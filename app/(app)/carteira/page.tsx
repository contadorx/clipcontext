import Link from "next/link";
import PageHeader from "@/components/ui/page-header";
import { getCarteiraData } from "@/lib/carteira";
import CarteiraClient from "@/components/carteira/carteira-client";

const PLABEL: Record<string, string> = {
  hoje: "hoje", "3": "3 dias", "7": "7 dias", "15": "15 dias", "30": "30 dias", mes: "mês corrente",
};

export default async function CarteiraPage({ searchParams }: { searchParams: { periodo?: string } }) {
  const periodos = ["hoje", "3", "7", "15", "30", "mes"];
  const periodo = periodos.includes(searchParams.periodo ?? "") ? (searchParams.periodo as string) : "7";
  const dados = await getCarteiraData(periodo);
  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Carteira"
        sub={`Visão de todas as empresas: caixa, previsão de ${PLABEL[periodo]} e situação da conciliação.`}
        acoes={
          <Link
            href="/carteira/gerenciar"
            className="shrink-0 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
          >
            Gerenciar
          </Link>
        }
      />
      <CarteiraClient dados={dados} periodo={periodo} />
    </div>
  );
}
