/* O roteamento público.
 *
 * A regra que manda em tudo: **o endereço publicado não muda**. A home
 * portuguesa é `/`, não `/pt`; a página de preços é `/precos`, não
 * `/pt/precos`. Cada um desses endereços está num canonical já indexado, num
 * sitemap já enviado e em links que outras pessoas já publicaram — trocar
 * qualquer um deles é jogar fora tráfego que custou meses.
 *
 * Por dentro, o Next precisa do idioma como segmento (`app/[lang]/…`) para o
 * `<html lang>` sair certo. A ponte entre as duas coisas são os `rewrites` daqui,
 * e é só isso que eles fazem.
 */
import fs from 'node:fs';

const rotas = JSON.parse(fs.readFileSync('./src/rotas.json', 'utf8'));
const { idiomas, slugs } = rotas;
const PREFIXO = { pt: '', en: '/en', es: '/es' };
const paginas = Object.keys(slugs);

/* A área do cliente tem endereço traduzido como o resto do site: quem lê em
   espanhol não deveria ter que reconhecer a palavra "conta" para achar a
   própria fatura. Por dentro ela mora em `/conta/<idioma>`. */
const CONTA = { pt: '/conta', en: '/en/account', es: '/es/cuenta' };
/* A tela de controle do roteiro de casos, dentro da conta e traduzida igual.
   Ela é separada da ferramenta: quem organiza a fila e quem grava o vídeo são
   momentos diferentes, e quase sempre pessoas diferentes. */
const ROTEIRO = { pt: '/conta/roteiro', en: '/en/account/cases', es: '/es/cuenta/casos' };

/** O endereço público de cada página, no idioma dela. */
const publico = (pg, L) => (pg === 'home' ? PREFIXO[L] || '/' : PREFIXO[L] + '/' + slugs[pg][L]);
/** E onde ela mora dentro do `app/`. */
const interno = (pg, L) => (pg === 'home' ? `/${L}` : `/${L}/${slugs[pg][L]}`);

const config = {
  // Os cabeçalhos vinham do vercel.json. Vieram para cá porque agora valem
  // também em desenvolvimento e nos testes — um cabeçalho que só existe em
  // produção é um cabeçalho que ninguém testa.
  async headers() {
    return [{
      source: '/:caminho*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        // `credentialless` é o que deixa a ferramenta usar SharedArrayBuffer
        // (a transcrição em WebAssembly) sem barrar imagem de outra origem.
        { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
      ],
    }];
  },

  async redirects() {
    const r = [];
    // `/pt` e `/pt/qualquer-coisa` existem por dentro; se alguém chegar neles
    // por fora, vai para o endereço de verdade. Duas URLs para a mesma página é
    // o buscador dividindo a força dela entre as duas.
    r.push({ source: '/pt', destination: '/', permanent: true });
    for (const pg of paginas) {
      r.push({ source: `/pt/${slugs[pg].pt}`, destination: publico(pg, 'pt'), permanent: true });
    }
    // O site antigo era servido com `cleanUrls`, que aceitava `/precos.html` e
    // mandava para `/precos`. Continua aceitando: há links por aí com o `.html`.
    r.push({ source: '/index.html', destination: '/', permanent: true });
    for (const L of idiomas) {
      for (const pg of paginas) {
        r.push({ source: `${publico(pg, L)}.html`, destination: publico(pg, L), permanent: true });
      }
      // e o endereço interno da conta também não é para ser visitado por fora
      r.push({ source: `/conta/${L}`, destination: CONTA[L], permanent: true });
      r.push({ source: `/conta/${L}/roteiro`, destination: ROTEIRO[L], permanent: true });
    }
    return r;
  },

  async rewrites() {
    const depois = [];
    for (const pg of ['home', ...paginas]) {
      // en e es já vêm com o idioma no endereço; só o português precisa da ponte
      if (publico(pg, 'pt') !== interno(pg, 'pt')) {
        depois.push({ source: publico(pg, 'pt'), destination: interno(pg, 'pt') });
      }
    }
    for (const L of idiomas) depois.push({ source: CONTA[L], destination: `/conta/${L}` });
    // A ferramenta é um arquivo estático em `public/app.html` e continua sendo.
    // O `/app` sem extensão é o endereço que o site inteiro cita há meses.
    depois.push({ source: '/app', destination: '/app.html' });

    /* A tela do roteiro precisa da ponte ANTES dos arquivos, e não depois.
       `/conta/roteiro` casa com a rota dinâmica `/conta/[lang]` — com `lang`
       valendo a palavra "roteiro" — e uma reescrita `afterFiles` só é
       consultada quando NENHUMA rota casou. O resultado seria um 404 numa tela
       que existe. `/conta/planilha` não precisa disto: é rota estática de
       verdade, e estática ganha da dinâmica sem ponte nenhuma. */
    const antes = idiomas.map((L) => ({ source: ROTEIRO[L], destination: `/conta/${L}/roteiro` }));

    return { beforeFiles: antes, afterFiles: depois };
  },
};

export default config;
