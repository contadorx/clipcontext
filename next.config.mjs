/* O roteamento público.
 *
 * A regra que manda em tudo: **o endereço publicado não muda**. A home
 * portuguesa é `/`, não `/pt`; o comparativo é `/comparativo`, não
 * `/pt/comparativo`. Cada um desses endereços está num canonical já indexado, num
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
 *   *.hf.co            para onde o Hugging Face REDIRECIONA os pesos grandes.
 *                      Achado nos relatos de CSP do Build 71: 28 avisos, todos
 *                      em `.onnx` de peso e nenhum em `config.json` — o padrão
 *                      de um redirecionamento para um host que a lista não
 *                      tinha. Em `Report-Only` nada quebrou; travando, a
 *                      transcrição não baixaria o modelo;
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
    'https://*.hf.co https://www.googleapis.com https://accounts.google.com',
  "frame-src 'self' https://accounts.google.com https://docs.google.com",
  /* SEM ENDEREÇO DE RELATÓRIO desde o Build 71. Os avisos iam para `/api/csp`
     e ficavam no banco; o site deixou de ter servidor, e a rota saiu com ele.
     Os 887 avisos guardados (02/09 a 04/11) foram lidos antes:

       838  script inline — a detecção de idioma da home e o trecho do Vercel
            Analytics. São eles que precisam de hash antes de a política travar;
        28  pesos do modelo redirecionados para `*.hf.co` — entrou acima;
        20  capas do blog vindas do Supabase — o Build 70 as trouxe para cá;
         1  a barra de prévia da Vercel, que não é do produto.

     A política continua em `Report-Only`: o navegador ainda confere e avisa no
     console de quem estiver olhando, e a régua `csp.mjs` continua medindo. */
].join('; ');
const paginas = Object.keys(slugs);

/* A ÁREA DO CLIENTE SAIU NO BUILD 71 — o produto ficou grátis e sem conta.
   Os endereços dela continuam no mundo (no e-mail de quem entrou, em
   favoritos, em links colados num chamado), então cada um, nos cinco idiomas
   e com tudo o que vinha embaixo dele, vai para a home do idioma com 308.
   A lista sai do `rotas.json` (`contaAposentada`), escrita uma vez no
   `build.py`. */
const CONTA_APOSENTADA = rotas.contaAposentada;

/** O endereço público de cada página, no idioma dela. */
const publico = (pg, L) => (pg === 'home' ? PREFIXO[L] || '/' : PREFIXO[L] + '/' + slugs[pg][L]);
/** E onde ela mora dentro do `app/`. */
const interno = (pg, L) => (pg === 'home' ? `/${L}` : `/${L}/${slugs[pg][L]}`);

/* O teto de 9 MB das Server Actions saiu no Build 71. Ele existia para o
   upload de figura do blog (que virou arquivo no Build 70) e para o
   importador de planilha da conta (que saiu com a conta). Sem Server Action
   nenhuma no site, o padrão do Next vale. */
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
    /* A conta aposentada: o endereço público de cada idioma, tudo o que vinha
       embaixo dele, e o endereço interno `/conta/<idioma>` — todos para a home
       do idioma. */
    /* O interno de cada idioma vem PRIMEIRO: o público português é `/conta`, e
       o `/conta/:resto*` dele casaria `/conta/en/...` e mandaria o inglês para
       a home portuguesa. A primeira regra que casa é a que vale. */
    for (const L of Object.keys(CONTA_APOSENTADA)) {
      if (L === 'pt') continue;
      r.push({ source: `/conta/${L}`, destination: PREFIXO[L], permanent: true });
      r.push({ source: `/conta/${L}/:resto*`, destination: PREFIXO[L], permanent: true });
    }
    for (const [L, caminho] of Object.entries(CONTA_APOSENTADA)) {
      const home = PREFIXO[L] || '/';
      r.push({ source: caminho, destination: home, permanent: true });
      r.push({ source: `${caminho}/:resto*`, destination: home, permanent: true });
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

    const antes = [];

    return { beforeFiles: antes, afterFiles: depois };
  },
};

export default config;
