/* O vocabulário da coluna de reexecução — um lugar só, e sem nada do Node.
 *
 * Ele mora fora do `lib/planilha.ts` de propósito: aquele arquivo lê xlsx, usa
 * `Buffer` e `zlib`, e é de servidor. A tela que confere o mapa da planilha é
 * componente de CLIENTE e precisa da mesma normalização — a prévia tem que
 * mostrar o que vai ser guardado, e não a célula crua. Uma prévia que mostra
 * "Sim" e um banco que guarda `repetivel` são duas verdades para o mesmo dado.
 */
/** Como a planilha escreve "repetível" e "queima a massa", nos cinco idiomas e
 *  do jeito que a pessoa digitou. O banco só aceita os dois valores; normalizar
 *  aqui é o que impede uma célula em alemão de virar nulo em silêncio.
 *
 *  A ordem importa: `queima` é testado ANTES, porque "não repetível" contém
 *  "repetível" e cairia no lado errado. */
export function normalizarReexecucao(v: unknown): 'repetivel' | 'queima' | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  if (/(queima|consome|consumes?|burns?|uma\s*vez|once|n[aã]o\s*repet|not\s*repeat|non\s*repeat|nicht\s*wiederhol|verbraucht|no\s*repet|non\s*r[eé]p[eé]t|consomme)/.test(s)) {
    return 'queima';
  }
  if (/(repet|reutiliz|reusa|repeat|rerun|reusable|wiederhol|r[eé]p[eé]t|sim|yes|s[ií]|ja|oui)/.test(s)) {
    return 'repetivel';
  }
  return null;
}
