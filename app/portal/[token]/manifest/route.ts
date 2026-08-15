import { dadosDoPortal } from "@/lib/portal-sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { token: string } }) {
  /*
    Sem exigir sessão aqui, de propósito.

    O manifesto é buscado pelo navegador com as credenciais omitidas (é o que a
    especificação manda, e o `<link rel="manifest">` do Next não pede
    `use-credentials`). Ou seja: o cookie nunca chega, e condicionar o nome à
    sessão não protegeria nada — só faria TODO PWA instalar com o nome genérico,
    perdendo o white-label que já funcionava.

    O que vaza é o nome do escritório, que a própria tela de "peça acesso"
    mostra. Os números continuam atrás da sessão, na página.
  */
  const d = await dadosDoPortal(params.token, new Date().getFullYear());
  const nome = ((d as { escritorio_nome?: string } | null)?.escritorio_nome as string) || "Financeiro";

  const base = `/portal/${params.token}`;
  const short = nome.length > 12 ? nome.slice(0, 12).trim() : nome;

  const manifest = {
    name: `${nome} — Financeiro`,
    short_name: short,
    description: "Acompanhe o financeiro da sua empresa.",
    start_url: base,
    scope: base,
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F5F7",
    theme_color: "#12A594",
    icons: [
      { src: `${base}/icon?size=192`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icon?size=512`, sizes: "512x512", type: "image/png", purpose: "any" },
      // fallback garantido (caso o ícone dinâmico falhe)
      { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json; charset=utf-8" },
  });
}
