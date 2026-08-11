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
- **Vídeo de exemplo** em `public/demo/`, com legenda nos três idiomas, para experimentar sem arquivo próprio.

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
brand/                   logotipos, favicon e paleta
media/                   GIF e MP4 de demonstração, para divulgação
build.py                 gera public/app.html e o build offline
public/support.js        bloco de apoio voluntário (preencha os identificadores no topo)
LANCAMENTO.md            textos de divulgação, palavras-chave e posicionamento
ARQUITETURA-PAGO.md      o que é preciso para cobrar: custos, preços e ordem de construção
```

## Apoio voluntário

O bloco de apoio nasce **desligado**. Abra `public/support.js`, preencha só os identificadores que
você usa (GitHub Sponsors, Buy Me a Coffee, chave Pix) e ele aparece sozinho na landing e na página de
preços, nos três idiomas. Se todos ficarem vazios, o bloco não é renderizado e nenhuma página fica com
buraco. Nada nele destrava funcionalidade — é voluntário de verdade.

Para mudar um texto da landing, edite `src/i18n-site.json` e rode o build — as três versões saem
sincronizadas. `public/app.html` e as três `index.html` são geradas; nunca edite direto.

As páginas de preços, privacidade e termos ainda são só em português e ficam em `public/`, escritas à mão.

**Detecção de idioma:** só a home em português carrega o script de detecção, e só age quando não há
`?lang=` na URL. Quem chega de navegador em inglês vai para `/en`, em espanhol para `/es`, e qualquer
outro idioma fica no português. O seletor PT/EN/ES no topo sempre permite trocar, e o link para a
versão em português leva `?lang=pt` justamente para não ser redirecionado de volta.

Edite sempre `src/template.html` e rode o build. Não edite os arquivos gerados.

```bash
python3 build.py
```

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

- **A transcrição automática não pode ser interrompida** depois de iniciada (a varredura de frames pode).
- **Formatos que o navegador não decodifica** (HEVC, alguns MKV) simplesmente não abrem. Resolver isso exige conversão no servidor.
- **Estado não é salvo**: atualizar a página perde tudo.
- **A landing e as páginas institucionais ainda são só em português** — a ferramenta já é multilíngue.
- **Não adaptada para celular.**
- O modelo `base` do Whisper é modesto em português; o `small` é bem melhor e bem mais pesado.

## Roadmap

1. Traduzir também a landing e as páginas institucionais (hoje só a ferramenta é multilíngue)
2. Salvar o estado — hoje atualizar a página perde tudo
3. Cancelamento também na transcrição automática
4. Traduzir preços, privacidade e termos (a home já está em pt/en/es)
4. Camada paga no servidor: formatos exóticos, vídeos longos, transcrição de qualidade superior, lote
5. API / MCP para agentes consumirem vídeo já mastigado

## Licença

MIT — veja `LICENSE`.

Dependências de terceiros: [jsPDF](https://github.com/parallax/jsPDF) (MIT) e
[transformers.js](https://github.com/huggingface/transformers.js) (Apache-2.0), que baixa modelos Whisper sob demanda.
Confirme as licenças de cada uma antes de uso comercial.
