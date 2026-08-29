/* O CONVITE DE ASSENTO — o e-mail que faltava.
 *
 * O cartão Team vende, em cinco idiomas: "Assentos: convidar por e-mail, sem
 * ninguém digitar chave". Medido em 28/08: o assento era criado no banco e
 * **nenhum e-mail saía.** Quem administra tinha que avisar por fora, no
 * WhatsApp ou no chat da empresa — exatamente o trabalho manual que o cartão
 * diz que ele não terá. Era uma promessa sem porta, vendida como pronta, e sem
 * régua nenhuma cobrindo a falta.
 *
 * ---- o que este e-mail é, e o que ele não é ----
 *
 * Ele não carrega chave, nem token, nem link de sessão. O assento já existe no
 * banco; o que a pessoa precisa é ENTRAR com o e-mail dela, e a entrada é a
 * mesma de sempre — link mágico, sem senha. Um convite que carregasse acesso
 * viraria acesso encaminhável: quem recebesse o e-mail encaminhado entraria.
 *
 * ---- a tranca ----
 *
 * O `/api/convite` (o "indique a ferramenta a um colega") é aberto ao mundo e
 * por isso tem cinco travas. Este é outro caso: quem chama está autenticado,
 * paga, e o número de assentos já limita quantas pessoas distintas entram —
 * `time_convidar` recusa com `sem_assento`.
 *
 * Sobra UM abuso, e ele é real: reconvidar o mesmo endereço não gasta assento
 * (o `insert` é `on conflict do update`), então um administrador poderia mandar
 * carta para a mesma pessoa a tarde inteira. Por isso o limite POR DESTINO
 * continua valendo, com o mesmo número do outro convite — 2 por dia.
 *
 * O limite POR ORIGEM é que precisou ser outro. O do `/api/convite` é 5 por
 * hora, e reaproveitá-lo aqui quebraria a funcionalidade que este arquivo
 * existe para entregar: um time de 25 assentos levaria cinco horas para ser
 * montado. Aqui são 60 por hora por administrador — folga para montar um time
 * inteiro numa sentada, e ainda assim um teto para um laço em fuga.
 *
 * ---- e quando não dá para mandar ----
 *
 * Faltando a chave do Brevo, o remetente ou o `CONVITE_SAL`, ele NÃO manda e
 * diz que não mandou. Quem chama tem que contar isso na tela: o assento nasceu,
 * a carta não saiu. É a regra do `lib/email.ts` levada até o fim — um "ok" sem
 * envio é a pior falha, porque ninguém procura o e-mail que o sistema jurou ter
 * mandado.
 */
import 'server-only';
import { createHash } from 'crypto';
import { mandarEmail, podeMandarEmail } from '@/lib/email';
import { moldeDeCarta } from '@/lib/carta';
import { rpc } from '@/lib/supabase/servico';
import marca from '@/src/marca.json';
import rotas from '@/src/rotas.json';

export type Lang = 'pt' | 'en' | 'es' | 'de' | 'fr';

/** Por que não saiu — para quem chama escolher o que dizer na tela. */
export type Resultado = 'enviado' | 'sem_configuracao' | 'limite' | 'falha';

const TEXTOS: Record<Lang, {
  assunto: (cliente: string) => string;
  ola: string;
  quem: (quem: string, cliente: string) => string;
  corpo: string;
  como: string;
  botao: string;
  porque: string;
  rodape: string;
}> = {
  pt: {
    assunto: (c) => `Você tem um assento do Walkstamp em ${c}`,
    ola: 'Oi',
    quem: (q, c) => `${q} reservou um assento do Walkstamp para você, em ${c}.`,
    corpo: 'O Walkstamp transforma uma gravação de tela em documento: só os instantes em que a tela muda, cada um com a hora exata e com o que estava sendo dito. Roda inteiro no navegador — o vídeo não sai do seu computador.',
    como: 'Para começar, entre com este mesmo endereço de e-mail. Não há senha nem chave para digitar: a licença chega sozinha.',
    botao: 'Entrar com o meu e-mail',
    porque: 'Você recebeu isto porque foi convidado para um time do Walkstamp.',
    rodape: 'Se não era para você, é só ignorar: sem entrar, nada acontece.',
  },
  en: {
    assunto: (c) => `You have a Walkstamp seat at ${c}`,
    ola: 'Hi',
    quem: (q, c) => `${q} reserved a Walkstamp seat for you, at ${c}.`,
    corpo: 'Walkstamp turns a screen recording into a document: only the moments where the screen changed, each with the exact time and with what was being said. It runs entirely in the browser — the video never leaves your computer.',
    como: 'To start, sign in with this same email address. There is no password and no key to type: the licence arrives on its own.',
    botao: 'Sign in with my email',
    porque: 'You received this because you were invited to a Walkstamp team.',
    rodape: 'If this was not meant for you, just ignore it: without signing in, nothing happens.',
  },
  es: {
    assunto: (c) => `Tienes un asiento de Walkstamp en ${c}`,
    ola: 'Hola',
    quem: (q, c) => `${q} reservó un asiento de Walkstamp para ti, en ${c}.`,
    corpo: 'Walkstamp convierte una grabación de pantalla en documento: solo los instantes en que la pantalla cambia, cada uno con la hora exacta y con lo que se estaba diciendo. Funciona entero en el navegador — el vídeo no sale de tu ordenador.',
    como: 'Para empezar, entra con esta misma dirección de correo. No hay contraseña ni clave que escribir: la licencia llega sola.',
    botao: 'Entrar con mi correo',
    porque: 'Recibes esto porque te invitaron a un equipo de Walkstamp.',
    rodape: 'Si no era para ti, ignóralo: sin entrar, no pasa nada.',
  },
  de: {
    assunto: (c) => `Sie haben einen Walkstamp-Platz bei ${c}`,
    ola: 'Hallo',
    quem: (q, c) => `${q} hat bei ${c} einen Walkstamp-Platz für Sie reserviert.`,
    corpo: 'Walkstamp macht aus einer Bildschirmaufnahme ein Dokument: nur die Momente, in denen sich der Bildschirm ändert, jeder mit der genauen Uhrzeit und mit dem, was gerade gesagt wurde. Es läuft vollständig im Browser — das Video verlässt Ihren Rechner nicht.',
    como: 'Melden Sie sich zum Start mit genau dieser E-Mail-Adresse an. Es gibt kein Passwort und keinen Schlüssel zum Eintippen: die Lizenz kommt von selbst.',
    botao: 'Mit meiner E-Mail anmelden',
    porque: 'Sie erhalten dies, weil Sie in ein Walkstamp-Team eingeladen wurden.',
    rodape: 'War das nicht für Sie bestimmt, ignorieren Sie es einfach: ohne Anmeldung passiert nichts.',
  },
  fr: {
    assunto: (c) => `Vous avez un siège Walkstamp chez ${c}`,
    ola: 'Bonjour',
    quem: (q, c) => `${q} a réservé un siège Walkstamp pour vous, chez ${c}.`,
    corpo: 'Walkstamp transforme un enregistrement d’écran en document : seulement les instants où l’écran change, chacun avec l’heure exacte et avec ce qui était dit. Tout tourne dans le navigateur — la vidéo ne quitte pas votre ordinateur.',
    como: 'Pour commencer, connectez-vous avec cette même adresse e-mail. Il n’y a ni mot de passe ni clé à saisir : la licence arrive toute seule.',
    botao: 'Se connecter avec mon e-mail',
    porque: 'Vous recevez ceci parce que vous avez été invité dans une équipe Walkstamp.',
    rodape: 'Si ce n’était pas pour vous, ignorez-le : sans connexion, rien ne se passe.',
  },
};

/* A MESMA TRAVA DO `lib/conta/textos.ts`, e pelo mesmo motivo: a falta de um
   idioma vira `undefined` no assunto de um e-mail de cliente, em silêncio e só
   na língua que ninguém testou. Aqui ela roda quando o módulo carrega. */
for (const L of ['pt', 'en', 'es', 'de', 'fr'] as Lang[]) {
  const t = TEXTOS[L];
  if (!t || !t.ola || !t.corpo || !t.botao) {
    throw new Error(`convite de assento sem texto em "${L}"`);
  }
}

/* O ENDEREÇO DA CONTA SAI DO `rotas.json`. Escrito aqui seria a quarta cópia
   dele — as outras três são o `next.config.mjs`, o `middleware.ts` e o
   `lib/conta/textos.ts`, e a quarta é sempre a que fica para trás. */
const CAMINHO = rotas.caminhoConta as Record<Lang, string>;

/* Nem o endereço do administrador nem o de destino são guardados: só um hash
   com sal do ambiente, igual ao `/api/convite`. Dá para contar sem dar para
   saber de quem é. */
const SAL = process.env.CONVITE_SAL;
const disfarcar = (v: string) =>
  createHash('sha256').update(`${SAL}:${v.toLowerCase().trim()}`).digest('hex');

/** Manda o convite. Nunca lança: o assento já está criado quando isto roda, e
 *  uma carta que não saiu não pode desfazer trabalho que já existe. */
export async function convidarParaAssento(
  p: { para: string; quem: string; cliente: string | null; lang: Lang },
): Promise<Resultado> {
  if (!podeMandarEmail() || !SAL) return 'sem_configuracao';

  /* O limite mora no banco e é conferido-e-registrado na mesma transação, como
     o do outro convite: conferir num lugar e registrar em outro abre a janela
     entre os dois. Banco fora do ar NÃO vira permissão para mandar à vontade. */
  let pode: boolean;
  try {
    pode = (await rpc<boolean>('walkstamp_convite_assento_pode', {
      p_quem: disfarcar(p.quem), p_para: disfarcar(p.para),
    })) === true;
  } catch { return 'falha'; }
  if (!pode) return 'limite';

  const t = TEXTOS[p.lang];
  /* Sem nome de cliente configurado, a frase não pode virar "em null". O nome
     da marca é o fallback honesto: o assento é de um time do Walkstamp. */
  const cliente = (p.cliente || '').trim() || marca.marca;
  const url = marca.site + CAMINHO[p.lang];
  const corpo = [t.quem(p.quem, cliente), t.corpo, t.como];

  const r = await mandarEmail({
    para: p.para,
    assunto: t.assunto(cliente),
    /* A resposta vai para gente, e não para o endereço de disparo: quem recebe
       um convite responde perguntando o que é isso. */
    responderPara: marca.contato,
    html: moldeDeCarta({ ola: t.ola, corpo, botao: t.botao, url, rodape: [t.porque, t.rodape] }),
    texto: `${t.ola},\n\n${corpo.join('\n\n')}\n\n${url}\n\n${t.porque}\n${t.rodape}`,
  });
  return r.ok ? 'enviado' : 'falha';
}
