import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Lock, Bot, BellRing, MessageSquare, MessageSquareText, Ticket, FileText, Tag, HelpCircle } from "lucide-react";
import AdminContas, { type Conta } from "@/components/admin/admin-contas";
import DigestDisparo from "@/components/admin/digest-disparo";
import PageHeader from "@/components/ui/page-header";
import Card from "@/components/ui/card";
import { brl } from "@/lib/formato";

type Negocio = {
  mrr: number;
  mrr_potencial: number;
  total: number;
  ativa: number;
  trial: number;
  selecionada: number;
  cancelada: number;
  novos_30d: number;
  por_ciclo: { mensal: number; semestral: number; anual: number };
  serie: { mes: string; novos: number }[];
  teste: number;
  lista: Conta[];
};

function mesLabel(m: string) {
  const [a, mm] = m.split("-");
  const nomes = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[Number(mm)]}/${a.slice(2)}`;
}

export default async function AdminPage() {
  const supabase = createClient();
  const { data } = await supabase.rpc("painel_negocio");
  const n = data as Negocio | null;

  if (!n) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm rounded-xl2 bg-white p-8 text-center shadow-card">
          <Lock size={24} className="mx-auto text-ink-soft" />
          <h1 className="mt-2 text-lg font-bold text-ink">Painel restrito</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Este painel é só para administradores do FinanceiroX.
          </p>
        </div>
      </div>
    );
  }

  const maxSerie = Math.max(1, ...n.serie.map((s) => s.novos));
  const ticketMedio = n.ativa > 0 ? Number(n.mrr) / n.ativa : 0;

  // uso de IA (observabilidade de custo) — só roda para admin (n != null)
  let iaMes = 0;
  let iaHoje = 0;
  try {
    const admin = createAdminClient();
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const [mesRes, diaRes] = await Promise.all([
      admin.from("ia_uso").select("id", { count: "exact", head: true }).eq("ok", true).gte("criado_em", inicioMes.toISOString()),
      admin.from("ia_uso").select("id", { count: "exact", head: true }).eq("ok", true).gte("criado_em", inicioDia.toISOString()),
    ]);
    iaMes = mesRes.count ?? 0;
    iaHoje = diaRes.count ?? 0;
  } catch {
    /* tabela ainda não criada ou sem service role: deixa zerado */
  }

  const kpis = [
    { label: "MRR (pagantes)", valor: brl(Number(n.mrr)), tom: "text-brand", destaque: true },
    { label: "Ticket médio", valor: ticketMedio > 0 ? brl(ticketMedio) : "—", tom: "text-ink", sub: "por escritório pagante" },
    { label: "MRR potencial", valor: brl(Number(n.mrr_potencial)), tom: "text-ink", sub: "planos selecionados" },
    { label: "Assinantes ativos", valor: String(n.ativa), tom: "text-ink" },
    { label: "Em trial", valor: String(n.trial), tom: "text-ink" },
    { label: "Selecionaram plano", valor: String(n.selecionada), tom: "text-ink", sub: "aguardando pagamento" },
    { label: "Novos (30 dias)", valor: String(n.novos_30d), tom: "text-ink" },
    { label: "Análises de IA (mês)", valor: String(iaMes), tom: "text-ink", sub: `${iaHoje} hoje` },
    { label: "Churn mensal", valor: "—", tom: "text-ink-soft", sub: "precisa de histórico" },
    { label: "LTV estimado", valor: "—", tom: "text-ink-soft", sub: "precisa de churn" },
    { label: "Contas de teste", valor: String(n.teste), tom: "text-ink-soft", sub: "fora das métricas" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Painel do negócio"
        sub="Métricas do FinanceiroX — todos os escritórios."
        acoes={
          <>
          <a
            href="/admin/notas"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
          >
            <FileText size={15} /> Faturamento
          </a>
          <a
            href="/admin/cobranca"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
          >
            <BellRing size={15} /> Cobrança
          </a>
          <a
            href="/admin/comunicacao"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
          >
            <MessageSquare size={15} /> Comunicação
          </a>
          <a
            href="/admin/assistente"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
          >
            <Bot size={15} /> Assistente
          </a>
          <a
            href="/admin/cupons"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
          >
            <Ticket size={15} /> Cupons
          </a>
          <a
            href="/admin/precos"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
          >
            <Tag size={15} /> Preços
          </a>
          <a
            href="/admin/feedbacks"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
          >
            <MessageSquareText size={15} /> Feedbacks
          </a>
          <a
            href="/admin/ajuda"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
          >
            <HelpCircle size={15} /> Central de Ajuda
          </a>
          </>
        }
      />

      {/* Disparo manual do resumo diário */}
      <DigestDisparo />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={[
              "rounded-xl2 bg-white p-4 shadow-card",
              k.destaque ? "ring-2 ring-brand" : "border border-line",
            ].join(" ")}
          >
            <p className="text-xs font-semibold text-ink-muted">{k.label}</p>
            <p className={`num mt-1 text-xl font-extrabold ${k.tom}`}>{k.valor}</p>
            {k.sub && <p className="mt-0.5 text-[11px] text-ink-soft">{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        {/* novos por mês */}
        <Card titulo="Novos escritórios por mês">
          {n.serie.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Sem dados ainda.</p>
          ) : (
            <div className="flex items-end justify-between gap-3" style={{ height: 160 }}>
              {n.serie.map((s) => (
                <div key={s.mes} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="num text-xs font-bold text-ink">{s.novos}</span>
                  <div
                    className="w-full max-w-[46px] rounded-t bg-brand"
                    style={{ height: `${(s.novos / maxSerie) * 120}px` }}
                  />
                  <span className="text-[10px] text-ink-soft">{mesLabel(s.mes)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ciclos */}
        <Card titulo="Por ciclo">
          <div className="space-y-3">
            {[
              { l: "Mensal", v: n.por_ciclo.mensal },
              { l: "Semestral", v: n.por_ciclo.semestral },
              { l: "Anual", v: n.por_ciclo.anual },
            ].map((c) => (
              <div key={c.l} className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{c.l}</span>
                <span className="num font-bold text-ink">{c.v}</span>
              </div>
            ))}
            <div className="border-t border-line pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Cancelados</span>
                <span className="num font-bold text-ink">{n.cancelada}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-ink-muted">Total de contas</span>
                <span className="num font-bold text-ink">{n.total}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* lista de escritórios */}
      <AdminContas lista={n.lista} />

      <p className="text-[11px] text-ink-soft">
        MRR conta apenas escritórios com pagamento confirmado (status ativa). O MRR potencial soma quem já escolheu
        plano mas ainda não pagou — vira MRR quando a cobrança (Asaas) confirmar.
      </p>
    </div>
  );
}
