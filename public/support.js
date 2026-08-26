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

   O que este arquivo ainda faz, e continua fazendo:
     - a lista de aviso do plano pago (abaixo);
     - a aba lateral da ficha e do NPS (mais abaixo).
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
   achar, e que exige a pessoa trocar de programa para dizer uma frase.

   E ela carrega o NPS, que não é vaidade: é a única pergunta que dá para fazer
   sem conta e sem rastrear ninguém, e é ela que decide a quem vale a pena pedir
   um compartilhamento. Pedir a todo mundo é o que transforma um pedido legítimo
   em incômodo. */
const FICHA_TXT = {
  pt: { abrir:'Dar retorno', titulo:'Como está sendo?', fechar:'fechar',
        pergunta:'De 0 a 10, quanto você indicaria o Walkstamp a um colega?',
        nada:'de jeito nenhum', muito:'com certeza',
        ideia:'Ideia', elogio:'Elogio', problema:'Problema',
        ph:'Escreva do seu jeito — é uma pessoa que lê.',
        email:'seu e-mail, se quiser resposta', enviar:'Enviar',
        vazio:'Escreva alguma coisa antes de enviar.',
        enviado:'Recebido. O seu chamado é o {0} — anote, é por ele que você acompanha.',
        semEmail:'Sem e-mail, ele não tem como ser respondido nem consultado.',
        tempo:'Tenho respondido em {0}h, em média, nas últimas {1} respostas. É o número real, não um prazo prometido.',
        tempoRapido:'Tenho respondido em menos de uma hora, em média, nas últimas {1} respostas. É o número real, não um prazo prometido.',
        jaTenho:'Já tenho um chamado e quero consultar', voltar:'Voltar ao recado',
        consultaTit:'Digite o número do chamado e o e-mail com que ele foi aberto.',
        consultar:'Consultar', faltaDado:'Preencha o número e o e-mail.',
        naoAchei:'Não achei esse chamado com esse e-mail.', semResposta:'Ainda sem resposta.',
        status:{ aberto:'aberto', analise:'em análise', respondido:'respondido', fechado:'fechado' },
        indo:'Enviando…', erro:'Não consegui enviar agora. Tente de novo em instantes.', muitos:'Muitos recados ao mesmo tempo. Espere um minuto.', semRede:'Sem conexão com o serviço agora.',
        obrigado:'Obrigado. Se ele te poupou trabalho, contar para uma pessoa ajuda mais que qualquer anúncio — e nós não temos anúncio.',
        compartilhar:'Compartilhar no LinkedIn',
        compNota:'Abre o compartilhador do LinkedIn com o endereço já preenchido. O texto é seu.' },
  en: { abrir:'Give feedback', titulo:'How is it going?', fechar:'close',
        pergunta:'From 0 to 10, how likely are you to recommend Walkstamp to a colleague?',
        nada:'not at all', muito:'absolutely',
        ideia:'Idea', elogio:'Praise', problema:'Problem',
        ph:'In your own words — a person reads this.',
        email:'your e-mail, if you want a reply', enviar:'Send',
        vazio:'Write something before sending.',
        enviado:'Got it. Your ticket is {0} — write it down, that is how you follow it.',
        semEmail:'Without an e-mail, it cannot be answered or looked up.',
        tempo:'I have been replying in {0}h on average across the last {1} replies. That is the real number, not a promised deadline.',
        tempoRapido:'I have been replying in under an hour on average across the last {1} replies. That is the real number, not a promised deadline.',
        jaTenho:'I already have a ticket and want to check it', voltar:'Back to the message',
        consultaTit:'Type the ticket number and the e-mail it was opened with.',
        consultar:'Check', faltaDado:'Fill in the number and the e-mail.',
        naoAchei:'I could not find that ticket with that e-mail.', semResposta:'No reply yet.',
        status:{ aberto:'open', analise:'under review', respondido:'answered', fechado:'closed' },
        indo:'Sending…', erro:'I could not send it now. Try again in a moment.', muitos:'Too many messages at once. Wait a minute.', semRede:'No connection to the service right now.',
        obrigado:'Thank you. If it saved you work, telling one person helps more than any ad — and we have no ads.',
        compartilhar:'Share on LinkedIn',
        compNota:'Opens the LinkedIn sharer with the address filled in. The words are yours.' },
  es: { abrir:'Dar tu opinión', titulo:'¿Qué tal va?', fechar:'cerrar',
        pergunta:'De 0 a 10, ¿cuánto recomendarías Walkstamp a un colega?',
        nada:'de ninguna manera', muito:'sin duda',
        ideia:'Idea', elogio:'Elogio', problema:'Problema',
        ph:'Escríbelo a tu manera — lo lee una persona.',
        email:'tu correo, si quieres respuesta', enviar:'Enviar',
        vazio:'Escribe algo antes de enviar.',
        enviado:'Recibido. Tu ticket es el {0} — anótalo, es por él que le haces seguimiento.',
        semEmail:'Sin correo, no puede ser respondido ni consultado.',
        tempo:'He respondido en {0}h de media en las últimas {1} respuestas. Es el número real, no un plazo prometido.',
        tempoRapido:'He respondido en menos de una hora de media en las últimas {1} respuestas. Es el número real, no un plazo prometido.',
        jaTenho:'Ya tengo un ticket y quiero consultarlo', voltar:'Volver al mensaje',
        consultaTit:'Escribe el número del ticket y el correo con el que se abrió.',
        consultar:'Consultar', faltaDado:'Rellena el número y el correo.',
        naoAchei:'No encontré ese ticket con ese correo.', semResposta:'Todavía sin respuesta.',
        status:{ aberto:'abierto', analise:'en análisis', respondido:'respondido', fechado:'cerrado' },
        indo:'Enviando…', erro:'No he podido enviarlo ahora. Inténtalo en un momento.', muitos:'Demasiados mensajes a la vez. Espera un minuto.', semRede:'Sin conexión con el servicio ahora mismo.',
        obrigado:'Gracias. Si te ahorró trabajo, contárselo a una persona ayuda más que cualquier anuncio — y no tenemos anuncios.',
        compartilhar:'Compartir en LinkedIn',
        compNota:'Abre el compartidor de LinkedIn con la dirección ya puesta. El texto es tuyo.' },
  de: { abrir:'Feedback geben', titulo:'Wie läuft es?', fechar:'schließen',
        pergunta:'Von 0 bis 10: Wie wahrscheinlich würden Sie Walkstamp einem Kollegen weiterempfehlen?',
        nada:'auf keinen Fall', muito:'auf jeden Fall',
        ideia:'Idee', elogio:'Lob', problema:'Problem',
        ph:'Schreiben Sie in Ihren Worten – es liest ein Mensch.',
        email:'Ihre E-Mail, falls Sie eine Antwort möchten', enviar:'Senden',
        vazio:'Schreiben Sie etwas, bevor Sie senden.',
        enviado:'Angekommen. Ihr Ticket ist {0} – notieren Sie es, darüber verfolgen Sie den Stand.',
        semEmail:'Ohne E-Mail kann es weder beantwortet noch abgefragt werden.',
        tempo:'Ich antworte im Schnitt in {0} Std., gemessen an den letzten {1} Antworten. Das ist die echte Zahl, keine zugesagte Frist.',
        tempoRapido:'Ich antworte im Schnitt in unter einer Stunde, gemessen an den letzten {1} Antworten. Das ist die echte Zahl, keine zugesagte Frist.',
        jaTenho:'Ich habe schon ein Ticket und möchte nachsehen', voltar:'Zurück zur Nachricht',
        consultaTit:'Geben Sie die Ticketnummer und die E-Mail ein, mit der es eröffnet wurde.',
        consultar:'Nachsehen', faltaDado:'Bitte Nummer und E-Mail ausfüllen.',
        naoAchei:'Dieses Ticket habe ich mit dieser E-Mail nicht gefunden.', semResposta:'Noch keine Antwort.',
        status:{ aberto:'offen', analise:'in Prüfung', respondido:'beantwortet', fechado:'geschlossen' },
        indo:'Wird gesendet…', erro:'Senden hat gerade nicht geklappt. Versuchen Sie es gleich noch einmal.', muitos:'Zu viele Nachrichten auf einmal. Warten Sie eine Minute.', semRede:'Gerade keine Verbindung zum Dienst.',
        obrigado:'Danke. Wenn es Ihnen Arbeit erspart hat: einer Person davon zu erzählen hilft mehr als jede Anzeige – und wir schalten keine.',
        compartilhar:'Auf LinkedIn teilen',
        compNota:'Öffnet den LinkedIn-Dialog mit bereits eingetragener Adresse. Der Text ist Ihrer.' },
  fr: { abrir:'Donner un avis', titulo:'Comment ça se passe ?', fechar:'fermer',
        pergunta:'De 0 à 10, recommanderiez-vous Walkstamp à un collègue ?',
        nada:'pas du tout', muito:'sans hésiter',
        ideia:'Idée', elogio:'Compliment', problema:'Problème',
        ph:'Écrivez-le à votre façon — c’est une personne qui lit.',
        email:'votre e-mail, si vous voulez une réponse', enviar:'Envoyer',
        vazio:'Écrivez quelque chose avant d’envoyer.',
        enviado:'Bien reçu. Votre ticket est le {0} — notez-le, il vous sert à suivre.',
        semEmail:'Sans e-mail, impossible d’y répondre ou de le consulter.',
        tempo:'Je réponds en {0} h en moyenne sur les {1} dernières réponses. C’est le chiffre réel, pas un délai promis.',
        tempoRapido:'Je réponds en moins d’une heure en moyenne sur les {1} dernières réponses. C’est le chiffre réel, pas un délai promis.',
        jaTenho:'J’ai déjà un ticket et je veux le consulter', voltar:'Revenir au message',
        consultaTit:'Saisissez le numéro du ticket et l’e-mail utilisé à l’ouverture.',
        consultar:'Consulter', faltaDado:'Renseignez le numéro et l’e-mail.',
        naoAchei:'Je n’ai pas trouvé ce ticket avec cet e-mail.', semResposta:'Pas encore de réponse.',
        status:{ aberto:'ouvert', analise:'en cours d’examen', respondido:'répondu', fechado:'fermé' },
        indo:'Envoi…', erro:'Je n’ai pas pu envoyer. Réessayez dans un instant.', muitos:'Trop de messages à la fois. Attendez une minute.', semRede:'Pas de connexion au service pour le moment.',
        obrigado:'Merci. Si ça vous a évité du travail, en parler à une personne aide plus que n’importe quelle publicité — et nous n’en avons pas.',
        compartilhar:'Partager sur LinkedIn',
        compNota:'Ouvre le partage LinkedIn avec l’adresse déjà remplie. Le texte est le vôtre.' }
};

(function () {
  const lang = (document.documentElement.lang || 'pt').slice(0, 2);
  /* O endereço da Supabase vem do mesmo lugar que a lista de aviso usa: um
     data-attribute no formulário, estampado pelo build. Sem ele a ficha some,
     porque uma caixa de recado que não tem para onde mandar é pior que caixa
     nenhuma. */
  /* No <body>, e não no formulário da lista de aviso: aquele só existe na
     página de preços, e a ficha existe em todas. */
  const SUPA = document.body.dataset.supaUrl || '';
  const ANON = document.body.dataset.supaKey || '';
  const T = Object.assign({}, FICHA_TXT[lang] || FICHA_TXT.pt, {
    marca: 'Walkstamp',
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
        '<p class="small muted" id="fichaTempo" style="margin:8px 0 0" hidden></p>' +
      '</div>' +
      '<div id="fichaConsulta" hidden>' +
        '<p class="small muted" style="margin:0 0 8px">' + T.consultaTit + '</p>' +
        '<input id="fichaNum" placeholder="WS-0000" autocomplete="off">' +
        '<input id="fichaNumEmail" type="email" placeholder="' + T.email + '" autocomplete="email">' +
        '<div class="row" style="gap:8px;align-items:center;margin-top:6px">' +
          '<button type="button" class="btn ghost" id="fichaVer">' + T.consultar + '</button>' +
          '<span class="small muted" id="fichaVerMsg" role="status"></span></div>' +
        '<div id="fichaVerOut" class="small" style="margin-top:10px"></div>' +
      '</div>' +
      '<p class="small" style="margin:12px 0 0">' +
        '<a href="#" id="fichaTrocar">' + T.jaTenho + '</a></p>' +
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
      tempoDeResposta();
    }
  };
  /* O tempo REAL de resposta, no lugar onde a pessoa decide se vale a pena
     escrever. Três regras, e as três importam:

       - é a média das últimas vinte respostas, calculada no banco, não um SLA;
       - abaixo de três respostas ele não aparece: com uma, o número é a última
         resposta com cara de estatística;
       - se a rede falhar, ele simplesmente não aparece. Prometer prazo é ruim;
         prometer prazo por engano, pior.

     Buscado uma vez por visita — a média não muda entre duas aberturas. */
  let tempoJaBuscado = false;
  async function tempoDeResposta() {
    if (tempoJaBuscado || !SUPA || !ANON) return;
    tempoJaBuscado = true;
    try {
      const r = await fetch(SUPA + '/rest/v1/rpc/walkstamp_chamado_resposta', {
        method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON,
                                   'Content-Type': 'application/json' }, body: '{}' });
      if (!r.ok) return;
      const d = await r.json();
      if (!d || (d.quantos || 0) < 3) return;
      const molde = d.horas >= 1 ? T.tempo : T.tempoRapido;
      $('fichaTempo').textContent = molde.replace('{0}', d.horas).replace('{1}', d.quantos);
      $('fichaTempo').hidden = false;
    } catch (e) { /* sem número é melhor que número errado */ }
  }

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

  /* Consultar um chamado: número + e-mail, sem login. O e-mail é o que impede
     alguém de varrer WS-0001..WS-9999 e ler o que os outros escreveram. */
  let vendoConsulta = false;
  $('fichaTrocar').onclick = (e) => {
    e.preventDefault();
    vendoConsulta = !vendoConsulta;
    $('fichaConsulta').hidden = !vendoConsulta;
    $('fichaPasso1').hidden = vendoConsulta || $('fichaPasso1').dataset.pronto === '1';
    $('fichaPasso2').hidden = vendoConsulta || $('fichaPasso2').dataset.pronto !== '1';
    $('fichaTrocar').textContent = vendoConsulta ? T.voltar : T.jaTenho;
  };

  $('fichaVer').onclick = async () => {
    const num = ($('fichaNum').value || '').trim();
    const em = ($('fichaNumEmail').value || '').trim();
    if (!num || !em) { $('fichaVerMsg').textContent = T.faltaDado; return; }
    if (!SUPA || !ANON) { $('fichaVerMsg').textContent = T.semRede; return; }
    $('fichaVer').disabled = true; $('fichaVerMsg').textContent = T.indo;
    try {
      const r = await fetch(SUPA + '/rest/v1/rpc/walkstamp_chamado_ver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + ANON },
        body: JSON.stringify({ p_numero: num, p_email: em })
      });
      const d = await r.json().catch(() => null);
      $('fichaVer').disabled = false; $('fichaVerMsg').textContent = '';
      if (!d || d.erro) { $('fichaVerMsg').textContent = T.naoAchei; $('fichaVerOut').innerHTML = ''; return; }
      const nomes = T.status || {};
      $('fichaVerOut').innerHTML =
        '<b>' + d.numero + '</b> · ' + (nomes[d.status] || d.status) +
        '<p style="margin:6px 0 0;white-space:pre-wrap">' + (d.texto || '').replace(/[<>&]/g, '') + '</p>' +
        (d.resposta
          ? '<p style="margin:10px 0 0;padding:9px;background:#f3f5ff;border-radius:8px;white-space:pre-wrap">' +
            (d.resposta).replace(/[<>&]/g, '') + '</p>'
          : '<p class="muted" style="margin:8px 0 0">' + T.semResposta + '</p>');
    } catch (e) {
      $('fichaVer').disabled = false; $('fichaVerMsg').textContent = T.erro;
    }
  };

  $('fichaEnviar').onclick = async () => {
    const txt = ($('fichaTexto').value || '').trim();
    if (!txt) { $('fichaMsg').textContent = T.vazio; return; }
    if (!SUPA || !ANON) { $('fichaMsg').textContent = T.semRede; return; }
    $('fichaEnviar').disabled = true;
    $('fichaMsg').textContent = T.indo;
    try {
      const r = await fetch(SUPA + '/rest/v1/rpc/walkstamp_recado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + ANON },
        body: JSON.stringify({ p_tipo: tipo, p_texto: txt,
          p_email: ($('fichaEmail').value || '').trim() || null,
          p_nota: nota, p_idioma: lang, p_origem: 'site',
          p_diag: location.href + '\n' + navigator.userAgent.slice(0, 160) })
      });
      const resp = await r.json().catch(() => null);
      $('fichaEnviar').disabled = false;
      if (!r.ok || resp === 'vazio') { $('fichaMsg').textContent = T.erro; return; }
      if (resp === 'muitos') { $('fichaMsg').textContent = T.muitos; return; }
      $('fichaTexto').value = '';
      /* O número é o que a pessoa anota. Sem e-mail ela não consulta depois, e
         é melhor dizer isso agora do que deixar descobrir quando precisar. */
      const temEmail = !!($('fichaEmail').value || '').trim();
      $('fichaMsg').textContent = T.enviado.replace('{0}', resp) +
        (temEmail ? '' : ' ' + T.semEmail);
      if (T.evento) T.evento('recado', tipo);
    } catch (e) {
      $('fichaEnviar').disabled = false;
      $('fichaMsg').textContent = T.erro;
    }
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
