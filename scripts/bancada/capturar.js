/**
 * Captura as telas reais para a auditoria lado a lado com o mockup Fiori.
 *
 * Roda contra `/estilo/tela/<nome>`, que monta o componente de verdade dentro do
 * shell de verdade, com o banco respondido por `servir.js`. O que sai daqui é o
 * lado direito da comparação; o esquerdo são as capturas do mockup.
 *
 *   node scripts/bancada/capturar.js [nome…]      # sem argumento: todas
 *
 * Saída em `auditoria/telas/`. Também imprime o que encontrou de estrutura em
 * cada tela — quantas listas, se o cabeçalho gruda, se há barra de filtro —
 * porque a imagem mostra o sintoma e a contagem mostra a causa.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const { servirSupabase } = require("./servir");

const TELAS = ["movimentacoes", "lancamentos", "fluxo", "conciliacao", "agendamento"];
const BASE = process.env.BASE ?? "http://localhost:3112";
const SAIDA = process.env.SAIDA ?? path.join(process.cwd(), "auditoria", "telas");

/** O que dá para contar sem opinar: é a causa por trás do que a imagem mostra. */
async function medir(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelectorAll(s).length;
    const alvo = document.querySelector("main") ?? document.body;
    return {
      tabelasHtml: q("table"),
      gridsDeLista: q('[class*="grid-cols-["]'),
      cabecalhosGrudentos: q('[class*="sticky"]'),
      botoes: q("button"),
      camposComId: q("input[id], select[id], textarea[id]"),
      camposTotal: q("input, select, textarea"),
      rotulosLigados: q("label[for]"),
      rotulosTotal: q("label"),
      статус: undefined,
      alturaConteudo: alvo.scrollHeight,
    };
  });
}

(async () => {
  const quais = process.argv.slice(2).length ? process.argv.slice(2) : TELAS;
  fs.mkdirSync(SAIDA, { recursive: true });

  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });

  for (const tela of quais) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    const erros = [];
    p.on("pageerror", (e) => erros.push(String(e).slice(0, 160)));
    await servirSupabase(p);
    await p.goto(`${BASE}/estilo/tela/${tela}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(SAIDA, `${tela}.png`), fullPage: true });

    /*
      Segunda captura, **com itens marcados**.

      A primeira rodada da auditoria foi feita só com a foto do estado inicial, e
      isso produziu dois achados falsos: "o checkbox não comanda nada" em
      Liquidações e "toda saída é vermelha" em Movimentações. Os dois morreram no
      primeiro teste de verdade — a barra de rodapé existe e só aparece quando há
      seleção, e o vermelho já era só do vencido.

      Fotografar o estado inicial mostra o que a tela faz quando ninguém a está
      usando. Auditar exige usá-la.
    */
    /*
      Antes de marcar caixas, clicar numa linha de lista.

      A Conciliação passou a nascer com o painel de lançamentos populado e com as
      caixas **desabilitadas** até haver uma transação selecionada. Um `check()`
      numa caixa desabilitada não falha: fica esperando ela habilitar até o
      timeout (30s por chamada), e o `.catch()` engole tudo — a captura "com
      seleção" sairia idêntica à inicial, e a auditoria concluiria que a seleção
      não muda nada. Que é exatamente o achado falso que este bloco existe para
      evitar.
    */
    const linha = p.locator("[data-linha-selecionavel], .cursor-pointer").first();
    await linha.click({ timeout: 2000 }).catch(() => {});
    await p.waitForTimeout(400);

    // `:not([disabled])` no seletor, e não só no clique: caixa desabilitada nem
    // entra na contagem, então `quantas > 2` volta a significar o que diz.
    const caixas = p.locator('input[type="checkbox"]:not([disabled])');
    const quantas = await caixas.count();
    if (quantas > 2) {
      await caixas.nth(1).check({ timeout: 3000 }).catch(() => {});
      await caixas.nth(2).check({ timeout: 3000 }).catch(() => {});
      await p.waitForTimeout(700);
      await p.screenshot({ path: path.join(SAIDA, `${tela}--com-selecao.png`), fullPage: false });
    }
    const m = await medir(p);
    delete m["статус"];
    console.log(
      `${tela.padEnd(15)} tabelas:${m.tabelasHtml} grids:${m.gridsDeLista} ` +
        `campos:${m.camposComId}/${m.camposTotal} com id · rótulos ligados:${m.rotulosLigados}/${m.rotulosTotal} ` +
        `· botões:${m.botoes}${erros.length ? ` · ERROS: ${erros[0]}` : ""}`,
    );
    await p.close();
  }

  await b.close();
})();
