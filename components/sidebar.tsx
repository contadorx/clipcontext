"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Home,
  PieChart,
  ArrowLeftRight,
  CalendarClock,
  Landmark,
  Inbox,
  Users,
  BadgeDollarSign,
  FileText,
  Settings,
  HelpCircle,
  CreditCard,
  Gauge,
  Calculator,
  FileDown,
} from "lucide-react";

/**
 * Navegação lateral no formato "tool page": superfície clara, itens agrupados,
 * seleção marcada por barra + fundo da marca.
 *
 * Diferença deliberada em relação ao padrão original: a navegação **fica na
 * tela**. No modelo de launchpad puro você volta para a home só para trocar de
 * área — para quem abre o sistema duas vezes por semana isso é regressão.
 *
 * A marca e o contexto (empresa, período) moram na shell bar, não aqui.
 */

const carteira = { href: "/carteira", label: "Carteira", icon: LayoutGrid };

const nav = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  { href: "/agendamento", label: "Liquidações", icon: CalendarClock },
  { href: "/conciliacao", label: "Conciliação", icon: Landmark },
  { href: "/documentos", label: "Caixa de Entrada", icon: Inbox },
  { href: "/clientes-fornecedores", label: "Clientes e Fornecedores", icon: Users },
  { href: "/vendas", label: "Serviços", icon: BadgeDollarSign },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
];

const rodape = [
  { href: "/configuracoes/assinatura", label: "Assinatura", icon: CreditCard },
  { href: "/ajuda", label: "Ajuda", icon: HelpCircle },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

// Menu enxuto do perfil Contabilidade: só configuração e exportação contábil.
const navContabil = [
  { href: "/configuracoes/contabil", label: "Config. contábil", icon: Calculator },
  { href: "/configuracoes/exportar-contabil", label: "Exportação contábil", icon: FileDown },
];

export default function Sidebar({
  colapsado = false,
  gavetaAberta = false,
  admin = false,
  papel = "membro",
  docsNovos = 0,
  menusBloqueados = [],
}: {
  logoUrl?: string | null;
  colapsado?: boolean;
  /** só vale abaixo de md, onde a navegação é gaveta e não coluna fixa */
  gavetaAberta?: boolean;
  admin?: boolean;
  papel?: string;
  docsNovos?: number;
  menusBloqueados?: string[];
  onToggle?: () => void;
}) {
  const pathname = usePathname();

  // No desktop, "aberto" é a preferência de coluna larga/estreita. Na gaveta não
  // existe coluna estreita: quem abre o menu no celular quer os rótulos, não uma
  // faixa de 56px só com ícones.
  const aberto = !colapsado || gavetaAberta;
  const larg = aberto ? "w-[214px] px-2" : "w-[56px] items-center px-1.5";

  const ehContabil = papel === "contabilidade";
  const navItens = ehContabil ? navContabil : nav;
  const rodapeVisivel =
    ehContabil || papel === "analista" ? rodape.filter((r) => r.href === "/ajuda") : rodape;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  /**
   * Funções chamadas, não componentes. Definidas no corpo do render e usadas
   * como `<Grupo>` / `<ItemLink>`, teriam identidade nova a cada render e o
   * React remontaria a navegação inteira sempre que a sidebar recalculasse — o
   * mesmo antipadrão que fez um campo de texto do app aceitar só uma letra.
   * A `key` de cada item vai no elemento de raiz.
   */
  const grupo = (titulo: string) =>
    !aberto ? (
      <div key={`sep-${titulo}`} className="my-1.5 h-px w-7 bg-line" />
    ) : (
      <p
        key={`gr-${titulo}`}
        className="px-2.5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-ink-soft"
      >
        {titulo}
      </p>
    );

  const itemLink = ({
    href,
    label,
    icon: Icon,
    badge = 0,
  }: {
    href: string;
    label: string;
    icon: typeof PieChart;
    badge?: number;
  }) => {
    const active = isActive(href);
    const cls = active
      ? "bg-brand-light text-brand-dark font-bold"
      : "text-ink-muted hover:bg-surface hover:text-ink";

    if (aberto) {
      return (
        <Link
          key={href}
          href={href}
          className={`relative flex h-9 items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-[12.5px] font-semibold transition ${cls}`}
        >
          {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand" />}
          <Icon size={16} className="shrink-0" />
          <span className="truncate">{label}</span>
          {badge > 0 && (
            <span
              className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                active ? "bg-brand/20 text-brand-dark" : "bg-surface text-ink-muted"
              }`}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </Link>
      );
    }
    return (
      <Link
        key={href}
        href={href}
        title={badge > 0 ? `${label} (${badge} novo${badge > 1 ? "s" : ""})` : label}
        className={`relative flex h-10 w-10 items-center justify-center rounded-md transition ${cls}`}
      >
        {active && <span className="absolute inset-y-2 left-[-6px] w-[3px] rounded-r bg-brand" />}
        <Icon size={18} />
        {badge > 0 && (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand ring-2 ring-white" />
        )}
      </Link>
    );
  };

  return (
    <aside
      aria-label="Navegação principal"
      // Abaixo de md a coluna fixa de 214px come metade de um celular: vira
      // gaveta, deslizando para fora da tela. De md para cima o
      // `md:translate-x-0` cancela isso e ela volta a ser coluna.
      className={`fixed inset-y-0 left-0 z-[50] flex flex-col border-r border-line bg-white pb-3 pt-[52px] transition-all md:z-30 md:translate-x-0 ${
        gavetaAberta ? "translate-x-0 shadow-xl" : "-translate-x-full"
      } ${gavetaAberta ? "w-[214px] px-2" : larg}`}
    >
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        {!ehContabil && (
          <>
            {grupo("Escritório")}
            {itemLink(carteira)}
          </>
        )}

        {grupo(ehContabil ? "Contábil" : "Empresa")}
        {navItens
          .filter((item) => !menusBloqueados.includes(item.href))
          .map((item) => itemLink({ ...item, badge: item.href === "/documentos" ? docsNovos : 0 }))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-2">
        {(admin
          ? [{ href: "/admin", label: "Painel do negócio", icon: Gauge }, ...rodapeVisivel]
          : rodapeVisivel
        )
          .filter((item) => !menusBloqueados.includes(item.href))
          .map((item) => itemLink(item))}
      </div>
    </aside>
  );
}
