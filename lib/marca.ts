/* A identidade, e só ela.
 *
 * Está num arquivo separado do resto do site por um motivo concreto: o
 * `middleware` roda no Edge, onde não existe sistema de arquivos. Se `marca`
 * viesse do mesmo módulo que lê os corpos das páginas em disco, importar o nome
 * da marca arrastaria o `fs` junto e o build quebrava.
 *
 * `src/marca.json` é escrito pelo `build.py`, que continua sendo o dono do nome,
 * do domínio e das chaves públicas. Aqui é importação estática — o valor entra
 * no pacote na hora do build, sem ler disco em tempo de execução.
 */
import dados from '@/src/marca.json';

export const marca: {
  marca: string; marcaA: string; marcaB: string; site: string; iconV: string;
  empresa: string; cnpj: string; contato: string;
  supaUrl: string; supaKey: string; analytics: string;
  licPub: string; licPubAuto: string;
} = dados;
