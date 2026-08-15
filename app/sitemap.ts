import type { MetadataRoute } from "next";
import { URL_SITE } from "@/lib/hosts";

/*
  Só as páginas públicas entram. As telas do produto ficam de fora por não
  existirem sem sessão — um sitemap que as lista entrega ao buscador uma lista
  de endereços que respondem redirecionamento para o login.

  A lista precisa acompanhar `DO_SITE` em `middleware.ts`: página nova sem
  entrada lá não responde no domínio público, e sem entrada aqui não é
  descoberta.
*/
export default function sitemap(): MetadataRoute.Sitemap {
  const base = URL_SITE;
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/termos`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacidade`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/seguranca`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
