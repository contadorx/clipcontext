# ClipContext

Transforma um vídeo em um **PDF único** com os frames que importam e a transcrição sincronizada — pronto para entregar a um modelo de linguagem.

Modelos de texto não assistem vídeo. O que eles leem bem é: imagens dos momentos certos, transcrição com marcação de tempo, e as duas coisas pareadas. É isso que este projeto produz.

**Tudo roda no navegador do usuário.** O vídeo nunca é enviado para servidor nenhum — não há backend, não há limite de upload, não há custo de processamento.

---

## O que faz

- **Escolhe frames por mudança de cena.** Varre o vídeo e só guarda quando a imagem realmente muda. Num vídeo de slides, troca dezenas de capturas repetidas por uma de cada tela. Também há os modos de quantidade fixa e intervalo fixo.
- **Transcreve localmente** com Whisper via WebGPU (`@huggingface/transformers`), ou aceita `.vtt` / `.srt` / texto colado do painel do Google Drive.
- **Pareia imagem e fala.** No PDF, cada frame aparece com o que é dito naquele trecho. Falas que começaram antes do frame vêm marcadas com `...`.
- **Deixa revisar antes de gerar.** Grade de miniaturas, clique para descartar, botão para remover quase-duplicados, e estimativa do tamanho do PDF em tempo real.
- **Monta o prompt.** No fim do fluxo, gera o texto que explica ao modelo como o PDF está organizado — instantes, o que é imagem e o que é fala, e o aviso de que os frames são amostras. Com quatro objetivos prontos ou pedido livre.
- **Dá para interromper.** A varredura mostra previsão de término e pode ser parada a qualquer momento, aproveitando o que já foi extraído.
- **Três idiomas.** Português, inglês e espanhol, incluindo o texto do prompt e do PDF. O idioma vem de `?lang=pt|en|es` ou do navegador.
- **Vídeo de exemplo narrado** em `public/demo/`, um por idioma, com legenda — dá para testar tanto a
  detecção de cena quanto a transcrição sem arquivo próprio.
- **Abre vídeo do Google Drive** sem sair do navegador: o arquivo vai do Google direto para a máquina da
  pessoa, sem passar por servidor nosso. Nasce desligado — veja `GOOGLE-DRIVE.md`.
- **Captura a tela ao vivo, sem guardar vídeo.** Durante o compartilhamento, extrai os frames quando a
  imagem muda e transcreve **dois canais de áudio em separado** — o microfone e o som do computador —,
  rotulando cada fala com sua origem. Uma reunião de uma hora que ocuparia perto de um giga em disco
  termina como algumas dezenas de imagens e um texto. Nada de vídeo é escrito em lugar nenhum.
- **Recorta o trecho a analisar**: em vez de varrer uma hora inteira, aponte `10:00` a `25:00`.
- **Exporta a transcrição** em `.vtt`, `.srt` ou `.txt`, e o resultado inteiro em **JSON** (instantes,
  transcrição, texto lido da tela e as imagens em base64) para outro programa consumir.
- **Lê o texto que aparece na tela** (OCR local) e inclui no PDF, no JSON e no aviso ao modelo.
- **Descarta frames sem fala**, pela transcrição quando existe, ou medindo a energia do áudio quando não.
- **Índice no PDF**: a primeira página lista cada instante com o começo da fala, dando ao modelo um mapa
  do vídeo antes das imagens.

## Estrutura

```
public/index.html        landing em português   — GERADA, não edite
public/en/index.html     landing em inglês      — GERADA, não edite
public/es/index.html     landing em espanhol    — GERADA, não edite
src/site/home.html       modelo da landing, com marcadores {{chave}}
src/i18n-site.json       os textos da landing nos três idiomas
public/precos.html       planos e preços
public/privacidade.html  política de privacidade
public/termos.html       termos de uso
public/site.css          estilo compartilhado das páginas institucionais
public/app.html          A FERRAMENTA — gerada pelo build, não edite
offline/*.html           build autocontido: um arquivo só, funciona sem internet
src/template.html        fonte da ferramenta; contém o marcador /*__JSPDF__*/
vendor/jspdf.umd.min.js  cópia da biblioteca usada no build offline
brand/                   logotipos, favicon (.svg e .ico) e paleta
public/favicon.ico       ícone multi-tamanho, referenciado por todas as páginas
media/                   GIF e MP4 de demonstração, para divulgação
build.py                 gera public/app.html e o build offline
public/support.js        bloco de apoio voluntário (preencha os identificadores no topo)
LANCAMENTO.md            textos de divulgação, palavras-chave e posicionamento
ARQUITETURA-PAGO.md      o que é preciso para cobrar: custos, preços e ordem de construção
GOOGLE-DRIVE.md          como ligar o botão do Drive: escopo, chaves e configuração no Google Cloud
```

## Captura ao vivo

O botão de gravar a tela não grava um arquivo. Enquanto a tela está compartilhada, três coisas acontecem
ao mesmo tempo, todas na máquina de quem usa:

1. a imagem é comparada a cada 700 ms e um frame é guardado quando a tela muda de verdade;
2. o microfone e o som do computador entram por **canais separados**, em 16 kHz, por `AudioWorklet` — na
   thread de áudio, e não na principal, justamente porque o Whisper ocupa a principal em rajadas;
3. cada canal é transcrito em janelas de 20 segundos, durante a gravação, e cada fala sai marcada com o
   canal de onde veio.

A separação dos canais é o que torna a transcrição de reunião utilizável: em vez de um bloco único de
texto, sai `Microfone:` para quem está no computador e `Computador:` para as outras pessoas. O prompt
gerado no fim explica ao modelo o que cada rótulo significa.

Janelas silenciosas não vão para a GPU. O corte olha blocos de um segundo, e não a média da janela —
com a média, meio segundo de fala diluído em vinte segundos de silêncio ficaria abaixo do limiar e a
frase seria descartada sem nunca chegar ao modelo.

O modelo é carregado **antes** de a gravação começar, porque baixá-lo no meio travaria a captura. Se ele
não carregar, a gravação continua e guarda os frames sem transcrever.

## Google Drive

O botão "Abrir do Google Drive" nasce **desligado**, como o bloco de apoio. Preencha as três constantes
`GOOGLE_*` no topo do script de `src/template.html` e ele aparece; vazias, a linha não é renderizada e
nenhum endereço do Google é requisitado. Os SDKs do Google só são carregados quando alguém clica no
botão — quem não usa o Drive continua com uma página que não fala com terceiro nenhum.

O escopo é `drive.file`, o mais restrito possível: dá acesso só aos arquivos escolhidos no seletor,
nunca ao Drive inteiro. Passo a passo da configuração em `GOOGLE-DRIVE.md`.

## Apoio voluntário

O bloco de apoio nasce **desligado**. Abra `public/support.js`, preencha só os identificadores que
você usa (GitHub Sponsors, Buy Me a Coffee, chave Pix) e ele aparece sozinho na landing e na página de
preços, nos três idiomas. Se todos ficarem vazios, o bloco não é renderizado e nenhuma página fica com
buraco. Nada nele destrava funcionalidade — é voluntário de verdade.

Para mudar um texto da landing, edite `src/i18n-site.json` e rode o build — as três versões saem
sincronizadas. `public/app.html` e as três `index.html` são geradas; nunca edite direto.

Preços, privacidade e termos também saem do build, nos três idiomas: o cabeçalho e o rodapé vêm de
`src/site/doc.html` e o texto de cada página fica em `src/site/bodies/<pagina>.<idioma>.html`. São doze
páginas geradas ao todo — nunca edite nada dentro de `public/`.

**Detecção de idioma:** só a home em português carrega o script de detecção, e só age quando não há
`?lang=` na URL. Quem chega de navegador em inglês vai para `/en`, em espanhol para `/es`, e qualquer
outro idioma fica no português. O seletor PT/EN/ES no topo sempre permite trocar, e o link para a
versão em português leva `?lang=pt` justamente para não ser redirecionado de volta.

Edite sempre `src/template.html` e rode o build. Não edite os arquivos gerados.

```bash
python3 build.py
```

## Domínio e ícone

O endereço público sai de uma linha só: `SITE` no topo de `build.py`. Dele saem o `canonical`, os
`hreflang`, o link do topo da ferramenta e a base do vídeo de exemplo — o template usa os marcadores
`__SITE__` e `__SITEDOM__`, substituídos no build. Trocar de domínio é mudar essa linha e rodar o build.

O ícone existe em três formas: `favicon.ico` multi-tamanho (16 a 256 px), `favicon.svg` e
`apple-touch-icon.png`. Todas as páginas os declaram. A ferramenta traz **o SVG embutido como data URI**,
além do `.ico`: assim o arquivo de `offline/` mostra o ícone sem depender de rede nem de um arquivo ao
lado. A logo no topo do app também é SVG inline, pelo mesmo motivo.

## Publicar

O projeto é estático. Na Vercel, aponte o *output directory* para `public/`, não configure comando de build e mantenha
`cleanUrls` ligado no `vercel.json` (é o que faz `/precos` funcionar sem o `.html`).

```bash
npx vercel --prod
```

Serve igualmente em Cloudflare Pages, Netlify ou GitHub Pages.

## Como está sendo testado

A suíte usa Playwright com Chromium e vídeos gerados por ffmpeg — inclusive um vídeo de cinco cenas de doze segundos, usado para verificar que a detecção acha os cinco cortes exatos (00:00, 00:12, 00:24, 00:36, 00:48). O cancelamento é verificado interrompendo uma extração de 120 frames e conferindo que ela para em torno de 18 e ainda assim gera PDF.

Um detalhe que só apareceu por causa desse teste: comparar os frames em tons de cinza **não** funciona. Vermelho `(254,0,0)` e verde `(0,128,0)` têm quase o mesmo brilho, e a troca de cena entre eles passava despercebida. A assinatura precisa guardar os três canais de cor separados.

## Limitações conhecidas

- **A transcrição de arquivo não pode ser interrompida** depois de iniciada (a varredura de frames pode,
  e a captura ao vivo permite não esperar a fila).
- **A captura ao vivo disputa a máquina**: a transcrição roda junto com o compartilhamento de tela, e em
  computador modesto a detecção de cena pode perder alguma troca. É o preço de ver o texto aparecendo.
- **Formatos que o navegador não decodifica** (HEVC, alguns MKV) simplesmente não abrem. Resolver isso exige conversão no servidor.
- **Estado não é salvo**: atualizar a página perde tudo.
- **Não adaptada para celular.**
- **Vídeo do Drive vira um `Blob` na memória**: acima de ~1,5 GB a interface avisa, e arquivos muito
  maiores podem derrubar a aba. Baixar e arrastar continua sendo o caminho seguro nesses casos.
- O modelo `base` do Whisper é modesto em português; o `small` é bem melhor e bem mais pesado.

## Roadmap

1. Acelerar a varredura (hoje ~75 ms por salto)
2. Salvar o estado — hoje atualizar a página perde tudo
3. Cancelamento também na transcrição de arquivo (a captura ao vivo já permite abreviar)
4. YouTube: colar o link e receber a legenda pronta, com os frames vindo da gravação da aba.
   Exige um proxy no servidor — `youtube.com` não libera CORS — e o endereço de legenda não é
   documentado. Veja `ARQUITETURA-PAGO.md`, seção 8.
5. Camada paga no servidor: formatos exóticos, vídeos longos, transcrição de qualidade superior, lote
6. API / MCP para agentes consumirem vídeo já mastigado

## Licença

MIT — veja `LICENSE`.

Dependências de terceiros: [jsPDF](https://github.com/parallax/jsPDF) (MIT) e
[transformers.js](https://github.com/huggingface/transformers.js) (Apache-2.0), que baixa modelos Whisper sob demanda.
Confirme as licenças de cada uma antes de uso comercial.
