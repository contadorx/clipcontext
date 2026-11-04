/* ============================================================
   O BLOCO DE APOIO VOLUNTÁRIO SAIU DAQUI.

   Ele desenhava, na âncora `#support`, três botões de doação —
   GitHub Sponsors, Buy Me a Coffee e a chave Pix — e a página de
   preços era a única do site que o hospedava.

   Saiu porque a página de preços mudou de trabalho. Ela vende dois
   planos disponíveis, com preço e checkout. "Pague um café" ao lado
   de uma assinatura de R$ 349 por pessoa/ano não é uma segunda
   opção: é a página se desculpando por cobrar. Quem estava com o
   cartão na mão parava para decidir entre comprar e doar.

   `paginas.mjs` cobra que nenhuma página volte a pedir apoio.

   O que este arquivo ainda faz:
     - a aba lateral da ficha e do NPS (mais abaixo), que desde o Build 71
       manda o recado por e-mail;
     - a busca da base de conhecimento.
   ============================================================ */

/* A LISTA DE AVISO SAIU — 23/08.
   Ela existia para "avise-me quando o plano pago sair", e ele saiu. O
   formulário já não estava em corpo de página nenhum desde a rodada de preços:
   o que sobrava aqui eram 76 linhas de JavaScript morto, servidas em toda
   página do site, armadas para o dia em que alguém recolocasse o formulário.

   O id dele NÃO está escrito aqui de propósito: `medicao.mjs` cobra que o
   nome não apareça neste arquivo, e uma régua que abrisse exceção para
   comentário seria uma régua com um buraco em forma de comentário.

   Decisão sua: fica só o plano. Quem quer o produto vai ao checkout, e não a
   uma caixa de "me avise". A régua que impede a volta é `medicao.mjs [M4]`, que
   passou a cobrar a AUSÊNCIA — do mesmo jeito que `paginas.mjs` cobra que
   nenhuma página volte a pedir apoio.

   O que continua aqui: a aba lateral da ficha/NPS, logo abaixo. */

/* ================= a ficha lateral: recado e NPS =================

   Uma aba fixa na borda do site. Ela existe porque o único canal de retorno que
   havia era um endereço de e-mail no rodapé — que ninguém rola até o fim para
   achar.

   E ela carrega o NPS, que não é vaidade: é a única pergunta que dá para fazer
   sem conta e sem rastrear ninguém, e é ela que decide a quem vale a pena pedir
   um compartilhamento. Pedir a todo mundo é o que transforma um pedido legítimo
   em incômodo.

   ---- DESDE O BUILD 71, O RECADO É E-MAIL ----

   Até o Build 70 o recado ia para uma rota do site e virava um chamado
   numerado num banco, com consulta por número e o tempo médio de resposta. O
   site deixou de ter servidor, e a ficha passou a fazer o mesmo que a
   ferramenta: abrir o programa de e-mail da pessoa, já endereçado ao suporte,
   com o recado no corpo. Ela vê o que vai, manda do endereço dela — que é por
   onde a resposta volta.

   A nota de 0 a 10 não vai a lugar nenhum sozinha. Ela fica neste navegador
   (para a pergunta não reaparecer) e, se a pessoa escrever, vai no e-mail. */
const FICHA_TXT = {
  pt: { abrir:'Dar retorno', titulo:'Como está sendo?', fechar:'fechar',
        pergunta:'De 0 a 10, quanto você indicaria o Walkstamp a um colega?',
        nada:'de jeito nenhum', muito:'com certeza',
        ideia:'Ideia', elogio:'Elogio', problema:'Problema',
        ph:'Escreva do seu jeito — é uma pessoa que lê.', enviar:'Enviar por e-mail',
        vazio:'Escreva alguma coisa antes de enviar.',
        abriu:'Abri o seu programa de e-mail com o recado para {0}. Se ele não abriu, escreva direto para {0}.',
        nota:'nota', pagina:'página',
        obrigado:'Obrigado. Se ele te poupou trabalho, contar para uma pessoa ajuda mais que qualquer anúncio — e nós não temos anúncio.',
        compartilhar:'Compartilhar no LinkedIn',
        compNota:'Abre o compartilhador do LinkedIn com o endereço já preenchido. O texto é seu.' },
  en: { abrir:'Give feedback', titulo:'How is it going?', fechar:'close',
        pergunta:'From 0 to 10, how likely are you to recommend Walkstamp to a colleague?',
        nada:'not at all', muito:'absolutely',
        ideia:'Idea', elogio:'Praise', problema:'Problem',
        ph:'In your own words — a person reads this.', enviar:'Send by e-mail',
        vazio:'Write something before sending.',
        abriu:'I opened your e-mail program with the message to {0}. If it did not open, write to {0} directly.',
        nota:'score', pagina:'page',
        obrigado:'Thank you. If it saved you work, telling one person helps more than any ad — and we have no ads.',
        compartilhar:'Share on LinkedIn',
        compNota:'Opens the LinkedIn sharer with the address filled in. The words are yours.' },
  es: { abrir:'Dar tu opinión', titulo:'¿Qué tal va?', fechar:'cerrar',
        pergunta:'De 0 a 10, ¿cuánto recomendarías Walkstamp a un colega?',
        nada:'de ninguna manera', muito:'sin duda',
        ideia:'Idea', elogio:'Elogio', problema:'Problema',
        ph:'Escríbelo a tu manera — lo lee una persona.', enviar:'Enviar por correo',
        vazio:'Escribe algo antes de enviar.',
        abriu:'Abrí tu programa de correo con el mensaje para {0}. Si no se abrió, escribe directamente a {0}.',
        nota:'nota', pagina:'página',
        obrigado:'Gracias. Si te ahorró trabajo, contárselo a una persona ayuda más que cualquier anuncio — y no tenemos anuncios.',
        compartilhar:'Compartir en LinkedIn',
        compNota:'Abre el compartidor de LinkedIn con la dirección ya puesta. El texto es tuyo.' },
  de: { abrir:'Feedback geben', titulo:'Wie läuft es?', fechar:'schließen',
        pergunta:'Von 0 bis 10: Wie wahrscheinlich würden Sie Walkstamp einem Kollegen weiterempfehlen?',
        nada:'auf keinen Fall', muito:'auf jeden Fall',
        ideia:'Idee', elogio:'Lob', problema:'Problem',
        ph:'Schreiben Sie in Ihren Worten – es liest ein Mensch.', enviar:'Per E-Mail senden',
        vazio:'Schreiben Sie etwas, bevor Sie senden.',
        abriu:'Ich habe Ihr E-Mail-Programm mit der Nachricht an {0} geöffnet. Falls es sich nicht geöffnet hat, schreiben Sie direkt an {0}.',
        nota:'Bewertung', pagina:'Seite',
        obrigado:'Danke. Wenn es Ihnen Arbeit erspart hat: einer Person davon zu erzählen hilft mehr als jede Anzeige – und wir schalten keine.',
        compartilhar:'Auf LinkedIn teilen',
        compNota:'Öffnet den LinkedIn-Dialog mit bereits eingetragener Adresse. Der Text ist Ihrer.' },
  fr: { abrir:'Donner un avis', titulo:'Comment ça se passe ?', fechar:'fermer',
        pergunta:'De 0 à 10, recommanderiez-vous Walkstamp à un collègue ?',
        nada:'pas du tout', muito:'sans hésiter',
        ideia:'Idée', elogio:'Compliment', problema:'Problème',
        ph:'Écrivez-le à votre façon — c’est une personne qui lit.', enviar:'Envoyer par e-mail',
        vazio:'Écrivez quelque chose avant d’envoyer.',
        abriu:'J’ai ouvert votre messagerie avec le message pour {0}. Si elle ne s’est pas ouverte, écrivez directement à {0}.',
        nota:'note', pagina:'page',
        obrigado:'Merci. Si ça vous a évité du travail, en parler à une personne aide plus que n’importe quelle publicité — et nous n’en avons pas.',
        compartilhar:'Partager sur LinkedIn',
        compNota:'Ouvre le partage LinkedIn avec l’adresse déjà remplie. Le texte est le vôtre.' }
};

(function () {
  const lang = (document.documentElement.lang || 'pt').slice(0, 2);
  const SUPORTE = 'suporte@walkstamp.com';
  const T = Object.assign({}, FICHA_TXT[lang] || FICHA_TXT.pt, {
    marca: 'Walkstamp',
    url: location.origin,
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
       pessoa, na caixa dele. */
    $('fichaLinkedin').href =
      'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(T.url || location.origin);
  }

  $('fichaEnviar').onclick = () => {
    const txt = ($('fichaTexto').value || '').trim();
    if (!txt) { $('fichaMsg').textContent = T.vazio; return; }
    /* O assunto diz o tipo; o corpo leva o texto e, separados por uma linha,
       a nota (se houve) e a página de onde a pessoa escreveu. Nada além do
       que ela vê antes de mandar. */
    const assunto = '[' + T.marca + '] ' + T[tipo];
    const rodape = [nota != null ? T.nota + ': ' + nota + '/10' : '',
                    T.pagina + ': ' + location.pathname].filter(Boolean).join(' · ');
    const href = 'mailto:' + SUPORTE + '?subject=' + encodeURIComponent(assunto) +
                 '&body=' + encodeURIComponent(txt + '\n\n---\n' + rodape);
    $('fichaMsg').textContent = T.abriu.split('{0}').join(SUPORTE);
    try { window.__ultimoEmail = href; } catch (e) {}
    location.href = href;
  };
})();

/* ================= a busca da base de conhecimento =================

   A página da Ajuda tem 45 painéis em nove temas e não tinha navegação
   nenhuma: quem chegava caía no topo de três mil palavras e rolava. Os
   acordeões já nascem abertos desde 23/08, então o Ctrl+F alcança tudo — mas
   achar a palavra no meio de uma parede não diz em que tema você está nem o
   que mais existe ao lado.

   O índice é montado no servidor a partir dos próprios `<h2>` (ver
   `indiceDaAjuda` em `lib/site.ts`) e são âncoras de HTML puro: eles funcionam
   sem uma linha disto aqui. O que este bloco acrescenta é o filtro, e por isso
   o campo nasce com `hidden` no HTML e é REVELADO aqui — um campo de busca que
   não busca é pior do que campo nenhum.

   As frases do contador chegam em `data-` no próprio elemento, e não numa
   tabela de idiomas aqui dentro. A ficha logo acima tem uma dessas tabelas, e
   ela é a segunda lista ao lado do `i18n-site.json`.

   O que ele NÃO faz, de propósito: pintar o trecho encontrado. Realçar exige
   mexer no HTML de dentro do painel, e o texto ali tem link, `<b>` e `<code>` —
   uma passada de `innerHTML` sobre isso é como se perdem atributos e se criam
   tags quebradas num idioma que ninguém relê. O Ctrl+F do navegador continua
   fazendo o realce, e agora sobre uma lista já reduzida. */
(function buscaDaAjuda() {
  const nav = document.querySelector('.ajNav');
  if (!nav) return;
  const caixa = nav.querySelector('.ajBusca');
  const campo = nav.querySelector('#ajQ');
  const conta = nav.querySelector('.ajConta');
  if (!caixa || !campo || !conta) return;

  /* ACENTO NÃO PODE SER OBRIGATÓRIO. Quem procura "transcricao" no teclado do
     trabalho quer achar "transcrição", e quem escreve alemão numa máquina sem
     trema digita "ue" esperando achar "ü".

     Os dois casos são resolvidos INDEXANDO CADA PAINEL DUAS VEZES — sem acento
     e transliterado — e normalizando a consulta uma vez só. Assim "u" acha
     "ü" pela primeira forma e "ue" acha "ü" pela segunda, sem que a consulta
     precise saber em que idioma está. É a mesma regra que a ferramenta já usa
     para o dicionário de vocabulário em alemão. */
  const semAcento = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const comoAlemao = (x) => x
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss');
  const chave = (x) => (x || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const temas = [];
  for (const h of document.querySelectorAll('h2[id^="tema-"]')) {
    const faq = h.nextElementSibling;
    if (!faq || !faq.classList.contains('faq')) continue;
    const paineis = [];
    for (const d of faq.children) {
      if (d.tagName !== 'DETAILS') continue;
      const txt = d.textContent || '';
      /* O separador impede que a consulta case atravessando a fronteira entre
         a forma sem acento e a transliterada. */
      paineis.push({ el: d, txt: chave(semAcento(txt)) + '  ' + chave(comoAlemao(txt)) });
    }
    if (paineis.length) temas.push({ h, faq, paineis });
  }
  const TOTAL = temas.reduce((s, t) => s + t.paineis.length, 0);
  if (!TOTAL) return;

  /* O estado de aberto/fechado de antes da busca, guardado UMA vez. Sem isto,
     limpar o campo devolveria a página com tudo aberto — inclusive o que a
     pessoa tinha recolhido de propósito antes de procurar. */
  let antes = null;

  const molde = (s, a, b) => String(s || '').replace('{0}', a).replace('{1}', b);

  function filtrar() {
    const cru = chave(semAcento(campo.value));
    const termos = cru ? cru.split(' ').filter(Boolean) : [];

    if (!termos.length) {
      for (const t of temas) {
        t.h.hidden = false; t.faq.hidden = false;
        for (const p of t.paineis) p.el.hidden = false;
      }
      if (antes) { for (const p of antes) p.el.open = p.aberto; antes = null; }
      conta.textContent = '';
      return;
    }

    if (!antes) {
      antes = [];
      for (const t of temas) for (const p of t.paineis) antes.push({ el: p.el, aberto: p.el.open });
    }

    let achados = 0;
    for (const t of temas) {
      let vivos = 0;
      for (const p of t.paineis) {
        const bate = termos.every((w) => p.txt.indexOf(w) >= 0);
        p.el.hidden = !bate;
        /* Achado é achado aberto: quem procurou quer a resposta, e não mais um
           clique para vê-la. */
        if (bate) { p.el.open = true; vivos++; achados++; }
      }
      t.h.hidden = vivos === 0;
      t.faq.hidden = vivos === 0;
    }
    conta.textContent = achados
      ? molde(conta.dataset.conta, achados, TOTAL)
      : (conta.dataset.nada || molde(conta.dataset.conta, 0, TOTAL));
  }

  campo.addEventListener('input', filtrar);
  /* Esc limpa — é o que o campo de busca de qualquer lugar faz, e sem isso a
     única saída de uma busca sem resultado é apagar letra por letra. */
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && campo.value) { campo.value = ''; filtrar(); }
  });
  /* Revelado só agora: daqui para baixo ele funciona. */
  caixa.hidden = false;
})();
