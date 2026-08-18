/* O MENU do painel, num lugar só.
 *
 * A área do cliente era UMA página de 484 linhas com sete seções empilhadas:
 * plano, licença, roteiro, faturas, chamados, time, modelos. Tudo aberto ao
 * mesmo tempo, sem dizer onde a pessoa está nem o que existe além do que ela
 * enxerga. Quem entra para ver uma fatura rola por cima do plano, da chave de
 * licença e da lista de assentos até achar — e quem entra para bloquear um
 * assento não descobre que dá, porque aquilo está no fim de uma página que
 * ninguém termina de ler.
 *
 * Agora são rotas, e o menu é este.
 *
 * ---- por que uma TABELA, e não os links escritos na casca ----
 *
 * É a lição que este projeto já aprendeu quatro vezes, sempre do mesmo jeito:
 * uma lista escrita à mão ao lado de outra lista de verdade. Foi assim que o
 * alemão e o francês ficaram sem `hreflang`, e depois vendo o tour em inglês
 * mesmo com o vídeo deles pronto. Um item de menu escrito na casca é um item
 * que existe em um idioma e some no outro sem ninguém ver.
 *
 * Aqui: o rótulo vem do dicionário (`lib/conta/textos.ts`), o endereço é
 * montado a partir do idioma, e quem some quando não há do que falar some por
 * uma regra escrita — não por alguém ter lembrado de esconder.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Lang, Textos } from '@/lib/conta/textos';
import { CAMINHO } from '@/lib/conta/textos';

/* Os pedaços traduzidos de cada sub-rota vêm do `rotas.json`, escrito pelo
   `build.py`. O `next.config.mjs` lê a MESMA tabela para montar a ponte de
   reescrita — e é isso que impede o menu apontar para `/de/konto/faturas`
   enquanto a ponte só conhece `/de/konto/rechnungen`, que daria 404 num link
   do próprio produto. */
const SUB: Record<string, Record<Lang, string>> = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'src', 'rotas.json'), 'utf8'),
).subConta;

export interface ItemNav {
  /** o pedaço final do endereço; vazio é a raiz do painel */
  slug: string;
  /** a chave do rótulo no dicionário — nunca o texto */
  rotulo: keyof Textos;
  /** o desenho do ícone, em `path` de SVG 24×24 */
  icone: string;
  /** quando este item só existe para parte das pessoas */
  quando?: 'time' | 'plano' | 'dono';
}

/* Os ícones são traçados à mão, em `path`, e vão inline: a área do cliente já
   carrega o `site.css` e nada mais, e um pacote de ícones para seis desenhos
   seria mais bytes que o painel inteiro. */
export const NAV: ItemNav[] = [
  { slug: '',          rotulo: 'navInicio',
    icone: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { slug: 'roteiro',   rotulo: 'navRoteiro',
    icone: 'M4 4h16v16H4z M8 9h8 M8 13h8 M8 17h5' },
  { slug: 'faturas',   rotulo: 'navFaturas',
    icone: 'M6 2h12v20l-3-2-3 2-3-2-3 2z M9 7h6 M9 11h6' },
  { slug: 'chamados',  rotulo: 'navChamados',
    icone: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { slug: 'time',      rotulo: 'navTime', quando: 'time',
    icone: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
  { slug: 'negocio',   rotulo: 'navNegocio', quando: 'dono',
    icone: 'M3 3v18h18 M7 15l4-4 3 3 5-6' },
];

/** O endereço público de um item, no idioma dele. */
export function enderecoDoItem(slug: string, lang: Lang): string {
  const base = CAMINHO[lang];
  if (!slug) return base;
  const traduzido = SUB[slug]?.[lang] ?? slug;
  return `${base}/${traduzido}`;
}

/** O menu que ESTA pessoa vê. */
export function menuDe(lang: Lang, tem: { time: boolean; plano: boolean; dono: boolean }) {
  return NAV.filter((i) => !i.quando || tem[i.quando]).map((i) => ({
    ...i,
    href: enderecoDoItem(i.slug, lang),
  }));
}
