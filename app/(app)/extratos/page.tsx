import { redirect } from "next/navigation";

// A tela de Contas & Extratos foi unificada com a Movimentações.
export default function ExtratosPage() {
  redirect("/movimentacoes");
}
