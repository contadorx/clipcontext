"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Landmark, UploadCloud, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { contarUso, descreverUso, ondeResolver, VINCULOS } from "@/lib/uso-cadastro";
import { brl, mascaraCpfCnpj, mascaraMoeda, moedaParaInput, parseMoeda, soDigitos } from "@/lib/formato";
import { useAtalhosModal } from "@/lib/atalhos";
import { BANCOS as BANCOS_CNAB } from "@/lib/cnab/bancos";
import Modal, { useSujo } from "@/components/ui/modal";
import EmptyState from "@/components/ui/empty-state";
import MessageStrip from "@/components/ui/message-strip";
import FooterBar from "@/components/ui/footer-bar";
import Botao, { BotaoLink } from "@/components/ui/botao";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";
import { useListaNavegavel } from "@/components/ui/use-lista-navegavel";

type Conta = {
  id: string;
  nome: string;
  banco: string | null;
  agencia: string | null;
  agencia_dv: string | null;
  conta_numero: string | null;
  conta_dv: string | null;
  banco_codigo: string | null;
  convenio: string | null;
  convenio_pagamento: string | null;
  carteira: string | null;
  pagador_documento: string | null;
  pagador_nome: string | null;
  nosso_numero_proximo: number | null;
  cnab_seq_cobranca: number | null;
  juros_mes_pct: number | null;
  multa_pct: number | null;
  data_inicio: string | null;
  saldo_inicial: number;
};

const BANCOS = [
  "Banco do Brasil",
  "Caixa Econômica Federal",
  "Itaú",
  "Bradesco",
  "Santander",
  "Nubank",
  "Inter",
  "C6 Bank",
  "BTG Pactual",
  "Sicoob",
  "Sicredi",
  "Safra",
  "Banrisul",
  "Mercado Pago",
  "PagBank",
  "Original",
  "Neon",
  "XP",
  "BRB",
  "Caixa interno / Dinheiro",
];

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function iniciais(c: Conta): string {
  const base = (c.banco || c.nome || "?").trim();
  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function subtitulo(c: Conta): string {
  const p: string[] = [];
  if (c.banco) p.push(c.banco);
  if (c.agencia) p.push("Ag " + c.agencia + (c.agencia_dv ? "-" + c.agencia_dv : ""));
  if (c.conta_numero) p.push("Cc " + c.conta_numero + (c.conta_dv ? "-" + c.conta_dv : ""));
  if (c.banco_codigo && c.carteira) p.push("cobrança ok");
  return p.join(" · ");
}

const CAMPOS =
  "id, nome, banco, agencia, agencia_dv, conta_numero, conta_dv, banco_codigo, convenio, convenio_pagamento, carteira, pagador_documento, pagador_nome, nosso_numero_proximo, cnab_seq_cobranca, juros_mes_pct, multa_pct, data_inicio, saldo_inicial";

export default function ContasCrud({
  empresaId,
  initial,
  /** modo página: só esta conta, na própria URL, sem a lista nem o véu */
  soId,
}: {
  empresaId: string;
  initial: Conta[];
  soId?: string;
}) {
  const [contas, setContas] = useState<Conta[]>(initial);
  const router = useRouter();
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  // guarda contra perder o que foi digitado ao fechar sem salvar
  const form = useSujo(aberto);

  /*
    A conta tem página própria (`/configuracoes/contas-bancarias/[id]`), que era
    alcançável só por um ícone. `abrir` leva a ela — e não ao diálogo de edição
    que esta tela também tem, pelo mesmo motivo de Clientes: um objeto, uma
    porta.
  */
  const nav = useListaNavegavel({
    itens: contas,
    abrir: (c) => router.push(`/configuracoes/contas-bancarias/${c.id}`),
    desligado: aberto,
  });
  const [editando, setEditando] = useState<Conta | null>(null);
  const comoPagina = Boolean(soId);

  // só o ⌘/Ctrl+Enter: o Esc é do Modal, que já confirma o descarte
  useAtalhosModal(aberto, { onConfirmar: () => salvar() });
  const [erro, setErro] = useState<string | null>(null);
  /*
    Erro da LISTA, separado do erro do formulário.

    O erro do diálogo só é desenhado dentro dele; excluir é acionado da lista,
    com o diálogo fechado. Sem um lugar próprio, a exclusão barrada escrevia
    numa mensagem invisível — clicar, confirmar e nada acontecer, sem
    explicação.
  */
  const [erroLista, setErroLista] = useState<string | null>(null);
  /*
    Qual linha está sendo conferida antes de excluir.

    A contagem de uso é uma ida ao banco por vínculo. Sem indicação, o clique na
    lixeira passava segundos sem nada acontecer, e o segundo clique disparava um
    lote concorrente que terminava em dois `confirm()` seguidos.
  */
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mostraCnab, setMostraCnab] = useState(false);

  // básicos
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [contaNum, setContaNum] = useState("");
  const [dataInicio, setDataInicio] = useState(hoje());
  const [saldo, setSaldo] = useState("");
  const [nome, setNome] = useState("");
  // bancários / cobrança (CNAB)
  const [bancoCodigo, setBancoCodigo] = useState("");
  const [agenciaDv, setAgenciaDv] = useState("");
  const [contaDv, setContaDv] = useState("");
  const [convenio, setConvenio] = useState("");
  const [convenioPagamento, setConvenioPagamento] = useState("");
  const [carteira, setCarteira] = useState("");
  const [seqCobranca, setSeqCobranca] = useState("");
  const [proxNN, setProxNN] = useState("1");
  const [pagDoc, setPagDoc] = useState("");
  const [pagNome, setPagNome] = useState("");
  const [jurosPct, setJurosPct] = useState("0");
  const [multaPct, setMultaPct] = useState("0");

  function limpar() {
    setBanco("");
    setAgencia("");
    setContaNum("");
    setDataInicio(hoje());
    setSaldo("");
    setNome("");
    setBancoCodigo("");
    setAgenciaDv("");
    setContaDv("");
    setConvenio("");
    setConvenioPagamento("");
    setCarteira("");
    setProxNN("1");
    setSeqCobranca("");
    setPagDoc("");
    setPagNome("");
    setJurosPct("0");
    setMultaPct("0");
    setErro(null);
  }

  function abrirNova() {
    setEditando(null);
    limpar();
    setMostraCnab(false);
    setAberto(true);
  }

  function abrirEdicao(c: Conta) {
    setEditando(c);
    setBanco(c.banco ?? "");
    setAgencia(c.agencia ?? "");
    setContaNum(c.conta_numero ?? "");
    setDataInicio(c.data_inicio ?? hoje());
    setSaldo(moedaParaInput(c.saldo_inicial));
    setNome(c.nome);
    setBancoCodigo(c.banco_codigo ?? "");
    setAgenciaDv(c.agencia_dv ?? "");
    setContaDv(c.conta_dv ?? "");
    setConvenio(c.convenio ?? "");
    setConvenioPagamento(c.convenio_pagamento ?? "");
    setCarteira(c.carteira ?? "");
    setProxNN(String(c.nosso_numero_proximo ?? 1)); setSeqCobranca(c.cnab_seq_cobranca ? String(c.cnab_seq_cobranca) : "");
    setPagDoc(mascaraCpfCnpj(c.pagador_documento ?? ""));
    setPagNome(c.pagador_nome ?? "");
    setJurosPct(String(c.juros_mes_pct ?? 0).replace(".", ","));
    setMultaPct(String(c.multa_pct ?? 0).replace(".", ","));
    setErro(null);
    setMostraCnab(!!(c.banco_codigo || c.carteira || c.convenio));
    setAberto(true);
  }

  // ao escolher o banco CNAB, sugere o nome do banco se ainda estiver vazio
  function escolherBancoCnab(codigo: string) {
    setBancoCodigo(codigo);
    if (!banco.trim() && codigo) {
      const b = BANCOS_CNAB.find((x) => x.codigo === codigo);
      if (b) setBanco(b.nome);
    }
  }

  async function recarregar() {
    const supabase = createClient();
    const { data } = await supabase
      .from("contas_bancarias")
      .select(CAMPOS)
      .eq("empresa_id", empresaId)
      // nome, e não criação: é a ordem que a página da lista usa e a que a
      // navegação entre irmãos segue. Recarregar com outra ordem fazia a lista
      // se reorganizar sozinha depois de salvar, e Alt+↑↓ passar a discordar
      // do que está na tela até o próximo F5.
      .order("nome");
    if (data) setContas(data as Conta[]);
    router.refresh();
  }

  async function salvar() {
    /*
      Trava de duplo envio dentro da função, não só no botão.

      O botão checava `salvando`; o ⌘/Ctrl+Enter do modal chamava `salvar()`
      direto. Dois atalhos seguidos criavam duas contas idênticas.
    */
    if (salvando) return;
    setErro(null);
    const nomeFinal = nome.trim() || banco.trim();
    if (!nomeFinal) {
      setErro("Dê um nome à conta (ou escolha um banco).");
      return;
    }
    const valor = parseMoeda(saldo);
    const payload = {
      nome: nomeFinal,
      banco: banco.trim() || null,
      agencia: agencia.trim() || null,
      agencia_dv: agenciaDv.trim() || null,
      conta_numero: contaNum.trim() || null,
      conta_dv: contaDv.trim() || null,
      banco_codigo: bancoCodigo || null,
      convenio: convenio.trim() || null,
      convenio_pagamento: convenioPagamento.trim() || null,
      carteira: carteira.trim() || null,
      pagador_documento: soDigitos(pagDoc) || null,
      pagador_nome: pagNome.trim() || null,
      nosso_numero_proximo: Math.max(1, Number(proxNN) || 1),
      cnab_seq_cobranca: seqCobranca.trim() ? Number(seqCobranca) : null,
      juros_mes_pct: Math.max(0, Number(jurosPct.replace(",", ".")) || 0),
      multa_pct: Math.max(0, Number(multaPct.replace(",", ".")) || 0),
      data_inicio: dataInicio || null,
      saldo_inicial: valor,
    };

    setSalvando(true);
    const supabase = createClient();
    /*
      `.select("id")` no update, e não só `.eq()`.

      `update().eq("id", x)` que casa ZERO linhas não é erro no supabase-js:
      volta `{ data: null, error: null }`. Se a RLS barrar a linha, ou se ela
      tiver sumido em outra aba, a tela fechava o diálogo anunciando "salvo" e o
      banco não mudava nada. Pedindo a linha de volta, zero linhas vira uma
      resposta que dá para conferir.
    */
    const resp = editando
      ? await supabase.from("contas_bancarias").update(payload).eq("id", editando.id).select("id")
      : await supabase
          .from("contas_bancarias")
          .insert({ empresa_id: empresaId, ...payload });
    setSalvando(false);
    if (resp.error) {
      setErro(resp.error.message);
      return;
    }
    if (editando && (resp.data ?? []).length === 0) {
      setErro("A conta não foi encontrada para salvar. Recarregue a página — ela pode ter sido excluída em outra aba.");
      return;
    }
    // Modo página: não há diálogo para fechar; recarrega o servidor para o
    // cabeçalho acompanhar o que mudou.
    if (comoPagina) {
      form.limpar();
      router.refresh();
      return;
    }
    setAberto(false);
    await recarregar();
  }

  // Modo página: abre a conta assim que ela chega.
  useEffect(() => {
    if (!soId) return;
    const c = contas.find((x) => x.id === soId);
    if (c) abrirEdicao(c);
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soId]);

  async function excluir(c: Conta) {
    if (excluindoId) return;
    setExcluindoId(c.id);
    try {
      const supabase = createClient();
      /*
        A trava antiga falhava aberta e olhava pouco.

        `const { count }` descartava o erro: uma consulta que falhasse devolvia
        `null`, `(count ?? 0) > 0` era falso, e a conta com movimento era
        apagada. E ela só olhava `lancamentos` — extrato importado, boletos,
        remessas CNAB, vendas, contratos e recorrências passavam livres, todos
        apontando para uma conta que deixou de existir.
      */
      const uso = await contarUso(supabase, c.id, VINCULOS.conta);
      if (!uso.ok) {
        setErroLista(
          `Não foi possível conferir se a conta "${c.nome}" está em uso (${uso.erro}). Nada foi excluído — tente de novo.`,
        );
        return;
      }
      if (uso.total > 0) {
        setErroLista(`A conta "${c.nome}" tem ${descreverUso(uso.usos)} e não pode ser excluída.${ondeResolver(uso.usos)}`);
        return;
      }
      /*
        Sem `confirm()`: exclusão imediata com Desfazer.

        O cadastro só chega aqui depois de a contagem confirmar que ele não está
        em uso — ou seja, a pergunta do navegador cobrava um clique para
        proteger de um estrago que a trava acima já impediu. O padrão do resto do
        app (Movimentações, Conciliação) é agir e oferecer volta; `confirm()`
        fica só onde não há volta.

        O retrato completo da linha vai junto: é ele que o Desfazer reinsere.
      */
      const back = await supabase.from("contas_bancarias").select("*").eq("id", c.id).maybeSingle();
      const r = await supabase.from("contas_bancarias").delete().eq("id", c.id);
      if (r.error) {
        setErroLista(r.error.message);
        return;
      }
      setErroLista(null);
      await recarregar();
      const linha = back.error ? null : back.data;
      toast(
        linha ? `Conta excluída: ${c.nome}.` : `Conta excluída: ${c.nome}. Não foi possível preparar o Desfazer.`,
        {
          desfazer: linha
            ? async () => {
                const volta = await createClient().from("contas_bancarias").insert(linha as Record<string, unknown>);
                if (volta.error) {
                  toast(`Não foi possível restaurar (${volta.error.message}).`, { tom: "erro" });
                  return;
                }
                await recarregar();
              }
            : undefined,
        },
      );
    } finally {
      setExcluindoId(null);
    }
  }

  const total = contas.reduce((s, c) => s + Number(c.saldo_inicial), 0);

  // Mesmo corpo nas duas molduras (diálogo e página) — duas cópias é como
  // elas começam a divergir.
  const corpoFormulario = (
    <>
              <div className="grid grid-cols-[1fr_auto_auto] gap-3">
                <CampoTexto
                  id="conta-banco"
                  rotulo="Banco"
                  list="lista-bancos"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  placeholder="Escolha ou digite"
                />
                {/* o `datalist` não vira coluna do grid: `display:none` não gera caixa */}
                <datalist id="lista-bancos">
                  {BANCOS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
                {/*
                  A largura vai na moldura, não no controle: o input do `Campo` já
                  é `w-full`, e na folha gerada `w-full` vem depois de `w-24` —
                  posta no input, a largura fixa seria ignorada.
                */}
                <CampoTexto
                  id="conta-agencia"
                  rotulo="Agência"
                  className="w-24"
                  inputClassName="num"
                  value={agencia}
                  onChange={(e) => setAgencia(e.target.value)}
                  placeholder="0000"
                />
                <CampoTexto
                  id="conta-numero"
                  rotulo="Conta"
                  className="w-28"
                  inputClassName="num"
                  value={contaNum}
                  onChange={(e) => setContaNum(e.target.value)}
                  placeholder="00000-0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CampoTexto
                  id="conta-data-inicio"
                  rotulo="Data de início do controle"
                  type="date"
                  inputClassName="num"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
                <CampoTexto
                  id="conta-saldo-inicial"
                  rotulo="Saldo inicial (R$)"
                  inputMode="decimal"
                  inputClassName="num"
                  value={saldo}
                  onChange={(e) => setSaldo(mascaraMoeda(e.target.value))}
                  placeholder="0,00"
                />
              </div>

              <CampoTexto
                id="conta-nome"
                rotulo="Como deseja chamar essa conta?"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Conta corrente, Caixinha, Investimentos"
                ajuda="Se deixar em branco, usamos o nome do banco."
              />

              {/* dados bancários e cobrança (CNAB) */}
              <button
                type="button"
                onClick={() => setMostraCnab((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-line bg-surface/50 px-3 py-2.5 text-left text-xs font-bold text-ink transition hover:bg-surface"
              >
                <span>
                  Dados bancários e cobrança (CNAB)
                  <span className="ml-2 font-normal text-ink-soft">
                    boletos, remessas e retornos
                  </span>
                </span>
                {mostraCnab ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {mostraCnab && (
                <div className="space-y-3 rounded-lg border border-line p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <CampoSelect
                      id="conta-banco-cnab"
                      rotulo="Banco (CNAB)"
                      value={bancoCodigo}
                      onChange={(e) => escolherBancoCnab(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {BANCOS_CNAB.map((b) => (
                        <option key={b.codigo} value={b.codigo}>
                          {b.codigo} — {b.nome}
                        </option>
                      ))}
                    </CampoSelect>
                    <div className="grid grid-cols-2 gap-3">
                      <CampoTexto
                        id="conta-agencia-dv"
                        rotulo="DV agência"
                        inputClassName="num"
                        value={agenciaDv}
                        onChange={(e) => setAgenciaDv(e.target.value)}
                        placeholder="0"
                      />
                      <CampoTexto
                        id="conta-conta-dv"
                        rotulo="DV conta"
                        inputClassName="num"
                        value={contaDv}
                        onChange={(e) => setContaDv(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <CampoTexto
                      id="conta-convenio"
                      rotulo="Convênio de cobrança"
                      inputClassName="num"
                      value={convenio}
                      onChange={(e) => setConvenio(e.target.value)}
                      placeholder="código do beneficiário (boleto)"
                    />
                    <CampoTexto
                      id="conta-convenio-pagamento"
                      rotulo="Convênio de pagamento"
                      inputClassName="num"
                      value={convenioPagamento}
                      onChange={(e) => setConvenioPagamento(e.target.value)}
                      placeholder="se diferente do de cobrança"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <CampoTexto
                      id="conta-carteira"
                      rotulo="Carteira de cobrança"
                      inputClassName="num"
                      value={carteira}
                      onChange={(e) => setCarteira(e.target.value)}
                      ajuda="Usada só na cobrança (boletos). O pagamento não usa carteira."
                    />
                    <CampoTexto
                      id="conta-prox-nosso-numero"
                      rotulo="Próx. nosso número"
                      inputClassName="num"
                      value={proxNN}
                      onChange={(e) => setProxNN(e.target.value.replace(/\D/g, ""))}
                      placeholder="1"
                      ajuda="Ajuste se você também emite boletos em outro sistema, para o número não colidir."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <CampoTexto
                      id="conta-seq-cobranca"
                      rotulo="Próx. sequencial de remessa (cobrança)"
                      inputClassName="num"
                      value={seqCobranca}
                      onChange={(e) => setSeqCobranca(e.target.value.replace(/\D/g, ""))}
                      placeholder="automático"
                      ajuda="Deixe vazio para automático. Preencha para continuar a numeração de arquivo de outro sistema."
                    />
                  </div>
                  {bancoCodigo === "748" && (
                    <p className="rounded-lg bg-surface px-3 py-2 text-[11px] text-ink-soft">
                      Sicredi: no convênio, informe posto + código do beneficiário juntos
                      (ex.: posto 02 e beneficiário 12345 → 0212345).
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <CampoTexto
                      id="conta-pagador-documento"
                      rotulo="CNPJ/CPF do pagador (remessas)"
                      inputClassName="num"
                      value={pagDoc}
                      onChange={(e) => setPagDoc(mascaraCpfCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                    />
                    <CampoTexto
                      id="conta-pagador-nome"
                      rotulo="Nome do pagador"
                      value={pagNome}
                      onChange={(e) => setPagNome(e.target.value)}
                      placeholder="Razão social"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <CampoTexto
                      id="conta-juros-pct"
                      rotulo="Juros após vencimento (% ao mês)"
                      inputMode="decimal"
                      inputClassName="num"
                      value={jurosPct}
                      onChange={(e) => setJurosPct(e.target.value.replace(/[^\d,\.]/g, ""))}
                      placeholder="1,00"
                    />
                    <CampoTexto
                      id="conta-multa-pct"
                      rotulo="Multa por atraso (%)"
                      inputMode="decimal"
                      inputClassName="num"
                      value={multaPct}
                      onChange={(e) => setMultaPct(e.target.value.replace(/[^\d,\.]/g, ""))}
                      placeholder="2,00"
                    />
                  </div>
                  <p className="text-[11px] text-ink-soft">
                    Valem para os boletos desta conta (registro e impressão). Zero = isento. Limite usual: juros 1% a.m. e multa 2%.
                  </p>
                </div>
              )}

              {erro && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-danger">
                  {erro}
                </p>
              )}

              {/*
                No modo página o rodapé já tem o Salvar — dois botões com o
                mesmo nome, um no meio do formulário e outro no rodapé, fazem a
                pessoa se perguntar se são a mesma coisa.
              */}
              {!comoPagina && (
                <Botao variante="primario" largura onClick={salvar} disabled={salvando}>
                  {salvando ? "Salvando…" : editando ? "Salvar" : "Cadastrar"}
                </Botao>
              )}
                </>
  );

  if (comoPagina) {
    return (
      <div className="rounded-xl2 bg-white shadow-card" {...form.campos}>
        <div className="space-y-3 px-5 py-4">{corpoFormulario}</div>
        <FooterBar
          info={
            <BotaoLink href="/configuracoes/contas-bancarias" variante="secundario">
              Voltar à lista
            </BotaoLink>
          }
        >
          <Botao variante="primario" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </FooterBar>
      </div>
    );
  }

  return (
    <div className="rounded-xl2 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[13px] font-bold text-ink">Suas contas</h2>
          <p className="text-xs text-ink-muted">
            Tudo da conta num lugar só: dados, extrato e cobrança (CNAB).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/importar?tipo=contas"
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface"
          >
            <UploadCloud size={15} /> Importar
          </Link>
          <Botao variante="primario" tamanho="sm"
            onClick={abrirNova}
          >
            <Plus size={15} /> Nova conta
          </Botao>
        </div>
      </div>

      {erroLista && (
        <div className="px-5 pt-4">
          <MessageStrip tipo="erro" fechavel onFechar={() => setErroLista(null)}>
            {erroLista}
          </MessageStrip>
        </div>
      )}

      {contas.length === 0 ? (
        /*
          `filtrado` é para vazio POR FILTRO — e este é o vazio de primeira vez.

          Usar o modo discreto aqui inverte a mensagem: some a moldura, some o
          convite, e a tela sugere "não há resultado para o que você procurou"
          numa lista que nunca teve nada. O componente diz isso no próprio
          contrato: se o vazio é o começo, ofereça a ação.
        */
        <EmptyState
          icone={Landmark}
          titulo="Nenhuma conta ainda"
          descricao="Cadastre a conta por onde o dinheiro entra e sai."
          acao={
            <button type="button" onClick={abrirNova} className="text-sm font-semibold text-brand hover:underline">
              Cadastrar a primeira
            </button>
          }
        />
      ) : (
        <div className="px-5 py-2">
          {contas.map((c) => {
            const { onClick, emFoco, ...resto } = nav.propsLinha(c);
            return (
            <div
              key={c.id}
              {...resto}
              onClick={onClick}
              className={`flex cursor-pointer items-center gap-3 border-b border-line py-3 last:border-0 ${
                emFoco ? "ring-2 ring-inset ring-brand/40 hover:bg-surface/60" : "hover:bg-surface/60"
              }`}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-light text-[11px] font-bold text-brand">
                {iniciais(c)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{c.nome}</p>
                {subtitulo(c) && (
                  <p className="truncate text-xs text-ink-soft">{subtitulo(c)}</p>
                )}
              </div>
              <span className="num text-sm text-ink">{brl(Number(c.saldo_inicial))}</span>
              <span className="flex gap-1">
                <Link
                  href={`/configuracoes/contas-bancarias/${c.id}`}
                  title="Abrir conta"
                  aria-label={`Abrir a conta ${c.nome}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-ink"
                >
                  <Pencil size={15} />
                </Link>
                <button
                  type="button"
                  onClick={() => excluir(c)}
                  title="Excluir"
                  aria-label={`Excluir a conta ${c.nome}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-rose-50 hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </span>
            </div>
            );
          })}
          <div className="flex items-center justify-between py-3 text-sm">
            <span className="font-semibold text-ink-muted">Total</span>
            <span className="num font-bold text-ink">{brl(total)}</span>
          </div>
        </div>
      )}

      <Modal
        rotulo={editando ? `Editar conta ${editando.nome}` : "Nova conta"}
        aberto={aberto}
        onFechar={() => setAberto(false)}
        sujo={form.sujo}
      >
        {/* `rounded-xl2` aqui também: o conteúdo que rola pinta por cima dos cantos
            arredondados da moldura, que agora é o elemento de fora */}
        <div className="max-h-[92vh] overflow-auto rounded-xl2 p-5" {...form.campos}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">
              {editando ? "Editar conta" : "Nova conta"}
            </h3>
            <button aria-label="Fechar"
              type="button"
              onClick={() => form.confirmar() && setAberto(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3">
            {corpoFormulario}
          </div>
        </div>
      </Modal>
    </div>
  );
}
