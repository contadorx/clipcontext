import { Construction } from "lucide-react";
import PageHeader from "@/components/ui/page-header";

export default function EmConstrucao({
  titulo,
  descricao,
}: {
  titulo: string;
  descricao: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader titulo={titulo} />
      <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-line bg-white py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand">
          <Construction size={24} />
        </div>
        <p className="mt-4 max-w-sm text-sm text-ink-muted">{descricao}</p>
      </div>
    </div>
  );
}
