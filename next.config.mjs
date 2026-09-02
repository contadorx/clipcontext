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
/* Sai de `idiomas`, e não escrito à mão: uma tabela de prefixos que precisa ser
   lembrada a cada idioma novo é uma tabela que vai ser esquecida — e o sintoma
   é um `undefined/aide.html` no build, que não aponta para a causa. */
const PREFIXO = Object.fromEntries(idiomas.map((L) => [L, L === 'pt' ? '' : '/' + L]));

/* ---- A CONTENT-SECURITY-POLICY, EM `Report-Only` --------------------------
 *
 * Ela é a resposta executável para a pergunta do questionário de fornecedor:
 * "o que impede o dado de sair?". Hoje a resposta é "nós"; com ela, é o
 * navegador — e a diferença entre as duas é a única que conta numa auditoria.
 *
 * CADA ORIGEM AQUI TEM MOTIVO, e nenhuma entrou por precaução:
 *
 *   cdn.jsdelivr.net   a biblioteca de transcrição, o runtime WebAssembly e o
 *                      gerador de PDF. É a única dependência de execução que a
 *                      ferramenta busca de fora;
 *   huggingface.co     os pesos do modelo de fala, e o `cdn-lfs` que serve os
 *                      arquivos grandes;
 *   *.supabase.co      a conta: sessão, licença, chamado e a medição anônima.
 *                      A ferramenta funciona sem ele — é aditivo, nunca
 *                      requisito — mas quando existe, é para lá que ele fala;
 *   accounts/apis      o Google Drive, que é recurso desligado hoje e vai
 *   /docs.google.com   ligar depois. Fora daqui, ligá-lo quebraria em produção
 *                      com um erro que ninguém liga à CSP.
 *
 * `'wasm-unsafe-eval'` é obrigatório: a transcrição É WebAssembly. Sem ele o
 * produto não transcreve, e transcrever é o que a pessoa veio fazer.
 *
 * `'unsafe-inline'` no estilo, e a razão é contável: são 385 atributos
 * `style=` nos corpos do site e 147 na ferramenta. Trocá-los por classe é
 * trabalho de verdade, e ele não cabe no mesmo build que liga a regra. Fica
 * escrito aqui como dívida, e não como decisão.
 *
 * O SCRIPT NÃO GANHOU `'unsafe-inline'`, de propósito — é ali que a regra vale
 * alguma coisa. É a linha que a régua `testes/csp.mjs` mede, e é o que a
 * segunda metade da DEC-12 vai ter de resolver com hash ou nonce.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  /* `report-sample` faz o navegador mandar os primeiros caracteres do trecho
     barrado junto com o aviso. Sem ele, "um script inline violou" não diz QUAL
     — e a diferença entre um `<script>` que a gente escreveu e um que o
     framework injeta decide se a saída é hash ou nonce. */
  "script-src 'self' 'wasm-unsafe-eval' 'report-sample' blob: https://cdn.jsdelivr.net " +
    'https://apis.google.com https://accounts.google.com',
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https://cdn.jsdelivr.net https://huggingface.co " +
    'https://*.huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co ' +
    'https://*.supabase.co https://www.googleapis.com https://accounts.google.com',
  "frame-src 'self' https://accounts.google.com https://docs.google.com",
  /* ONDE OS AVISOS CHEGAM — e sem isto o `Report-Only` não relatava a ninguém.
     Medido em 02/09: a política estava em `Report-Only` desde 24/08 e **sem
     endereço de relatório**. O navegador conferia, montava o aviso e jogava
     fora. Uma semana que devia ter virado dados virou trabalho de CPU na
     máquina dos outros — e a segunda metade da DEC-12 dependia justamente
     desses dados para não ser aposta.

     Os DOIS nomes, porque os navegadores não concordam: `report-uri` é o antigo
     e é o que a maioria ainda manda; `report-to` é o novo e precisa do
     cabeçalho `Reporting-Endpoints` ao lado. Manter só um é perder metade dos
     relatórios, e a metade que falta é sempre a que tinha a resposta. */
  'report-uri /api/csp',
  'report-to csp',
].join('; ');
const paginas = Object.keys(slugs);

/* A área do cliente tem endereço traduzido como o resto do site: quem lê em
   espanhol não deveria ter que reconhecer a palavra "conta" para achar a
   própria fatura. Por dentro ela mora em `/conta/<idioma>`. */
const CONTA = rotas.caminhoConta;
/* AS SUB-ROTAS DO PAINEL, traduzidas como o resto.

   Cada uma precisa de ponte `beforeFiles`, e não `afterFiles`: `/conta/faturas`
   casa com a rota dinâmica `/conta/[lang]` — com `lang` valendo a palavra
   "faturas" — e uma reescrita `afterFiles` só é consultada quando NENHUMA rota
   casou. O resultado seria 404 numa tela que existe. O roteiro já tinha
   aprendido isso sozinho; agora a regra vale para as quatro.

   Uma tabela só. Duas tabelas para a mesma coisa é exatamente como o alemão
   ficou sem `hreflang` e depois vendo o tour em inglês. */
const SUB = rotas.subConta;
/* O roteiro continua tendo nome próprio porque outros arquivos o citam. */
const ROTEIRO = Object.fromEntries(
  Object.keys(CONTA).map((L) => [L, `${CONTA[L]}/${SUB.roteiro[L]}`]));
/* O site fala cinco idiomas; a área do cliente ainda fala três. Os laços da
   conta andam por ESTA lista, e não por `idiomas` — senão cada idioma novo do
   site pede uma rota de conta que não existe, e o build quebra com um
   "`source` is missing" que não diz nada sobre a causa. */
const IDIOMAS_CONTA = Object.keys(CONTA);

/** O endereço público de cada página, no idioma dela. */
const publico = (pg, L) => (pg === 'home' ? PREFIXO[L] || '/' : PREFIXO[L] + '/' + slugs[pg][L]);
/** E onde ela mora dentro do `app/`. */
const interno = (pg, L) => (pg === 'home' ? `/${L}` : `/${L}/${slugs[pg][L]}`);

/* ---- O TETO DA FIGURA DO BLOG, DITO ONDE O NEXT LÊ ----

   O DEFEITO, relatado de produção: subir a figura de um post devolvia "This
   page couldn't load — a server error occurred". Sem mensagem, sem pista, e
   dependendo do arquivo: figuras pequenas subiam.

   A causa são DOIS TETOS que não se falavam. O produto permite 8 MB
   (`TETO_FIGURA`, em `lib/supabase/figura.ts`), o formulário aceita 8 MB e a
   ação tem até a frase pronta para recusar acima disso. Só que uma Server
   Action do Next tem teto PRÓPRIO, e o padrão dele é 1 MB — conferido na fonte
   da versão instalada, `app-render/action-handler.js`: sem `bodySizeLimit`, o
   valor é `1024 * 1024`, e passar dele lança um 413 ANTES de a ação rodar.

   Quer dizer: toda figura entre 1 MB e 8 MB morria no framework, e a recusa
   educada que o produto escreveu ("a figura passou de 8 MB, exporte menor")
   nunca chegava a ser possível de ver. O erro genérico do Next era tudo o que
   sobrava.

   O número aqui é o do produto mais uma folga: o corpo multipart carrega
   também `lang`, `chave` e `alt`, e o teto vale para o corpo inteiro, não só
   para o arquivo. `testes/figura.mjs` compara os dois números a cada rodada —
   dois tetos em dois arquivos voltam a divergir na primeira distração, e a
   régua é mais barata que descobrir de novo por relato. */
const config = {
  experimental: {
    serverActions: { bodySizeLimit: '9mb' },
  },
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
        /* OS TRÊS BARATOS, E A CSP DE PROPÓSITO FORA DAQUI.
           `X-Frame-Options` e `frame-ancestors` fecham o enquadramento em
           página de terceiro — a conta e a ferramenta não têm por que existir
           dentro do site de mais ninguém. `HSTS` tranca o protocolo. E o
           `Permissions-Policy` desliga o que o produto não usa: geolocalização,
           pagamento e sensores. Câmera, microfone e captura de tela ficam em
           `self`, porque são o produto.

           A CSP ENTROU, E EM `Report-Only` — 24/08. Ela não barra nada: o
           navegador confere e AVISA. É a primeira metade da DEC-12 caminho A,
           e a segunda metade (travar) é outro build, com a lista do que
           realmente falta na mão.

           A semana de ler relatórios virou uma RÉGUA: `testes/csp.mjs` abre as
           páginas e a ferramenta num navegador de verdade, escuta os eventos de
           violação e conta. O que uma semana de produção daria em relatórios
           esparsos, ela dá agora e de forma repetível — e reprova quando alguém
           acrescentar um `<script>` solto.

           O QUE ELA AINDA NÃO PODE MEDIR, e está dito no `csp.mjs`: o caminho
           da transcrição. O modelo vem de CDN, e a CDN não é alcançável da
           máquina onde a régua roda. É exatamente por isso que ela entra em
           `Report-Only` e não travando. */
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Content-Security-Policy-Report-Only', value: CSP },
        /* O `report-to` da CSP é só um NOME; é este cabeçalho que diz a que
           endereço o nome corresponde. Sem ele, a diretiva não aponta para
           lugar nenhum — e o navegador não avisa que não avisou. */
        { key: 'Reporting-Endpoints', value: 'csp="/api/csp"' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Permissions-Policy',
          value: 'geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), ' +
                 'accelerometer=(), camera=(self), microphone=(self), display-capture=(self)' },
      ],
    }];
  },

  async redirects() {
    const r = [];
    // `/pt` e `/pt/qualquer-coisa` existem por dentro; se alguém chegar neles
    // por fora, vai para o endereço de verdade. Duas URLs para a mesma página é
    // o buscador dividindo a força dela entre as duas.
    r.push({ source: '/pt', destination: '/', permanent: true });
    r.push({ source: '/pt/blog', destination: '/blog', permanent: true });
    r.push({ source: '/pt/blog/tag/:tag', destination: '/blog/tag/:tag', permanent: true });
    r.push({ source: '/pt/blog/autor/:autor', destination: '/blog/autor/:autor', permanent: true });
    r.push({ source: '/pt/blog/:slug', destination: '/blog/:slug', permanent: true });
    for (const pg of paginas) {
      r.push({ source: `/pt/${slugs[pg].pt}`, destination: publico(pg, 'pt'), permanent: true });
    }
    /* OS ENDEREÇOS APOSENTADOS. Uma página que sai do ar não some do mundo:
       ela está em canonical indexado, em sitemap enviado e em links que outras
       pessoas publicaram. Um 404 ali é jogar fora o tráfego que ela custou.
       A lista sai do `rotas.json` — escrevê-la aqui seria a mesma lista em dois
       lugares, que é o defeito que este projeto mais pagou. */
    for (const [nome, velha] of Object.entries(rotas.aposentadas || {})) {
      for (const L of idiomas) {
        const de = `${PREFIXO[L]}/${velha.slugs[L]}`;
        r.push({ source: de, destination: publico(velha.para, L), permanent: true });
        r.push({ source: `${de}.html`, destination: publico(velha.para, L), permanent: true });
        if (L === 'pt') r.push({ source: `/pt/${velha.slugs.pt}`,
                                 destination: publico(velha.para, 'pt'), permanent: true });
      }
      void nome;
    }

    // O site antigo era servido com `cleanUrls`, que aceitava `/precos.html` e
    // mandava para `/precos`. Continua aceitando: há links por aí com o `.html`.
    r.push({ source: '/index.html', destination: '/', permanent: true });
    for (const L of idiomas) {
      for (const pg of paginas) {
        r.push({ source: `${publico(pg, L)}.html`, destination: publico(pg, L), permanent: true });
      }
    }
    for (const L of IDIOMAS_CONTA) {
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
    for (const L of IDIOMAS_CONTA) depois.push({ source: CONTA[L], destination: `/conta/${L}` });
    /* O blog. `blog` é a mesma palavra nos cinco idiomas, então ele NÃO entra
       na tabela de slugs traduzidos — mas o português continua precisando da
       ponte, porque o endereço público é `/blog` e por dentro ele mora em
       `/pt/blog`. O `:slug` cobre o post. */
    depois.push({ source: '/blog', destination: '/pt/blog' });
    /* Etiqueta e autor ANTES do `:slug`: eles têm dois segmentos, e `:slug` só
       casa com um — sem estas duas linhas, `/blog/tag/evidencia` não casa com
       nada e responde 404. Uma página que existe por dentro e não tem ponte é
       uma página que não existe. */
    depois.push({ source: '/blog/tag/:tag', destination: '/pt/blog/tag/:tag' });
    depois.push({ source: '/blog/autor/:autor', destination: '/pt/blog/autor/:autor' });
    depois.push({ source: '/blog/:slug', destination: '/pt/blog/:slug' });

    // A ferramenta é um arquivo estático em `public/app.html` e continua sendo.
    // O `/app` sem extensão é o endereço que o site inteiro cita há meses.
    depois.push({ source: '/app', destination: '/app.html' });

    /* A tela do roteiro precisa da ponte ANTES dos arquivos, e não depois.
       `/conta/roteiro` casa com a rota dinâmica `/conta/[lang]` — com `lang`
       valendo a palavra "roteiro" — e uma reescrita `afterFiles` só é
       consultada quando NENHUMA rota casou. O resultado seria um 404 numa tela
       que existe. `/conta/planilha` não precisa disto: é rota estática de
       verdade, e estática ganha da dinâmica sem ponte nenhuma. */
    const antes = [];
    for (const [nome, trad] of Object.entries(SUB)) {
      for (const L of IDIOMAS_CONTA) {
        antes.push({ source: `${CONTA[L]}/${trad[L]}`, destination: `/conta/${L}/${nome}` });
      }
    }
    /* As abas do back-office são um nível mais fundo — `/conta/negocio/contas`
       — e caem na MESMA armadilha: `/conta/negocio` já é uma reescrita, e sem
       ponte própria a aba vira 404. A lista sai do `rotas.json`, e não escrita
       aqui: uma aba na faixa e ausente nesta ponte é um clique que quebra. */
    for (const aba of rotas.abasNegocio) {
      for (const L of IDIOMAS_CONTA) {
        antes.push({ source: `${CONTA[L]}/${SUB.negocio[L]}/${aba}`,
                     destination: `/conta/${L}/negocio/${aba}` });
      }
    }

    return { beforeFiles: antes, afterFiles: depois };
  },
};

export default config;
