/* O convite por e-mail — o único lugar do produto em que NÓS mandamos algo.
 *
 * O que se compartilha continua sendo o endereço da ferramenta. Nunca o
 * documento: ele não sai da máquina de quem gravou, e essa é a promessa que o
 * produto vende. Aqui não passa vídeo, não passa transcrição, não passa PDF.
 *
 * O QUE MUDA NA HISTÓRIA DE PRIVACIDADE, dito sem rodeio: o endereço de e-mail
 * de quem vai receber o convite passa por este servidor. Antes o `mailto:`
 * abria o programa de e-mail da própria pessoa e nada disso nos alcançava. A
 * página de privacidade precisa dizer isso — e diz, na seção do convite.
 *
 * POR QUE ISTO EXISTE. O `mailto:` depende de haver um cliente de e-mail
 * configurado na máquina. Em computador corporativo com webmail, o clique
 * abria o Outlook que ninguém usa, ou não abria nada. Um botão que não faz
 * nada em metade das máquinas é pior do que botão nenhum.
 *
 * ================================ A TRANCA ================================
 *
 * Um endereço que manda e-mail para quem for pedido é um relé de spam, e vira
 * um em uma semana. Cinco travas, e cada uma cobre um buraco diferente:
 *
 *   1. TEXTO FIXO. Quem chama escolhe o DESTINATÁRIO e um primeiro nome. O
 *      corpo é nosso, sempre o mesmo, escrito aqui. Não há campo de mensagem
 *      livre — sem isso o endereço vira um envelope para mandar qualquer coisa
 *      com o nosso domínio no remetente, e é o nosso domínio que queima.
 *   2. LIMITE POR ORIGEM. Cinco por hora por IP. O IP é guardado em HASH, com
 *      um segredo do ambiente: dá para contar sem dar para saber de quem é.
 *   3. LIMITE POR DESTINATÁRIO. Dois por dia para o mesmo endereço, contados
 *      também por hash. É o que impede usar o convite para incomodar alguém.
 *   4. ORIGEM CONFERIDA. Só aceita chamada vinda do nosso próprio site. O
 *      pacote offline abre de `file://` e não tem rede — lá o aplicativo cai
 *      no `mailto:` sozinho, que é o certo.
 *   5. RECUSA FECHADA. Faltando qualquer segredo (a chave do serviço de
 *      e-mail, a do banco, a do hash), responde 503 e não manda nada. Um
 *      endereço que fica aberto quando falta variável de ambiente é o tipo de
 *      porta que ninguém percebe estar aberta — o mesmo raciocínio da faxina.
 *
 * O aplicativo trata o 503 e o 429 caindo no `mailto:`, com a frase explicando.
 * Nenhuma resposta daqui deixa a pessoa sem caminho.
 */
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import marca from '@/src/marca.json';
import { mandarEmail, podeMandarEmail } from '@/lib/email';
import { moldeDeCarta } from '@/lib/carta';
import { daCasa } from '@/lib/daCasa';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const IDIOMAS = ['pt', 'en', 'es', 'de', 'fr'] as const;
type Lang = (typeof IDIOMAS)[number];

const URL_BASE = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE_BANCO = process.env.SUPABASE_SERVICE_ROLE_KEY;
/* O disparo saiu daqui e virou `lib/email.ts`: agora há um segundo e-mail no
   produto (a resposta de um chamado) e vão aparecer outros. Cada rota com a sua
   chamada é cada rota com a sua versão do remetente e do tratamento de erro. */
/* O SAL É DELE, E NÃO EMPRESTADO DO `CRON_SECRET` — 24/08.
   Era `process.env.CONVITE_SAL || process.env.CRON_SECRET`, e o `CRON_SECRET` é
   a chave do endereço que APAGA dado de cliente. Rodar o segredo daquele
   endereço é uma boa prática de segurança — e, com o encosto aqui, ela
   reescrevia todos os hashes deste arquivo em silêncio: as contagens do
   limite de convite zeravam junto.
   Quem faz aquela rotação está pensando em faxina, não em convite. Um efeito
   colateral que ninguém tem motivo para prever é a definição de armadilha, e o
   custo de evitá-la é uma variável de ambiente que a lista de configuração já
   pede desde sempre (passo 8). */
const SAL = process.env.CONVITE_SAL;


const temTudo = Boolean(URL_BASE && CHAVE_BANCO && podeMandarEmail() && SAL);

/* Hash, e não o valor. Contar quantos convites saíram de um IP não exige
   guardar o IP; contar quantos chegaram num endereço não exige guardar o
   endereço. O sal vem do ambiente para que a tabela, vazada, não permita
   testar "este e-mail está lá?" com um dicionário. */
const disfarcar = (v: string) =>
  createHash('sha256').update(`${SAL}:${v.trim().toLowerCase()}`).digest('hex').slice(0, 32);

/* Um e-mail válido o suficiente. Validar e-mail por expressão regular é uma
   armadilha conhecida — a única prova de verdade é a mensagem chegar. O que se
   quer aqui é barrar o que claramente não é endereço, e nada além disso. */
const pareceEmail = (v: string) =>
  typeof v === 'string' && v.length <= 254 && /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(v.trim());

const idiomaDe = (v: unknown): Lang =>
  IDIOMAS.includes(String(v) as Lang) ? (String(v) as Lang) : 'en';

/* O `daCasa` saiu daqui e virou `lib/daCasa.ts` — 29/08. A rota do chamado
   precisou da mesma conferência, e duas cópias desta função são duas listas de
   hosts de prévia: a segunda é a que esquece de ser corrigida. */

const TEXTOS: Record<Lang, {
  assunto: (quem: string) => string;
  ola: (nome: string) => string;
  corpo: string; botao: string; porque: (quem: string) => string; rodape: string;
}> = {
  pt: {
    assunto: (q) => q ? `${q} indicou o Walkstamp para você` : 'Alguém indicou o Walkstamp para você',
    ola: (n) => n ? `Oi, ${n}` : 'Oi',
    corpo: 'O Walkstamp transforma uma gravação de tela em documento: só os instantes em que a tela muda, cada um com a hora exata e com o que estava sendo dito. Roda inteiro no navegador — o vídeo não sai do computador de quem grava.',
    botao: 'Abrir a ferramenta',
    porque: (q) => q ? `Você recebeu isto porque ${q} pediu que enviássemos.` : 'Você recebeu isto porque alguém pediu que enviássemos.',
    rodape: 'Não queremos incomodar: não há cadastro nenhum por trás deste e-mail, e ele não se repete.',
  },
  en: {
    assunto: (q) => q ? `${q} thought you should see Walkstamp` : 'Someone thought you should see Walkstamp',
    ola: (n) => n ? `Hi ${n}` : 'Hi',
    corpo: 'Walkstamp turns a screen recording into a document: only the moments where the screen changed, each with the exact time and with what was being said. It runs entirely in the browser — the video never leaves the recorder’s computer.',
    botao: 'Open the tool',
    porque: (q) => q ? `You got this because ${q} asked us to send it.` : 'You got this because someone asked us to send it.',
    rodape: 'We do not want to bother you: there is no sign-up behind this email, and it does not repeat.',
  },
  es: {
    assunto: (q) => q ? `${q} te recomendó Walkstamp` : 'Alguien te recomendó Walkstamp',
    ola: (n) => n ? `Hola, ${n}` : 'Hola',
    corpo: 'Walkstamp convierte una grabación de pantalla en documento: solo los instantes en que la pantalla cambia, cada uno con la hora exacta y con lo que se estaba diciendo. Funciona entero en el navegador — el vídeo no sale del ordenador de quien graba.',
    botao: 'Abrir la herramienta',
    porque: (q) => q ? `Recibes esto porque ${q} pidió que te lo enviáramos.` : 'Recibes esto porque alguien pidió que te lo enviáramos.',
    rodape: 'No queremos molestar: no hay ningún registro detrás de este correo, y no se repite.',
  },
  de: {
    assunto: (q) => q ? `${q} empfiehlt Ihnen Walkstamp` : 'Jemand empfiehlt Ihnen Walkstamp',
    ola: (n) => n ? `Hallo ${n}` : 'Hallo',
    corpo: 'Walkstamp macht aus einer Bildschirmaufnahme ein Dokument: nur die Momente, in denen sich der Bildschirm ändert, jeder mit der genauen Uhrzeit und mit dem, was gerade gesagt wurde. Es läuft vollständig im Browser — das Video verlässt den Rechner der aufnehmenden Person nicht.',
    botao: 'Werkzeug öffnen',
    porque: (q) => q ? `Sie erhalten dies, weil ${q} uns darum gebeten hat.` : 'Sie erhalten dies, weil jemand uns darum gebeten hat.',
    rodape: 'Wir wollen nicht stören: hinter dieser E-Mail steckt keine Anmeldung, und sie wiederholt sich nicht.',
  },
  fr: {
    assunto: (q) => q ? `${q} vous recommande Walkstamp` : 'Quelqu’un vous recommande Walkstamp',
    ola: (n) => n ? `Bonjour ${n}` : 'Bonjour',
    corpo: 'Walkstamp transforme un enregistrement d’écran en document : seulement les instants où l’écran change, chacun avec l’heure exacte et avec ce qui était dit. Tout tourne dans le navigateur — la vidéo ne quitte pas l’ordinateur de la personne qui enregistre.',
    botao: 'Ouvrir l’outil',
    porque: (q) => q ? `Vous recevez ceci parce que ${q} nous a demandé de vous l’envoyer.` : 'Vous recevez ceci parce que quelqu’un nous a demandé de vous l’envoyer.',
    rodape: 'Nous ne voulons pas déranger : il n’y a aucune inscription derrière cet e-mail, et il ne se répète pas.',
  },
};

/* O ESC E O MOLDE SAÍRAM DAQUI e viraram `lib/carta.ts` — 28/08. Havia dois
   HTMLs de carta no produto (este e o do aviso de chamado) e o convite de
   assento ia ser o terceiro. Em e-mail esse defeito é invisível de dentro:
   ninguém abre as três no Outlook para comparar, e a que ficou sem a cor de
   fundo só aparece errada na caixa de quem recebe — que não reclama, só não
   clica. */

/** Conta e registra, no banco, com a chave de serviço. Devolve `false` quando
 *  o limite estourou — e `null` quando o banco não respondeu, que é diferente:
 *  banco fora do ar não pode virar permissão para mandar à vontade. */
async function podeMandar(ipHash: string, paraHash: string): Promise<boolean | null> {
  try {
    const r = await fetch(`${URL_BASE}/rest/v1/rpc/walkstamp_convite_pode`, {
      method: 'POST',
      headers: {
        apikey: CHAVE_BANCO!,
        Authorization: `Bearer ${CHAVE_BANCO}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip: ipHash, p_para: paraHash }),
      cache: 'no-store',
    });
    if (!r.ok) return null;
    return (await r.json()) === true;
  } catch { return null; }
}

export async function POST(req: Request) {
  /* A origem vem ANTES do resto, inclusive antes de conferir os segredos: uma
     chamada de fora não deve nem descobrir se este endereço está configurado.
     Responder 503 para quem não é da casa entrega, de graça, que existe um
     serviço aqui esperando uma chave. */
  if (!daCasa(req)) {
    return NextResponse.json({ erro: 'origem' }, { status: 403 });
  }
  if (!temTudo) {
    return NextResponse.json(
      { erro: 'sem_servico', detalhe: 'faltam variáveis de ambiente para mandar e-mail' },
      { status: 503 },
    );
  }

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return NextResponse.json({ erro: 'json' }, { status: 400 }); }

  const para = String(corpo.para || '').trim();
  if (!pareceEmail(para)) return NextResponse.json({ erro: 'email' }, { status: 400 });

  /* Só o PRIMEIRO nome, e curto. Um campo de nome que aceita qualquer coisa é
     um campo de mensagem livre disfarçado — dá para escrever a mensagem inteira
     dentro do "nome" e usar o nosso remetente para entregá-la. */
  const limpo = (v: unknown, n: number) =>
    String(v ?? '').replace(/[\r\n<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const nome = limpo(corpo.nome, 40);
  const quem = limpo(corpo.quem, 40);
  const lang = idiomaDe(corpo.lang);

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sem-ip';
  const permitido = await podeMandar(disfarcar(ip), disfarcar(para));
  if (permitido === null) {
    return NextResponse.json({ erro: 'sem_servico', detalhe: 'não consegui conferir o limite' }, { status: 503 });
  }
  if (!permitido) return NextResponse.json({ erro: 'limite' }, { status: 429 });

  const t = TEXTOS[lang];
  const url = marca.site + (lang === 'pt' ? '' : '/' + lang);
  const enviado = await mandarEmail({
    para,
    nome: nome || undefined,
    assunto: t.assunto(quem),
    html: moldeDeCarta({ ola: t.ola(nome), corpo: [t.corpo], botao: t.botao, url,
                         rodape: [t.porque(quem), t.rodape] }),
    texto: `${t.ola(nome)}\n\n${t.corpo}\n\n${url}\n\n${t.porque(quem)}\n${t.rodape}`,
  });
  if (!enviado.ok) return NextResponse.json({ erro: 'envio' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
