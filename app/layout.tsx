import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinanceiroX",
  description:
    "Gestão financeira completa: conciliação bancária, contas a pagar e receber, fluxo de caixa, pagamentos em lote, cobrança e NFS-e — para uma empresa ou para uma carteira inteira.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Densidade escolhida pela pessoa (menu do usuário). Vem do cookie para o
  // primeiro paint já sair no tamanho certo, sem piscar.
  const densidade = cookies().get("fx_densidade")?.value ?? "compacta";

  return (
    <html lang="pt-BR" data-densidade={densidade}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
