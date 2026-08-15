import { redirect } from "next/navigation";

// O faturamento do negócio foi unificado na tela de Notas (define o Master,
// emite a NFS-e e gera o contas a receber). Mantém o link antigo funcionando.
export default function NegocioPage() {
  redirect("/admin/notas");
}
