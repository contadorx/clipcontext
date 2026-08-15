/**
 * Os dois lados de `preencher()` no formulário de lançamento.
 *
 * A carga é segurada por 2 s de propósito — é a janela em que o formulário já
 * está na tela e a pessoa já consegue digitar, mas os dados ainda não chegaram.
 *
 * 1. Sem digitar nada, todo campo tem de vir preenchido do banco, inclusive o
 *    `<select>` de categoria (o caso que a versão anterior desta bancada não
 *    exercia, porque mandava `categoria_id: null`).
 * 2. Digitando na descrição, **só** a descrição é preservada; valor, vencimento
 *    e categoria continuam preenchendo normalmente.
 */
const { chromium } = require("playwright-core");

const CATEGORIA = { id: "cat-00000000-0000-0000-0000-000000000001", nome: "Aluguel e condomínio", tipo: "pagar" };
const CONTA = { id: "ct-00000000-0000-0000-0000-000000000001", nome: "Itaú — conta corrente" };

/** Devolve a tabela que a URL do PostgREST está pedindo. */
function tabelaDe(url) {
  const m = /\/rest\/v1\/([^?]+)/.exec(url);
  return m ? m[1] : "";
}

async function abrir(browser) {
  const p = await browser.newPage();
  await p.route("**/rest/v1/**", async (route) => {
    const tabela = tabelaDe(route.request().url());
    const corpo = tabela === "categorias" ? [CATEGORIA] : tabela === "contas_bancarias" ? [CONTA] : [];
    await new Promise((r) => setTimeout(r, 2000)); // a janela do bug
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) });
  });
  await p.goto("http://localhost:3112/estilo/lancamento-pagina", { waitUntil: "domcontentloaded" });
  return p;
}

async function ler(p) {
  const selects = p.locator("select");
  let categoria = "(select de categoria não encontrado)";
  for (let i = 0; i < (await selects.count()); i++) {
    const s = selects.nth(i);
    if ((await s.locator(`option:has-text("${CATEGORIA.nome}")`).count()) > 0) {
      categoria = await s.locator("option:checked").innerText().catch(() => "(vazio)");
      break;
    }
  }
  return {
    descricao: await p.locator('input[placeholder="Breve descrição"]').inputValue(),
    valor: await p.locator('input[placeholder="0,00"]').first().inputValue(),
    vencimento: await p.locator('input[type="date"]').nth(1).inputValue(),
    categoria,
  };
}

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  let falhou = false;
  const conferir = (nome, ok, obtido) => {
    if (!ok) falhou = true;
    console.log(`${ok ? "ok   " : "FALHA"}  ${nome}: ${JSON.stringify(obtido)}`);
  };

  // 1) intocado — tudo tem de preencher
  let p = await abrir(b);
  await p.locator('input[placeholder="Breve descrição"]').waitFor({ timeout: 10000 });
  await p.waitForTimeout(4000);
  let r = await ler(p);
  conferir("descrição veio do banco", r.descricao === "Aluguel", r.descricao);
  conferir("valor veio do banco", r.valor === "8.400,00", r.valor);
  conferir("vencimento veio do banco", r.vencimento === "2026-08-13", r.vencimento);
  conferir("categoria selecionada no select", r.categoria.includes(CATEGORIA.nome), r.categoria);
  await p.close();

  // 2) digitando durante a carga — só a descrição resiste
  p = await abrir(b);
  const desc = p.locator('input[placeholder="Breve descrição"]');
  await desc.waitFor({ timeout: 10000 });
  await desc.click();
  await desc.fill("");
  await p.keyboard.type("Energia elétrica agosto", { delay: 30 });
  await p.waitForTimeout(4000);
  r = await ler(p);
  conferir("descrição digitada sobreviveu", r.descricao === "Energia elétrica agosto", r.descricao);
  conferir("valor preencheu mesmo assim", r.valor === "8.400,00", r.valor);
  conferir("categoria preencheu mesmo assim", r.categoria.includes(CATEGORIA.nome), r.categoria);
  await p.close();

  await b.close();
  process.exit(falhou ? 1 : 0);
})();
