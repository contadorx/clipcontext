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

## Estrutura

```
public/index.html      build web (jsPDF vindo do CDN) — é o que a Vercel publica
offline/*.html         build autocontido: um arquivo só, funciona sem internet
src/template.html      fonte editável; contém o marcador /*__JSPDF__*/
vendor/jspdf.umd.min.js  cópia da biblioteca usada no build offline
build.py               gera os dois builds a partir de src/template.html
```

Edite sempre `src/template.html` e rode o build. Não edite os arquivos gerados.

```bash
python3 build.py
```

## Publicar

O projeto é estático. Na Vercel, aponte o *output directory* para `public/` e não configure comando de build.

```bash
npx vercel --prod
```

Serve igualmente em Cloudflare Pages, Netlify ou GitHub Pages.

## Como está sendo testado

A suíte usa Playwright com Chromium e vídeos gerados por ffmpeg — inclusive um vídeo de cinco cenas de doze segundos, usado para verificar que a detecção acha os cinco cortes exatos (00:00, 00:12, 00:24, 00:36, 00:48).

Um detalhe que só apareceu por causa desse teste: comparar os frames em tons de cinza **não** funciona. Vermelho `(254,0,0)` e verde `(0,128,0)` têm quase o mesmo brilho, e a troca de cena entre eles passava despercebida. A assinatura precisa guardar os três canais de cor separados.

## Limitações conhecidas

- **Não dá para cancelar a varredura.** Em vídeos longos ela faz centenas de saltos e bloqueia a interface sem previsão de término. É o defeito mais grave hoje.
- **Formatos que o navegador não decodifica** (HEVC, alguns MKV) simplesmente não abrem. Resolver isso exige conversão no servidor.
- **Estado não é salvo**: atualizar a página perde tudo.
- **Interface só em português** e não adaptada para celular.
- O modelo `base` do Whisper é modesto em português; o `small` é bem melhor e bem mais pesado.

## Roadmap

1. Botão de cancelar e previsão de término na varredura
2. Gerador de prompt no fim do fluxo — entregar o PDF junto do texto pronto para colar na IA
3. Internacionalização (inglês primeiro)
4. Camada paga no servidor: formatos exóticos, vídeos longos, transcrição de qualidade superior, lote
5. API / MCP para agentes consumirem vídeo já mastigado

## Licença

MIT — veja `LICENSE`.

Dependências de terceiros: [jsPDF](https://github.com/parallax/jsPDF) (MIT) e
[transformers.js](https://github.com/huggingface/transformers.js) (Apache-2.0), que baixa modelos Whisper sob demanda.
Confirme as licenças de cada uma antes de uso comercial.
