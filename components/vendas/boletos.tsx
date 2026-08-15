"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Receipt, AlertTriangle, FileDown, FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { montarCodigoBarras, linhaDigitavel } from "@/lib/boleto/febraban";
import { montarTitulo, BANCOS_COBRANCA } from "@/lib/boleto/bancos";
import { gerarRemessaCobranca } from "@/lib/cnab/cobranca240";
import { reservarSequencialCobranca } from "@/lib/cnab/sequencial-cobranca";
import { parseRetornoCobranca, casaNossoNumero, MOVIMENTOS_COBRANCA } from "@/lib/cnab/cobranca-retorno";
import type { Venda, VendaParcela } from "@/components/vendas/vendas-avulsas";
import CentralBoletos from "@/components/vendas/central-boletos";
import type { NfseRow } from "@/components/vendas/notas-fiscais";
import { brl, dataBR } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

export type ContaCobranca = {
  id: string;
  nome: string;
  banco_codigo: string | null;
  agencia: string | null;
  agencia_dv: string | null;
  conta_numero: string | null;
  conta_dv: string | null;
  convenio: string | null;
  carteira: string | null;
  juros_mes_pct?: number | null;
  multa_pct?: number | null;
};

/** projeção mínima de `cobranca_titulos`: só os quatro vínculos possíveis */
export type Vinculo = {
  venda_parcela_id: string | null;
  contrato_faturamento_id: string | null;
  lancamento_id: string | null;
  nfse_id: string | null;
  /** o status entra na projeção: sem ele, título rejeitado nunca volta à fila */
  status: string;
};

export type TituloRow = {
  id: string;
  token_publico: string | null;
  conta_id: string;
  origem: string;
  venda_parcela_id: string | null;
  contrato_faturamento_id: string | null;
  lancamento_id: string | null;
  nfse_id: string | null;
  cliente_fornecedor_id: string | null;
  nosso_numero: number;
  nosso_numero_fmt: string | null;
  numero_documento: string | null;
  valor: number;
  vencimento: string;
  sacado_nome: string | null;
  sacado_documento: string | null;
  sacado_logradouro: string | null;
  sacado_cep: string | null;
  sacado_municipio: string | null;
  sacado_uf: string | null;
  status: string;
  criado_em: string;
};

export type FatBoletoPendente = {
  id: string;
  contrato_id: string;
  competencia: string;
  valor: number;
  lancamento_id: string | null;
  contrato: { nome: string | null; cliente_fornecedor_id: string } | null;
  lancamento: { data_vencimento: string } | null;
};

export type LancamentoReceber = {
  id: string;
  valor: number;
  data_vencimento: string;
  cliente_fornecedor_id: string | null;
  numero_documento: string | null;
  descricao: string | null;
};

type Cliente = {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  municipio: string | null;
  uf?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  codigo_ibge: string | null;
};

// vencimento padrão do boleto de NF-e: emissão (ou hoje) + 7 dias, em ISO (YYYY-MM-DD).
function vencimentoNota(base: string | null): string {
  const d = base ? new Date(base) : new Date();
  if (Number.isNaN(d.getTime())) d.setTime(Date.now());
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

// O que falta numa conta para cobrança, conforme o banco.
function faltasConta(c: ContaCobranca): string[] {
  const f: string[] = [];
  const cod = (c.banco_codigo ?? "").padStart(3, "0");
  if (!BANCOS_COBRANCA[cod]) {
    f.push("banco sem suporte de cobrança");
    return f;
  }
  if (!c.agencia) f.push("agência");
  if (!c.conta_numero) f.push("conta");
  if (!c.carteira) f.push("carteira");
  if (["001", "033", "104", "756"].includes(cod) && !c.convenio) f.push("convênio/código do beneficiário");
  return f;
}

export default function Boletos({
  empresaId,
  vendas,
  vendaParcelas,
  fatsBoleto,
  lancamentosReceber,
  notas,
  titulos: titulosInitial,
  vinculos: vinculosInitial,
  vinculosNoTeto,
  contas,
  clientes,
}: {
  empresaId: string;
  vendas: Venda[];
  vendaParcelas: VendaParcela[];
  fatsBoleto: FatBoletoPendente[];
  lancamentosReceber: LancamentoReceber[];
  notas: NfseRow[];
  titulos: TituloRow[];
  /** vínculos de TODOS os títulos, projeção mínima — decide o que já foi cobrado */
  vinculos: Vinculo[];
  /** a varredura de vínculos bateu no teto: não dá para saber o que já foi cobrado */
  vinculosNoTeto: boolean;
  contas: ContaCobranca[];
  clientes: Cliente[];
}) {
  const router = useRouter();
  const [titulos, setTitulos] = useState<TituloRow[]>(titulosInitial);
  /*
    Espelho local dos vínculos, para a fila encolher sem recarregar a página.
    Gerar um boleto acrescenta o vínculo aqui; excluir um título tira.
  */
  const [vinculos, setVinculos] = useState<Vinculo[]>(vinculosInitial);
  /*
    Ressincroniza quando o servidor manda dado novo.

    O espelho local existe para a fila encolher sem recarregar a página, mas
    `useState(inicial)` congela no primeiro render: depois de um `router.refresh()`
    — ou com duas abas abertas, ou um colega gerando boletos ao lado — esta aba
    continuaria oferecendo itens já cobrados. É a mesma duplicação que o teto de
    200 causava, só que por sessão em vez de por volume.
  */
  useEffect(() => {
    setVinculos(vinculosInitial);
  }, [vinculosInitial]);
  const [reloadBoletos, setReloadBoletos] = useState(0);
  const [contaId, setContaId] = useState(contas.length === 1 ? contas[0].id : "");
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const clienteMap = useMemo(() => {
    const m = new Map<string, Cliente>();
    clientes.forEach((c) => m.set(c.id, c));
    return m;
  }, [clientes]);
  const vendaMap = useMemo(() => {
    const m = new Map<string, Venda>();
    vendas.forEach((v) => m.set(v.id, v));
    return m;
  }, [vendas]);

  /*
    "Já tem título?" sai de `vinculos`, e não de `titulos`.

    `titulos` tem teto de 200 e é a lista que a Central mostra. Perguntar a ela
    o que já foi cobrado fazia com que, passando de 200 títulos, os itens mais
    antigos saíssem da lista carregada e **voltassem para a fila "A gerar"** —
    o sistema oferecia emitir boleto para uma parcela que já tinha boleto, e um
    clique em "Gerar N boleto(s)" mandava cobrança duplicada para o cliente.

    `vinculos` traz os vínculos de todos os títulos, em quatro colunas de id.
    O `status` entra na projeção junto. Sem ele, título rejeitado pelo banco
    contaria como "já existe" e o item nunca voltaria para a fila — e não há
    caminho na interface para refazer: o botão de excluir só aparece em status
    `gerado`, e um título rejeitado está em `erro`. Ficaria irrecuperável.
  */
  const ativos = useMemo(() => vinculos.filter((v) => v.status !== "erro"), [vinculos]);
  const parcelasComTitulo = useMemo(
    () => new Set(ativos.map((t) => t.venda_parcela_id).filter(Boolean)),
    [ativos],
  );
  const fatsComTitulo = useMemo(
    () => new Set(ativos.map((t) => t.contrato_faturamento_id).filter(Boolean)),
    [ativos],
  );

  // fila: parcelas de vendas com boleto pendente + faturamentos pendentes
  const filaParcelas = useMemo(() => {
    const out: { parcela: VendaParcela; venda: Venda }[] = [];
    for (const p of vendaParcelas) {
      const v = vendaMap.get(p.venda_id);
      if (!v || v.status === "cancelada" || !v.gera_boleto || v.boleto_status !== "pendente") continue;
      if (parcelasComTitulo.has(p.id)) continue;
      out.push({ parcela: p, venda: v });
    }
    return out.sort((a, b) => a.parcela.vencimento.localeCompare(b.parcela.vencimento));
  }, [vendaParcelas, vendaMap, parcelasComTitulo]);

  const filaFats = useMemo(
    () => fatsBoleto.filter((f) => !fatsComTitulo.has(f.id)),
    [fatsBoleto, fatsComTitulo],
  );

  // lançamentos já representados por uma parcela/faturamento (evita duplicar a
  // mesma conta a receber) ou que já têm título.
  const lancVinculados = useMemo(() => {
    const s = new Set<string>();
    vendaParcelas.forEach((p) => p.lancamento_id && s.add(p.lancamento_id));
    fatsBoleto.forEach((f) => f.lancamento_id && s.add(f.lancamento_id));
    return s;
  }, [vendaParcelas, fatsBoleto]);
  const lancComTitulo = useMemo(
    () => new Set(ativos.map((t) => t.lancamento_id).filter(Boolean)),
    [ativos],
  );

  // fila: lançamentos avulsos a receber, em aberto, sem vínculo nem título.
  const filaLancamentos = useMemo(
    () =>
      lancamentosReceber.filter(
        (l) => l.cliente_fornecedor_id && !lancVinculados.has(l.id) && !lancComTitulo.has(l.id),
      ),
    [lancamentosReceber, lancVinculados, lancComTitulo],
  );

  // notas que já têm título de cobrança ativo (rejeitado não conta — ver `ativos`)
  const notasComTitulo = useMemo(
    () => new Set(ativos.map((t) => t.nfse_id).filter(Boolean)),
    [ativos],
  );

  // fila: NF-e emitidas que precisam de cobrança própria — avulsas, ou de venda que
  // NÃO gera boleto sozinha. Notas de contrato/faturamento já são cobradas por ali.
  const filaNotas = useMemo(
    () =>
      notas.filter((n) => {
        if (n.status !== "emitida") return false;
        if (!n.cliente_fornecedor_id) return false;
        if (notasComTitulo.has(n.id)) return false;
        if (n.contrato_faturamento_id) return false;
        if (n.venda_id) {
          const v = vendaMap.get(n.venda_id);
          if (v?.gera_boleto) return false; // a venda já emite o próprio boleto
        }
        return true;
      }),
    [notas, notasComTitulo, vendaMap],
  );

  const conta = contas.find((c) => c.id === contaId) ?? null;
  const faltas = conta ? faltasConta(conta) : [];
  const contaPronta = !!conta && faltas.length === 0;
  const bancoInfo = conta ? BANCOS_COBRANCA[(conta.banco_codigo ?? "").padStart(3, "0")] : null;

  async function gerarTodos() {
    if (!conta || !contaPronta) {
      setMsg({ tipo: "erro", texto: "Escolha uma conta com os dados de cobrança completos." });
      return;
    }
    /*
      Se a varredura de vínculos bateu no teto, a fila não é confiável: pode
      conter item que já tem boleto e cuja ligação ficou de fora. Gerar assim
      seria cobrar o cliente duas vezes. Entre não emitir e emitir errado, não
      emitir é o único desfecho recuperável.
    */
    if (vinculosNoTeto) {
      setMsg({
        tipo: "erro",
        texto:
          "Não deu para conferir com segurança o que já foi cobrado nesta empresa. A geração está desligada para não emitir boleto duplicado — recarregue a página; se continuar, avise o suporte.",
      });
      return;
    }
    setGerando(true);
    setMsg(null);
    const supabase = createClient();
    let ok = 0;
    let falhas = 0;
    const novos: TituloRow[] = [];
    const vendasCompletas = new Map<string, number>(); // venda_id -> parcelas restantes

    const itens: {
      origem: "venda_parcela" | "contrato_faturamento" | "lancamento" | "nfse";
      chaveId: string;
      vendaId?: string;
      fatId?: string;
      lancamentoId: string | null;
      nfseId?: string | null;
      clienteId: string;
      valor: number;
      vencimento: string;
      doc: string;
    }[] = [
      ...filaParcelas.map(({ parcela, venda }) => ({
        origem: "venda_parcela" as const,
        chaveId: parcela.id,
        vendaId: venda.id,
        lancamentoId: parcela.lancamento_id,
        clienteId: venda.cliente_fornecedor_id,
        valor: parcela.valor,
        vencimento: parcela.vencimento,
        doc: `${venda.id.slice(0, 6).toUpperCase()}-${parcela.numero}`,
      })),
      ...filaFats.map((f) => ({
        origem: "contrato_faturamento" as const,
        chaveId: f.id,
        fatId: f.id,
        lancamentoId: f.lancamento_id,
        clienteId: f.contrato?.cliente_fornecedor_id ?? "",
        valor: f.valor,
        vencimento: f.lancamento?.data_vencimento ?? f.competencia,
        doc: `CT-${f.id.slice(0, 6).toUpperCase()}`,
      })),
      ...filaLancamentos.map((l) => ({
        origem: "lancamento" as const,
        chaveId: l.id,
        lancamentoId: l.id,
        clienteId: l.cliente_fornecedor_id ?? "",
        valor: l.valor,
        vencimento: l.data_vencimento,
        doc: l.numero_documento || `LC-${l.id.slice(0, 6).toUpperCase()}`,
      })),
      ...filaNotas.map((n) => ({
        origem: "nfse" as const,
        chaveId: n.id,
        lancamentoId: null,
        nfseId: n.id,
        clienteId: n.cliente_fornecedor_id ?? "",
        valor: n.valor_servico,
        vencimento: vencimentoNota(n.emitida_em),
        doc: n.nfse_numero ? `NF ${n.nfse_numero}` : `NF-${n.id.slice(0, 6).toUpperCase()}`,
      })),
    ];

    /*
      Três causas diferentes de "pulado", contadas separado.

      A mensagem final dizia sempre "confira CPF/CNPJ do cliente", mesmo quando
      o motivo era o banco recusar a reserva do nosso número ou o insert falhar
      — e quem lesse iria conferir cadastro de cliente atrás de um problema que
      não estava lá.
    */
    let semDoc = 0;
    let erroBanco = 0;
    /** título gerado mas o item não foi marcado: risco de emitir de novo */
    let naoMarcados = 0;
    for (const item of itens) {
      const cli = clienteMap.get(item.clienteId);
      if (!cli || !cli.cpf_cnpj) {
        falhas++;
        semDoc++;
        continue;
      }
      // 1) reserva atômica do nosso número
      const { data: nn, error: errNN } = await supabase.rpc("next_nosso_numero", { p_conta: conta.id });
      if (errNN || nn == null) {
        falhas++;
        erroBanco++;
        continue;
      }
      // 2) monta o boleto
      let linha = "";
      let barras = "";
      let nnFmt = "";
      try {
        const t = montarTitulo({
          bancoCodigo: conta.banco_codigo ?? "",
          agencia: conta.agencia ?? "",
          agenciaDv: conta.agencia_dv,
          conta: conta.conta_numero ?? "",
          contaDv: conta.conta_dv,
          convenio: conta.convenio,
          carteira: conta.carteira ?? "",
          nossoNumero: Number(nn),
        });
        barras = montarCodigoBarras(conta.banco_codigo ?? "", item.vencimento, item.valor, t.campoLivre);
        linha = linhaDigitavel(barras);
        nnFmt = t.nossoNumeroFmt;
      } catch {
        falhas++;
        continue;
      }
      // 3) grava o título com snapshot do sacado
      const tokenPublico = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      const { data: ins, error: errIns } = await supabase
        .from("cobranca_titulos")
        .insert({
          empresa_id: empresaId,
          token_publico: tokenPublico,
          conta_id: conta.id,
          origem: item.origem,
          venda_parcela_id: item.origem === "venda_parcela" ? item.chaveId : null,
          contrato_faturamento_id: item.origem === "contrato_faturamento" ? item.chaveId : null,
          lancamento_id: item.lancamentoId,
          nfse_id: item.nfseId ?? null,
          cliente_fornecedor_id: item.clienteId,
          nosso_numero: Number(nn),
          nosso_numero_fmt: nnFmt,
          numero_documento: item.doc,
          valor: item.valor,
          vencimento: item.vencimento,
          sacado_nome: cli.nome,
          sacado_documento: cli.cpf_cnpj,
          sacado_logradouro: cli.logradouro ?? null,
          sacado_cep: cli.cep ?? null,
          sacado_municipio: cli.municipio ?? null,
          sacado_uf: cli.uf ?? null,
          linha_digitavel: linha,
          codigo_barras: barras,
          status: "gerado",
        })
        .select()
        .single();
      if (errIns || !ins) {
        falhas++;
        erroBanco++;
        continue;
      }
      novos.push(ins as TituloRow);
      ok++;
      if (item.origem === "venda_parcela" && item.vendaId) {
        vendasCompletas.set(item.vendaId, (vendasCompletas.get(item.vendaId) ?? 0) + 1);
      }
      if (item.origem === "contrato_faturamento" && item.fatId) {
        /*
          O título já existe aqui. Se a marcação falhar em silêncio, o
          faturamento continua "pendente" e a próxima geração emite **um segundo
          boleto para a mesma parcela**.
        */
        const mb = await supabase.from("contrato_faturamentos").update({ boleto_status: "emitido" }).eq("id", item.fatId);
        if (mb.error) naoMarcados++;
      }
    }

    // marca vendas cujas parcelas pendentes foram todas cobertas
    const idsVendas = Array.from(vendasCompletas.keys());
    for (const vendaId of idsVendas) {
      const pendentesRestantes = filaParcelas.filter(
        ({ venda, parcela }) => venda.id === vendaId && !novos.some((n) => n.venda_parcela_id === parcela.id),
      ).length;
      if (pendentesRestantes === 0) {
        await supabase.from("vendas").update({ boleto_status: "emitido" }).eq("id", vendaId);
      }
    }

    setTitulos((l) => [...novos, ...l]);
    // o vínculo entra junto: sem isto o item recém-cobrado continua na fila até
    // a página recarregar, e um segundo clique manda o boleto de novo
    setVinculos((l) => [
      ...novos.map((t) => ({
        venda_parcela_id: t.venda_parcela_id ?? null,
        contrato_faturamento_id: t.contrato_faturamento_id ?? null,
        lancamento_id: t.lancamento_id ?? null,
        nfse_id: t.nfse_id ?? null,
        status: t.status ?? "gerado",
      })),
      ...l,
    ]);
    setReloadBoletos((x) => x + 1);
    setGerando(false);
    const motivos = [
      semDoc > 0 ? `${semDoc} sem CPF/CNPJ do cliente` : "",
      erroBanco > 0 ? `${erroBanco} por falha ao gravar — tente de novo` : "",
    ].filter(Boolean).join("; ");
    const avisoMarca =
      naoMarcados > 0
        ? ` ATENÇÃO: ${naoMarcados} boleto(s) foram gerados mas o item não foi marcado como cobrado — NÃO gere de novo antes de conferir, há risco de emitir duas vezes.`
        : "";
    setMsg({
      tipo: falhas > 0 || naoMarcados > 0 ? "erro" : "ok",
      texto: `${ok} boleto(s) gerado(s).${falhas > 0 ? ` ${falhas} item(ns) pulado(s): ${motivos}.` : ""}${avisoMarca}`,
    });
    router.refresh();
  }

  async function copiarLinkPublico(t: TituloRow) {
    let token = t.token_publico;
    if (!token) {
      // título criado antes do link público: gera o token agora
      token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      const supabase = createClient();
      const { error } = await supabase.from("cobranca_titulos").update({ token_publico: token }).eq("id", t.id);
      if (error) {
        setMsg({ tipo: "erro", texto: "Não foi possível gerar o link público deste boleto. Tente de novo; se persistir, avise o suporte." });
        return;
      }
      t.token_publico = token;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/b/${token}`);
      setMsg({ tipo: "ok", texto: `Link público copiado — ${t.sacado_nome ?? "cliente"} abre sem login.` });
    } catch {
      setMsg({ tipo: "erro", texto: `Copie manualmente: ${window.location.origin}/b/${token}` });
    }
  }

  async function excluirTitulo(t: TituloRow) {
    if (t.status !== "gerado") {
      setMsg({ tipo: "erro", texto: "Só é possível excluir boletos ainda não enviados em remessa." });
      return;
    }
    if (!confirm(`Excluir o boleto ${t.nosso_numero_fmt ?? t.nosso_numero}? O item volta para a fila.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("cobranca_titulos").delete().eq("id", t.id);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return;
    }
    if (t.venda_parcela_id) {
      // reabre a pendência na venda
      const parcela = vendaParcelas.find((p) => p.id === t.venda_parcela_id);
      // reabrir a pendência é o que a confirmação prometeu ("o item volta para a
      // fila"); sem verificar, a venda fica sem cobrança e ninguém percebe
      if (parcela) {
        const rv = await supabase.from("vendas").update({ boleto_status: "pendente" }).eq("id", parcela.venda_id);
        if (rv.error) setMsg({ tipo: "erro", texto: `Boleto excluído, mas a venda não voltou para a fila: ${rv.error.message}` });
      }
    }
    if (t.contrato_faturamento_id) {
      const rf = await supabase.from("contrato_faturamentos").update({ boleto_status: "pendente" }).eq("id", t.contrato_faturamento_id);
      if (rf.error) setMsg({ tipo: "erro", texto: `Boleto excluído, mas o contrato não voltou para a fila: ${rf.error.message}` });
    }
    setTitulos((l) => l.filter((x) => x.id !== t.id));
    // tira o vínculo junto, senão o item excluído não volta para a fila — que é
    // exatamente o que a confirmação prometeu ("O item volta para a fila")
    setVinculos((l) =>
      l.filter(
        (v) =>
          !(
            (t.venda_parcela_id && v.venda_parcela_id === t.venda_parcela_id) ||
            (t.contrato_faturamento_id && v.contrato_faturamento_id === t.contrato_faturamento_id) ||
            (t.lancamento_id && v.lancamento_id === t.lancamento_id) ||
            (t.nfse_id && v.nfse_id === t.nfse_id)
          ),
      ),
    );
    setReloadBoletos((x) => x + 1);
    router.refresh();
  }

  const totalFila = filaParcelas.length + filaFats.length + filaLancamentos.length + filaNotas.length;

  // ---- remessa de registro e retorno ----
  const titulosParaRemessa = useMemo(
    () => titulos.filter((t) => t.status === "gerado" && (!contaId || t.conta_id === contaId)),
    [titulos, contaId],
  );
  const [gerandoRemessa, setGerandoRemessa] = useState(false);
  const [processandoRet, setProcessandoRet] = useState(false);

  async function gerarRemessa() {
    if (!conta || !contaPronta) {
      setMsg({ tipo: "erro", texto: "Escolha a conta de cobrança para a remessa." });
      return;
    }
    const lote = titulos.filter((t) => t.status === "gerado" && t.conta_id === conta.id);
    if (lote.length === 0) {
      setMsg({ tipo: "erro", texto: "Nenhum boleto gerado aguardando remessa nesta conta." });
      return;
    }
    setGerandoRemessa(true);
    setMsg(null);
    const supabase = createClient();
    // dados do cedente (empresa)
    const { data: emp } = await supabase.from("empresas").select("nome, razao_social, cnpj_cpf").eq("id", empresaId).maybeSingle();
    const { seq, aviso: avisoSeq } = await reservarSequencialCobranca(supabase, conta.id);
    let arquivo;
    try {
      arquivo = gerarRemessaCobranca({
        conta: {
          banco_codigo: conta.banco_codigo ?? "",
          agencia: conta.agencia ?? "",
          agencia_dv: conta.agencia_dv,
          conta_numero: conta.conta_numero ?? "",
          conta_dv: conta.conta_dv,
          convenio: conta.convenio,
          carteira: conta.carteira,
          juros_mes_pct: conta.juros_mes_pct,
          multa_pct: conta.multa_pct,
        },
        cedenteNome: emp?.razao_social || emp?.nome || "",
        cedenteDocumento: (emp?.cnpj_cpf ?? "").replace(/\D/g, ""),
        titulos: lote.map((t) => ({
          id: t.id,
          nosso_numero: t.nosso_numero,
          numero_documento: t.numero_documento,
          valor: t.valor,
          vencimento: t.vencimento,
          sacado_nome: t.sacado_nome,
          sacado_documento: t.sacado_documento,
          sacado_logradouro: t.sacado_logradouro,
          sacado_cep: t.sacado_cep,
          sacado_municipio: t.sacado_municipio,
          sacado_uf: t.sacado_uf,
        })),
        sequencialArquivo: seq,
      });
    } catch (e) {
      setGerandoRemessa(false);
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao montar a remessa." });
      return;
    }
    // registra a remessa e marca os títulos
    const rem = await supabase
      .from("cnab_remessas")
      .insert({
        empresa_id: empresaId,
        conta_id: conta.id,
        banco_codigo: conta.banco_codigo,
        tipo: "cobranca",
        sequencial: seq,
        quantidade: arquivo.quantidadeTitulos,
        valor_total: arquivo.valorTotal,
        arquivo_nome: arquivo.nomeArquivo,
        conteudo: arquivo.conteudo,
        itens: lote.map((t) => ({ titulo_id: t.id, nosso_numero: t.nosso_numero, valor: t.valor })),
      })
      .select("id")
      .single();
    /*
      Sem registro da remessa, o arquivo NÃO é baixado.

      O erro deste insert era descartado (`const { data: rem }`): quando ele
      falhava, `remessaId` ficava nulo, os títulos eram marcados `em_remessa`
      assim mesmo e o arquivo era baixado. O lote seguia para o banco sem
      nenhum histórico — e sem volta, porque o botão de excluir título só
      existe em status `gerado`. O sequencial da conta, que já foi consumido,
      também não voltaria.

      Parar aqui deixa os títulos em `gerado` e o sequencial com um buraco. O
      buraco é aceito pelos bancos; cobrança fantasma não é.
    */
    if (rem.error || !rem.data) {
      setGerandoRemessa(false);
      setMsg({
        tipo: "erro",
        texto: `Não foi possível registrar a remessa — nada foi enviado. ${rem.error?.message ?? ""}`,
      });
      return;
    }
    const remessaId = (rem.data as { id: string }).id;
    const marcou = await supabase
      .from("cobranca_titulos")
      .update({ status: "em_remessa", remessa_id: remessaId })
      .in("id", lote.map((t) => t.id));
    if (marcou.error) {
      setGerandoRemessa(false);
      setMsg({
        tipo: "erro",
        texto: `A remessa foi registrada mas os títulos não mudaram de status — não baixe o arquivo, recarregue e tente de novo. ${marcou.error.message}`,
      });
      return;
    }
    setTitulos((l) => l.map((t) => (lote.some((x) => x.id === t.id) ? { ...t, status: "em_remessa" } : t)));
    setReloadBoletos((x) => x + 1);
    // download
    const blob = new Blob([arquivo.conteudo], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = arquivo.nomeArquivo;
    a.click();
    URL.revokeObjectURL(a.href);
    setGerandoRemessa(false);
    setMsg({
      // o arquivo saiu e está correto; o aviso é sobre o PRÓXIMO, então a
      // mensagem continua confirmando a remessa e emenda o alerta
      tipo: avisoSeq ? "erro" : "ok",
      texto: `Remessa ${arquivo.nomeArquivo} gerada com ${arquivo.quantidadeTitulos} título(s) — envie ao banco.${avisoSeq ? " " + avisoSeq : ""}`,
    });
    router.refresh();
  }

  async function processarRetorno(file: File) {
    setProcessandoRet(true);
    setMsg(null);
    const texto = await file.text();
    const { itens: eventos, ehRetornoCobranca } = parseRetornoCobranca(texto);
    if (!ehRetornoCobranca || eventos.length === 0) {
      setProcessandoRet(false);
      setMsg({ tipo: "erro", texto: "Este arquivo não parece um retorno de cobrança (lote serviço 01) ou está vazio." });
      return;
    }
    const supabase = createClient();
    const { data: abertos } = await supabase
      .from("cobranca_titulos")
      .select("id, nosso_numero, numero_documento, lancamento_id, status")
      .eq("empresa_id", empresaId)
      /*
        `liquidado` entra na lista de propósito.

        Sem ele, um título já liquidado numa passada anterior não é encontrado no
        reprocessamento — e é exatamente o caso que precisa do reprocessamento:
        quando o título foi marcado liquidado mas a baixa no lançamento falhou, a
        Central diz "pago" e o contas a receber continua cobrando. Reprocessar o
        arquivo era a saída que a mensagem prometia, e ela não existia.
      */
      .in("status", ["gerado", "em_remessa", "registrado", "erro", "liquidado"]);
    const lista = (abertos ?? []) as { id: string; nosso_numero: number; numero_documento: string | null; lancamento_id: string | null; status: string }[];
    let registrados = 0;
    let liquidados = 0;
    let baixados = 0;
    let rejeitados = 0;
    let semPar = 0;
    /*
      Falha de gravação passa a ser contada, e não engolida.

      Nenhum dos `update` deste laço tinha o erro conferido: os contadores
      subiam de qualquer jeito e a mensagem final anunciava sucesso. Um arquivo
      processado pela metade deixava metade dos títulos atualizados — e, como a
      baixa automática no contas a receber acontece aqui, também metade dos
      recebimentos dados como pagos — sem que ninguém soubesse qual metade.
      Reprocessar o mesmo arquivo é seguro (os updates são idempotentes), então
      o certo é dizer quantos falharam e pedir para rodar de novo.
    */
    let falhas = 0;
    const conferir = (erro: { message: string } | null) => {
      if (erro) falhas++;
      return !erro;
    };
    for (const ev of eventos) {
      const titulo = lista.find(
        (t) =>
          (ev.seuNumero && t.numero_documento && ev.seuNumero === t.numero_documento) ||
          casaNossoNumero(ev.nossoNumeroDigitos, t.nosso_numero),
      );
      if (!titulo) {
        semPar++;
        continue;
      }
      if (ev.movimento === "02") {
        const r = await supabase.from("cobranca_titulos").update({ status: "registrado", motivo_erro: null }).eq("id", titulo.id);
        if (conferir(r.error)) registrados++;
      } else if (ev.movimento === "06" || ev.movimento === "17") {
        const r = await supabase
          .from("cobranca_titulos")
          .update({ status: "liquidado", valor_pago: ev.valorPago || null, liquidado_em: ev.dataOcorrencia })
          .eq("id", titulo.id);
        if (!conferir(r.error)) continue;
        if (titulo.lancamento_id && ev.dataOcorrencia) {
          // baixa automática no contas a receber
          const b = await supabase.from("lancamentos").update({ data_pagamento: ev.dataOcorrencia }).eq("id", titulo.lancamento_id);
          // título liquidado sem a baixa é pior que nenhum dos dois: a Central
          // diz "pago" e o contas a receber continua cobrando
          if (!conferir(b.error)) continue;
        }
        liquidados++;
      } else if (ev.movimento === "09") {
        const r = await supabase.from("cobranca_titulos").update({ status: "baixado" }).eq("id", titulo.id);
        if (conferir(r.error)) baixados++;
      } else if (["03", "26", "30"].includes(ev.movimento)) {
        const motivo = `${MOVIMENTOS_COBRANCA[ev.movimento] ?? "Rejeitado"}${ev.motivos.length ? ` (motivos ${ev.motivos.join(", ")})` : ""}`;
        const r = await supabase.from("cobranca_titulos").update({ status: "erro", motivo_erro: motivo }).eq("id", titulo.id);
        if (conferir(r.error)) rejeitados++;
      }
    }
    setProcessandoRet(false);
    setMsg({
      tipo: rejeitados > 0 || falhas > 0 ? "erro" : "ok",
      texto:
        `Retorno processado: ${registrados} registrado(s), ${liquidados} liquidado(s) com baixa no financeiro, ` +
        `${baixados} baixado(s), ${rejeitados} rejeitado(s)` +
        (semPar > 0 ? `, ${semPar} sem correspondência` : "") +
        (falhas > 0
          ? `. ATENÇÃO: ${falhas} atualização(ões) falharam — parte pode ter sido aplicada. Processe o mesmo arquivo de novo: o que já foi gravado é reescrito com o mesmo valor e o que faltou é concluído.`
          : "."),
    });
    // recarrega títulos do servidor
    const { data: atualizados } = await supabase
      .from("cobranca_titulos")
      .select(
        "id, conta_id, origem, venda_parcela_id, contrato_faturamento_id, lancamento_id, nfse_id, cliente_fornecedor_id, nosso_numero, nosso_numero_fmt, numero_documento, valor, vencimento, sacado_nome, sacado_documento, sacado_logradouro, sacado_cep, sacado_municipio, sacado_uf, status, criado_em",
      )
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false })
      .limit(200);
    if (atualizados) setTitulos(atualizados as TituloRow[]);
    setReloadBoletos((x) => x + 1);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* gerador */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl2 bg-white p-4 shadow-card">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-brand" />
          <span className="text-sm font-bold text-ink">Gerar boletos (CNAB)</span>
        </div>
        <select
          value={contaId}
          onChange={(e) => setContaId(e.target.value)}
          className={classeControle("md", false, "bg-white")}
        >
          <option value="">Conta de cobrança…</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-muted">
          {totalFila > 0 ? `${totalFila} boleto(s) a gerar` : "Nada na fila."}
        </span>
        <Botao variante="primario" className="ml-auto"
          onClick={gerarTodos}
          // desabilitado, e não só recusado no clique: a fila continua na tela e
          // pode conter item já cobrado, então convidar para o clique é convidar
          // para a duplicata
          disabled={gerando || totalFila === 0 || !contaPronta || vinculosNoTeto}
        >
          {gerando ? "Gerando…" : `Gerar ${totalFila > 0 ? totalFila + " " : ""}boleto(s)`}
        </Botao>
        {conta && faltas.length > 0 && (
          <p className="flex w-full items-center gap-1.5 text-xs font-semibold text-danger">
            <AlertTriangle size={13} /> Complete na conta: {faltas.join(", ")} —{" "}
            <Link href="/configuracoes/cnab" className="underline">
              Configurações → CNAB
            </Link>
          </p>
        )}
        {contaPronta && bancoInfo?.homologar && (
          <p className="w-full text-[11px] text-ink-soft">
            {bancoInfo.nome}: confira o primeiro boleto com o banco (homologação) antes de enviar a clientes.
          </p>
        )}
        {msg && (
          <p className={`w-full text-xs font-semibold ${msg.tipo === "erro" ? "text-danger" : "text-brand"}`}>{msg.texto}</p>
        )}
      </div>

      {/* registro no banco: remessa e retorno */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl2 bg-white p-4 shadow-card">
        <div className="flex items-center gap-2">
          <FileDown size={16} className="text-brand" />
          <span className="text-sm font-bold text-ink">Registro no banco</span>
        </div>
        <span className="text-xs text-ink-muted">
          {titulosParaRemessa.length > 0
            ? `${titulosParaRemessa.length} boleto(s) aguardando remessa${conta ? "" : " — escolha a conta acima"}`
            : "Nenhum boleto aguardando remessa."}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Botao variante="primario" tamanho="sm"
            onClick={gerarRemessa}
            disabled={gerandoRemessa || !contaPronta || titulosParaRemessa.length === 0}
          >
            <FileDown size={13} /> {gerandoRemessa ? "Gerando…" : "Gerar remessa (.REM)"}
          </Botao>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-xs font-semibold text-ink-muted transition hover:bg-surface">
            <FileUp size={13} /> {processandoRet ? "Processando…" : "Processar retorno (.RET)"}
            <input
              type="file"
              accept=".ret,.RET,.txt"
              className="hidden"
              disabled={processandoRet}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) processarRetorno(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="w-full text-[11px] text-ink-soft">
          Fluxo: gere a remessa e envie no internet banking → o banco registra → baixe o retorno (.RET) e processe aqui.
          A liquidação dá baixa automática no contas a receber. Histórico completo em{" "}
          <a href="/arquivos-bancarios" className="font-semibold text-brand hover:underline">Arquivos bancários</a>.
        </p>
      </div>

      {/* fila */}
      <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
        <div className="border-b border-line bg-surface/50 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">A gerar ({totalFila})</p>
        </div>
        {totalFila === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-soft">
            Vendas e faturamentos com a opção de boleto marcada aparecem aqui, uma linha por parcela.
          </p>
        ) : (
          <>
            {filaParcelas.map(({ parcela, venda }) => (
              <div key={parcela.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {clienteMap.get(venda.cliente_fornecedor_id)?.nome ?? "Cliente"}
                  </p>
                  <p className="text-[11px] text-ink-soft">
                    venda · parcela {parcela.numero}/{venda.parcelas} · vence {dataBR(parcela.vencimento)}
                  </p>
                </div>
                <span className="num shrink-0 text-sm font-semibold text-ink">{brl(parcela.valor)}</span>
              </div>
            ))}
            {filaFats.map((f) => (
              <div key={f.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {f.contrato ? clienteMap.get(f.contrato.cliente_fornecedor_id)?.nome ?? "Cliente" : "Cliente"}
                  </p>
                  <p className="text-[11px] text-ink-soft">
                    contrato{f.contrato?.nome ? " " + f.contrato.nome : ""} · competência {f.competencia.slice(5, 7)}/
                    {f.competencia.slice(0, 4)}
                  </p>
                </div>
                <span className="num shrink-0 text-sm font-semibold text-ink">{brl(f.valor)}</span>
              </div>
            ))}
            {filaLancamentos.map((l) => (
              <div key={l.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {clienteMap.get(l.cliente_fornecedor_id ?? "")?.nome ?? "Cliente"}
                  </p>
                  <p className="truncate text-[11px] text-ink-soft">
                    lançamento{l.descricao ? " · " + l.descricao : ""} · vence {dataBR(l.data_vencimento)}
                  </p>
                </div>
                <span className="num shrink-0 text-sm font-semibold text-ink">{brl(l.valor)}</span>
              </div>
            ))}
            {filaNotas.map((n) => (
              <div key={n.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {clienteMap.get(n.cliente_fornecedor_id ?? "")?.nome ?? "Cliente"}
                  </p>
                  <p className="truncate text-[11px] text-ink-soft">
                    NF-e {n.nfse_numero ? "nº " + n.nfse_numero : "emitida"} · vence {dataBR(vencimentoNota(n.emitida_em))}
                  </p>
                </div>
                <span className="num shrink-0 text-sm font-semibold text-ink">{brl(n.valor_servico)}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* títulos gerados — central com filtros, busca e paginação */}
      <CentralBoletos
        empresaId={empresaId}
        titulosIniciais={titulos}
        onCopiarLink={copiarLinkPublico}
        onExcluir={excluirTitulo}
        reloadSignal={reloadBoletos}
      />
    </div>
  );
}
