# Grátis, pago, e a sequência de entrega

Escrito em 14/08/2026, depois de "conseguimos com as features listar numa estratégia do que
entregar gratuito, o que fazer com planos pagos... já coloca uma sequência de entrega."

Este documento junta três coisas que estavam em lugares separados: o catálogo
(`FUNCIONALIDADES.md`), o mapa de concorrentes (`CONCORRENTES.md`, `O-QUE-FAZER.md`) e o
desenho do plano pago (`ARQUITETURA-PAGO.md`). O que sai daqui é a ordem de construção.

---

## 1. A linha de corte entre grátis e pago

Uma regra só, que decide qualquer caso futuro sem precisar reabrir a discussão:

> **É grátis tudo o que faz a evidência de UMA pessoa ser aceita.
> É pago o que uma EQUIPE precisa quando padroniza — e o que exige servidor.**

Por que essa linha e não outra:

- O gratuito é o canal. O produto entra na empresa pela mão de um analista de teste, não por
  compra corporativa. Se a qualidade da evidência ficar atrás de um paywall, o analista não tem
  o que mostrar, e o canal morre.
- A privacidade nunca pode ser item pago. "Pague para proteger o CPF que aparece na sua tela"
  destruiria o discurso inteiro numa frase. **Tarjamento e aviso de dado sensível são gratuitos
  para sempre**, e são justamente o melhor marketing que o produto pode ter.
- Empresa não paga por feature, paga por padronização: a marca dela no documento, o time inteiro
  configurado igual, a versão que a TI distribui internamente. Nada disso o indivíduo precisa —
  e nada disso enfraquece o gratuito.

E a descoberta que muda o plano pago original: **o primeiro dinheiro não precisa de servidor.**
O `ARQUITETURA-PAGO.md` desenhou um Pro de conversão/transcrição no servidor — continua válido,
mas vira o SEGUNDO produto pago. O primeiro é a **licença local**: uma chave assinada, validada
no navegador, sem conta e sem upload. Para o público de evidência, ela é melhor em tudo — não
quebra a promessa de privacidade nem para quem paga, não tem custo por uso, e não exige
construir infraestrutura antes de saber se alguém compra.

---

## 2. O mapa completo: cada feature, seu plano, sua onda

### Grátis para sempre (o produto que conquista)

| feature | esforço | onda |
|---|---|---|
| Tudo o que já existe (captura, transcrição, modelos de saída, evidência, hash) | — | no ar na Onda 0 |
| Perfil na aba (sessionStorage) | P | 1 — **feito** |
| Fuso horário explícito no documento | P | 1 — **feito** |
| Editar o instante/hora de um frame | P | 1 — **feito** |
| Zoom na miniatura (ampliar num overlay) | P | 1 — **feito** |
| Marcar momento durante a gravação (no controle flutuante) | P | 1 — **feito** |
| Pausar / retomar a gravação | M | 1 — **feito** |
| Editar a fala por trecho, na miniatura | M | 1 — **feito** |
| **Tarjar área sensível (manual)** | M | 2 — **feito** |
| **Aviso de dado sensível via OCR** (CPF, e-mail, cartão) | M | 2 — **feito** |
| Tarjar automático do padrão achado | M | 2 |
| Recortar (crop) aplicado a todos os frames | M | 2 — **feito** |
| Ignorar região na detecção (relógio da barra de tarefas) | M | 2 |
| Verificador de integridade (confere os SHA-256) | M | 4 — **feito** |
| HTML autocontido e Markdown | M+P | 4 — **feito** |
| CSV dos passos e papel Carta | P | 4 — **feito** (numeração EV-001 fora: o caso de teste já nomeia) |
| PWA instalável | M | 4 — **feito** |
| Exportar / importar perfil (.json) | P | 4 — **feito** |
| Contagem regressiva, auto-parar, atalhos, remover hesitações | P | 5+ |

### Pago 1 — "Time" (licença local, sem servidor) — Onda 3

| feature | por que empresa paga |
|---|---|
| **Logo e identidade do cliente no documento** (PDF, Word, rodapé) | consultoria entrega evidência com a marca do cliente final |
| **Link de equipe pré-configurado** (`?perfil=...`: sistema, modelo, vocabulário) | o gestor padroniza o time inteiro sem treinar ninguém |
| **Perfil persistente e compartilhável** (além da aba) | cinco casos por tarde, zero redigitação |
| **Vocabulário do domínio compartilhado** (ME21N, KI235… corrigem a transcrição) | a transcrição do time inteiro melhora de uma vez |
| **Pacote empresa da versão offline** (arquivo assinado, com canal de atualização) | a TI escaneia, versiona e distribui internamente |
| **Template de documento próprio** (capa, campos extras) | o documento sai no padrão da empresa, não no nosso |

### Pago 2 — "Pro / API" (com servidor, o plano já anunciado) — Onda 5

Continua exatamente como está na página de preços e no `ARQUITETURA-PAGO.md`: HEVC/MKV/ProRes,
transcrição de alta precisão, lote, vídeos longos, API/MCP. Só entra quando houver **sinal de
demanda** (lista de aviso + pedidos reais), porque é o único que adiciona custo por uso e a
única parte que muda a conversa de privacidade.

### Nunca (nem grátis, nem pago)

Conta obrigatória, nuvem para o conteúdo no plano gratuito, aplicativo de desktop, leitura de
campos do SAP GUI, "conformidade garantida", edição de vídeo. Os porquês estão no
`FUNCIONALIDADES.md`, seção 8.

---

## 3. A sequência de entrega

Cada onda tem um **portão de saída**: o sinal que autoriza começar a próxima. Sem o sinal, a
onda seguinte espera — é o que impede construir plano pago para zero usuários.

### Onda 0 — Publicar (esta semana, ~1 dia de trabalho)

O que já está pronto e não está no ar: o produto inteiro com evidência, modelos de saída,
comparativo, segurança, Steps Recorder, tour e exemplo regravados.

1. Domínios na Vercel + DNS (o passo a passo está no `DOMINIO-E-EMAIL.md`)
2. `privacidade@walkstamp.com` criada e **testada recebendo**
3. Deploy, Web Analytics ligado, CORS conferido, funções `clipcontext_*` derrubadas
4. Search Console com mudança de endereço

**Portão:** a medição chegando no Supabase e as páginas indexando.

### Onda 1 — Acabamento de evidência — **construída em 14/08/2026**

Os sete itens estão no código e testados. Três decisões que valem registrar, porque foram
escolhas e não detalhes:

**A pausa não para o relógio.** Parece contraintuitivo até se pensar em evidência: se o teste
esperou trinta minutos por um job, o documento tem que mostrar trinta minutos. O que a pausa
faz é não guardar tela e **jogar fora o áudio da espera** — a conversa paralela não pode
aparecer como fala de um passo. Ao retomar, uma captura forçada, porque depois da espera a tela
mudou e é esse estado que se queria documentar.

**Corrigir a hora de um passo reancora a gravação inteira.** A pessoa sabe quando o passo 3
aconteceu, não quando apertou gravar. Então o campo de hora na lente recalcula o instante zero
em vez de criar uma hora solta por frame — uma fonte de verdade só. (E o instante do frame passou
a ser arredondado ao segundo: sem isso, corrigir para 15:00:00 devolvia 14:59:59.)

**Corrigir uma fala reescreve a transcrição de origem**, e não uma cópia. Se o documento dissesse
ME21N e a transcrição completa nas últimas páginas continuasse dizendo "emê vinte e um ene", a
evidência se contradiria dentro do próprio PDF.

A política de privacidade e a página de segurança ganharam a descrição precisa do
`sessionStorage`: o que é guardado (só sistema e executado por), o que não é (caso, chamado,
resultado, anotações), que morre ao fechar a aba, que não é cookie, e que há um botão que apaga
na hora.

É a onda de usar com a **sua comunidade de testes SAP**: dez pessoas reais gravando evidência de
verdade e reclamando do que doer.

**Portão:** ≥ 10 usos reais completos (gravou → baixou) e a lista das três maiores reclamações.

### Onda 2 — Privacidade que age — **construída em 14/08/2026**

Tarjar manual, aviso de dado sensível via OCR e recorte estão no código. Sobraram para depois o
tarjar automático do padrão achado e o ignorar região na detecção.

Três decisões, e a segunda é a que evita um vazamento silencioso:

**A tarja é queimada, não desenhada por cima.** As coordenadas são normalizadas (0 a 1), porque a
miniatura tem 158 px, a lente tem 900 e o PDF tem outra escala. Na hora de exportar, uma imagem
nova é gerada com os retângulos pretos dentro dela, e é essa que vai para o PDF, o Word, o ZIP e o
JSON. **O original nunca é exportado** — não existe camada para alguém remover depois.

**O OCR passou a ler a imagem tarjada.** Sem isso a tarja seria contornável pela porta dos fundos:
o texto lido da imagem inteira entra no documento como "texto na tela", e o CPF coberto reapareceria
escrito ao lado da própria tarja. Pelo mesmo motivo, tarjar apaga a leitura anterior daquele quadro —
ela foi feita sobre a imagem antiga e não vale mais.

**O aviso não tarja sozinho.** Ele diz em quais passos há CPF, CNPJ, e-mail, telefone ou sequência
com cara de cartão, e para por aí. Tarjar automaticamente apagaria justamente o número que às vezes
é a prova — um pedido, uma nota fiscal. Quem decide é quem executou o teste.

E o recorte é um só para toda a gravação: numa mesma sessão a área que interessa não muda. Ele
desfaz as tarjas do quadro ao ser aplicado, porque as coordenadas antigas apontariam outro lugar —
recalcular e errar por um pixel numa evidência seria pior que pedir para refazer. O original fica em
memória, então "tirar o recorte" devolve tudo sem extrair de novo.

Junto saiu o **bloco de apoio da ferramenta e da home** — ficou só na página de preços. Uma chave
Pix de pessoa física ao lado de uma promessa de privacidade corporativa enfraquece a leitura de
"empresa" justamente para quem a página de segurança está tentando convencer. No lugar dela, o
rodapé da ferramenta aponta segurança, comparativo e preços.

É também a onda de **falar em público**: o artigo de LinkedIn já escrito, os canais do
`onde-publicar.md`, e a página do Steps Recorder trabalhando. O produto ganha o argumento que
nenhum concorrente tem no momento em que começa a aparecer.

**Portão:** tráfego orgânico chegando (Search Console) e a lista de aviso crescendo — são os
compradores do plano Time se apresentando.

### Onda 3 — Primeiro dinheiro: plano Time (3–4 semanas)

A licença local e as seis features da tabela acima. A mecânica, sem quebrar promessa nenhuma:

- **Compra** por link de pagamento (Stripe ou Mercado Pago — as taxas e exigências estão no
  `ARQUITETURA-PAGO.md`, seção 4). Sem conta no produto.
- **Entrega** por chave assinada (Ed25519): o e-mail do recibo recebe a chave, a chave entra no
  app, o app valida a assinatura **localmente** — funciona offline, inclusive.
- **O que o servidor sabe:** que alguém pagou e o e-mail do recibo. **O que ele continua sem
  saber:** qualquer coisa sobre os vídeos. A página de segurança ganha um parágrafo dizendo
  exatamente isso.

Preço de partida, a validar com os primeiros dez interessados: **R$ 349/usuário/ano**
(~R$ 29/mês) — dentro do vácuo entre o Folge (€75–130 único) e o FlowShare (€450/ano), e
alinhado com "5–10× abaixo" do `O-QUE-FAZER.md`. Piso para negociação de time: 5 usuários.
A página de preços ganha o cartão "Time" ao lado do Pro, e o Pro continua "em desenvolvimento".

**Portão:** as primeiras 10 licenças vendidas — ou 30 dias de conversa sem venda, que também é
resposta (aí o preço ou o pacote estão errados, e a Onda 4 continua de qualquer jeito).

### Onda 4 — Confiança e alcance — **construída em 14/08/2026**

Construída **antes da Onda 3**, e de propósito: a Onda 3 é a única que depende de gente usando,
e sem a Onda 0 no ar não há a quem vender. A Onda 4 não tem portão de demanda, é toda gratuita, e
o verificador é justamente o que dá peso à divulgação da Onda 2.

**O verificador é a peça que muda a conversa.** Uma página que recebe o `.zip` ou o `.json`,
recalcula os SHA-256 no próprio navegador e diz o que confere. Ela vem com um parágrafo dizendo o
que **não** prova: uma impressão digital é soma de verificação, não assinatura — quem alterasse a
imagem *e* recalculasse a lista passaria sem alarme. Dizer isso é o que faz o resto ser crível.

**Três saídas novas**, cada uma resolvendo um destino que o PDF não atende: **HTML autocontido**
(um arquivo, abre em qualquer coisa, imprime bem — o melhor formato para mandar por chat interno),
**Markdown** com as imagens em base64 (documentação de processo termina numa wiki, e assim cola
sem anexo separado) e **CSV** com ponto e vírgula e BOM, que é o que o Excel em português abre em
colunas sem passar pelo assistente.

**Papel Carta** para quem entrega a empresa americana — e as medidas do PDF passaram a sair do
formato escolhido, em vez de constantes.

**Perfil em arquivo**: quem quer persistência entre visitas, entre máquinas ou entre a equipe leva
um `.json`. É a única forma de oferecer isso sem que a gente guarde nada — não existe conta nossa
para vazar.

**PWA instalável**: atalho na área de trabalho sem que a TI aprove um executável. O service worker é
**rede-primeiro para as páginas** — uma ferramenta que abre a versão de ontem depois de um deploy é
pior que uma que não instala — e não toca em nada de origem externa. A política de privacidade
descreve o que ele guarda (páginas e estilos) e o que ele nunca vê (vídeo, áudio, transcrição,
documento: nada disso é requisição de rede).

**Portão:** nenhum.

### Onda 4.1 — Presença e destino do documento — **construída em 15/08/2026**

Um pacote curto de acabamento, saído de uso real e não de planejamento.

**A plataforma passou a assinar o que gera.** O rodapé de cada página cresceu (marca de 6,4 mm,
texto de 9 pt) e ganhou, na abertura do PDF e do Word, um **bloco de autoria**: marca de 13 mm,
nome, endereço e uma frase dizendo que aquele documento foi gerado inteiramente no navegador de
quem executou. O HTML e o Markdown ganharam o mesmo bloco no fim. A régua aqui foi deliberada:
**presença na capa, discrição nas páginas internas** — propaganda em toda folha tira a seriedade
de uma evidência de auditoria, que é exatamente o contrário do que o produto vende.

**Enviar para o Google Docs.** O `.docx` montado no navegador sobe para o Drive já convertido em
documento nativo, pelo mesmo escopo `drive.file` do botão que abre vídeo. É o **único caminho da
ferramenta em que o documento sai do computador**, e o tratamento reflete isso: confirmação
explícita antes de enviar, borda tracejada e seta ↗ para se distinguir dos outros botões, linha
própria na tabela da página de segurança e parágrafo próprio na política. O botão só aparece com
credencial do Google configurada, e a versão offline não o tem.

A escolha do `.docx` como formato de envio não é preferência: o conversor de HTML do Drive
descarta imagem em base64, e este documento **é** imagens.

**Portão:** nenhum.

### Onda 5 — Pro com servidor (quando o sinal vier)

O plano da página de preços: conversão, transcrição de alta precisão, lote, API/MCP. Os números
de custo já estão feitos (US$ 0,02/vídeo pelo Groq). Pré-requisitos antes da primeira linha de
código: lista de aviso com volume, pedidos explícitos de HEVC/lote na caixa de e-mail, e o
texto de privacidade do plano pago escrito — porque é o único momento em que "não temos seus
arquivos" precisa ganhar uma exceção delimitada e honesta.

Aqui também entram os grandes do catálogo que dependem de fôlego: vários casos numa gravação
(capítulos), tradução da transcrição, PDF/A.

---

## 4. O resumo numa tela

| onda | o quê | custo | dinheiro | portão de saída |
|---|---|---|---|---|
| 0 | publicar o que está pronto | 1 dia | — | medição chegando |
| 1 | acabamento de evidência | **feito** | — | 10 usos reais |
| 2 | tarjamento + OCR sensível + recorte | **feito** | — | tráfego + lista crescendo |
| 3 | **plano Time, licença local** | 3–4 sem | **R$ 349/usuário/ano** | 10 licenças (ou 30 dias) |
| 4 | verificador + formatos + PWA | **feito** | — | — |
| 4.1 | assinatura da plataforma + envio ao Google Docs | **feito** | — | — |
| 5 | Pro/API com servidor | quando houver sinal | R$ 29/mês + API | demanda explícita |

Duas leituras finais:

**O caminho até o dinheiro passa por duas ondas gratuitas de propósito.** A Onda 1 faz o produto
merecer uso diário; a Onda 2 dá o que contar em público. Vender antes disso seria vender para
ninguém — a lista de aviso de hoje é o termômetro, e ela só cresce com as ondas 1 e 2 no ar.

**Nenhuma onda quebra a promessa.** Até a Onda 4, zero conteúdo sai da máquina de quem usa —
pagante ou não. Existem exatamente duas exceções, e as duas são **escolhas de quem usa, não
comportamento padrão**: o botão de enviar para o Google Docs (Onda 4.1), que pede confirmação e
manda o arquivo do navegador direto ao Google, sem passar por nós; e a Onda 5, que é opcional,
delimitada, e já tem o discurso preparado antes do código. Em nenhuma das duas existe servidor
nosso no caminho do conteúdo — e é essa a frase que precisa continuar verdadeira.
