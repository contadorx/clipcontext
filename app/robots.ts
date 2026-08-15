import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { ehHostDoSite, HOST_SITE, SPLIT_ATIVO } from "@/lib/hosts";

/*
  Dois hosts, um deploy — e regras opostas para o robô.

  O domínio público existe para ser indexado. O host do app é tela de produto
  atrás de login: indexá-lo só produz resultado de busca que leva a um
  redirecionamento para `/login`, e ainda disputa a mesma marca com o site.

  Precisa ler o `host` da requisição, então é dinâmico de propósito: um único
  arquivo estático serviria a mesma resposta aos dois domínios.
*/
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  /*
    Com a separação desligada, o mesmo domínio serve site e produto. Liberar o
    robô ali entregaria `/carteira`, `/documentos` e o resto ao índice — todas
    respondendo redirecionamento para o login. Na dúvida, não indexa.
  */
  if (!SPLIT_ATIVO || !ehHostDoSite(headers().get("host") ?? "")) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `https://${HOST_SITE}/sitemap.xml`,
  };
}
