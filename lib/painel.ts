import { createClient } from "@/lib/supabase/server";

export type ContaSaldo = {
  id: string;
  nome: string;
  banco: string | null;
  saldo: number;
  /**
   * Transações do extrato ainda não casadas com lançamento.
   *
   * `null` = a conta nunca recebeu extrato, e aí não há o que conciliar; zero =
   * está em dia. São coisas diferentes e não podem aparecer igual: "sem extrato"
   * não é "conciliada".
   */
  aConciliar: number | null;
};

/** Um mês de orçamento contra o que de fato saiu. */
export type LinhaOrcamento = {
  categoriaId: string;
  nome: string;
  orcado: number;
  realizado: number;
  /** quanto do orçado já foi consumido, de 0 a 1+ */
  fracao: number;
};

export type LinhaLanc = {
  id: string;
  descricao: string | null;
  data_vencimento: string;
  data_pagamento: string | null;
  valor: number;
};

/**
 * Um dia da curva de caixa.
 *
 * `projetado` diz de que lado da linha "hoje" o ponto está. Antes a série só
 * trazia o realizado — e o gráfico se chamava "saldo projetado no período".
 * Prometer projeção e desenhar histórico é o pior dos dois mundos: quem olha
 * acha que está vendo o futuro e está vendo o passado.
 */
export type PontoFluxo = { data: string; saldo: number; projetado?: boolean };

/**
 * O que o painel precisa dizer para alguém decidir, e não só informar.
 *
 * `furo` é a resposta à única pergunta que tira o sono de quem opera caixa:
 * **em que dia o dinheiro acaba**, se nada mudar. Sai da mesma curva do
 * gráfico; o gráfico mostra a forma, este número mostra a data.
 */
export type Alerta = {
  /** primeiro dia do período em que o saldo projetado fica negativo */
  furo: string | null;
  /** quanto falta no pior dia (negativo) */
  furoValor: number;
  /** menor saldo projetado do período, mesmo que positivo */
  menorSaldo: number;
  menorSaldoData: string | null;
  /** a pagar nos próximos 7 dias e se o caixa de hoje cobre */
  pagar7: number;
  receber7: number;
  cobre7: boolean;
};

/** Cada linha do cartão de pendências: um número, um rótulo e para onde ir. */
export type Pendencia = {
  id: string;
  quantos: number;
  titulo: string;
  detalhe: string;
  acao: string;
  href: string;
  tom: "negativo" | "critico" | "info" | "neutro";
};

export type ResultadoMes = {
  ym: string;
  label: string;
  entradas: number;
  saidas: number;
  resultado: number;
};

type Grupo = { emAberto: LinhaLanc[]; efetuados: LinhaLanc[]; vencidos: LinhaLanc[] };

/** BRL sem depender do formatador de tela — isto roda no servidor. */
function brlSeco(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function getPainelData(empresaId: string, de: string, ate: string) {
  const supabase = createClient();
  const [{ data: contasRaw }, { data: lancRaw }, docsPend, extratoPend, { data: txRaw }, { data: orcRaw }, { data: catRaw }] =
    await Promise.all([
    supabase
      .from("contas_bancarias")
      .select("id, nome, banco, saldo_inicial")
      .eq("empresa_id", empresaId)
      .order("nome"),
    supabase
      .from("lancamentos")
      .select("id, tipo, valor, descricao, data_vencimento, data_pagamento, conta_id, transferencia, categoria_id")
      .eq("empresa_id", empresaId),
    // Contagens do cartão de pendências. Vêm por `head: true` porque só o número
    // interessa — trazer as linhas para contá-las seria pagar caro por um dígito.
    supabase
      .from("documentos_recebidos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .is("lancamento_id", null),
    supabase
      .from("transacoes_extrato")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("conciliado", false),
    // por conta, para o cartão de saldos dizer de quais deles dá para confiar
    supabase.from("transacoes_extrato").select("conta_id, conciliado").eq("empresa_id", empresaId),
    supabase
      .from("orcamentos")
      .select("categoria_id, mes, valor")
      .eq("empresa_id", empresaId)
      .eq("ano", Number(de.slice(0, 4))),
    supabase.from("categorias").select("id, nome, tipo").eq("empresa_id", empresaId),
  ]);

  const contas = contasRaw ?? [];
  const lanc = (lancRaw ?? []) as Array<{
    id: string;
    tipo: "entrada" | "saida";
    valor: number;
    descricao: string | null;
    data_vencimento: string;
    data_pagamento: string | null;
    conta_id: string | null;
    transferencia: boolean;
    categoria_id: string | null;
  }>;

  const hoje = new Date().toISOString().slice(0, 10);
  const saldoInicialTotal = contas.reduce((s, c) => s + Number(c.saldo_inicial), 0);

  // Saldo realizado por conta (até hoje)
  const saldo = new Map<string, number>();
  for (const c of contas) saldo.set(c.id, Number(c.saldo_inicial));
  for (const l of lanc) {
    if (l.data_pagamento && l.conta_id && saldo.has(l.conta_id)) {
      const delta = l.tipo === "entrada" ? Number(l.valor) : -Number(l.valor);
      saldo.set(l.conta_id, (saldo.get(l.conta_id) ?? 0) + delta);
    }
  }
  // quantas transações do extrato ainda não foram casadas, por conta
  const tx = (txRaw ?? []) as Array<{ conta_id: string | null; conciliado: boolean }>;
  const temExtrato = new Set(tx.map((t) => t.conta_id).filter(Boolean) as string[]);
  const pendPorConta = new Map<string, number>();
  for (const t of tx) {
    if (!t.conta_id || t.conciliado) continue;
    pendPorConta.set(t.conta_id, (pendPorConta.get(t.conta_id) ?? 0) + 1);
  }

  const contasSaldo: ContaSaldo[] = contas.map((c) => ({
    id: c.id,
    nome: c.nome,
    banco: c.banco,
    saldo: saldo.get(c.id) ?? 0,
    aConciliar: temExtrato.has(c.id) ? pendPorConta.get(c.id) ?? 0 : null,
  }));
  const saldoAtual = contasSaldo.reduce((s, c) => s + c.saldo, 0);

  const soma = (arr: typeof lanc) => arr.reduce((s, l) => s + Number(l.valor), 0);
  const entradas = lanc.filter((l) => l.tipo === "entrada" && !l.transferencia);
  const saidas = lanc.filter((l) => l.tipo === "saida" && !l.transferencia);

  const aberto = (l: (typeof lanc)[number]) => !l.data_pagamento;
  const vencido = (l: (typeof lanc)[number]) => !l.data_pagamento && l.data_vencimento < hoje;
  const aVencer = (l: (typeof lanc)[number]) => !l.data_pagamento && l.data_vencimento >= hoje;
  const pago = (l: (typeof lanc)[number]) => Boolean(l.data_pagamento);
  const noPeriodo = (l: (typeof lanc)[number]) =>
    Boolean(l.data_pagamento && l.data_pagamento >= de && l.data_pagamento <= ate);

  const noMesVenc = (l: (typeof lanc)[number]) =>
    !l.data_pagamento && l.data_vencimento >= de && l.data_vencimento <= ate;
  const abertoAteFim = (l: (typeof lanc)[number]) => !l.data_pagamento && l.data_vencimento <= ate;

  const recebidos = soma(entradas.filter(noPeriodo));
  const despesas = soma(saidas.filter(noPeriodo));
  const aReceberMes = soma(entradas.filter(noMesVenc));
  const aPagarMes = soma(saidas.filter(noMesVenc));
  const vencidos = soma(saidas.filter(vencido)); // a pagar vencido
  const vencidosReceber = soma(entradas.filter(vencido)); // a receber vencido
  // Previsão com horizonte: saldo + tudo em aberto que vence até o fim do período
  const previsto =
    saldoAtual + soma(entradas.filter(abertoAteFim)) - soma(saidas.filter(abertoAteFim));

  // Série do fluxo de caixa: saldo realizado acumulado dia a dia no período
  let abertura = saldoInicialTotal;
  const netPorDia = new Map<string, number>();
  for (const l of lanc) {
    if (!l.data_pagamento) continue;
    const delta = l.tipo === "entrada" ? Number(l.valor) : -Number(l.valor);
    if (l.data_pagamento < de) abertura += delta;
    else if (l.data_pagamento <= ate)
      netPorDia.set(l.data_pagamento, (netPorDia.get(l.data_pagamento) ?? 0) + delta);
  }
  /*
    Do lado de lá de "hoje", a curva passa a ser projeção.

    Até hoje o saldo vem do que foi **pago**, pela data de pagamento. Depois de
    hoje, do que está **em aberto**, pela data de vencimento — que é a melhor
    aposta disponível sobre quando o dinheiro entra ou sai.

    Sem esta parte, o gráfico chamado "saldo projetado no período" desenhava só
    o histórico e ficava reto a partir de hoje. Quem olhava via uma linha
    tranquila justamente no trecho em que o caixa pode furar.

    Vencido em aberto **não** entra: ele já devia ter acontecido e não
    aconteceu, então jogá-lo num dia futuro qualquer seria inventar data. Ele
    aparece no cartão de pendências, que é onde cabe.
  */
  const projPorDia = new Map<string, number>();
  for (const l of lanc) {
    if (l.data_pagamento || l.transferencia) continue;
    if (l.data_vencimento < hoje || l.data_vencimento > ate) continue;
    const delta = l.tipo === "entrada" ? Number(l.valor) : -Number(l.valor);
    projPorDia.set(l.data_vencimento, (projPorDia.get(l.data_vencimento) ?? 0) + delta);
  }

  const serie: PontoFluxo[] = [];
  let acc = abertura;
  let cur = new Date(de + "T00:00:00Z");
  const fim = new Date(ate + "T00:00:00Z");
  let guard = 0;
  while (cur <= fim && guard < 800) {
    const k = cur.toISOString().slice(0, 10);
    acc += netPorDia.get(k) ?? 0;
    const futuro = k >= hoje;
    if (futuro) acc += projPorDia.get(k) ?? 0;
    serie.push({ data: k, saldo: acc, projetado: futuro });
    cur = new Date(cur.getTime() + 86400000);
    guard++;
  }

  /* ---------------------------------------------------- alertas de caixa --- */
  const negativos = serie.filter((p) => p.saldo < 0);
  const menor = serie.reduce<PontoFluxo | null>((m, p) => (!m || p.saldo < m.saldo ? p : m), null);
  const dia7 = new Date(new Date(hoje + "T00:00:00Z").getTime() + 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const em7 = (l: (typeof lanc)[number]) =>
    !l.data_pagamento && !l.transferencia && l.data_vencimento >= hoje && l.data_vencimento <= dia7;
  const pagar7 = soma(saidas.filter(em7));
  const receber7 = soma(entradas.filter(em7));

  const alerta: Alerta = {
    furo: negativos[0]?.data ?? null,
    furoValor: negativos.length ? Math.min(...negativos.map((p) => p.saldo)) : 0,
    menorSaldo: menor?.saldo ?? saldoAtual,
    menorSaldoData: menor?.data ?? null,
    pagar7,
    receber7,
    cobre7: saldoAtual + receber7 >= pagar7,
  };

  /* -------------------------------------------------------- pendências ---- */
  const vencPagar = saidas.filter(vencido);
  const vencReceber = entradas.filter(vencido);
  const liquidar7 = saidas.filter(em7);

  const pendencias: Pendencia[] = ([
    {
      id: "conciliar",
      quantos: extratoPend.count ?? 0,
      titulo: "transações do extrato sem conciliar",
      detalhe: "o saldo do banco só bate depois disto",
      acao: "Conciliar",
      href: "/conciliacao",
      tom: "info",
    },
    {
      id: "vencidos-pagar",
      quantos: vencPagar.length,
      titulo: "contas vencidas a pagar",
      detalhe: brlSeco(soma(vencPagar)),
      acao: "Liquidar",
      href: "/agendamento",
      tom: "negativo",
    },
    {
      id: "vencidos-receber",
      quantos: vencReceber.length,
      titulo: "recebimentos vencidos",
      detalhe: `${brlSeco(soma(vencReceber))} parados com clientes`,
      acao: "Cobrar",
      href: "/movimentacoes?sit=vencidos&tipo=entrada",
      tom: "critico",
    },
    {
      id: "documentos",
      quantos: docsPend.count ?? 0,
      titulo: "documentos sem lançamento",
      detalhe: "notas e boletos que chegaram e ninguém classificou",
      acao: "Classificar",
      href: "/documentos",
      tom: "neutro",
    },
    {
      id: "liquidar",
      quantos: liquidar7.length,
      titulo: "pagamentos vencem em 7 dias",
      detalhe: brlSeco(soma(liquidar7)),
      acao: "Agendar",
      href: "/agendamento",
      tom: "critico",
    },
  ] as Pendencia[]).filter((p) => p.quantos > 0);

  // Resultado mensal — últimos 6 meses (apenas pagos, sem transferências)
  const MES3 = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const baseM = new Date();
  const mensal: ResultadoMes[] = [];
  for (let i = 5; i >= 0; i--) {
    const dM = new Date(baseM.getFullYear(), baseM.getMonth() - i, 1);
    const ym = `${dM.getFullYear()}-${String(dM.getMonth() + 1).padStart(2, "0")}`;
    mensal.push({
      ym,
      label: `${MES3[dM.getMonth()]}/${String(dM.getFullYear()).slice(2)}`,
      entradas: 0,
      saidas: 0,
      resultado: 0,
    });
  }
  const idxM = new Map(mensal.map((m, i) => [m.ym, i]));
  for (const l of lanc) {
    if (!l.data_pagamento || l.transferencia) continue;
    const i = idxM.get(l.data_pagamento.slice(0, 7));
    if (i === undefined) continue;
    if (l.tipo === "entrada") mensal[i].entradas += Number(l.valor);
    else mensal[i].saidas += Number(l.valor);
  }
  for (const m of mensal) m.resultado = m.entradas - m.saidas;

  const toLinha = (l: (typeof lanc)[number]): LinhaLanc => ({
    id: l.id,
    descricao: l.descricao,
    data_vencimento: l.data_vencimento,
    data_pagamento: l.data_pagamento,
    valor: Number(l.valor),
  });
  const agrupar = (arr: typeof lanc): Grupo => ({
    emAberto: arr.filter(aVencer).map(toLinha),
    efetuados: arr.filter(pago).map(toLinha),
    vencidos: arr.filter(vencido).map(toLinha),
  });

  /* ------------------------------------------------- orçado × realizado --- */
  const mesAtual = Number(hoje.slice(5, 7));
  const cats = (catRaw ?? []) as Array<{ id: string; nome: string; tipo: string }>;
  const nomeCat = new Map(cats.map((c) => [c.id, c.nome]));
  const orcPorCat = new Map<string, number>();
  for (const o of (orcRaw ?? []) as Array<{ categoria_id: string; mes: number; valor: number }>) {
    if (Number(o.mes) !== mesAtual) continue;
    orcPorCat.set(o.categoria_id, (orcPorCat.get(o.categoria_id) ?? 0) + Number(o.valor));
  }

  // Realizado = o que **saiu** no período, por categoria. Orçamento é de
  // despesa: comparar receita contra ele não diz nada.
  const realPorCat = new Map<string, number>();
  for (const l of lanc) {
    if (l.tipo !== "saida" || l.transferencia || !l.categoria_id) continue;
    if (!l.data_pagamento || l.data_pagamento < de || l.data_pagamento > ate) continue;
    realPorCat.set(l.categoria_id, (realPorCat.get(l.categoria_id) ?? 0) + Number(l.valor));
  }

  const orcamento: LinhaOrcamento[] = Array.from(orcPorCat.entries())
    .map(([categoriaId, orcado]) => {
      const realizado = realPorCat.get(categoriaId) ?? 0;
      return {
        categoriaId,
        nome: nomeCat.get(categoriaId) ?? "Sem nome",
        orcado,
        realizado,
        fracao: orcado > 0 ? realizado / orcado : 0,
      };
    })
    // quem estourou primeiro: é a linha que exige decisão
    .sort((a, b) => b.fracao - a.fracao);

  return {
    alerta,
    pendencias,
    orcamento,
    contasSaldo,
    saldoAtual,
    previsto,
    recebidos,
    despesas,
    vencidos,
    vencidosReceber,
    aReceberMes,
    aPagarMes,
    serie,
    mensal,
    receber: agrupar(entradas),
    pagar: agrupar(saidas),
  };
}
