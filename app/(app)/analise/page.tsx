import { redirect } from "next/navigation";

// A Análise agora vive dentro de Relatórios (último relatório).
// Mantém este redirect para links antigos.
export default function AnaliseRedirect() {
  redirect("/relatorios?modo=analise");
}
