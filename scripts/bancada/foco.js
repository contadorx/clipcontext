const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  const erros = [];
  p.on('pageerror', e => erros.push(String(e)));
  await p.goto('http://localhost:3112/estilo/foco', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);

  // 1) digitação humana
  await p.click('[data-testid="alvo"]');
  await p.keyboard.type('Padaria Aurora', { delay: 60 });
  await p.waitForTimeout(150);
  const lento = { val: await p.inputValue('[data-testid="alvo"]'), caret: await p.evaluate(() => document.querySelector('[data-testid="alvo"]').selectionStart) };

  // 2) digitação sem pausa — o caso que a janela de 30ms perdia
  await p.evaluate(() => { document.querySelector('[data-testid="alvo"]').value = ''; });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  await p.click('[data-testid="alvo"]');
  await p.keyboard.type('conciliacao bancaria 2026', { delay: 0 });
  await p.waitForTimeout(150);
  const rapido = { val: await p.inputValue('[data-testid="alvo"]'), caret: await p.evaluate(() => document.querySelector('[data-testid="alvo"]').selectionStart) };

  // 3) cursor no meio: volta 5 e digita
  for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowLeft');
  await p.keyboard.type('XY', { delay: 0 });
  await p.waitForTimeout(150);
  const meio = { val: await p.inputValue('[data-testid="alvo"]'), caret: await p.evaluate(() => document.querySelector('[data-testid="alvo"]').selectionStart) };

  console.log(JSON.stringify({ lento, rapido, meio, erros }, null, 1));
  await b.close();
})();
