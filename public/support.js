/* ============================================================
   Bloco de apoio voluntário.

   Preencha só o que você usa — o que ficar vazio simplesmente
   não aparece. Se todos ficarem vazios, o bloco inteiro some e
   nenhuma página fica com espaço em branco.

   github  : seu usuário no GitHub Sponsors
   bmc     : seu usuário no Buy Me a Coffee
   pix     : a chave Pix (e-mail, telefone, CPF/CNPJ ou aleatória)
   pixNome : o nome que aparece ao lado da chave, para dar confiança
   ============================================================ */
const SUPPORT = {
  github:  '',
  bmc:     '',
  pix:     'leandro@contadorx.com.br',
  pixNome: ''
};

const SUPPORT_TXT = {
  pt: {
    eyebrow: 'Apoio',
    title:   'O ClipContext é gratuito e vai continuar',
    lead:    'Não há anúncio, não há cadastro e não há dado seu sendo vendido — porque não há servidor. ' +
             'Se a ferramenta te poupou trabalho e você quiser retribuir, isso ajuda a manter o desenvolvimento. ' +
             'É voluntário: nada aqui destrava funcionalidade nenhuma.',
    github:  'Apoiar no GitHub',
    bmc:     'Pagar um café',
    pix:     'Copiar chave Pix',
    copied:  'chave copiada',
    failed:  'não consegui copiar — a chave é: '
  },
  en: {
    eyebrow: 'Support',
    title:   'ClipContext is free and will stay that way',
    lead:    'No ads, no sign-up, no data being sold — because there is no server. ' +
             'If the tool saved you work and you would like to give something back, it helps keep development going. ' +
             'It is voluntary: nothing here unlocks any feature.',
    github:  'Sponsor on GitHub',
    bmc:     'Buy me a coffee',
    pix:     'Copy Pix key',
    copied:  'key copied',
    failed:  'could not copy — the key is: '
  },
  es: {
    eyebrow: 'Apoyo',
    title:   'ClipContext es gratuito y seguirá siéndolo',
    lead:    'Sin anuncios, sin registro y sin vender tus datos — porque no hay servidor. ' +
             'Si la herramienta te ahorró trabajo y quieres devolver algo, ayuda a mantener el desarrollo. ' +
             'Es voluntario: nada de esto desbloquea ninguna función.',
    github:  'Apoyar en GitHub',
    bmc:     'Invítame un café',
    pix:     'Copiar clave Pix',
    copied:  'clave copiada',
    failed:  'no pude copiar — la clave es: '
  }
};

(function () {
  const alvo = document.getElementById('support');
  if (!alvo) return;
  if (!SUPPORT.github && !SUPPORT.bmc && !SUPPORT.pix) return;   // nada configurado: não renderiza

  const q = new URLSearchParams(location.search).get('lang');
  const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
  const L = ['pt', 'en', 'es'].includes(q) ? q : (['pt', 'en', 'es'].includes(nav) ? nav : 'en');
  const T = SUPPORT_TXT[L];

  const botoes = [];
  if (SUPPORT.github) botoes.push(`<a class="btn ghost" href="https://github.com/sponsors/${SUPPORT.github}" rel="noopener" target="_blank">${T.github}</a>`);
  if (SUPPORT.bmc)    botoes.push(`<a class="btn ghost" href="https://buymeacoffee.com/${SUPPORT.bmc}" rel="noopener" target="_blank">${T.bmc}</a>`);
  if (SUPPORT.pix)    botoes.push(`<button class="btn ghost" id="pixBtn">${T.pix}</button>`);

  alvo.innerHTML = `
    <div class="wrap">
      <p class="eyebrow">${T.eyebrow}</p>
      <h2>${T.title}</h2>
      <p class="lead">${T.lead}</p>
      <div class="row" style="gap:12px">${botoes.join('')}
        <span class="small muted" id="pixMsg"></span>
      </div>
      ${SUPPORT.pix && SUPPORT.pixNome
        ? `<p class="small muted" style="margin-top:14px">Pix: <b>${SUPPORT.pixNome}</b></p>` : ''}
    </div>`;

  const b = document.getElementById('pixBtn');
  if (b) b.onclick = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT.pix);
      document.getElementById('pixMsg').textContent = T.copied;
    } catch (e) {
      document.getElementById('pixMsg').textContent = T.failed + SUPPORT.pix;
    }
    setTimeout(() => { document.getElementById('pixMsg').textContent = ''; }, 4000);
  };
})();
