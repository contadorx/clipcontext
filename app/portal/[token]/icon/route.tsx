import { ImageResponse } from "next/og";
import { dadosDoPortal } from "@/lib/portal-sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAND = "#12A594";

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const { searchParams } = new URL(req.url);
  const size = Math.min(512, Math.max(48, Number(searchParams.get("size")) || 512));

  /*
    Sem sessão aqui, mesma razão do manifesto: os ícones são buscados a partir
    dele, com credenciais omitidas. Exigir cookie só apagaria o logo do
    escritório do app instalado. A resposta é cacheada agressivamente pelo
    `ImageResponse`, o que também não combina com conteúdo por sessão.
  */
  const d = await dadosDoPortal(params.token, new Date().getFullYear());
  const logo = ((d as { logo_url?: string } | null)?.logo_url as string) ?? null;

  // Com logo do escritório: encaixa centralizado num quadrado branco (white-label).
  // Sem logo: ícone padrão do FinanceiroX (barras), desenhado sem fontes.
  const conteudo = logo ? (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        width={Math.round(size * 0.74)}
        height={Math.round(size * 0.74)}
        style={{ objectFit: "contain" }}
      />
    </div>
  ) : (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: size * 0.06,
        paddingBottom: size * 0.28,
        background: BRAND,
      }}
    >
      <div style={{ width: size * 0.12, height: size * 0.2, background: "#fff", borderRadius: size * 0.02 }} />
      <div style={{ width: size * 0.12, height: size * 0.32, background: "#fff", borderRadius: size * 0.02 }} />
      <div style={{ width: size * 0.12, height: size * 0.46, background: "#fff", borderRadius: size * 0.02 }} />
    </div>
  );

  return new ImageResponse(conteudo, { width: size, height: size });
}
