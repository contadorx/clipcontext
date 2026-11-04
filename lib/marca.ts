/* A identidade, e só ela.
 *
 * Está num arquivo separado do resto do site porque o `middleware`, que rodava
 * no Edge (onde não existe sistema de arquivos), também a importava. O
 * middleware saiu no Build 71, com a conta; o arquivo ficou separado porque
 * continua sendo o lugar certo para uma coisa que não lê disco.
 *
 * `src/marca.json` é escrito pelo `build.py`, que continua sendo o dono do nome,
 * do domínio e da identificação legal. Aqui é importação estática — o valor
 * entra no pacote na hora do build, sem ler disco em tempo de execução.
 *
 * Saíram no Build 71: o endereço e a chave do Supabase, as duas chaves
 * públicas da licença (que a ferramenta já não conferia desde o 69) e os
 * prazos de retenção da conta.
 */
import dados from '@/src/marca.json';

export const marca: {
  marca: string; marcaA: string; marcaB: string; site: string; iconV: string;
  empresa: string; cnpj: string; contato: string; encarregado: string;
  analytics: string;
} = dados;
