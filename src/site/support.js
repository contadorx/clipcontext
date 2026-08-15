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
  pixNome: 'Leandro Batista de Oliveira'
};

const SUPPORT_TXT = {
  pt: {
    eyebrow: 'Apoio',
    title:   'O {{marca}} é gratuito e vai continuar',
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
    title:   '{{marca}} is free and will stay that way',
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
    title:   '{{marca}} es gratuito y seguirá siéndolo',
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

/* ============================================================
   Lista de aviso do plano pago.

   O endereço e a chave vêm em data- no próprio formulário, postos
   pelo build — assim este arquivo continua estático e não precisa
   ser gerado. A chave é publicável de propósito: do lado do banco
   ela só alcança uma função que insere, nunca lê.

   O e-mail não é cruzado com nada. A medição de uso é outra coisa,
   separada, e não sabe quem é você.
   ============================================================ */
const LISTA_TXT = {
  pt: { vazio:  'Faltou o e-mail.',
        ruim:   'Esse endereço não parece um e-mail.',
        indo:   'enviando...',
        ok:     'Pronto. Aviso você quando sair — uma mensagem, não uma newsletter.',
        falhou: 'Não consegui enviar agora. Tente de novo daqui a pouco.' },
  en: { vazio:  'The e-mail is missing.',
        ruim:   'That address does not look like an e-mail.',
        indo:   'sending...',
        ok:     'Done. I will let you know when it ships — one message, not a newsletter.',
        falhou: 'Could not send it right now. Please try again in a moment.' },
  es: { vazio:  'Falta el correo.',
        ruim:   'Esa dirección no parece un correo.',
        indo:   'enviando...',
        ok:     'Listo. Te aviso cuando salga — un mensaje, no un boletín.',
        falhou: 'No pude enviarlo ahora. Inténtalo de nuevo en un momento.' }
};

(function () {
  const form = document.getElementById('listaForm');
  if (!form) return;

  const url = form.dataset.url, key = form.dataset.key;
  const campo = document.getElementById('listaEmail');
  const botao = document.getElementById('listaBtn');
  const msg   = document.getElementById('listaMsg');

  const q = new URLSearchParams(location.search).get('lang');
  const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
  const L = ['pt', 'en', 'es'].includes(q) ? q : (['pt', 'en', 'es'].includes(nav) ? nav : 'en');
  const T = LISTA_TXT[L];

  /* Sem endereço configurado o formulário some em vez de ficar ali fingindo
     que funciona — é o mesmo critério do bloco de apoio acima. */
  if (!url || !key) { form.style.display = 'none'; return; }

  const diz = (texto, classe) => { msg.textContent = texto; msg.className = 'small listaMsg ' + (classe || 'muted'); };

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const email = (campo.value || '').trim();
    if (!email)                     return diz(T.vazio, 'err');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return diz(T.ruim, 'err');

    botao.disabled = true; diz(T.indo);
    try {
      const r = await fetch(url + '/rest/v1/rpc/walkstamp_interesse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key },
        body: JSON.stringify({ p_email: email, p_idioma: L })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      /* O banco responde 'invalido' quando o endereço não passa na checagem de
         lá — que é mais rigorosa que a daqui. Repetido responde 'ok': para quem
         enviou, deu certo das duas vezes. */
      if ((await r.json()) === 'invalido') { botao.disabled = false; return diz(T.ruim, 'err'); }
      form.style.display = 'none';
      diz(T.ok, 'ok');
    } catch (e) {
      botao.disabled = false;
      diz(T.falhou, 'err');
    }
  });
})();

/* ================= a ficha lateral: recado e NPS =================

   Uma aba fixa na borda do site. Ela existe porque o único canal de retorno que
   havia era um endereço de e-mail no rodapé — que ninguém rola até o fim para
   achar, e que exige a pessoa trocar de programa para dizer uma frase.

   E ela carrega o NPS, que não é vaidade: é a única pergunta que dá para fazer
   sem conta e sem rastrear ninguém, e é ela que decide a quem vale a pena pedir
   um compartilhamento. Pedir a todo mundo é o que transforma um pedido legítimo
   em incômodo. */
const FICHA_TXT = {
  pt: { abrir:'Dar retorno', titulo:'Como está sendo?', fechar:'fechar',
        pergunta:'De 0 a 10, quanto você indicaria o {{marca}} a um colega?',
        nada:'de jeito nenhum', muito:'com certeza',
        ideia:'Ideia', elogio:'Elogio', problema:'Problema',
        ph:'Escreva do seu jeito — é uma pessoa que lê.',
        email:'seu e-mail, se quiser resposta', enviar:'Enviar',
        vazio:'Escreva alguma coisa antes de enviar.', enviado:'Abri o seu e-mail.',
        obrigado:'Obrigado. Se ele te poupou trabalho, contar para uma pessoa ajuda mais que qualquer anúncio — e nós não temos anúncio.',
        compartilhar:'Compartilhar no LinkedIn',
        compNota:'Abre o compartilhador do LinkedIn com o endereço já preenchido. O texto é seu.' },
  en: { abrir:'Give feedback', titulo:'How is it going?', fechar:'close',
        pergunta:'From 0 to 10, how likely are you to recommend {{marca}} to a colleague?',
        nada:'not at all', muito:'absolutely',
        ideia:'Idea', elogio:'Praise', problema:'Problem',
        ph:'In your own words — a person reads this.',
        email:'your e-mail, if you want a reply', enviar:'Send',
        vazio:'Write something before sending.', enviado:'I opened your e-mail.',
        obrigado:'Thank you. If it saved you work, telling one person helps more than any ad — and we have no ads.',
        compartilhar:'Share on LinkedIn',
        compNota:'Opens the LinkedIn sharer with the address filled in. The words are yours.' },
  es: { abrir:'Dar tu opinión', titulo:'¿Qué tal va?', fechar:'cerrar',
        pergunta:'De 0 a 10, ¿cuánto recomendarías {{marca}} a un colega?',
        nada:'de ninguna manera', muito:'sin duda',
        ideia:'Idea', elogio:'Elogio', problema:'Problema',
        ph:'Escríbelo a tu manera — lo lee una persona.',
        email:'tu correo, si quieres respuesta', enviar:'Enviar',
        vazio:'Escribe algo antes de enviar.', enviado:'Abrí tu correo.',
        obrigado:'Gracias. Si te ahorró trabajo, contárselo a una persona ayuda más que cualquier anuncio — y no tenemos anuncios.',
        compartilhar:'Compartir en LinkedIn',
        compNota:'Abre el compartidor de LinkedIn con la dirección ya puesta. El texto es tuyo.' }
};

(function () {
  const lang = (document.documentElement.lang || 'pt').slice(0, 2);
  const T = Object.assign({}, FICHA_TXT[lang] || FICHA_TXT.pt, {
    marca: '{{marca}}',
    contato: (document.querySelector('a[href^="mailto:"]') || {}).href
             ? (document.querySelector('a[href^="mailto:"]').href.replace('mailto:', '')) : '',
    url: location.origin,
    /* A medição do site já existe e é a mesma: um evento sem identidade. */
    evento: (nome, valor) => { try { if (window.wsMedir) window.wsMedir(nome, valor); } catch (e) {} }
  });
  if (!T.abrir) return;
  const $ = id => document.getElementById(id);
  const LS = 'walkstamp.nps';           // só a marca de "já respondi", nada mais

  const aba = document.createElement('button');
  aba.id = 'fichaAba'; aba.type = 'button'; aba.textContent = T.abrir;
  aba.setAttribute('aria-haspopup', 'dialog');
  document.body.appendChild(aba);

  const cx = document.createElement('div');
  cx.id = 'fichaCx'; cx.hidden = true;
  cx.setAttribute('role', 'dialog'); cx.setAttribute('aria-modal', 'true');
  cx.setAttribute('aria-label', T.abrir);
  cx.innerHTML =
    '<div class="fichaBox">' +
      '<div class="fichaTopo"><b>' + T.titulo + '</b>' +
        '<button type="button" id="fichaFechar" aria-label="' + T.fechar + '">&times;</button></div>' +
      '<div id="fichaPasso1">' +
        '<p class="small muted" style="margin:0 0 8px">' + T.pergunta + '</p>' +
        '<div id="fichaNotas"></div>' +
        '<div class="fichaLeg"><span>' + T.nada + '</span><span>' + T.muito + '</span></div>' +
      '</div>' +
      '<div id="fichaPasso2" hidden>' +
        '<div class="row" id="fichaTipos" style="gap:7px;margin:0 0 9px;flex-wrap:wrap">' +
          '<button type="button" class="btn ghost fichaTipo" data-t="ideia">' + T.ideia + '</button>' +
          '<button type="button" class="btn ghost fichaTipo" data-t="elogio">' + T.elogio + '</button>' +
          '<button type="button" class="btn ghost fichaTipo" data-t="problema">' + T.problema + '</button>' +
        '</div>' +
        '<textarea id="fichaTexto" rows="4" maxlength="1200" placeholder="' + T.ph + '"></textarea>' +
        '<input id="fichaEmail" type="email" placeholder="' + T.email + '" autocomplete="email">' +
        '<div class="row" style="gap:8px;align-items:center;margin-top:8px">' +
          '<button type="button" class="btn" id="fichaEnviar">' + T.enviar + '</button>' +
          '<span class="small muted" id="fichaMsg" role="status"></span></div>' +
      '</div>' +
      '<div id="fichaPasso3" hidden>' +
        '<p class="small" style="margin:0 0 10px">' + T.obrigado + '</p>' +
        '<a class="btn" id="fichaLinkedin" target="_blank" rel="noopener">' + T.compartilhar + '</a>' +
        '<p class="small muted" style="margin:10px 0 0">' + T.compNota + '</p>' +
      '</div>' +
    '</div>';
  document.body.appendChild(cx);

  const notas = $('fichaNotas');
  for (let n = 0; n <= 10; n++) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fichaNota'; b.textContent = n; b.dataset.n = n;
    notas.appendChild(b);
  }

  const abrir = (v) => {
    cx.hidden = !v;
    aba.setAttribute('aria-expanded', String(v));
    if (v) {
      /* Quem já respondeu a nota não responde de novo: a pergunta vira recado
         direto. Uma pesquisa que reaparece é a definição de incômodo. */
      const jaDeu = (() => { try { return localStorage.getItem(LS); } catch (e) { return null; } })();
      if (jaDeu) { $('fichaPasso1').hidden = true; $('fichaPasso2').hidden = false; }
      (jaDeu ? $('fichaTexto') : notas.querySelector('button')).focus();
    }
  };
  aba.onclick = () => abrir(cx.hidden);
  $('fichaFechar').onclick = () => abrir(false);
  cx.addEventListener('click', e => { if (e.target === cx) abrir(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !cx.hidden) abrir(false); });

  let nota = null, tipo = 'ideia';
  notas.addEventListener('click', e => {
    const b = e.target.closest('.fichaNota'); if (!b) return;
    nota = +b.dataset.n;
    [...notas.children].forEach(x => x.classList.toggle('on', x === b));
    try { localStorage.setItem(LS, String(nota)); } catch (e2) {}
    if (T.evento) T.evento('nps', String(nota));
    $('fichaPasso1').hidden = true;
    /* De 7 para cima, o pedido de compartilhar; abaixo disso, a caixa de texto
       — quem deu nota baixa tem algo a dizer, e pedir divulgação a essa pessoa
       é não ter escutado. */
    if (nota >= 7) { $('fichaPasso3').hidden = false; montarLinkedin(); }
    else { $('fichaPasso2').hidden = false; tipo = 'problema'; pintarTipos(); $('fichaTexto').focus(); }
  });

  function pintarTipos(){
    cx.querySelectorAll('.fichaTipo').forEach(b => b.classList.toggle('on', b.dataset.t === tipo));
  }
  cx.querySelectorAll('.fichaTipo').forEach(b => {
    b.onclick = () => { tipo = b.dataset.t; pintarTipos(); };
  });
  pintarTipos();

  function montarLinkedin(){
    /* O compartilhador do LinkedIn aceita só a URL; o texto quem escreve é a
       pessoa, na caixa dele. Tentar empurrar um texto pronto por parâmetro é
       um caminho que eles fecharam e que voltaria vazio. */
    $('fichaLinkedin').href =
      'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(T.url || location.origin);
    $('fichaLinkedin').onclick = () => { if (T.evento) T.evento('compartilhou', 'linkedin'); };
  }

  $('fichaEnviar').onclick = () => {
    const txt = ($('fichaTexto').value || '').trim();
    if (!txt) { $('fichaMsg').textContent = T.vazio; return; }
    const email = ($('fichaEmail').value || '').trim();
    const assunto = encodeURIComponent(T.marca + ' · ' + tipo + (email ? ' · ' + email : '') +
                                       (nota != null ? ' · nota ' + nota : ''));
    const corpo = encodeURIComponent(txt + '\n\n---\n' + location.href + '\n' + navigator.userAgent.slice(0,120));
    if (T.evento) T.evento('recado', tipo);
    window.location.href = 'mailto:' + T.contato + '?subject=' + assunto + '&body=' + corpo;
    $('fichaMsg').textContent = T.enviado;
  };
})();
