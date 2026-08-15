/**
 * Os dois hostnames do projeto, normalizados uma vez só.
 *
 * A normalização não é preciosismo: quem configura na Vercel copia o domínio do
 * painel e cola `https://financeirox.com.br` ou `www.financeirox.com.br`, às
 * vezes com espaço. Cada lugar que lia a variável crua reagia de um jeito
 * diferente ao mesmo valor — um seguia funcionando, outro montava
 * `https://https//financeirox.com.br`, e `new URL()` com espaço no meio LANÇA,
 * derrubando a árvore inteira em 500. Um valor, um tratamento.
 *
 * Módulo puro de propósito: sem `next/headers`, sem `next/server`. Assim o
 * middleware (edge), os Server Components e os geradores de metadados podem
 * todos importar daqui.
 */
function normalizar(valor: string | undefined, padrao: string): string {
  const bruto = (valor ?? "").trim() || padrao;
  return bruto
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/^www\./, "")
    .trim();
}

export const HOST_APP = normalizar(process.env.NEXT_PUBLIC_APP_HOST, "app.financeirox.com.br");
export const HOST_SITE = normalizar(process.env.NEXT_PUBLIC_SITE_HOST, "financeirox.com.br");

/**
 * Com os dois hosts iguais, o redirecionamento viraria laço:
 * `financeirox.com.br/login` mandaria para `financeirox.com.br/login`, e o
 * navegador mostraria ERR_TOO_MANY_REDIRECTS na tela de login sem nada no log
 * explicando. Nesse caso a separação é desligada e o app responde em tudo, com
 * o site alcançável em `/site` — que é o comportamento anterior a ela.
 *
 * Note que deixar as variáveis VAZIAS não desliga nada: vazio cai nos padrões,
 * que são diferentes entre si. Para servir os dois num domínio só, as duas
 * variáveis precisam receber o mesmo valor explicitamente.
 */
export const SPLIT_ATIVO = HOST_APP !== HOST_SITE && HOST_APP !== "" && HOST_SITE !== "";

export function ehHostDoSite(host: string): boolean {
  const h = host.toLowerCase().split(":")[0];
  return h === HOST_SITE || h === `www.${HOST_SITE}`;
}

export function ehHostDoApp(host: string): boolean {
  const h = host.toLowerCase().split(":")[0];
  return h === HOST_APP || h === `www.${HOST_APP}`;
}

export const URL_APP = `https://${HOST_APP}`;
export const URL_SITE = `https://${HOST_SITE}`;
