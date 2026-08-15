const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  // Segura toda chamada ao Supabase por 2,5s — é o que acontece numa conexão
  // real: o formulário aparece preenchido e editável antes de a carga terminar.
  await p.route('**/rest/v1/**', async route => {
    await new Promise(r => setTimeout(r, 2500));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await p.goto('http://localhost:3112/estilo/lancamento-pagina', { waitUntil: 'domcontentloaded' });
  const alvo = p.locator('input[placeholder="Breve descrição"]');
  await alvo.waitFor({ timeout: 10000 });
  await alvo.click();
  await alvo.fill('');
  await p.keyboard.type('Energia eletrica agosto', { delay: 40 });
  const logoApos = await alvo.inputValue();
  console.log('logo depois de digitar:', JSON.stringify(logoApos));
  await p.waitForTimeout(4000);   // deixa a carga terminar
  const depoisDaCarga = await alvo.inputValue();
  console.log('depois da carga chegar:', JSON.stringify(depoisDaCarga));
  console.log(logoApos === depoisDaCarga ? 'OK — o que foi digitado sobreviveu' : '>>> O QUE FOI DIGITADO FOI SOBRESCRITO <<<');
  await b.close();
})();
