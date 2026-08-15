import { createClient } from "@/lib/supabase/client";
import {
  gerarRemessaItauBoletos,
  gerarRemessaItauPix,
  gerarRemessaItauTransferencias,
  type BoletoCnab,
  type PixCnab,
  type TransferenciaCnab,
  type RemessaResultado,
} from "@/lib/cnab/itau-pagamento";
import {
  gerarRemessaBBTransferencias,
  gerarRemessaBBBoletos,
  type PagadorBB,
} from "@/lib/cnab/bb-pagamento";
import {
  gerarRemessaBradescoTransferencias,
  gerarRemessaBradescoBoletos,
  type PagadorBradesco,
} from "@/lib/cnab/bradesco-pagamento";
import {
  gerarRemessaSantanderTransferencias,
  gerarRemessaSantanderBoletos,
  type PagadorSantander,
} from "@/lib/cnab/santander-pagamento";
import {
  gerarRemessaSicoobTransferencias,
  gerarRemessaSicoobBoletos,
  type PagadorSicoob,
} from "@/lib/cnab/sicoob-pagamento";
import {
  gerarRemessaCaixaTransferencias,
  gerarRemessaCaixaBoletos,
  type PagadorCaixa,
} from "@/lib/cnab/caixa-pagamento";
import { bancoCnab, suportaPagamento, nomeBancoCnab } from "@/lib/cnab/registry";

export type ContaPagadora = {
  id: string;
  nome: string;
  banco_codigo: string | null;
  agencia: string | null;
  conta_numero: string | null;
  conta_dv: string | null;
  pagador_documento: string | null;
  pagador_nome: string | null;
  cnab_sequencial: number | null;
  convenio: string | null;
  convenio_pagamento: string | null;
  agencia_dv: string | null;
};

export type ItemParaRemessa = {
  id: string;
  valor: number;
  descricao: string;
  forma: "boleto" | "pix" | "ted";
  favorecido_nome: string;
  favorecido_doc: string;
  dataPagamento: string;
  linha_digitavel?: string;
  chave_pix?: string;
  fav_banco_codigo?: string | null;
  fav_agencia?: string | null;
  fav_conta?: string | null;
  fav_conta_dv?: string | null;
  fav_conta_tipo?: string | null;
  /**
   * `data_agendamento` que o lançamento já tinha antes desta remessa.
   *
   * Existe só para a reversão. O rollback zerava `data_agendamento` de todo o
   * lote, e quem chega aqui **já pode estar agendado** — o botão "Agendar" da
   * tela grava esta coluna, e a seleção não exclui agendados. Zerar apaga o
   * agendamento manual de todo mundo e a mensagem ainda dizia "nada foi
   * alterado".
   */
  prev_data_agendamento?: string | null;
};

const soDig = (s: string) => (s || "").replace(/\D/g, "");

// Mesma regra de validação do gerador antigo, por forma.
export function validarItem(i: ItemParaRemessa): { pronto: boolean; motivo: string | null } {
  const docOk = soDig(i.favorecido_doc).length === 11 || soDig(i.favorecido_doc).length === 14;
  if (i.forma === "ted") {
    const bancoOk = soDig(i.fav_banco_codigo || "").length === 3;
    const contaOk = Boolean(soDig(i.fav_agencia || "")) && Boolean(soDig(i.fav_conta || ""));
    if (!bancoOk) return { pronto: false, motivo: "Falta o banco do favorecido (Clientes e Fornecedores → Dados para pagamento)." };
    if (!contaOk) return { pronto: false, motivo: "Falta agência/conta do favorecido." };
    if (!docOk) return { pronto: false, motivo: "Falta o CNPJ/CPF do favorecido." };
    return { pronto: true, motivo: null };
  }
  if (i.forma === "pix") {
    const chaveOk = Boolean((i.chave_pix || "").trim());
    const chaveEhDoc = soDig(i.chave_pix || "").length === 11 || soDig(i.chave_pix || "").length === 14;
    if (!chaveOk) return { pronto: false, motivo: "Falta a chave Pix." };
    if (!(docOk || chaveEhDoc)) return { pronto: false, motivo: "Falta o CNPJ/CPF do favorecido." };
    return { pronto: true, motivo: null };
  }
  const linhaOk = soDig(i.linha_digitavel || "").length === 47;
  if (!linhaOk) return { pronto: false, motivo: "Linha digitável precisa ter 47 dígitos (boleto bancário)." };
  if (!docOk) return { pronto: false, motivo: "Falta o CNPJ/CPF do favorecido." };
  return { pronto: true, motivo: null };
}

function baixar(conteudo: string, nome: string) {
  const blob = new Blob([conteudo], { type: "text/plain;charset=us-ascii" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ResultadoGeracao = {
  gerados: number;
  valor: number;
  arquivos: string[];
  ignorados: { nome: string; motivo: string }[];
  /**
   * Lotes que **não** foram baixados porque a gravação falhou.
   *
   * Separado de `ignorados` de propósito: ignorado é item que não entrou por
   * dado incompleto, e o usuário resolve corrigindo o cadastro. Falha é o
   * sistema não ter conseguido registrar, e o usuário resolve tentando de novo.
   * Misturar os dois esconderia a diferença entre "faltou CPF" e "o banco não
   * respondeu".
   */
  falhas: string[];
};

/**
 * Gera as remessas Itaú a partir de uma seleção mista. Agrupa por forma
 * (Pix/boleto/TED viram arquivos separados — regra do banco), valida cada item,
 * baixa cada .REM, registra em cnab_remessas, marca os lançamentos como Agendados
 * (data_agendamento + remessa_id) e avança o sequencial da conta.
 */
export async function gerarRemessasDaSelecao(
  empresaId: string,
  conta: ContaPagadora,
  itens: ItemParaRemessa[],
): Promise<ResultadoGeracao> {
  // Só gera para bancos com layout de pagamento implementado (hoje, Itaú).
  if (!suportaPagamento(conta.banco_codigo)) {
    return {
      gerados: 0,
      valor: 0,
      arquivos: [],
      falhas: [],
      ignorados: [
        {
          nome: "—",
          motivo: `Remessa de pagamento CNAB ainda não disponível para o banco ${nomeBancoCnab(conta.banco_codigo)}. Hoje está disponível para Itaú, Banco do Brasil, Bradesco, Santander, Sicoob e Caixa. Você ainda pode pagar pelo internet banking copiando os dados.`,
        },
      ],
    };
  }
  const prefixoBanco = bancoCnab(conta.banco_codigo)?.prefixoArquivo ?? "CNAB";

  const pagador = {
    documento: conta.pagador_documento || "",
    nome: conta.pagador_nome || conta.nome,
    agencia: conta.agencia || "",
    contaNumero: conta.conta_numero || "",
    contaDv: conta.conta_dv,
  };

  // Banco do Brasil tem layout próprio e exige convênio; Pix não vai por remessa.
  // Em homologação o arquivo BB sai marcado como teste ('TS'). Trocar TESTE_BB para
  // false depois que o banco aprovar o arquivo.
  const ehBB = soDig(conta.banco_codigo || "") === "001";
  const TESTE_BB = true;
  const pagadorBB: PagadorBB = {
    documento: conta.pagador_documento || "",
    nome: conta.pagador_nome || conta.nome,
    agencia: conta.agencia || "",
    agenciaDv: conta.agencia_dv,
    contaNumero: conta.conta_numero || "",
    contaDv: conta.conta_dv,
    convenio: conta.convenio_pagamento || conta.convenio || "",
  };

  // Bradesco (Multipag) tem layout próprio e exige convênio; Pix fica para depois.
  const ehBradesco = soDig(conta.banco_codigo || "") === "237";
  const pagadorBradesco: PagadorBradesco = {
    documento: conta.pagador_documento || "",
    nome: conta.pagador_nome || conta.nome,
    agencia: conta.agencia || "",
    agenciaDv: conta.agencia_dv,
    contaNumero: conta.conta_numero || "",
    contaDv: conta.conta_dv,
    convenio: conta.convenio_pagamento || conta.convenio || "",
  };

  // Santander tem layout próprio (versões 060/031/030) e exige convênio.
  const ehSantander = soDig(conta.banco_codigo || "") === "033";
  const pagadorSantander: PagadorSantander = {
    documento: conta.pagador_documento || "",
    nome: conta.pagador_nome || conta.nome,
    agencia: conta.agencia || "",
    agenciaDv: conta.agencia_dv,
    contaNumero: conta.conta_numero || "",
    contaDv: conta.conta_dv,
    convenio: conta.convenio_pagamento || conta.convenio || "",
  };

  // Sicoob (FEBRABAN, versões 087/045/040); convênio = código do Sicoobnet Empresarial.
  const ehSicoob = soDig(conta.banco_codigo || "") === "756";
  const pagadorSicoob: PagadorSicoob = {
    documento: conta.pagador_documento || "",
    nome: conta.pagador_nome || conta.nome,
    agencia: conta.agencia || "",
    agenciaDv: conta.agencia_dv,
    contaNumero: conta.conta_numero || "",
    contaDv: conta.conta_dv,
    convenio: conta.convenio_pagamento || conta.convenio || "",
  };

  // Caixa (104) tem layout próprio (versões 080/041, densidade 01600). O convênio é o
  // código (6 díg) + tipo de compromisso (01 = pagamento a fornecedor) + nº do compromisso;
  // o campo `convenio` aceita só o código (6) ou as 12 posições. Pix QR Code fica para depois.
  const ehCaixa = soDig(conta.banco_codigo || "") === "104";
  const pagadorCaixa: PagadorCaixa = {
    documento: conta.pagador_documento || "",
    nome: conta.pagador_nome || conta.nome,
    agencia: conta.agencia || "",
    agenciaDv: conta.agencia_dv,
    contaNumero: conta.conta_numero || "",
    contaDv: conta.conta_dv,
    convenio: conta.convenio_pagamento || conta.convenio || "",
  };

  const ignorados: { nome: string; motivo: string }[] = [];
  const falhas: string[] = [];
  const prontosPorForma: Record<"boleto" | "pix" | "ted", ItemParaRemessa[]> = { boleto: [], pix: [], ted: [] };
  for (const i of itens) {
    const v = validarItem(i);
    if (v.pronto) prontosPorForma[i.forma].push(i);
    else ignorados.push({ nome: i.favorecido_nome || i.descricao, motivo: v.motivo || "Dados incompletos." });
  }

  const supabase = createClient();
  const hojeTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let seq = conta.cnab_sequencial ?? 0;
  let gerados = 0;
  let valor = 0;
  const arquivos: string[] = [];

  const grupos: { forma: "boleto" | "pix" | "ted"; tag: string }[] = [
    { forma: "boleto", tag: "BOLETOS" },
    { forma: "pix", tag: "PIX" },
    { forma: "ted", tag: "TED" },
  ];

  for (const g of grupos) {
    const lote = prontosPorForma[g.forma];
    if (lote.length === 0) continue;

    // O Banco do Brasil não aceita Pix por remessa CNAB.
    if (ehBB && g.forma === "pix") {
      for (const i of lote) {
        ignorados.push({
          nome: i.favorecido_nome || i.descricao,
          motivo: "O Banco do Brasil não aceita Pix por remessa CNAB. Pague o Pix pelo internet banking.",
        });
      }
      continue;
    }
    // O Bradesco aceita Pix por remessa, mas ainda não está implementado aqui.
    if (ehBradesco && g.forma === "pix") {
      for (const i of lote) {
        ignorados.push({
          nome: i.favorecido_nome || i.descricao,
          motivo: "Pix do Bradesco por remessa ainda não está disponível aqui. Pague o Pix pelo internet banking por enquanto.",
        });
      }
      continue;
    }
    // O Santander aceita Pix por remessa, mas ainda não está implementado aqui.
    if (ehSantander && g.forma === "pix") {
      for (const i of lote) {
        ignorados.push({
          nome: i.favorecido_nome || i.descricao,
          motivo: "Pix do Santander por remessa ainda não está disponível aqui. Pague o Pix pelo internet banking por enquanto.",
        });
      }
      continue;
    }
    // O Sicoob aceita Pix por remessa, mas ainda não está implementado aqui.
    if (ehSicoob && g.forma === "pix") {
      for (const i of lote) {
        ignorados.push({
          nome: i.favorecido_nome || i.descricao,
          motivo: "Pix do Sicoob por remessa ainda não está disponível aqui. Pague o Pix pelo internet banking por enquanto.",
        });
      }
      continue;
    }
    // A Caixa aceita Pix QR Code por remessa, mas ainda não está implementado aqui.
    if (ehCaixa && g.forma === "pix") {
      for (const i of lote) {
        ignorados.push({
          nome: i.favorecido_nome || i.descricao,
          motivo: "Pix da Caixa por remessa ainda não está disponível aqui. Pague o Pix pelo internet banking por enquanto.",
        });
      }
      continue;
    }
    seq += 1;

    const transferencias = () =>
      lote.map<TransferenciaCnab>((i) => ({
        bancoFavorecido: i.fav_banco_codigo || "",
        agenciaFavorecido: i.fav_agencia || "",
        contaFavorecido: i.fav_conta || "",
        contaDvFavorecido: i.fav_conta_dv,
        contaTipo: i.fav_conta_tipo,
        nomeFavorecido: i.favorecido_nome,
        docFavorecido: i.favorecido_doc,
        valor: i.valor,
        dataPagamento: i.dataPagamento,
        seuNumero: i.id.slice(0, 20),
      }));
    const boletos = () =>
      lote.map<BoletoCnab>((i) => ({
        linhaDigitavel: i.linha_digitavel || "",
        nomeFavorecido: i.favorecido_nome,
        docFavorecido: i.favorecido_doc,
        valor: i.valor,
        dataPagamento: i.dataPagamento,
        seuNumero: i.id.slice(0, 20),
      }));

    let res: RemessaResultado;
    if (g.forma === "ted") {
      res = ehCaixa
        ? gerarRemessaCaixaTransferencias({ pagador: pagadorCaixa, transferencias: transferencias() })
        : ehBradesco
        ? gerarRemessaBradescoTransferencias({ pagador: pagadorBradesco, transferencias: transferencias() })
        : ehSantander
        ? gerarRemessaSantanderTransferencias({ pagador: pagadorSantander, transferencias: transferencias() })
        : ehSicoob
        ? gerarRemessaSicoobTransferencias({ pagador: pagadorSicoob, transferencias: transferencias() })
        : ehBB
        ? gerarRemessaBBTransferencias({ pagador: pagadorBB, transferencias: transferencias(), teste: TESTE_BB })
        : gerarRemessaItauTransferencias({ pagador, transferencias: transferencias() });
    } else if (g.forma === "pix") {
      res = gerarRemessaItauPix({
        pagador,
        pix: lote.map<PixCnab>((i) => ({
          chavePix: i.chave_pix || "",
          nomeFavorecido: i.favorecido_nome,
          docFavorecido: i.favorecido_doc,
          valor: i.valor,
          dataPagamento: i.dataPagamento,
          seuNumero: i.id.slice(0, 20),
        })),
      });
    } else {
      res = ehCaixa
        ? gerarRemessaCaixaBoletos({ pagador: pagadorCaixa, boletos: boletos() })
        : ehBradesco
        ? gerarRemessaBradescoBoletos({ pagador: pagadorBradesco, boletos: boletos() })
        : ehSantander
        ? gerarRemessaSantanderBoletos({ pagador: pagadorSantander, boletos: boletos() })
        : ehSicoob
        ? gerarRemessaSicoobBoletos({ pagador: pagadorSicoob, boletos: boletos() })
        : ehBB
        ? gerarRemessaBBBoletos({ pagador: pagadorBB, boletos: boletos(), teste: TESTE_BB })
        : gerarRemessaItauBoletos({ pagador, boletos: boletos() });
    }

    /*
      Registra e marca ANTES de baixar — igual ao caminho do Itaú.

      Aqui era pior que lá, porque este é o laço multi-banco: um lote por conta,
      e cada volta baixava o arquivo primeiro. Com o erro do `insert` descartado
      na desestruturação e os `update` sem verificação, um lote podia sair para
      o banco sem registro **e** com os lançamentos ainda na lista "a fazer" —
      pagos agora e de novo na próxima remessa. O contador `gerados` incrementava
      fora de qualquer checagem, então o resumo devolvido ao usuário contava
      pagamentos que podiam não estar vinculados a remessa nenhuma.
    */
    const itensRemessa = lote.map((i) => ({
      lancamento_id: i.id,
      seu_numero: i.id.slice(0, 20).toUpperCase(),
      valor: i.valor,
    }));
    const nome = `${prefixoBanco}_${g.tag}_${String(seq).padStart(5, "0")}_${hojeTag}.REM`;
    const rem = await supabase
      .from("cnab_remessas")
      .insert({
        empresa_id: empresaId,
        conta_id: conta.id,
        banco_codigo: conta.banco_codigo || "341",
        tipo: "pagamento",
        sequencial: seq,
        quantidade: res.quantidade,
        valor_total: res.valorTotal,
        itens: itensRemessa,
        /*
          O conteúdo vai junto — as remessas de pagamento não guardavam.

          Arquivos bancários oferece "Baixar" para toda remessa e, quando não
          acha `conteudo`, diz "foi gerada antes do histórico". Para pagamento
          isso era falso em 100% dos casos: nunca foi gravado. E este é o
          caminho em que rebaixar importa mais, porque gerar de novo consome
          outro sequencial e cria uma segunda remessa para os mesmos títulos.
        */
        arquivo_nome: nome,
        conteudo: res.conteudo,
      })
      .select("id")
      .single();
    if (rem.error || !rem.data) {
      falhas.push(`${g.tag}: não foi possível registrar a remessa (${rem.error?.message ?? ""}) — nada foi baixado.`);
      continue;
    }
    const remessaId = (rem.data as { id: string }).id;

    const marcados = await Promise.all(
      lote.map((i) =>
        supabase
          .from("lancamentos")
          .update({ data_agendamento: i.dataPagamento, remessa_id: remessaId })
          .eq("id", i.id),
      ),
    );
    const naoMarcados = marcados.filter((r) => r.error).length;
    if (naoMarcados > 0) {
      /*
        Marcação parcial precisa ser desfeita, não só reportada.

        `Promise.all` marca N lançamentos independentes. Se três de dez falham,
        os outros sete ficam com `data_agendamento` e `remessa_id` preenchidos —
        ou seja, saem da lista "a pagar" e vão para "Agendadas", apontando para
        uma remessa cujo arquivo **não foi baixado**. Ninguém paga esses sete, e
        eles não voltam para lugar nenhum: some dinheiro a pagar da tela, sem
        erro, sem fila, sem aviso. Parar o download não basta.
      */
      const desmarcados = await Promise.all(
        lote.map((i) =>
          supabase
            .from("lancamentos")
            // volta ao valor de antes, não a `null`; e só nas linhas que esta
            // remessa realmente carimbou, para não mexer em quem já tinha
            // `remessa_id` de um arquivo entregue ao banco
            .update({ data_agendamento: i.prev_data_agendamento ?? null, remessa_id: null })
            .eq("id", i.id)
            .eq("remessa_id", remessaId),
        ),
      );
      const presos = desmarcados.filter((r) => r.error).length;
      const remApagada = await supabase.from("cnab_remessas").delete().eq("id", remessaId);
      const sobrouRegistro = remApagada.error ? " O registro desta remessa continua no histórico de Arquivos bancários, sem arquivo válido." : "";
      falhas.push(
        (presos > 0
          ? `${g.tag}: ${naoMarcados} de ${lote.length} pagamento(s) não foram agendados e ${presos} não voltaram para a lista — arquivo NÃO baixado. Confira em Agendamentos os que ficaram presos antes de gerar de novo.`
          : `${g.tag}: ${naoMarcados} de ${lote.length} pagamento(s) não foram marcados como agendados — arquivo NÃO baixado e nada foi alterado. Tente de novo.`) + sobrouRegistro,
      );
      continue;
    }

    baixar(res.conteudo, nome);
    arquivos.push(nome);

    gerados += res.quantidade;
    valor += res.valorTotal;
  }

  if (gerados > 0) {
    const seqOk = await supabase.from("contas_bancarias").update({ cnab_sequencial: seq }).eq("id", conta.id);
    if (seqOk.error) {
      falhas.push(
        "O sequencial da conta não foi atualizado — confira em Configurações → CNAB antes da próxima remessa.",
      );
    }
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
  }

  return { gerados, valor, arquivos, ignorados, falhas };
}
