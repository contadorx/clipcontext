import { createAdminClient } from "@/lib/supabase/admin";
import { brl } from "@/lib/formato";

// Fotografia diária da operação de um escritório, consolidando todas as
// empresas ativas da carteira. Roda com client admin (sem sessão), então
// filtra explicitamente por escritorio_id -> empresas -> lançamentos.

export type DigestEmpresa = {
  empresaId: string;
  nome: string;
  venceHojePagar: number;
  venceHojeReceber: number;
  vencidoPagar: number;
  vencidoReceber: number;
  saldo: number;
};

export type DigestData = {
  escritorioNome: string;
  // totais consolidados
  venceHojePagar: number;
  venceHojeReceber: number;
  vencidoPagar: number;
  vencidoReceber: number;
  entrouOntem: number;
  saiuOntem: number;
  saldoTotal: number;
  qtdEmpresas: number;
  // empresas com algo que pede atenção hoje (vence/vencido), as mais relevantes
  empresasAtencao: DigestEmpresa[];
  // relatórios do mês ainda não publicados (só na janela de fim de mês)
  relatoriosPendentes: number;
  relatorioMesNome: string;
  temAlgoRelevante: boolean;
};

const MESES_DIGEST = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function nomeDoMes(ym: string): string {
  const m = Number((ym || "").slice(5, 7));
  return m >= 1 && m <= 12 ? MESES_DIGEST[m - 1] : ym;
}
// A partir deste dia do mês, lembramos os relatórios do MÊS ANTERIOR ainda não publicados
// (dá alguns dias pra fechar o mês antes de cobrar a publicação).
const DIA_INICIO_AVISO_RELATORIO = 5;

function hojeISO(tz = "America/Sao_Paulo"): string {
  // data local de São Paulo (o cron roda em UTC)
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(new Date());
}
function isoMaisDias(baseISO: string, dias: number): string {
  const d = new Date(baseISO + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function getDigestData(escritorioId: string, escritorioNome: string): Promise<DigestData> {
  const admin = createAdminClient();
  const hoje = hojeISO();
  const ontem = isoMaisDias(hoje, -1);

  // empresas ativas do escritório
  const { data: empresasRaw } = await admin
    .from("empresas")
    .select("id, nome, portal_libera_analise")
    .eq("escritorio_id", escritorioId)
    .eq("status", "ativa");
  const empresas = (empresasRaw ?? []) as Array<{ id: string; nome: string; portal_libera_analise: boolean | null }>;
  const idsEmpresas = empresas.map((e) => e.id);

  const vazio: DigestData = {
    escritorioNome,
    venceHojePagar: 0,
    venceHojeReceber: 0,
    vencidoPagar: 0,
    vencidoReceber: 0,
    entrouOntem: 0,
    saiuOntem: 0,
    saldoTotal: 0,
    qtdEmpresas: empresas.length,
    empresasAtencao: [],
    relatoriosPendentes: 0,
    relatorioMesNome: nomeDoMes(hoje.slice(0, 7)),
    temAlgoRelevante: false,
  };
  if (idsEmpresas.length === 0) return vazio;

  const nomePorId = new Map(empresas.map((e) => [e.id, e.nome]));
  const porEmpresa = new Map<string, DigestEmpresa>();
  for (const e of empresas) {
    porEmpresa.set(e.id, {
      empresaId: e.id,
      nome: e.nome,
      venceHojePagar: 0,
      venceHojeReceber: 0,
      vencidoPagar: 0,
      vencidoReceber: 0,
      saldo: 0,
    });
  }

  // saldo: saldo_inicial das contas + movimento de pagamentos até hoje
  const { data: contas } = await admin
    .from("contas_bancarias")
    .select("empresa_id, saldo_inicial")
    .in("empresa_id", idsEmpresas);
  for (const c of (contas ?? []) as Array<{ empresa_id: string; saldo_inicial: number }>) {
    const e = porEmpresa.get(c.empresa_id);
    if (e) e.saldo += Number(c.saldo_inicial || 0);
  }
  // pagamentos efetivados (data_pagamento <= hoje) movem o saldo
  const { data: pagos } = await admin
    .from("lancamentos")
    .select("empresa_id, tipo, valor")
    .in("empresa_id", idsEmpresas)
    .not("data_pagamento", "is", null)
    .lte("data_pagamento", hoje);
  for (const p of (pagos ?? []) as Array<{ empresa_id: string; tipo: string; valor: number }>) {
    const e = porEmpresa.get(p.empresa_id);
    if (e) e.saldo += p.tipo === "entrada" ? Number(p.valor) : -Number(p.valor);
  }

  // vence hoje e vencido (em aberto = sem data_pagamento)
  const { data: abertos } = await admin
    .from("lancamentos")
    .select("empresa_id, tipo, valor, data_vencimento")
    .in("empresa_id", idsEmpresas)
    .is("data_pagamento", null)
    .lte("data_vencimento", hoje);
  for (const a of (abertos ?? []) as Array<{ empresa_id: string; tipo: string; valor: number; data_vencimento: string }>) {
    const e = porEmpresa.get(a.empresa_id);
    if (!e) continue;
    const venc = (a.data_vencimento ?? "").slice(0, 10);
    const val = Number(a.valor);
    if (venc === hoje) {
      if (a.tipo === "saida") e.venceHojePagar += val;
      else e.venceHojeReceber += val;
    } else if (venc < hoje) {
      if (a.tipo === "saida") e.vencidoPagar += val;
      else e.vencidoReceber += val;
    }
  }

  // entrou / saiu ONTEM (pagamentos do dia anterior) — o que de fato se moveu
  const { data: ontemMov } = await admin
    .from("lancamentos")
    .select("tipo, valor")
    .in("empresa_id", idsEmpresas)
    .eq("data_pagamento", ontem);
  let entrouOntem = 0;
  let saiuOntem = 0;
  for (const m of (ontemMov ?? []) as Array<{ tipo: string; valor: number }>) {
    if (m.tipo === "entrada") entrouOntem += Number(m.valor);
    else saiuOntem += Number(m.valor);
  }

  const lista = Array.from(porEmpresa.values());
  const totais = lista.reduce(
    (acc, e) => {
      acc.venceHojePagar += e.venceHojePagar;
      acc.venceHojeReceber += e.venceHojeReceber;
      acc.vencidoPagar += e.vencidoPagar;
      acc.vencidoReceber += e.vencidoReceber;
      acc.saldoTotal += e.saldo;
      return acc;
    },
    { venceHojePagar: 0, venceHojeReceber: 0, vencidoPagar: 0, vencidoReceber: 0, saldoTotal: 0 },
  );

  // empresas que pedem atenção hoje: têm algo vencendo ou vencido
  const empresasAtencao = lista
    .filter((e) => e.venceHojePagar + e.venceHojeReceber + e.vencidoPagar + e.vencidoReceber > 0)
    .sort(
      (a, b) =>
        b.vencidoPagar + b.vencidoReceber + b.venceHojePagar + b.venceHojeReceber -
        (a.vencidoPagar + a.vencidoReceber + a.venceHojePagar + a.venceHojeReceber),
    )
    .slice(0, 8);

  const temAlgoRelevante =
    totais.venceHojePagar + totais.venceHojeReceber + totais.vencidoPagar + totais.vencidoReceber + entrouOntem + saiuOntem > 0;

  // Lembrete de relatórios do MÊS ANTERIOR ainda não publicados — a partir do dia 5
  // (depois de fechar o mês), e só para quem entrega relatório (portal ativo + análise liberada).
  const ym = hoje.slice(0, 7);
  const ymRel = (() => {
    const y = Number(ym.slice(0, 4));
    const m = Number(ym.slice(5, 7));
    return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  })();
  const diaDoMes = Number(hoje.slice(8, 10));
  let relatoriosPendentes = 0;
  if (diaDoMes >= DIA_INICIO_AVISO_RELATORIO) {
    const { data: portais } = await admin.from("portal_links").select("empresa_id, ativo").in("empresa_id", idsEmpresas);
    const portalAtivo = new Set(((portais ?? []) as Array<{ empresa_id: string; ativo: boolean }>).filter((p) => p.ativo).map((p) => p.empresa_id));
    const entrega = empresas.filter((e) => !!e.portal_libera_analise && portalAtivo.has(e.id)).map((e) => e.id);
    if (entrega.length > 0) {
      const { data: analises } = await admin.from("analises_ia").select("empresa_id, publicada").eq("competencia", ymRel).in("empresa_id", entrega);
      const publicado = new Set(((analises ?? []) as Array<{ empresa_id: string; publicada: boolean }>).filter((a) => a.publicada).map((a) => a.empresa_id));
      relatoriosPendentes = entrega.filter((id) => !publicado.has(id)).length;
    }
  }

  return {
    escritorioNome,
    ...totais,
    entrouOntem,
    saiuOntem,
    qtdEmpresas: empresas.length,
    empresasAtencao,
    relatoriosPendentes,
    relatorioMesNome: nomeDoMes(ymRel),
    temAlgoRelevante: temAlgoRelevante || relatoriosPendentes > 0,
  };
}

// Monta o corpo HTML do digest a partir dos dados. Sóbrio, escaneável,
// números à direita. Pensado para leitura rápida de manhã no celular.
export function corpoDigest(d: DigestData, urlPainel: string): { assunto: string; html: string } {
  const dataHoje = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  const linha = (rotulo: string, valor: string, cor = "#0F172A") =>
    `<tr><td style="padding:6px 0;color:#475569;font-size:14px">${rotulo}</td><td style="padding:6px 0;text-align:right;font-weight:700;font-size:14px;color:${cor}">${valor}</td></tr>`;

  const blocoHoje = `
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;margin:0 0 14px">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px">Hoje</p>
      <table style="width:100%;border-collapse:collapse">
        ${linha("A receber vencendo hoje", brl(d.venceHojeReceber), "#12A594")}
        ${linha("A pagar vencendo hoje", brl(d.venceHojePagar), "#DB2777")}
      </table>
    </div>`;

  const temVencido = d.vencidoPagar + d.vencidoReceber > 0;
  const blocoVencido = temVencido
    ? `
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:14px 16px;margin:0 0 14px">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#B91C1C;text-transform:uppercase;letter-spacing:.5px">Em atraso</p>
      <table style="width:100%;border-collapse:collapse">
        ${linha("A receber vencido", brl(d.vencidoReceber), "#B91C1C")}
        ${linha("A pagar vencido", brl(d.vencidoPagar), "#B91C1C")}
      </table>
    </div>`
    : "";

  const blocoOntem = `
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;margin:0 0 14px">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px">Movimentou ontem</p>
      <table style="width:100%;border-collapse:collapse">
        ${linha("Entrou", brl(d.entrouOntem), "#12A594")}
        ${linha("Saiu", brl(d.saiuOntem), "#DB2777")}
        ${linha("Saldo em caixa (consolidado)", brl(d.saldoTotal))}
      </table>
    </div>`;

  const blocoEmpresas =
    d.empresasAtencao.length > 0
      ? `
    <p style="margin:18px 0 8px;font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px">Empresas que pedem atenção</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${d.empresasAtencao
        .map((e) => {
          const partes: string[] = [];
          if (e.vencidoReceber + e.vencidoPagar > 0) partes.push(`<span style="color:#B91C1C">${brl(e.vencidoReceber + e.vencidoPagar)} vencido</span>`);
          if (e.venceHojeReceber + e.venceHojePagar > 0) partes.push(`${brl(e.venceHojeReceber + e.venceHojePagar)} hoje`);
          return `<tr><td style="padding:7px 0;border-top:1px solid #F1F5F9;color:#0F172A;font-weight:600">${e.nome}</td><td style="padding:7px 0;border-top:1px solid #F1F5F9;text-align:right;color:#475569">${partes.join(" · ")}</td></tr>`;
        })
        .join("")}
    </table>`
      : "";

  const blocoRelatorios =
    d.relatoriosPendentes > 0
      ? `
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:14px 16px;margin:0 0 14px">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#B45309;text-transform:uppercase;letter-spacing:.5px">Relatórios a publicar</p>
      <p style="margin:0;font-size:14px;color:#334155">
        <b>${d.relatoriosPendentes}</b> ${d.relatoriosPendentes === 1 ? "cliente ainda está" : "clientes ainda estão"} sem o relatório de <b>${d.relatorioMesNome}</b> publicado no portal.
      </p>
    </div>`
      : "";

  const assunto = temVencido
    ? `Seu dia: ${brl(d.vencidoReceber + d.vencidoPagar)} em atraso · ${dataHoje}`
    : d.relatoriosPendentes > 0
      ? `${d.relatoriosPendentes} relatório${d.relatoriosPendentes === 1 ? "" : "s"} de ${d.relatorioMesNome} a publicar · ${dataHoje}`
      : `Seu dia no FinanceiroX · ${dataHoje}`;

  const html = `
    <p style="margin:0 0 16px;font-size:14px;color:#334155">Bom dia. Aqui está a fotografia da sua carteira (${d.qtdEmpresas} empresa${d.qtdEmpresas === 1 ? "" : "s"}) para hoje, ${dataHoje}.</p>
    ${blocoHoje}
    ${blocoVencido}
    ${blocoRelatorios}
    ${blocoOntem}
    ${blocoEmpresas}`;

  return { assunto, html };
}
