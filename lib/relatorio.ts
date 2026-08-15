import { createClient } from "@/lib/supabase/server";
import { carregarRateios, recortarPorCentro } from "@/lib/rateio";

const soma = (a: number[]) => a.reduce((x, y) => x + y, 0);

export type CategoriaRel = {
  id: string;
  nome: string;
  valores: number[]; // 12 meses, com sinal
  total: number;
};

export type GrupoRel = {
  id: string;
  nome: string;
  eh_receita: boolean;
  categorias: CategoriaRel[]; // contas do grupo com movimento no periodo
  valores: number[]; // 12 meses, já com sinal (entrada +, saída −)
  total: number;
};

export type SecaoRel = {
  chave: string;
  titulo: string;
  grupos: GrupoRel[];
  subtotal: number[];
  subtotalTotal: number;
  entraResultado: boolean;
};

export type Relatorio = {
  secoes: SecaoRel[];
  resultado: number[]; // resultado liquido (operacional + financeiro)
  resultadoTotal: number;
  resultadoOperacional: number[];
  resultadoOperacionalTotal: number;
  temGrupos: boolean;
  // Totais do período (regime escolhido), para indicadores e análise vertical.
  totalReceitas: number; // soma das entradas (valor absoluto)
  totalDespesas: number; // soma das saídas (valor absoluto)
  receitasMensais: number[]; // 12 meses (valor absoluto)
  despesasMensais: number[]; // 12 meses (valor absoluto)
  // Aviso de qualidade: lançamentos sem categoria que entraram no resultado.
  semCategoria: { qtd: number; total: number };
  // Aviso de qualidade: lançamentos cujo tipo diverge da natureza do grupo.
  divergencias: number;
};

const SECOES = [
  { chave: "operacionais", titulo: "Atividades Operacionais", entraResultado: true },
  { chave: "financeiro", titulo: "Resultado Financeiro", entraResultado: true },
  { chave: "caixa", titulo: "Atividades de Caixa", entraResultado: false },
];

// Demonstração de RESULTADO (gerencial). O sinal de cada lançamento segue o seu
// tipo (entrada soma, saída subtrai) — o grupo apenas organiza/classifica. Assim um
// estorno (saída numa conta de receita) reduz a receita, e nada fica "positivo por engano".
// Lançamentos sem categoria não somem: entram na linha "Não categorizado".
export async function getRelatorio(
  empresaId: string,
  ano: number,
  base: "competencia" | "vencimento" | "pagamento",
  centroId?: string,
): Promise<Relatorio> {
  const supabase = createClient();
  const [{ data: gruposRaw }, { data: catsRaw }, { data: lancRaw }] = await Promise.all([
    supabase
      .from("grupos_categoria")
      .select("id, nome, secao, eh_receita, ordem")
      .eq("empresa_id", empresaId)
      .order("ordem"),
    supabase.from("categorias").select("id, grupo_id, nome").eq("empresa_id", empresaId),
    supabase
      .from("lancamentos")
      .select("id, categoria_id, valor, tipo, data_pagamento, data_competencia, data_vencimento, centro_custo_id")
      .not("transferencia", "is", true)
      .eq("empresa_id", empresaId),
  ]);

  const grupos = (gruposRaw ?? []) as Array<{
    id: string;
    nome: string;
    secao: string;
    eh_receita: boolean;
  }>;
  const cats = (catsRaw ?? []) as Array<{ id: string; grupo_id: string; nome: string }>;
  const lanc = (lancRaw ?? []) as Array<{
    id: string;
    categoria_id: string | null;
    valor: number;
    tipo: "entrada" | "saida";
    data_pagamento: string | null;
    data_competencia: string;
    data_vencimento: string | null;
    centro_custo_id: string | null;
  }>;

  const catParaGrupo = new Map<string, string>();
  for (const c of cats) catParaGrupo.set(c.id, c.grupo_id);
  const grupoEhReceita = new Map<string, boolean>();
  for (const g of grupos) grupoEhReceita.set(g.id, g.eh_receita);

  // categorias de cada grupo (para abrir o plano de contas no relatorio)
  const catsDoGrupo = new Map<string, Array<{ id: string; nome: string }>>();
  for (const c of cats) {
    if (!catsDoGrupo.has(c.grupo_id)) catsDoGrupo.set(c.grupo_id, []);
    catsDoGrupo.get(c.grupo_id)!.push({ id: c.id, nome: c.nome });
  }

  const grid = new Map<string, number[]>();
  for (const g of grupos) grid.set(g.id, new Array(12).fill(0));
  const gridCat = new Map<string, number[]>();
  for (const c of cats) gridCat.set(c.id, new Array(12).fill(0));
  const semCat = new Array(12).fill(0);
  let semCatQtd = 0;
  let divergencias = 0;

  let totalReceitas = 0;
  let totalDespesas = 0;
  const receitasMensais = new Array(12).fill(0);
  const despesasMensais = new Array(12).fill(0);
  // Filtro por centro respeita rateio: o lançamento rateado entra com a parte
  // que cabe àquele centro, não com o valor cheio.
  const rateios = centroId ? await carregarRateios(supabase, empresaId, lanc.map((l) => l.id)) : null;
  const lancF = centroId && rateios ? recortarPorCentro(lanc, rateios, centroId) : lanc;
  for (const l of lancF) {
    const data =
      base === "pagamento" ? l.data_pagamento : base === "vencimento" ? l.data_vencimento : l.data_competencia;
    if (!data) continue;
    if (Number(data.slice(0, 4)) !== ano) continue;
    const m = Number(data.slice(5, 7)) - 1;
    if (m < 0 || m > 11) continue;
    const v = l.tipo === "entrada" ? Number(l.valor) : -Number(l.valor);
    if (l.tipo === "entrada") {
      totalReceitas += Number(l.valor);
      receitasMensais[m] += Number(l.valor);
    } else {
      totalDespesas += Number(l.valor);
      despesasMensais[m] += Number(l.valor);
    }
    const gid = l.categoria_id ? catParaGrupo.get(l.categoria_id) : undefined;
    if (gid && grid.has(gid)) {
      grid.get(gid)![m] += v;
      if (l.categoria_id && gridCat.has(l.categoria_id)) gridCat.get(l.categoria_id)![m] += v;
      // tipo diverge da natureza do grupo? (entrada em grupo de despesa, ou vice-versa)
      const ehRec = grupoEhReceita.get(gid);
      if (ehRec !== undefined && ((l.tipo === "entrada") !== ehRec)) divergencias++;
    } else {
      semCat[m] += v;
      semCatQtd++;
    }
  }

  const secoes: SecaoRel[] = [];
  const resultado = new Array(12).fill(0); // liquido: so secoes que entram no resultado
  const resultadoOperacional = new Array(12).fill(0);

  for (const s of SECOES) {
    const gs = grupos.filter((g) => g.secao === s.chave);
    if (gs.length === 0) continue;
    const gruposRel: GrupoRel[] = gs.map((g) => {
      const valores = grid.get(g.id) ?? new Array(12).fill(0);
      const categorias: CategoriaRel[] = (catsDoGrupo.get(g.id) ?? [])
        .map((c) => {
          const cv = gridCat.get(c.id) ?? new Array(12).fill(0);
          return { id: c.id, nome: c.nome, valores: cv, total: soma(cv) };
        })
        .filter((c) => c.valores.some((x) => x !== 0))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return { id: g.id, nome: g.nome, eh_receita: g.eh_receita, valores, total: soma(valores), categorias };
    });
    const subtotal = new Array(12).fill(0);
    for (const g of gruposRel) for (let m = 0; m < 12; m++) subtotal[m] += g.valores[m];
    if (s.entraResultado) for (let m = 0; m < 12; m++) resultado[m] += subtotal[m];
    if (s.chave === "operacionais") for (let m = 0; m < 12; m++) resultadoOperacional[m] += subtotal[m];
    secoes.push({
      chave: s.chave,
      titulo: s.titulo,
      grupos: gruposRel,
      subtotal,
      subtotalTotal: soma(subtotal),
      entraResultado: s.entraResultado,
    });
  }

  // Linha "Não categorizado" — para o resultado fechar com o caixa/competência real.
  if (semCatQtd > 0) {
    const grupo: GrupoRel = {
      id: "__sem_categoria__",
      nome: "Não categorizado",
      eh_receita: false,
      valores: semCat,
      total: soma(semCat),
      categorias: [],
    };
    for (let m = 0; m < 12; m++) resultado[m] += semCat[m];
    secoes.push({
      chave: "nao_categorizado",
      titulo: "Não categorizado",
      grupos: [grupo],
      subtotal: [...semCat],
      subtotalTotal: soma(semCat),
      entraResultado: true,
    });
  }

  return {
    secoes,
    resultado,
    resultadoTotal: soma(resultado),
    resultadoOperacional,
    resultadoOperacionalTotal: soma(resultadoOperacional),
    temGrupos: grupos.length > 0,
    totalReceitas,
    totalDespesas,
    receitasMensais,
    despesasMensais,
    semCategoria: { qtd: semCatQtd, total: soma(semCat) },
    divergencias,
  };
}

// ----------------------------------------------------------------------------
// Demonstração de FLUXO DE CAIXA (DFC), regime de caixa (data de pagamento).
// Saldo inicial → recebimentos → pagamentos → saldo final, mês a mês, partindo do
// saldo inicial das contas + tudo que foi movimentado antes do 1º dia do ano.
// Transferências entre contas são ignoradas (não mudam o caixa consolidado).
// ----------------------------------------------------------------------------
export type FluxoGrupoRel = { id: string; nome: string; valores: number[]; total: number };
export type FluxoSecaoRel = {
  chave: string;
  titulo: string;
  entraResultado: boolean;
  grupos: FluxoGrupoRel[];
  subtotal: number[];
  subtotalTotal: number;
};
export type FluxoCaixa = {
  recebimentos: number[]; // 12 meses
  pagamentos: number[]; // 12 meses (valores positivos do que saiu)
  geracao: number[]; // recebimentos - pagamentos
  saldoInicial: number[]; // saldo no inicio de cada mes
  saldoFinal: number[]; // saldo no fim de cada mes (acumulado)
  saldoInicialPeriodo: number; // saldo no 1o dia do ano
  totalReceb: number;
  totalPag: number;
  temDados: boolean;
  // Quebra por atividade (regime caixa, liquido com sinal). Operacional/Financeiro
  // entram no resultado; Caixa (investimento/financiamento) fica fora.
  secoes: FluxoSecaoRel[];
  semGrupo: number[]; // lancamentos pagos sem categoria
  semGrupoTotal: number;
};

export async function getFluxoCaixa(empresaId: string, ano: number, centroId?: string): Promise<FluxoCaixa> {
  const supabase = createClient();
  const [{ data: contasRaw }, { data: gruposRaw }, { data: catsRaw }, { data: lancRaw }] = await Promise.all([
    supabase.from("contas_bancarias").select("saldo_inicial").eq("empresa_id", empresaId),
    supabase
      .from("grupos_categoria")
      .select("id, nome, secao, ordem")
      .eq("empresa_id", empresaId)
      .order("ordem"),
    supabase.from("categorias").select("id, grupo_id").eq("empresa_id", empresaId),
    supabase
      .from("lancamentos")
      .select("id, tipo, valor, data_pagamento, categoria_id, centro_custo_id")
      .eq("empresa_id", empresaId)
      .not("transferencia", "is", true)
      .not("data_pagamento", "is", null),
  ]);

  const contas = (contasRaw ?? []) as Array<{ saldo_inicial: number }>;
  const grupos = (gruposRaw ?? []) as Array<{ id: string; nome: string; secao: string }>;
  const cats = (catsRaw ?? []) as Array<{ id: string; grupo_id: string }>;
  const lanc = (lancRaw ?? []) as Array<{
    id: string;
    tipo: "entrada" | "saida";
    valor: number;
    data_pagamento: string;
    categoria_id: string | null;
    centro_custo_id: string | null;
  }>;

  const catParaGrupo = new Map<string, string>();
  for (const c of cats) catParaGrupo.set(c.id, c.grupo_id);

  const saldoContas = contas.reduce((s, c) => s + Number(c.saldo_inicial || 0), 0);
  const ini = `${ano}-01-01`;

  let antes = 0;
  const receb = new Array(12).fill(0);
  const pag = new Array(12).fill(0);
  const grid = new Map<string, number[]>();
  for (const g of grupos) grid.set(g.id, new Array(12).fill(0));
  const semGrupo = new Array(12).fill(0);

  const rateiosDfc = centroId ? await carregarRateios(supabase, empresaId, lanc.map((l) => l.id)) : null;
  const lancF = centroId && rateiosDfc ? recortarPorCentro(lanc, rateiosDfc, centroId) : lanc;
  for (const l of lancF) {
    const d = l.data_pagamento;
    if (!d) continue;
    const v = Number(l.valor);
    if (d < ini) {
      antes += l.tipo === "entrada" ? v : -v;
      continue;
    }
    if (Number(d.slice(0, 4)) !== ano) continue;
    const m = Number(d.slice(5, 7)) - 1;
    if (m < 0 || m > 11) continue;
    if (l.tipo === "entrada") receb[m] += v;
    else pag[m] += v;
    const liquido = l.tipo === "entrada" ? v : -v;
    const gid = l.categoria_id ? catParaGrupo.get(l.categoria_id) : undefined;
    if (gid && grid.has(gid)) grid.get(gid)![m] += liquido;
    else semGrupo[m] += liquido;
  }

  const saldoInicialPeriodo = saldoContas + antes;
  const geracao = new Array(12).fill(0);
  const saldoInicial = new Array(12).fill(0);
  const saldoFinal = new Array(12).fill(0);
  let acum = saldoInicialPeriodo;
  for (let m = 0; m < 12; m++) {
    saldoInicial[m] = acum;
    geracao[m] = receb[m] - pag[m];
    acum += geracao[m];
    saldoFinal[m] = acum;
  }

  // Monta as secoes com os grupos que tiveram movimento no ano.
  const secoes: FluxoSecaoRel[] = [];
  for (const sec of SECOES) {
    const gs = grupos.filter((g) => g.secao === sec.chave);
    if (gs.length === 0) continue;
    const gruposRel: FluxoGrupoRel[] = gs
      .map((g) => {
        const valores = grid.get(g.id) ?? new Array(12).fill(0);
        return { id: g.id, nome: g.nome, valores, total: soma(valores) };
      })
      .filter((g) => g.valores.some((v) => v !== 0));
    const subtotal = new Array(12).fill(0);
    for (const g of gruposRel) for (let m = 0; m < 12; m++) subtotal[m] += g.valores[m];
    secoes.push({
      chave: sec.chave,
      titulo: sec.titulo,
      entraResultado: sec.entraResultado,
      grupos: gruposRel,
      subtotal,
      subtotalTotal: soma(subtotal),
    });
  }

  return {
    recebimentos: receb,
    pagamentos: pag,
    geracao,
    saldoInicial,
    saldoFinal,
    saldoInicialPeriodo,
    totalReceb: soma(receb),
    totalPag: soma(pag),
    temDados: contas.length > 0 || lanc.length > 0,
    secoes,
    semGrupo,
    semGrupoTotal: soma(semGrupo),
  };
}
