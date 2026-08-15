import Link from "next/link";
import EmpresaSelector from "@/components/empresa-selector";
import PeriodoSelector from "@/components/periodo-selector";
import UserMenu from "@/components/user-menu";
import AtalhoBusca from "@/components/ui/atalho-busca";
import type { Empresa } from "@/lib/empresa";
import { MarcaFX } from "@/components/marca";

/**
 * Shell bar: faixa fina e fixa no topo, igual em todas as telas.
 * Carrega marca, contexto (empresa e período) e as ações globais — busca e
 * usuário. O título da tela fica no cabeçalho da página, não aqui.
 */
export default function Topbar({
  empresas,
  atualId,
  userEmail,
  periodoPreset,
  periodoLabel,
  escritorioNome,
  logoUrl,
  papel = "membro",
}: {
  empresas: Empresa[];
  atualId: string;
  userEmail: string;
  periodoPreset: string;
  periodoLabel: string;
  escritorioNome: string;
  logoUrl: string | null;
  papel?: string;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-[52px] items-center gap-2 border-b border-line bg-white pl-12 pr-3 shadow-[0_1px_2px_rgba(90,107,123,.10)]">
      <Link
        href={papel === "contabilidade" ? "/configuracoes/exportar-contabil" : "/inicio"}
        className="flex items-center gap-2 overflow-hidden pl-0.5"
        title="Início"
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={escritorioNome || "Logo"}
            className="h-7 w-auto max-w-[130px] object-contain"
          />
        ) : (
          <MarcaFX tamanho={28} />
        )}
        <span className="hidden truncate text-sm font-bold text-ink sm:block">
          {escritorioNome || "FinanceiroX"}
        </span>
      </Link>

      <span className="mx-1 hidden h-5 w-px bg-line sm:block" />

      <EmpresaSelector empresas={empresas} atualId={atualId} papel={papel} />
      <PeriodoSelector preset={periodoPreset} label={periodoLabel} />

      <div className="flex-1" />

      <AtalhoBusca />
      <UserMenu email={userEmail} />
    </header>
  );
}
