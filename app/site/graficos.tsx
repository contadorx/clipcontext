/**
 * Peças gráficas do site público.
 *
 * O site anterior (o index do HostGator) tinha um vocabulário visual que a
 * primeira versão desta home deixou cair: hero escuro com brilhos radiais,
 * mockup do produto numa janela de navegador, KPIs, pílulas de status. Estas
 * peças o trazem de volta — com uma diferença deliberada: os mockups copiam o
 * PRODUTO como ele é hoje (as pílulas do `ObjectStatus`, as cores do gráfico do
 * Fluxo, os textos das telas reais), não uma idealização. O mockup é uma
 * promessa; quanto mais perto da tela real, menor a distância entre o que se
 * viu no site e o que se recebe no primeiro login.
 *
 * Tudo aqui é server-rendered, sem JavaScript de cliente: são divs, SVG e
 * Tailwind. Números são texto estático — massa de demonstração, não dado.
 */

/* ── fundo decorativo ─────────────────────────────────────────────────────
   Os dois brilhos radiais (teal e magenta) do hero antigo, mais uma grade
   sutil. `pointer-events-none` e `aria-hidden`: é cenografia, não conteúdo. */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -top-32 right-[-10%] h-[520px] w-[720px] rounded-full opacity-25"
        style={{ background: "radial-gradient(closest-side, #12A594, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-40%] left-[-12%] h-[480px] w-[640px] rounded-full opacity-[.14]"
        style={{ background: "radial-gradient(closest-side, #DB2777, transparent 70%)" }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[.05]" aria-hidden>
        <defs>
          <pattern id="grade-hero" width="42" height="42" patternUnits="userSpaceOnUse">
            <path d="M42 0H0V42" fill="none" stroke="#fff" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grade-hero)" />
      </svg>
    </div>
  );
}

/* ── janela de aplicativo ─────────────────────────────────────────────────
   A moldura de navegador do site antigo: barra com três pontos e uma aba. */
export function JanelaApp({
  aba,
  children,
  moldura = "clara",
  className = "",
}: {
  aba: string;
  children: React.ReactNode;
  /** "escura" para fundo escuro (borda clara + sombra funda); "clara" para seção branca. */
  moldura?: "escura" | "clara";
  className?: string;
}) {
  const borda =
    moldura === "escura"
      ? "border-white/50 shadow-[0_24px_60px_-12px_rgba(11,30,40,.45)]"
      : "border-line shadow-card";
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white ${borda} ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#D6DCE2]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#D6DCE2]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#D6DCE2]" />
        <span className="ml-2 truncate text-[11px] font-bold text-ink-muted">{aba}</span>
      </div>
      {children}
    </div>
  );
}

/* ── pílula de status ─────────────────────────────────────────────────────
   As MESMAS classes do `ObjectStatus` do produto (positivo/crítico/negativo).
   Se o produto mudar o semáforo, o site é atualizado junto — de propósito. */
function Pilula({ tom, children }: { tom: "ok" | "atencao" | "atraso"; children: React.ReactNode }) {
  const cls =
    tom === "ok"
      ? "bg-brand-light text-brand-dark"
      : tom === "atencao"
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-danger";
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${cls}`}>
      {children}
    </span>
  );
}

/* ── mockup: Carteira (o hero) ────────────────────────────────────────────── */
const EMPRESAS_DEMO = [
  { ini: "P", cor: "bg-rail", nome: "Padaria Estrela", sub: "conciliado hoje", valor: "R$ 22.480", tom: "ok" as const, pill: "Em dia" },
  { ini: "A", cor: "bg-brand", nome: "Auto Peças Veloz", sub: "3 linhas a conciliar", valor: "R$ 58.910", tom: "atencao" as const, pill: "Atenção" },
  { ini: "T", cor: "bg-accent-dark", nome: "TechFlow Ltda", sub: "extrato há 4 dias", valor: "R$ 9.230", tom: "atraso" as const, pill: "Atrasado" },
  { ini: "C", cor: "bg-rail", nome: "Clínica Bem Viver", sub: "conciliado ontem", valor: "R$ 41.700", tom: "ok" as const, pill: "Em dia" },
];

export function MockCarteira() {
  return (
    <JanelaApp aba="Carteira · 6 empresas" moldura="escura">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] font-extrabold tracking-tight text-ink">Visão da carteira</span>
          <span className="text-[10.5px] font-semibold text-ink-soft">previsão · 15 dias</span>
        </div>
        <div className="mb-3.5 grid grid-cols-3 gap-2">
          {[
            { l: "Caixa total", v: "R$ 184k", pos: true },
            { l: "A receber", v: "R$ 47k", pos: false },
            { l: "A pagar", v: "R$ 31k", pos: false },
          ].map((k) => (
            <div key={k.l} className="rounded-lg border border-brand/15 bg-brand-50 px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-ink-soft">{k.l}</p>
              <p className={`text-[14px] font-extrabold tracking-tight ${k.pos ? "text-brand-dark" : "text-ink"}`}>{k.v}</p>
            </div>
          ))}
        </div>
        <div>
          {EMPRESAS_DEMO.map((e) => (
            <div key={e.nome} className="flex items-center gap-2.5 border-b border-line py-2 last:border-0">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold text-white ${e.cor}`}>
                {e.ini}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[12px] font-bold text-ink">{e.nome}</b>
                <small className="text-[10px] font-medium text-ink-soft">{e.sub}</small>
              </span>
              <span className="text-[12px] font-extrabold tracking-tight text-ink">{e.valor}</span>
              <Pilula tom={e.tom}>{e.pill}</Pilula>
            </div>
          ))}
        </div>
      </div>
    </JanelaApp>
  );
}

/* ── mockup: Conciliação ──────────────────────────────────────────────────── */
const LINHAS_CONC = [
  { extrato: "PIX RECEB PADARIA ESTR", valor: "R$ 1.250,00", lanc: "Venda #1042 · boleto", tom: "ok" as const, pill: "Casado" },
  { extrato: "TED FORNEC EMBALAMAX", valor: "R$ 3.418,90", lanc: "Embalagens · agosto", tom: "ok" as const, pill: "Casado" },
  { extrato: "PAG BOLETO ENERGIA SP", valor: "R$ 862,45", lanc: "Energia elétrica", tom: "atencao" as const, pill: "≈ R$ 0,12" },
  { extrato: "TARIFA PACOTE SERVICOS", valor: "R$ 89,90", lanc: "sugestão: Tarifas bancárias", tom: "atencao" as const, pill: "Sugerido" },
];

export function MockConciliacao({ className = "" }: { className?: string }) {
  return (
    <JanelaApp aba="Conciliação · Itaú · 42 linhas" className={className}>
      <div className="p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[12px] font-extrabold text-ink">38 casadas sozinhas</span>
          <span className="rounded-lg bg-brand px-2.5 py-1 text-[10px] font-extrabold text-white">Confirmar lote</span>
        </div>
        {LINHAS_CONC.map((l) => (
          <div key={l.extrato} className="flex items-center gap-2 border-b border-line py-2 last:border-0">
            <span className="min-w-0 flex-1">
              <b className="block truncate font-mono text-[10px] font-bold text-ink-muted">{l.extrato}</b>
              <small className="text-[10.5px] font-semibold text-ink">{l.valor}</small>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#12A594" strokeWidth="2.5" aria-hidden>
              <path d="M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold text-ink-muted">{l.lanc}</span>
            <Pilula tom={l.tom}>{l.pill}</Pilula>
          </div>
        ))}
      </div>
    </JanelaApp>
  );
}

/* ── mockup: Fluxo (gráfico entradas × saídas) ────────────────────────────
   As cores são as do gráfico REAL do Fluxo: teal para entradas, o cinza
   #7C8B9A para saídas. Barras finas, topo arredondado, legenda com rótulo —
   identidade nunca só pela cor. */
const BARRAS = [
  { e: 62, s: 38 },
  { e: 48, s: 44 },
  { e: 74, s: 52 },
  { e: 58, s: 40 },
  { e: 86, s: 47 },
  { e: 70, s: 36 },
];

export function MockFluxo({ className = "" }: { className?: string }) {
  return (
    <JanelaApp aba="Fluxo de caixa · mar–ago" className={className}>
      <div className="p-4">
        <div className="mb-3 grid grid-cols-2 gap-2">
          {[
            { l: "Saldo atual", v: "R$ 41.700", cor: "text-brand-dark" },
            { l: "Resultado", v: "+ R$ 8.240", cor: "text-brand-dark" },
          ].map((k) => (
            <div key={k.l} className="rounded-lg border border-line px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-ink-soft">{k.l}</p>
              <p className={`text-[14px] font-extrabold tracking-tight ${k.cor}`}>{k.v}</p>
            </div>
          ))}
        </div>
        <div className="flex h-[92px] items-end gap-2 border-b border-line pb-px" aria-hidden>
          {BARRAS.map((b, i) => (
            <div key={i} className="flex flex-1 items-end justify-center gap-[3px]">
              <span className="w-full max-w-[14px] rounded-t bg-brand" style={{ height: `${b.e}px` }} />
              <span className="w-full max-w-[14px] rounded-t bg-[#7C8B9A]" style={{ height: `${b.s}px` }} />
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex gap-4">
          <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-muted">
            <i className="h-2 w-2 rounded-sm bg-brand" /> Entradas
          </span>
          <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink-muted">
            <i className="h-2 w-2 rounded-sm bg-[#7C8B9A]" /> Saídas
          </span>
        </div>
      </div>
    </JanelaApp>
  );
}

/* ── mockup: Portal do cliente ────────────────────────────────────────────── */
export function MockPortal({ className = "" }: { className?: string }) {
  return (
    <JanelaApp aba="portal · Clínica Bem Viver" className={className}>
      <div className="bg-rail p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/15 text-[10px] font-extrabold text-white">B</span>
          <span className="text-[11.5px] font-extrabold text-white">Bem Viver · agosto</span>
          <span className="ml-auto rounded-full bg-brand/20 px-2 py-0.5 text-[9px] font-extrabold text-[#5FE9D4]">sua marca</span>
        </div>
      </div>
      <div className="p-4">
        <div className="mb-3 grid grid-cols-2 gap-2">
          {[
            { l: "Resultado do mês", v: "+ R$ 12.480", cor: "text-brand-dark" },
            { l: "Caixa hoje", v: "R$ 41.700", cor: "text-ink" },
          ].map((k) => (
            <div key={k.l} className="rounded-lg border border-line px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-ink-soft">{k.l}</p>
              <p className={`text-[14px] font-extrabold tracking-tight ${k.cor}`}>{k.v}</p>
            </div>
          ))}
        </div>
        <p className="mb-2 text-[10.5px] leading-relaxed text-ink-muted">
          &quot;O mês fechou positivo: as vendas subiram 9% e a folha se manteve…&quot;
        </p>
        <div className="flex items-center justify-between rounded-lg border border-dashed border-brand/40 bg-brand-50 px-3 py-2">
          <span className="text-[10.5px] font-bold text-brand-dark">Enviar documento</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0E8577" strokeWidth="2.5" aria-hidden>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </div>
      </div>
    </JanelaApp>
  );
}
