/**
 * Interceptador de Supabase para as bancadas.
 *
 * As telas do app buscam tudo do banco pelo cliente. Em vez de subir um
 * Postgres, o Playwright responde às chamadas do PostgREST com a massa de
 * `fixtures.json` — a mesma do mockup Fiori, para que a comparação lado a lado
 * seja entre desenhos e não entre conteúdos diferentes.
 *
 * Não é um PostgREST de verdade: não filtra, não ordena, não junta. Devolve a
 * tabela inteira e deixa a tela fazer o resto. Para auditoria visual basta — e
 * é justamente o que evita a bancada virar um segundo backend para manter.
 */
const fs = require("fs");
const path = require("path");

// mesma massa que a bancada usa no navegador (lib/bancada/massa.json), para não
// haver duas verdades: o que o roteiro captura é o que a pessoa vê no deploy
const DADOS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "lib", "bancada", "massa.json"), "utf8"),
);

/** `.../rest/v1/lancamentos?select=…` → `lancamentos` */
function tabelaDe(url) {
  const m = /\/rest\/v1\/([^?/]+)/.exec(url);
  return m ? m[1] : "";
}

/**
 * O PostgREST devolve objeto (não lista) quando o pedido traz `Accept` de item
 * único — é o que `.single()` e `.maybeSingle()` mandam. Sem isso, telas que
 * pedem um registro só recebem uma lista e quebram.
 */
function ehItemUnico(headers) {
  const a = headers["accept"] ?? "";
  return a.includes("vnd.pgrst.object");
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{ atraso?: number, vazio?: string[] }} opcoes
 *   `atraso` segura toda resposta (ms) — é como se reproduz, numa máquina
 *   rápida, o que a pessoa vive numa conexão comum.
 *   `vazio` lista tabelas a devolver vazias, para ver o estado sem dado.
 */
async function servirSupabase(page, { atraso = 0, vazio = [] } = {}) {
  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    const tabela = tabelaDe(req.url());

    // `HEAD` é leitura: é o que o Supabase manda quando a tela pede só a contagem
    if (req.method() !== "GET" && req.method() !== "HEAD") {
      await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      return;
    }

    const linhas = vazio.includes(tabela) ? [] : DADOS[tabela] ?? [];
    if (atraso) await new Promise((r) => setTimeout(r, atraso));
    const corpo = ehItemUnico(req.headers()) ? linhas[0] ?? null : linhas;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": `0-${Math.max(linhas.length - 1, 0)}/${linhas.length}` },
      body: JSON.stringify(corpo),
    });
  });

  // auth: a bancada não tem sessão e não precisa de uma
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "user-1", email: "leandro@contadorx.com.br" } }),
    }),
  );
}

module.exports = { servirSupabase, DADOS };
