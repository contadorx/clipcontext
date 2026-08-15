"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { liquidarLancamentos, avisarMovimentacaoMudou } from "@/lib/liquidar";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import FooterBar, { FooterSep } from "@/components/ui/footer-bar";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";
import { brl, brlCurto } from "@/lib/formato";

type Conta = { id: string; nome: string; saldo_inicial: number; data_inicio: string | null };
type Pago = { conta_id: string; tipo: "entrada" | "saida"; valor: number; data_pagamento: string };
type Agendado = {
  id: string;
  conta_id: string;
  tipo: "entrada" | "saida";
  valor: number;
  data_vencimento: string;
  descricao: string | null;
};

function ddmm(s: string) {
  const [, m, d] = s.split("-");
  return `${d}/${m}`;
}
function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}
function maisDias(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Maior janela de histórico que os botões oferecem.
 *
 * A consulta busca sempre esta janela, e não a escolhida: trocar de 30 para 90
 * dias é um corte em memória, sem ida ao banco. Era assim antes — os botões
 * nunca refizeram consulta — e continua sendo, agora com um teto.
 */
const JANELA_MAX = 90;

export default function FluxoClient({ empresaId }: { empresaId: string }) {
  const router = useRouter();
  const [contas, setContas] = useState<Conta[]>([]);
  /** saldo de hoje por conta: saldo inicial + todos os pagamentos desde `data_inicio` */
  const [saldoBase, setSaldoBase] = useState<Map<string, number>>(new Map());
  /** só os pagamentos da janela visível — o resto do histórico já virou saldo */
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [agendados, setAgendados] = useState<Agendado[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [horizonte, setHorizonte] = useState(90);
  const [historico, setHistorico] = useState(30);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  /** o usuário já mexeu nos checkboxes de conta? antes disso, "todas" é padrão, não escolha */
  const tocouSelecao = useRef(false);
  // seleção de lançamentos nas duas tabelas (é o que liga a barra de rodapé)
  const [selLinhas, setSelLinhas] = useState<Set<string>>(new Set());
  const [baixaAberta, setBaixaAberta] = useState(false);
  const [baixaData, setBaixaData] = useState("");
  const [baixaConta, setBaixaConta] = useState("");
  const [baixando, setBaixando] = useState(false);
  const [erroBaixa, setErroBaixa] = useState<string | null>(null);
  const primeiroCampoBaixa = useRef<HTMLInputElement | null>(null);
  const focoAntesDaBaixa = useRef<HTMLElement | null>(null);

  // Esc fecha e o foco volta para onde estava. O app tem `Modal` para isto, mas
  // ele não aceita rodapé próprio; o mínimo de teclado fica aqui, explícito.
  useEffect(() => {
    if (!baixaAberta) return;
    focoAntesDaBaixa.current = document.activeElement as HTMLElement | null;
    primeiroCampoBaixa.current?.focus();
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setBaixaAberta(false);
    }
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("keydown", esc);
      focoAntesDaBaixa.current?.focus?.();
    };
  }, [baixaAberta]);

  /**
   * Carga em três consultas, no lugar de uma que não tinha fim.
   *
   * A consulta de pagamentos era `.eq("empresa_id", …)` e nada mais: trazia
   * **todo lançamento pago da empresa, desde sempre**, a cada abertura da tela e
   * a cada `fs-mov-changed`. Sem `.limit()`, sem `.range()`, e sem o aviso de
   * corte que a Conciliação tem — numa empresa com três anos de histórico são
   * dezenas de milhares de linhas para desenhar uma curva de 30 dias.
   *
   * A separação é esta: o **saldo** precisa de toda a história; o **desenho** só
   * precisa da janela. Então o saldo vem somado pelo banco (uma linha por conta
   * e tipo) e as linhas cruas vêm só dos últimos JANELA_MAX dias.
   *
   * `saldoAntesDe(L)` deixa de varrer a história: é o saldo de hoje menos os
   * pagamentos da janela a partir de L — e L nunca é anterior a JANELA_MAX dias,
   * porque é isso que os botões de histórico oferecem.
   */
  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();
    const desde = maisDias(-JANELA_MAX);
    const [c, ag, p, a] = await Promise.all([
      supabase
        .from("contas_bancarias")
        .select("id, nome, saldo_inicial, data_inicio")
        .eq("empresa_id", empresaId)
        .order("nome"),
      // somado pelo banco: no máximo duas linhas por conta (entrada e saída)
      supabase
        .from("lancamentos")
        .select("conta_id, tipo, valor.sum()")
        .eq("empresa_id", empresaId)
        .not("conta_id", "is", null)
        .not("data_pagamento", "is", null),
      // janela do gráfico. Sem teto superior de propósito: um lançamento pago
      // com data futura entra no saldo de hoje, e tirá-lo daqui faria
      // `saldoAntesDe` divergir do saldo mostrado ao lado.
      supabase
        .from("lancamentos")
        .select("conta_id, tipo, valor, data_pagamento")
        .eq("empresa_id", empresaId)
        .not("conta_id", "is", null)
        // o `is not null` é redundante diante do `gte` em SQL, e está aqui de
        // propósito: sem ele a intenção da consulta fica escondida numa regra de
        // comparação com nulo, e qualquer camada que não seja SQL — a bancada,
        // por exemplo — devolve os lançamentos em aberto junto com os pagos
        .not("data_pagamento", "is", null)
        .gte("data_pagamento", desde),
      supabase
        .from("lancamentos")
        .select("id, conta_id, tipo, valor, data_vencimento, descricao")
        .eq("empresa_id", empresaId)
        .not("conta_id", "is", null)
        .is("data_pagamento", null)
        /*
          Transferência fica de fora, como em Liquidações.

          Ela é um par: uma saída na conta de origem e uma entrada na de destino,
          amarradas por `transferencia_par_id`. Dar baixa numa perna só, ou nas
          duas com a mesma conta, cria uma saída e uma entrada na mesma conta —
          efeito líquido zero na origem e dinheiro que nunca chega ao destino. O
          par fica sem conserto pela tela. `agendamento-client` já filtrava isso;
          o Fluxo passou a ter ação e precisa do mesmo filtro.

          Elas continuam entrando no saldo pelo caminho dos pagos, que é onde
          transferência já paga deve mesmo aparecer.
        */
        .not("transferencia", "is", true)
        .order("data_vencimento"),
    ]);
    const cs = (c.data as Conta[]) ?? [];
    const janela = ((p.data as unknown) as Pago[]) ?? [];

    /*
      Agregação no servidor é opção do projeto PostgREST (`db-aggregates-enabled`)
      e não dá para conferir daqui. Se ela estiver desligada, a consulta erra e a
      tela cai no caminho antigo — mesma conta, mesmos números, só sem a
      economia. O pior caso de desempenho é o que já existia hoje; o de erro é
      tratado por `erroCarga`, mais abaixo, porque consulta que falha não pode
      virar saldo.
    */
    let base = new Map<string, number>();
    let usouAgregado = false;
    const linhasAg = (ag.data as unknown) as { conta_id: string; tipo: "entrada" | "saida"; sum: unknown }[] | null;
    /*
      A resposta é conferida linha a linha antes de virar saldo.

      Não basta `!ag.error`: um servidor que não entende `valor.sum()` pode
      responder 200 com as linhas cruas, sem o campo `sum` — e aí `Number(undefined)`
      é `NaN`, que se espalha por todo saldo da tela sem erro nenhum no console.
      Foi exatamente o que aconteceu no primeiro teste desta mudança: as três
      contas saíram "R$ NaN". Saldo errado em silêncio é pior que consulta lenta,
      então qualquer linha fora do formato manda a tela inteira para o caminho
      antigo.
    */
    const agValido =
      !ag.error &&
      Array.isArray(linhasAg) &&
      linhasAg.every(
        (l) => typeof l?.conta_id === "string" && l.sum != null && Number.isFinite(Number(l.sum)),
      );
    if (agValido && linhasAg) {
      usouAgregado = true;
      for (const c2 of cs) base.set(c2.id, Number(c2.saldo_inicial ?? 0));
      for (const l of linhasAg) {
        if (!base.has(l.conta_id)) continue;
        const v = l.tipo === "entrada" ? Number(l.sum) : -Number(l.sum);
        base.set(l.conta_id, (base.get(l.conta_id) ?? 0) + v);
      }
      // A soma do banco ignora `data_inicio`, que é por conta. Esta consulta
      // desconta o que ficou antes dele — normalmente zero linhas, porque
      // pagamento anterior à entrada da conta no sistema é exceção.
      const comInicio = cs.filter((x) => x.data_inicio);
      if (comInicio.length > 0) {
        const clausulas = comInicio
          .map((x) => `and(conta_id.eq.${x.id},data_pagamento.lt.${x.data_inicio})`)
          .join(",");
        const antes = await supabase
          .from("lancamentos")
          .select("conta_id, tipo, valor")
          .eq("empresa_id", empresaId)
          .not("data_pagamento", "is", null)
          .or(clausulas);
        if (!antes.error) {
          for (const l of ((antes.data ?? []) as unknown) as Pago[]) {
            if (!base.has(l.conta_id)) continue;
            const v = l.tipo === "entrada" ? Number(l.valor) : -Number(l.valor);
            base.set(l.conta_id, (base.get(l.conta_id) ?? 0) - v);
          }
        } else {
          // não dá para garantir o corte por data_inicio: volta ao caminho antigo
          usouAgregado = false;
        }
      }
    }

    let falhou: string | null = null;
    if (!usouAgregado) {
      const todos = await supabase
        .from("lancamentos")
        .select("conta_id, tipo, valor, data_pagamento")
        .eq("empresa_id", empresaId)
        .not("conta_id", "is", null)
        .not("data_pagamento", "is", null);
      if (todos.error) falhou = todos.error.message;
      base = new Map<string, number>();
      for (const c2 of cs) base.set(c2.id, Number(c2.saldo_inicial ?? 0));
      for (const l of ((todos.data ?? []) as unknown) as Pago[]) {
        const conta = cs.find((x) => x.id === l.conta_id);
        if (!conta) continue;
        if (conta.data_inicio && l.data_pagamento < conta.data_inicio) continue;
        const v = l.tipo === "entrada" ? Number(l.valor) : -Number(l.valor);
        base.set(l.conta_id, (base.get(l.conta_id) ?? 0) + v);
      }
    }

    /*
      Consulta que falha não pode virar saldo.

      Antes, `?? []` transformava erro em lista vazia: o saldo caía para o saldo
      inicial da conta e a tela mostrava esse número em preto, com a mesma
      confiança de um número certo. Numa tela de caixa, isso é pior que não
      mostrar nada — e era a falha que o comentário desta função chamava de
      "nada degrada em silêncio".
    */
    if (c.error) falhou = c.error.message;
    else if (p.error) falhou = p.error.message;
    else if (a.error) falhou = a.error.message;
    setErroCarga(falhou);

    setContas(cs);
    setSaldoBase(base);
    setPagos(janela);
    setAgendados(((a.data as unknown) as Agendado[]) ?? []);
    // A seleção é do usuário e sobrevive à recarga. Antes ela era remarcada
    // por inteiro aqui — e como `carregar` também roda no `fs-mov-changed`,
    // isolar uma conta era desfeito por um lançamento feito em outra tela.
    setSel((atual) => {
      const validas = new Set(cs.map((x) => x.id));
      // primeira carga (ou troca de empresa): marca todas. Depois disso a
      // escolha é do usuário, inclusive "nenhuma" — que `size > 0` confundia
      // com "nenhum id sobreviveu" e desfazia na recarga seguinte.
      if (!tocouSelecao.current) return validas;
      return new Set(Array.from(atual).filter((id) => validas.has(id)));
    });
    setCarregando(false);
  }, [empresaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const h = () => carregar();
    window.addEventListener("fs-mov-changed", h);
    return () => window.removeEventListener("fs-mov-changed", h);
  }, [carregar]);

  function toggle(id: string) {
    tocouSelecao.current = true;
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const sg = (t: "entrada" | "saida", v: number) => (t === "entrada" ? Number(v) : -Number(v));

  function toggleLinha(id: string) {
    setSelLinhas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function abrirLancamento(id: string) {
    router.push(`/movimentacoes/${id}`);
  }

  async function darBaixa() {
    if (!baixaData || !baixaConta) return;
    setBaixando(true);
    setErroBaixa(null);
    const { error } = await liquidarLancamentos(idsMarcados, baixaData, baixaConta);
    setBaixando(false);
    if (error) {
      setErroBaixa(error.message);
      return;
    }
    setBaixaAberta(false);
    setSelLinhas(new Set());
    await carregar();
    avisarMovimentacaoMudou();
  }

  function saldoContaAtual(id: string) {
    return saldoBase.get(id) ?? 0;
  }

  const hoje = hojeISO();
  const fim = maisDias(horizonte);
  const inicioHist = historico > 0 ? maisDias(-historico) : hoje;

  /**
   * Saldo das contas selecionadas antes de `dataLimite`.
   *
   * Varria a história inteira somando pagamento por pagamento. Agora anda para
   * trás a partir de hoje: saldo de hoje **menos** os pagamentos da janela que
   * são de `dataLimite` em diante. Dá o mesmo número porque `dataLimite` nunca
   * é anterior a JANELA_MAX dias — os botões de histórico param em 90.
   */
  function saldoAntesDe(dataLimite: string) {
    let s = contas.filter((c) => sel.has(c.id)).reduce((acc, c) => acc + saldoContaAtual(c.id), 0);
    for (const p of pagos) {
      if (!sel.has(p.conta_id)) continue;
      const c = contas.find((x) => x.id === p.conta_id);
      if (c?.data_inicio && p.data_pagamento < c.data_inicio) continue;
      if (p.data_pagamento >= dataLimite) s -= sg(p.tipo, p.valor);
    }
    return s;
  }

  const saldoAtual = contas.filter((c) => sel.has(c.id)).reduce((s, c) => s + saldoContaAtual(c.id), 0);

  const futuros = agendados
    .filter((g) => sel.has(g.conta_id) && g.data_vencimento >= hoje && g.data_vencimento <= fim)
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  const passados = agendados
    .filter((g) => sel.has(g.conta_id) && g.data_vencimento < hoje)
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

  /*
    Série do gráfico: HISTÓRICO realizado + HOJE + PROJEÇÃO.

    Dois campos, `real` e `prev`, e não um só. O código antigo calculava
    `tipo: "real" | "prev"` em cada ponto e **nunca usava** — desenhava uma
    única área contínua, com a mesma cor e a mesma espessura dos dois lados.
    Quem olhava não tinha como saber onde o extrato acaba e o palpite começa,
    justamente numa tela cujo rodapé diz "o histórico é o saldo realizado".

    Os dois se encontram no ponto de hoje, que recebe os dois valores: sem isso
    a linha cheia e a tracejada ficariam separadas por um vão.
  */
  type Ponto = { x: string; real: number | null; prev: number | null };
  const serie: Ponto[] = [];
  /** empurra sem repetir data — dois pontos na mesma categoria quebram o eixo */
  function empurrar(x: string, valor: number, projetado: boolean) {
    const ultimo = serie[serie.length - 1];
    const alvo = ultimo && ultimo.x === x ? ultimo : (serie.push({ x, real: null, prev: null }), serie[serie.length - 1]);
    if (projetado) alvo.prev = valor;
    else alvo.real = valor;
  }

  if (historico > 0) {
    const pagosHist = pagos.filter((p) => {
      if (!sel.has(p.conta_id)) return false;
      const c = contas.find((x) => x.id === p.conta_id);
      if (c?.data_inicio && p.data_pagamento < c.data_inicio) return false;
      return p.data_pagamento >= inicioHist && p.data_pagamento < hoje;
    });
    const porDia = new Map<string, number>();
    for (const p of pagosHist) porDia.set(p.data_pagamento, (porDia.get(p.data_pagamento) ?? 0) + sg(p.tipo, p.valor));
    let acc = saldoAntesDe(inicioHist);
    empurrar(inicioHist, acc, false);
    for (const d of Array.from(porDia.keys()).sort()) {
      acc += porDia.get(d)!;
      empurrar(d, acc, false);
    }
  }

  // o ponto de hoje pertence aos dois traços: é onde o realizado entrega o bastão
  empurrar(hoje, saldoAtual, false);
  empurrar(hoje, saldoAtual, true);
  let run = saldoAtual;
  const futurosComSaldo = futuros.map((g) => {
    run += sg(g.tipo, g.valor);
    empurrar(g.data_vencimento, run, true);
    return { ...g, saldo: run };
  });
  const saldoProjetado = run;
  const totalPassados = passados.reduce((s, g) => s + sg(g.tipo, g.valor), 0);
  const realizadoPeriodo = historico > 0 ? saldoAtual - saldoAntesDe(inicioHist) : 0;

  /*
    O aviso de caixa negativo olhava só `saldoProjetado`, que é o saldo do
    **último dia** do horizonte. Uma projeção que mergulha em 20/08 e se
    recupera até 31/08 não disparava aviso nenhum — e é exatamente o caso que o
    tile "O caixa fica negativo" do Início existe para pegar. Duas telas
    respondendo diferente à mesma pergunta.
  */
  const furo = futurosComSaldo.reduce<{ data: string; saldo: number } | null>(
    (pior, l) => (l.saldo < 0 && (!pior || l.saldo < pior.saldo) ? { data: l.data_vencimento, saldo: l.saldo } : pior),
    null,
  );
  const primeiroFuro = futurosComSaldo.find((l) => l.saldo < 0) ?? null;
  /*
    Caixa já negativo hoje, sem nada previsto para entrar, é o caso mais grave —
    e era o único que ficava sem aviso: `furo` sai de `futurosComSaldo`, que
    pode estar vazio. O aviso antigo (`saldoProjetado < 0`) pegava este caso e
    perdia o mergulho no meio do período; agora os dois são cobertos.
  */
  const negativoHoje = saldoAtual < 0;
  // uma série com um ponto só não vira linha nenhuma no recharts
  const temRealizado = serie.filter((p) => p.real !== null).length >= 2;
  const temProjecao = serie.filter((p) => p.prev !== null).length >= 2;
  const antecipados = marcadosParaBaixa(baixaData);
  function marcadosParaBaixa(data: string) {
    if (!data) return 0;
    return [...passados, ...futuros].filter((l) => selLinhas.has(l.id) && l.data_vencimento > data).length;
  }

  /*
    O que está marcado é o que está **visível e marcado** — nunca o Set cru.

    `selLinhas` sobrevive a recargas e a trocas de horizonte, e é isso que faz
    dele uma armadilha: marcar cinco futuros com 90 dias e voltar para 30 deixa
    três ids marcados fora da tela. O rodapé diria "5" somando dois, e a baixa
    pegaria os cinco. Aqui a lista visível é a fonte da verdade; o Set é só a
    memória de quem foi clicado.
  */
  const visiveis = [...passados, ...futuros];
  const marcados = visiveis.filter((l) => selLinhas.has(l.id));
  const idsMarcados = marcados.map((l) => l.id);
  const somaSelecionada = marcados.reduce((s, l) => s + sg(l.tipo, l.valor), 0);
  /*
    A conta só vem preenchida quando todos os marcados são da mesma.

    Preencher com a do primeiro parecia gentileza e era perda de dado: três
    boletos, dois do Itaú e um do Bradesco, viravam três saídas do Itaú com um
    clique em Confirmar. Nada registra a conta original, então desfazer depende
    de alguém lembrar. Liquidações já tinha tomado esta decisão — conta vazia e
    Confirmar travado até escolherem.
  */
  const contasDosMarcados = Array.from(new Set(marcados.map((l) => l.conta_id)));
  const contaPadraoBaixa = contasDosMarcados.length === 1 ? contasDosMarcados[0] : "";

  const horizOpcoes = [
    { v: 30, l: "30 dias" },
    { v: 60, l: "60 dias" },
    { v: 90, l: "90 dias" },
  ];
  /*
    O maior valor daqui NÃO pode passar de JANELA_MAX.

    `saldoAntesDe` anda para trás dentro da janela carregada; se um botão pedir
    um histórico maior que ela, os pagamentos entre a janela e o botão ficam no
    saldo e nunca são subtraídos — o ponto inicial do gráfico sobe e o
    "Realizado" desce, pelo mesmo valor, sem erro nenhum na tela. O `filter`
    abaixo impõe a invariante em vez de confiar em quem editar a lista depois.
  */
  const histOpcoes = [
    { v: 0, l: "Sem" },
    { v: 30, l: "30 dias" },
    { v: 60, l: "60 dias" },
    { v: 90, l: "90 dias" },
  ].filter((o) => o.v <= JANELA_MAX);

  return (
    <div className="space-y-5">
      {erroCarga && (
        <div className="rounded-xl2 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <b>Não deu para carregar tudo.</b> Os saldos abaixo podem estar incompletos — não use para decidir
          pagamento antes de recarregar. ({erroCarga})
        </div>
      )}
      {/* contas + KPIs */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl2 bg-white shadow-card">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-bold text-ink">Contas no fluxo</h2>
          </div>
          {carregando ? (
            <SkeletonLinhas linhas={4} colunas={2} />
          ) : contas.length === 0 ? (
            <EmptyState compacto titulo="Nenhuma conta cadastrada" />
          ) : (
            <div className="py-1">
              {contas.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 transition hover:bg-surface"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sel.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4 accent-brand"
                    />
                    <span className="text-sm text-ink">{c.nome}</span>
                  </span>
                  {/* Vermelho é problema, e conta no vermelho é problema. Estes
                      ternários existiam e não decidiam nada — os dois lados
                      diziam `text-ink`. A D1 da rodada 1 decidiu isto para a
                      barra de contas; o Fluxo tem a própria cópia dela e nunca
                      tinha recebido a decisão. */}
                  <span
                    className={`num text-sm font-semibold ${saldoContaAtual(c.id) < 0 ? "text-danger" : "text-ink"}`}
                  >
                    {brl(saldoContaAtual(c.id))}
                  </span>
                </label>
              ))}
              <div className="flex items-center justify-between border-t border-line px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">Saldo hoje</span>
                <span className={`num text-base font-extrabold ${saldoAtual < 0 ? "text-danger" : "text-ink"}`}>
                  {brl(saldoAtual)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl2 bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[13px] font-bold text-ink">Fluxo de caixa — realizado + projetado</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-ink-soft">Histórico</span>
                <div className="flex items-center gap-0.5 rounded-lg border border-line p-0.5 text-xs">
                  {histOpcoes.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setHistorico(o.v)}
                      className={
                        historico === o.v
                          ? "rounded-md bg-ink px-2.5 py-1.5 font-semibold text-white"
                          : "rounded-md px-2.5 py-1.5 font-medium text-ink-muted transition hover:bg-surface"
                      }
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-ink-soft">Projeção</span>
                <div className="flex items-center gap-0.5 rounded-lg border border-line p-0.5 text-xs">
                  {horizOpcoes.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setHorizonte(o.v)}
                      className={
                        horizonte === o.v
                          ? "rounded-md bg-brand px-2.5 py-1.5 font-semibold text-white"
                          : "rounded-md px-2.5 py-1.5 font-medium text-ink-muted transition hover:bg-surface"
                      }
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* "Saldo hoje" saiu daqui: ele já está no rodapé do painel de contas,
              a quarenta pixels à esquerda, com o mesmo valor. Os dois que ficam
              respondem coisas que o painel não responde — quanto entrou de
              líquido no período, e onde a projeção termina. */}
          <div className="mt-3 flex flex-wrap gap-6">
            {historico > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-ink-soft">Realizado ({historico}d)</p>
                <p className={`num text-xl font-extrabold ${realizadoPeriodo < 0 ? "text-danger" : "text-ink"}`}>
                  {realizadoPeriodo >= 0 ? "+" : ""}
                  {brl(realizadoPeriodo)}
                </p>
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold text-ink-soft">Saldo final ({horizonte}d)</p>
              <p className={`num text-xl font-extrabold ${saldoProjetado < 0 ? "text-danger" : "text-brand"}`}>
                {brl(saldoProjetado)}
              </p>
            </div>
            {furo && (
              <div>
                {/* não é "menor saldo do período": só existe quando mergulha
                    abaixo de zero, e olha só a projeção */}
                <p className="text-[11px] font-semibold text-ink-soft">Pior furo projetado</p>
                <p className="num text-xl font-extrabold text-danger">{brl(furo.saldo)}</p>
              </div>
            )}
          </div>

          <div className="mt-3 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-real" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#12A594" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#12A594" stopOpacity={0} />
                  </linearGradient>
                  {/* a projeção é mais clara: o preenchimento também diz que ali é palpite */}
                  <linearGradient id="grad-proj" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#12A594" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#12A594" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEEF2" vertical={false} />
                <XAxis dataKey="x" tickFormatter={ddmm} tick={{ fontSize: 11, fill: "#7C8B9A" }} minTickGap={24} />
                <YAxis tickFormatter={brlCurto} tick={{ fontSize: 11, fill: "#7C8B9A" }} width={56} />
                {/* `filterNull` porque as duas séries existem em todo ponto, e
                    uma delas é sempre nula: sem isto todo hover mostra uma
                    segunda linha vazia ("projetado :") embaixo da que interessa */}
                <Tooltip
                  filterNull
                  formatter={(v: number, n: string) => [brl(v), n]}
                  labelFormatter={(l: string) => ddmm(l)}
                  contentStyle={{ borderRadius: 10, border: "1px solid #E3E9EE", fontSize: 12 }}
                />
                <ReferenceLine y={0} stroke="#E5484D" strokeDasharray="4 4" />
                {historico > 0 && (
                  <ReferenceLine
                    x={hoje}
                    stroke="#7C8B9A"
                    strokeDasharray="3 3"
                    label={{ value: "hoje", position: "top", fontSize: 10, fill: "#7C8B9A" }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="real"
                  name="Saldo realizado"
                  stroke="#12A594"
                  strokeWidth={2}
                  fill="url(#grad-real)"
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="prev"
                  name="Saldo projetado"
                  stroke="#12A594"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  fill="url(#grad-proj)"
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* A legenda anuncia só o que está desenhado. Com "Histórico: Sem" a
              série realizada tem um ponto só e o recharts não desenha nada —
              anunciar "realizado" ali seria legenda mentindo. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-ink-soft">
            {temRealizado && (
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-4 rounded bg-brand" /> realizado
              </span>
            )}
            {temProjecao && (
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-4 [background:repeating-linear-gradient(to_right,#12A594_0_4px,transparent_4px_7px)]" />{" "}
                projetado
              </span>
            )}
          </p>
          {negativoHoje ? (
            <p className="mt-1 text-xs font-semibold text-danger">
              ⚠ O caixa já está negativo hoje ({brl(saldoAtual)})
              {furo ? ` e a projeção chega a ${brl(furo.saldo)}.` : "."}
            </p>
          ) : primeiroFuro ? (
            <p className="mt-1 text-xs font-semibold text-danger">
              ⚠ O caixa fica negativo em {primeiroFuro.data_vencimento.split("-").reverse().join("/")}
              {furo && furo.data !== primeiroFuro.data_vencimento
                ? ` e chega a ${brl(furo.saldo)} em ${furo.data.split("-").reverse().join("/")}.`
                : ` (${brl(primeiroFuro.saldo)}).`}
            </p>
          ) : null}
        </div>
      </div>

      {/* Agendamentos passados (vencidos) */}
      <div className="rounded-xl2 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[13px] font-bold text-ink">Agendamentos vencidos (não pagos)</h2>
          {/* saída vencida em aberto é o número mais alarmante da tela; J1
              decidiu que vermelho é problema e este ternário tinha ficado de fora */}
          {passados.length > 0 && (
            <span className={`num text-xs font-semibold ${totalPassados < 0 ? "text-danger" : "text-brand"}`}>
              impacto {brl(totalPassados)}
            </span>
          )}
        </div>
        {passados.length === 0 ? (
          <EmptyState compacto titulo="Nada vencido em aberto" descricao="👍" />
        ) : (
          <Tabela
            linhas={passados.map((g) => ({ ...g }))}
            mostrarSaldo={false}
            sel={selLinhas}
            onToggle={toggleLinha}
            onAbrir={abrirLancamento}
          />
        )}
      </div>

      {/* Agendamentos futuros */}
      <div className="rounded-xl2 bg-white shadow-card">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-[13px] font-bold text-ink">Agendamentos futuros ({horizonte} dias)</h2>
        </div>
        {futurosComSaldo.length === 0 ? (
          <EmptyState compacto titulo="Nenhum agendamento futuro no período" />
        ) : (
          <Tabela
            linhas={futurosComSaldo}
            mostrarSaldo
            sel={selLinhas}
            onToggle={toggleLinha}
            onAbrir={abrirLancamento}
          />
        )}
      </div>

      <p className="text-[11px] text-ink-soft">
        O histórico (linha cheia) é o saldo realizado, montado pelos pagamentos pela data de pagamento. A partir de
        hoje é a projeção (linha tracejada), aplicando os lançamentos em aberto pela data de vencimento. Vencidos não
        pagos aparecem à parte (não entram na projeção). Saldo inicial e data de início da conta vêm do cadastro de
        contas.{" "}
        {/* dito na tela porque é a única que não obedece ao período de cima, e
            descobrir isso por conta própria custa uma conferência inteira */}
        <b>
          Esta tela não usa o período escolhido na barra de cima: ela olha para frente, em janelas de 30, 60 ou 90
          dias a partir de hoje.
        </b>
      </p>

      {/* espaço para a barra de rodapé não cobrir o último parágrafo */}

      <FooterBar
        quando={marcados.length > 0}
        info={
          <span className="flex flex-wrap items-center gap-2 text-ink-muted">
            <b className="text-ink">{marcados.length} selecionado(s)</b>
            <FooterSep />
            <span>
              impacto <span className="num font-semibold text-ink">{brl(somaSelecionada)}</span>
            </span>
            {contasDosMarcados.length > 1 && (
              <>
                <FooterSep />
                <span className="text-[11px] font-semibold text-amber-700">
                  {contasDosMarcados.length} contas diferentes
                </span>
              </>
            )}
          </span>
        }
      >
        <button
          type="button"
          onClick={() => setSelLinhas(new Set())}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-surface"
        >
          Limpar seleção
        </button>
        <Botao
          variante="primario"
          tamanho="sm"
          onClick={() => {
            setErroBaixa(null);
            setBaixaData(hoje);
            setBaixaConta(contaPadraoBaixa);
            setBaixaAberta(true);
          }}
        >
          Dar baixa ({marcados.length})
        </Botao>
      </FooterBar>

      {baixaAberta && (
        // véu `bg-rail/50` e não um tom próprio: o app já unificou os quatro que
        // existiam, e abrir dois diálogos seguidos com fundos diferentes pisca
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setBaixaAberta(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fluxo-baixa-titulo"
            className="w-full max-w-sm rounded-xl2 bg-white p-5 shadow-card"
          >
            <h3 id="fluxo-baixa-titulo" className="text-sm font-bold text-ink">
              Dar baixa em {marcados.length} lançamento(s)
            </h3>
            <p className="mt-1 text-[11px] text-ink-soft">
              Marca como pago na data escolhida e joga o valor para o saldo realizado da conta.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="fluxo-baixa-data" className="mb-1 block text-[11px] font-semibold text-ink-soft">
                  Data do pagamento
                </label>
                <input
                  id="fluxo-baixa-data"
                  ref={primeiroCampoBaixa}
                  type="date"
                  value={baixaData}
                  onChange={(e) => setBaixaData(e.target.value)}
                  className={classeControle("sm", false, "num")}
                />
                {baixaData && antecipados > 0 && (
                  <p className="mt-1 text-[11px] font-semibold text-amber-700">
                    {antecipados} vence(m) depois desta data — a baixa antecipa o pagamento no caixa.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="fluxo-baixa-conta" className="mb-1 block text-[11px] font-semibold text-ink-soft">
                  Conta
                </label>
                <select
                  id="fluxo-baixa-conta"
                  value={baixaConta}
                  onChange={(e) => setBaixaConta(e.target.value)}
                  className={classeControle("sm", false, "bg-white")}
                >
                  {/* a opção vazia é a proteção: com contas misturadas na
                      seleção, gravar todas na do primeiro é perda silenciosa */}
                  <option value="">Selecione a conta…</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                {contasDosMarcados.length > 1 && (
                  <p className="mt-1 text-[11px] font-semibold text-amber-700">
                    Os lançamentos marcados são de {contasDosMarcados.length} contas diferentes. Todos vão para a
                    conta escolhida aqui.
                  </p>
                )}
              </div>
              {erroBaixa && <p className="text-[11px] font-semibold text-danger">{erroBaixa}</p>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBaixaAberta(false)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-surface"
              >
                Cancelar
              </button>
              <Botao
                variante="primario"
                tamanho="sm"
                onClick={darBaixa}
                disabled={baixando || !baixaData || !baixaConta}
              >
                {baixando ? "Dando baixa…" : "Confirmar"}
              </Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * As duas tabelas do Fluxo.
 *
 * Eram listas para ler: nenhuma linha clicável, nenhuma ação. Uma venda vencida
 * há oito dias aparecia aqui e não havia como cobrar dali — era preciso decorar
 * a descrição, ir a Movimentações e procurar de novo.
 *
 * O destino do clique é `/movimentacoes/[id]`, o mesmo de Movimentações e de
 * Liquidações. Abrir o mesmo objeto de dois jeitos diferentes confunde mais do
 * que ajuda, e essa decisão já estava escrita em `agendamento-client.tsx`.
 */
function Tabela({
  linhas,
  mostrarSaldo,
  sel,
  onToggle,
  onAbrir,
}: {
  linhas: Array<{ id: string; tipo: "entrada" | "saida"; valor: number; data_vencimento: string; descricao: string | null; saldo?: number }>;
  mostrarSaldo: boolean;
  sel: Set<string>;
  onToggle: (id: string) => void;
  onAbrir: (id: string) => void;
}) {
  const todasMarcadas = linhas.length > 0 && linhas.every((l) => sel.has(l.id));
  return (
    <div className="max-xl:overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="[&>th]:sticky [&>th]:top-[calc(52px_+_var(--fs-cab,0px))] [&>th]:z-10 [&>th]:bg-white border-b border-line text-[11px] font-semibold text-ink-soft">
            <th className="w-9 px-3 py-2">
              <input
                type="checkbox"
                aria-label={todasMarcadas ? "Desmarcar todos desta tabela" : "Marcar todos desta tabela"}
                checked={todasMarcadas}
                onChange={() => linhas.forEach((l) => (todasMarcadas ? sel.has(l.id) && onToggle(l.id) : !sel.has(l.id) && onToggle(l.id)))}
                className="h-4 w-4 accent-brand"
              />
            </th>
            <th className="px-2 py-2 text-left">Vencimento</th>
            <th className="px-4 py-2 text-left">Descrição</th>
            <th className="px-4 py-2 text-right">Entrada</th>
            <th className="px-4 py-2 text-right">Saída</th>
            {mostrarSaldo && <th className="px-5 py-2 text-right">Saldo projetado</th>}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={l.id}
              className={`border-b border-line/60 transition last:border-0 ${
                sel.has(l.id) ? "bg-brand-light/30" : "hover:bg-surface/50"
              }`}
            >
              {/* a caixa fica fora do alvo do clique: marcar não pode navegar */}
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${l.descricao || "lançamento"} de ${l.data_vencimento.split("-").reverse().join("/")}`}
                  checked={sel.has(l.id)}
                  onChange={() => onToggle(l.id)}
                  className="h-4 w-4 accent-brand"
                />
              </td>
              <td className="num cursor-pointer px-2 py-2 text-ink-muted" onClick={() => onAbrir(l.id)}>
                {l.data_vencimento.split("-").reverse().join("/")}
              </td>
              <td className="cursor-pointer px-4 py-2 text-ink" onClick={() => onAbrir(l.id)}>
                {/* `Link` e não `<button>`: é navegação para uma página inteira.
                    Assim o teclado chega pelo Tab e abre no Enter, o leitor de
                    tela anuncia link, e Ctrl+clique abre em outra aba — coisas
                    que `router.push` num `onClick` não dá. O `stopPropagation`
                    evita que o clique no link também dispare o da célula. */}
                <Link
                  href={`/movimentacoes/${l.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-left hover:text-brand hover:underline"
                >
                  {l.descricao || "—"}
                </Link>
              </td>
              <td className="num cursor-pointer px-4 py-2 text-right text-brand" onClick={() => onAbrir(l.id)}>
                {l.tipo === "entrada" ? brl(Number(l.valor)) : ""}
              </td>
              <td className="num cursor-pointer px-4 py-2 text-right text-ink" onClick={() => onAbrir(l.id)}>
                {l.tipo === "saida" ? brl(Number(l.valor)) : ""}
              </td>
              {mostrarSaldo && (
                <td
                  className={`num cursor-pointer px-5 py-2 text-right font-semibold ${
                    (l.saldo ?? 0) < 0 ? "text-danger" : "text-ink"
                  }`}
                  onClick={() => onAbrir(l.id)}
                >
                  {brl(l.saldo ?? 0)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
