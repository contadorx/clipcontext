/**
 * Reabrir o diálogo de lançamento tem de trazer o formulário limpo.
 *
 * O componente **não desmonta** ao fechar (`if (!aberto) return null` guarda o
 * estado), então o zerar é responsabilidade de um efeito. Quando esse zerar
 * morava dentro da carga assíncrona, ele ora chegava tarde e apagava o que a
 * pessoa tinha digitado, ora não rodava e a segunda abertura vinha suja.
 *
 * O caso caro é o "Repetir mensalmente": herdado de um abandono anterior, ele
 * transforma um lançamento em doze parcelas sem ninguém ter pedido.
 */
const { chromium } = require("playwright-core");

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const p = await b.newPage();
  p.on("dialog", (d) => d.accept()); // o confirm de "descartar alterações"
  await p.goto("http://localhost:3112/estilo/lancamento", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);

  const desc = p.locator('[role="dialog"] input[placeholder="Breve descrição"]');
  const valor = p.locator('[role="dialog"] input[placeholder="0,00"]').first();
  const repetir = p.locator('[role="dialog"] input[type="checkbox"]').first();

  await desc.fill("Almoço da equipe");
  await valor.fill("150,00");
  const tinhaCheckbox = (await repetir.count()) > 0;
  if (tinhaCheckbox) await repetir.check();

  // fecha descartando e abre de novo
  await p.locator('[role="dialog"] [aria-label="Fechar"]').first().click();
  await p.waitForTimeout(400);
  await p.getByText("abrir", { exact: true }).click();
  await p.waitForTimeout(800);

  const depois = {
    descricao: await desc.inputValue(),
    valor: await valor.inputValue(),
    repetir: tinhaCheckbox ? await repetir.isChecked() : false,
  };

  let falhou = false;
  const conferir = (nome, ok, obtido) => {
    if (!ok) falhou = true;
    console.log(`${ok ? "ok   " : "FALHA"}  ${nome}: ${JSON.stringify(obtido)}`);
  };
  conferir("descrição zerou ao reabrir", depois.descricao === "", depois.descricao);
  conferir("valor zerou ao reabrir", depois.valor === "", depois.valor);
  conferir("repetir desmarcou ao reabrir", depois.repetir === false, depois.repetir);

  await b.close();
  process.exit(falhou ? 1 : 0);
})();
