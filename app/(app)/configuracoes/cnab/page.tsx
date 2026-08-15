import { redirect } from "next/navigation";

// Os dados bancários e de cobrança (CNAB) agora ficam na ficha da própria
// conta, em Configurações → Contas bancárias.
export default function Page() {
  redirect("/configuracoes/contas-bancarias");
}
