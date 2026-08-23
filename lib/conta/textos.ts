/* Os textos da área do cliente.
 *
 * Importação estática, não leitura de disco: este módulo é usado por Server
 * Actions e pelo layout, e um `fs.readFileSync` aqui arrastaria o Node inteiro
 * para lugares onde ele não cabe (o middleware roda no Edge).
 *
 * A trava está no `conferir()` lá embaixo, chamada uma vez quando o módulo
 * carrega: se faltar uma chave em inglês ou espanhol, o build quebra. Sem isso,
 * a falta vira `undefined` na tela de um cliente — em silêncio, e só no idioma
 * que ninguém testou.
 */
import bruto from '@/src/i18n-conta.json';

export type Lang = 'pt' | 'en' | 'es' | 'de' | 'fr';
export type Textos = Record<string, string>;

const dicionarios = bruto as unknown as Record<string, Textos>;

export const IDIOMAS_CONTA: Lang[] = ['pt', 'en', 'es', 'de', 'fr'];

/** O endereço da área do cliente em cada idioma. Traduzido, como as outras
 *  páginas do site: quem lê em espanhol não deveria ter que reconhecer a
 *  palavra "conta" para achar a própria fatura. */
/* O ENDEREÇO SAI DO `rotas.json`, e não escrito aqui.
 *
 * Esta era a TERCEIRA cópia do endereço da conta — as outras duas são o
 * `next.config.mjs`, que monta as pontes de reescrita, e o `middleware.ts`, que
 * casa a sessão. E uma cópia com três idiomas onde havia cinco já foi o
 * `undefined` do rodapé em produção.
 *
 * Importado estaticamente, como `lib/marca.ts` já faz com `marca.json`: assim
 * o TypeScript reprova no build se o arquivo perder um idioma, em vez de a
 * página descobrir isso em produção. */
import rotas from '@/src/rotas.json';

export const CAMINHO: Record<Lang, string> = rotas.caminhoConta;

export const HTML_LANG: Record<Lang, string> = { pt: 'pt-BR', en: 'en', es: 'es', de: 'de', fr: 'fr' };

/** O locale de formatação — data, hora e número — de cada idioma.
 *
 *  Ele estava escrito QUATRO vezes, idêntico: `conta/[lang]/page.tsx`,
 *  `roteiro/page.tsx`, `secoes.tsx` e `blog/txt.ts`. Quatro cópias idênticas não
 *  doem no dia em que nascem; doem no dia em que três são atualizadas.
 *
 *  E havia uma QUINTA, diferente das outras: `app/conta/acoes.ts` fazia
 *  `lang === 'pt' ? 'pt-BR' : lang`, que devolve `en` onde estas devolvem
 *  `en-US` — e é essa que ia para a Stripe decidir o idioma do checkout.
 *
 *  `HTML_LANG` acima é outra coisa e continua separada de propósito: ela é o
 *  atributo `lang` do documento, que o leitor de tela e o buscador leem, e lá o
 *  inglês é `en` e não `en-US`. */
export const LOCALE: Record<Lang, string> = {
  pt: 'pt-BR', en: 'en-US', es: 'es-ES', de: 'de-DE', fr: 'fr-FR',
};

/** O locale que a STRIPE aceita, que é OUTRO vocabulário — e por isso é outra
 *  tabela, e não um descuido.
 *
 *  `Stripe.Checkout.SessionCreateParams.Locale` é uma lista fechada:
 *  `'auto' | 'bg' | ... | 'en' | 'en-GB' | 'es' | 'es-419' | ... | 'pt' |
 *  'pt-BR' | ...`. Ela tem `en`, e **não tem** `en-US`; tem `es`, e não `es-ES`.
 *  Mandar o `LOCALE` acima faria o checkout cair no idioma padrão da conta em
 *  quatro dos cinco idiomas, em silêncio.
 *
 *  Isto estava escrito como `lang === 'pt' ? 'pt-BR' : lang` dentro do
 *  `acoes.ts`, e o catálogo o listou como "a nona variante, com resultado
 *  diferente". Conferido contra os tipos do pacote: o resultado diferente é o
 *  CERTO. O que estava errado era ele ser um ternário anônimo no meio de uma
 *  chamada — a forma de uma coisa que parece acidente e por isso convida alguém
 *  a "consertá-la" para o `LOCALE`, que é o que quebraria. */
export const LOCALE_STRIPE: Record<Lang, string> = {
  pt: 'pt-BR', en: 'en', es: 'es', de: 'de', fr: 'fr',
};

export const ehLang = (v: string): v is Lang => IDIOMAS_CONTA.includes(v as Lang);

export function textos(lang: Lang): Textos {
  return dicionarios[lang];
}

/** Troca `{chave}` pelo valor. Uma chave sem valor fica visível de propósito —
 *  é melhor ver `{quantos}` na tela e consertar do que ver uma frase quebrada
 *  e não saber por quê. */
export function preencher(molde: string, vals: Record<string, string | number>): string {
  let s = molde;
  for (const [k, v] of Object.entries(vals)) s = s.split('{' + k + '}').join(String(v));
  return s;
}

function conferir() {
  const base = Object.keys(dicionarios.pt);
  for (const L of IDIOMAS_CONTA) {
    if (L === 'pt') continue;
    const faltando = base.filter((k) => !(k in dicionarios[L]));
    const sobrando = Object.keys(dicionarios[L]).filter((k) => !base.includes(k));
    if (faltando.length || sobrando.length) {
      throw new Error(
        `i18n-conta.json fora de sincronia em "${L}"` +
        (faltando.length ? ` — faltam: ${faltando.join(', ')}` : '') +
        (sobrando.length ? ` — sobram: ${sobrando.join(', ')}` : ''),
      );
    }
  }
}
conferir();
