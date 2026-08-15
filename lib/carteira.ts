import { createClient } from "@/lib/supabase/server";

export type EmpresaCockpit = {
  id: string;
  nome: string;
  caixa: number;
  aReceber7: number;
  aPagar7: number;
  previsao7: number;
  aReceberVencido: number;
  aPagarVencido: number;
  conciliadoAte: string | null;
  pendenteDesde: string | null;
  diasPendente: number | null;
  temExtrato: boolean;
  status: "verde" | "amarelo" | "vermelho";
  agHojeQtd: number;
  agHojePagar: number;
  agHojeReceber: number;
  resultadoMes: number;
  docsNovos: number;
  relatorioStatus: "publicado" | "rascunho" | "pendente" | "na";
  mesFechado: boolean;
};

export type CarteiraData = {
  empresas: EmpresaCockpit[];
  compFechar: string;
  creditosIa: number;
  /** consultas que falharam: os números são parciais e a tela precisa dizer isso */
  incompleto: string | null;
  totais: {
    n: number;
    caixa: number;
    aReceber7: number;
    aPagar7: number;
    previsao7: number;
    atencao: number;
  };
  alertas: {
    caixaNegativo: number;
    comVencidos: number;
    vencidoPagar: number;
    vencidoReceber: number;
    conciliacaoPendente: number;
    agHojeQtd: number;
    agHojePagar: number;
    agHojeReceber: number;
    comDocsNovos: number;
    docsNovosTotal: number;
    relatoriosPendentes: number;
  };
};

function isoHoje() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function isoMais(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
function diasEntre(a: string, b: string) {
  return Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);
}
function fimPeriodo(periodo: string): string {
  if (periodo === "hoje") return isoHoje();
  if (periodo === "mes") {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0); // último dia do mês corrente
    return d.toISOString().slice(0, 10);
  }
  const n = Number(periodo) || 7;
  return isoMais(n);
}

export async function getCarteiraData(periodo: string = "7"): Promise<CarteiraData> {
  const supabase = createClient();
  const hoje = isoHoje();
  const ym = hoje.slice(0, 7); // "YYYY-MM" do mês corrente (usado no resultado do mês)
  // mês a reportar = último mês fechado (anterior ao corrente); só dá pra fechar/relatar mês completo
  const ymRel = (() => {
    const y = Number(ym.slice(0, 4));
    const m = Number(ym.slice(5, 7));
    return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  })();
  const fim7 = fimPeriodo(periodo);

  const [emp, contas, pagos, abertos, extrato, docsNov, analises, portais, escs, fechadas] = await Promise.all([
    supabase.from("empresas").select("id, nome, portal_libera_analise").eq("status", "ativa").order("nome"),
    supabase.from("contas_bancarias").select("id, empresa_id, saldo_inicial, data_inicio"),
    supabase
      .from("lancamentos")
      .select("empresa_id, conta_id, tipo, valor, data_pagamento")
      .not("data_pagamento", "is", null),
    supabase
      .from("lancamentos")
      .select("empresa_id, tipo, valor, data_vencimento, data_agendamento")
      .is("data_pagamento", null),
    supabase.from("transacoes_extrato").select("empresa_id, data, conciliado"),
    supabase.from("documentos_recebidos").select("empresa_id").eq("status", "novo"),
    supabase.from("analises_ia").select("empresa_id, publicada").eq("competencia", ymRel),
    supabase.from("portal_links").select("empresa_id, ativo"),
    supabase.from("escritorios").select("creditos_ia").limit(1),
    supabase.from("competencias_fechadas").select("empresa_id, competencia"),
  ]);

  /*
    Alguma destas dez consultas falhou?

    Todas descartavam o erro (`x.data ?? []`), e o efeito é o pior possível numa
    tela de vigilância: se `lancamentos` falha, o caixa vira só o saldo inicial,
    a previsão zera, nenhuma empresa entra em "atenção" — e o cabeçalho anuncia
    "Tudo em ordem — nenhum alerta na carteira" sobre quarenta clientes que
    ninguém conferiu. Uma tela que erra para o lado de "está tudo bem" é pior
    que uma tela quebrada, porque não pede ajuda.

    Os números continuam sendo calculados com o que veio (a tela não fica em
    branco), mas o aviso sobe junto e é ele que a tela mostra no lugar do
    "tudo em ordem".
  */
  const falhas = (
    [
      ["empresas", emp.error],
      ["contas bancárias", contas.error],
      ["lançamentos pagos", pagos.error],
      ["lançamentos em aberto", abertos.error],
      ["extrato", extrato.error],
      ["documentos", docsNov.error],
      ["análises", analises.error],
      ["portais", portais.error],
      ["créditos de IA", escs.error],
      ["competências fechadas", fechadas.error],
    ] as const
  )
    .filter(([, e]) => e)
    .map(([nome]) => nome);
  const incompleto =
    falhas.length > 0
      ? `Nem tudo pôde ser lido: ${falhas.join(", ")}. Os números abaixo estão incompletos — recarregue antes de concluir que está tudo em ordem.`
      : null;

  const creditosIa = Number(((escs.data as Array<{ creditos_ia: number | null }>) ?? [])[0]?.creditos_ia ?? 0);
  // empresas com o mês a reportar (ymRel) já fechado/travado
  const fechadoSet = new Set(
    ((fechadas.data as Array<{ empresa_id: string; competencia: string }>) ?? [])
      .filter((f) => (f.competencia ?? "").slice(0, 7) === ymRel)
      .map((f) => f.empresa_id),
  );

  const empresas = (emp.data as Array<{ id: string; nome: string; portal_libera_analise: boolean | null }>) ?? [];
  const portalAtivo = new Set(
    ((portais.data as Array<{ empresa_id: string; ativo: boolean }>) ?? []).filter((p) => p.ativo).map((p) => p.empresa_id),
  );
  // só entrega relatório quem tem portal ativo E análise liberada na configuração da empresa
  const entregaRel: Record<string, boolean> = {};
  for (const e of empresas) entregaRel[e.id] = !!e.portal_libera_analise && portalAtivo.has(e.id);
  const contasArr =
    (contas.data as Array<{ id: string; empresa_id: string; saldo_inicial: number; data_inicio: string | null }>) ??
    [];
  const pagosArr =
    (pagos.data as Array<{
      empresa_id: string;
      conta_id: string | null;
      tipo: string;
      valor: number;
      data_pagamento: string;
    }>) ?? [];
  const abertosArr =
    (abertos.data as Array<{
      empresa_id: string;
      tipo: string;
      valor: number;
      data_vencimento: string;
      data_agendamento: string | null;
    }>) ?? [];
  const extratoArr =
    (extrato.data as Array<{ empresa_id: string; data: string; conciliado: boolean }>) ?? [];

  const caixa: Record<string, number> = {};
  const aReceber7: Record<string, number> = {};
  const aPagar7: Record<string, number> = {};
  const aReceberVenc: Record<string, number> = {};
  const aPagarVenc: Record<string, number> = {};
  const concAte: Record<string, string | null> = {};
  const pendDesde: Record<string, string | null> = {};
  const temExtrato: Record<string, boolean> = {};
  const agHojeQ: Record<string, number> = {};
  const agHojeP: Record<string, number> = {};
  const agHojeR: Record<string, number> = {};
  const resMes: Record<string, number> = {};
  const docsN: Record<string, number> = {};
  const relStatus: Record<string, "publicado" | "rascunho" | "pendente" | "na"> = {};

  for (const e of empresas) {
    caixa[e.id] = 0;
    aReceber7[e.id] = 0;
    aPagar7[e.id] = 0;
    aReceberVenc[e.id] = 0;
    aPagarVenc[e.id] = 0;
    concAte[e.id] = null;
    pendDesde[e.id] = null;
    temExtrato[e.id] = false;
    agHojeQ[e.id] = 0;
    agHojeP[e.id] = 0;
    agHojeR[e.id] = 0;
    resMes[e.id] = 0;
    docsN[e.id] = 0;
    relStatus[e.id] = entregaRel[e.id] ? "pendente" : "na";
  }

  for (const a of (analises.data as Array<{ empresa_id: string; publicada: boolean }>) ?? []) {
    if (relStatus[a.empresa_id] === undefined || relStatus[a.empresa_id] === "na") continue;
    if (a.publicada) relStatus[a.empresa_id] = "publicado";
    else if (relStatus[a.empresa_id] !== "publicado") relStatus[a.empresa_id] = "rascunho";
  }

  for (const d of (docsNov.data as Array<{ empresa_id: string }>) ?? []) {
    if (docsN[d.empresa_id] !== undefined) docsN[d.empresa_id] += 1;
  }

  // saldo inicial das contas + mapa de info por conta
  const contaInfo: Record<string, { empresa: string; di: string | null }> = {};
  for (const c of contasArr) {
    if (caixa[c.empresa_id] === undefined) continue;
    caixa[c.empresa_id] += Number(c.saldo_inicial || 0);
    contaInfo[c.id] = { empresa: c.empresa_id, di: c.data_inicio };
  }
  // lançamentos pagos (respeita data de início da conta)
  for (const p of pagosArr) {
    if (!p.conta_id) continue;
    const info = contaInfo[p.conta_id];
    if (!info) continue;
    if (info.di && p.data_pagamento < info.di) continue;
    caixa[info.empresa] += p.tipo === "entrada" ? Number(p.valor) : -Number(p.valor);
  }
  // resultado do mês corrente (entradas − saídas pagas no mês; transferências se anulam)
  for (const p of pagosArr) {
    if (resMes[p.empresa_id] === undefined) continue;
    if (!p.data_pagamento.startsWith(ym)) continue;
    resMes[p.empresa_id] += p.tipo === "entrada" ? Number(p.valor) : -Number(p.valor);
  }
  // em aberto -> 7 dias e vencidos
  for (const o of abertosArr) {
    if (caixa[o.empresa_id] === undefined) continue;
    const v = Number(o.valor);
    if (o.data_vencimento >= hoje && o.data_vencimento <= fim7) {
      if (o.tipo === "entrada") aReceber7[o.empresa_id] += v;
      else aPagar7[o.empresa_id] += v;
    } else if (o.data_vencimento < hoje) {
      if (o.tipo === "entrada") aReceberVenc[o.empresa_id] += v;
      else aPagarVenc[o.empresa_id] += v;
    }
    if (o.data_agendamento === hoje) {
      agHojeQ[o.empresa_id] += 1;
      if (o.tipo === "entrada") agHojeR[o.empresa_id] += v;
      else agHojeP[o.empresa_id] += v;
    }
  }
  // conciliação
  for (const x of extratoArr) {
    if (caixa[x.empresa_id] === undefined) continue;
    temExtrato[x.empresa_id] = true;
    if (x.conciliado) {
      if (!concAte[x.empresa_id] || x.data > concAte[x.empresa_id]!) concAte[x.empresa_id] = x.data;
    } else {
      if (!pendDesde[x.empresa_id] || x.data < pendDesde[x.empresa_id]!) pendDesde[x.empresa_id] = x.data;
    }
  }

  const lista: EmpresaCockpit[] = empresas.map((e) => {
    const previsao7 = caixa[e.id] + aReceber7[e.id] - aPagar7[e.id];
    const diasPendente = pendDesde[e.id] ? diasEntre(pendDesde[e.id]!, hoje) : null;
    let status: EmpresaCockpit["status"] = "verde";
    if (previsao7 < 0) status = "vermelho";
    else if ((diasPendente !== null && diasPendente >= 3) || aPagarVenc[e.id] > 0 || aReceberVenc[e.id] > 0)
      status = "amarelo";
    return {
      id: e.id,
      nome: e.nome,
      caixa: caixa[e.id],
      aReceber7: aReceber7[e.id],
      aPagar7: aPagar7[e.id],
      previsao7,
      aReceberVencido: aReceberVenc[e.id],
      aPagarVencido: aPagarVenc[e.id],
      conciliadoAte: concAte[e.id],
      pendenteDesde: pendDesde[e.id],
      diasPendente,
      temExtrato: temExtrato[e.id],
      status,
      agHojeQtd: agHojeQ[e.id],
      agHojePagar: agHojeP[e.id],
      agHojeReceber: agHojeR[e.id],
      resultadoMes: resMes[e.id],
      docsNovos: docsN[e.id],
      relatorioStatus: relStatus[e.id],
      mesFechado: fechadoSet.has(e.id),
    };
  });

  const totais = {
    n: lista.length,
    caixa: lista.reduce((s, x) => s + x.caixa, 0),
    aReceber7: lista.reduce((s, x) => s + x.aReceber7, 0),
    aPagar7: lista.reduce((s, x) => s + x.aPagar7, 0),
    previsao7: lista.reduce((s, x) => s + x.previsao7, 0),
    atencao: lista.filter((x) => x.status !== "verde").length,
  };

  // agendados para hoje (data_agendamento = hoje, ainda não pagos)
  const alertas = {
    caixaNegativo: lista.filter((x) => x.previsao7 < 0).length,
    comVencidos: lista.filter((x) => x.aPagarVencido > 0 || x.aReceberVencido > 0).length,
    vencidoPagar: lista.reduce((s, x) => s + x.aPagarVencido, 0),
    vencidoReceber: lista.reduce((s, x) => s + x.aReceberVencido, 0),
    conciliacaoPendente: lista.filter((x) => x.diasPendente !== null && x.diasPendente >= 3).length,
    agHojeQtd: lista.reduce((s, x) => s + x.agHojeQtd, 0),
    agHojePagar: lista.reduce((s, x) => s + x.agHojePagar, 0),
    agHojeReceber: lista.reduce((s, x) => s + x.agHojeReceber, 0),
    comDocsNovos: lista.filter((x) => x.docsNovos > 0).length,
    docsNovosTotal: lista.reduce((s, x) => s + x.docsNovos, 0),
    relatoriosPendentes: lista.filter((x) => x.relatorioStatus === "pendente" || x.relatorioStatus === "rascunho").length,
  };

  return { empresas: lista, compFechar: ymRel, creditosIa, totais, alertas, incompleto };
}
