import { headers } from "next/headers";
import { ehHostDoSite } from "@/lib/hosts";

/**
 * Prefixo dos links internos do site público.
 *
 * As páginas vivem em `app/site/`, mas no domínio institucional a URL não tem
 * esse prefixo — o middleware reescreve. Escrever `/termos` direto funciona lá e
 * quebra em todo o resto: em `localhost:3000` e no preview da Vercel o site é
 * aberto em `/site`, e `/termos` não é rota nenhuma — cai na regra de sessão e
 * vira a tela de login. O resultado era um site institucional cujos links só
 * podiam ser testados em produção, que é o único lugar onde não se quer
 * descobrir que um link está quebrado.
 *
 * Aqui o prefixo é decidido pelo host da requisição: vazio no domínio público,
 * `/site` em qualquer outro.
 */
export function baseDoSite(): string {
  return ehHostDoSite(headers().get("host") ?? "") ? "" : "/site";
}

/** Link para uma página do site. `paginaDoSite(base, "/termos")` → `/termos` ou `/site/termos`. */
export function paginaDoSite(base: string, caminho: string): string {
  return caminho === "/" ? base || "/" : `${base}${caminho}`;
}

/** Âncora na home do site. `ancoraDoSite(base, "preco")` → `/#preco` ou `/site#preco`. */
export function ancoraDoSite(base: string, id: string): string {
  return `${base || "/"}#${id}`;
}
