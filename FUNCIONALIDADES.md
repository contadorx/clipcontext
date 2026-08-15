# Todas as features possíveis

Escrito em 14/08/2026, depois de "vamos listar todas as features possiveis, incluindo controle
de frame, etc."

Este é o catálogo completo — o que dá para construir dentro da arquitetura (navegador, sem
servidor, sem conta), organizado por área. Cada item tem esforço (**P**equeno / **M**édio /
**G**rande) e uma marca de prioridade:

- ★★★ — muda a decisão de alguém usar ou não
- ★★ — remove um atrito real de quem já usa
- ★ — bom ter, quando sobrar tempo

A régua de prioridade é uma só: **o que faz a evidência ser aceita e a pessoa voltar amanhã.**

> A divisão grátis × pago e a ordem de construção destas features estão no
> `ESTRATEGIA-ENTREGA.md` — este arquivo é o catálogo; aquele é o plano.

---

## 1. Controle de frame (a sua pergunta)

O cartão de revisão é onde a pessoa passa mais tempo — cada melhoria aqui é sentida em todo uso.

| feature | esforço | prio | por quê |
|---|---|---|---|
| **Tarjar / borrar área sensível** | M | ★★★ | **feito** — coordenadas normalizadas, queimadas numa imagem nova na hora de exportar; o original nunca sai. O OCR passou a ler a imagem tarjada, senão o texto coberto voltava ao documento |
| **Recortar (crop)** | M | ★★ | **feito** — um recorte para toda a gravação, reversível porque o original fica em memória |
| **Reordenar passos** — arrastar miniatura de posição | M | ★★ | o passo 3 explicado antes do 2 acontece em teste exploratório; hoje a saída é regravar |
| **Inserir frame à mão** — colar um print (Ctrl+V) ou subir uma imagem avulsa no meio da sequência | M | ★★ | a tela que faltou (um e-mail de confirmação, um sistema legado) entra sem regravar tudo |
| **Editar o instante / a hora de um frame** | P | ★★ | a estimativa pela data do arquivo erra; hoje só se corrige o início, não um frame específico |
| **Zoom / destaque** — retângulo de realce ou círculo no ponto clicado | M | ★★ | "olhe aqui" é metade do valor de um tutorial; o Steps Recorder destacava o clique |
| **Ignorar região na detecção** — excluir da assinatura a área do relógio/notificações | M | ★★ | relógio da barra de tarefas mudando gera frame "novo" sem mudança real; é a maior fonte de repetidos |
| **Duplicar frame** — o mesmo print como passo N e N+2 (antes/depois) | P | ★ | evita truques quando a mesma tela prova duas coisas |
| **Comparar dois frames lado a lado** — sobreposição com transparência | M | ★ | "o que mudou entre estes dois?" — útil para revisão, não essencial |
| **Zoom na miniatura** — clique para ampliar num overlay | P | ★★ | hoje a miniatura de 158 px é o único jeito de conferir o frame antes de gerar |

## 2. Captura

| feature | esforço | prio | por quê |
|---|---|---|---|
| **Pausar / retomar a gravação** — no controle flutuante | M | ★★★ | teste de SAP tem espera (job, aprovação); hoje a espera vira frames de tela parada e tempo de relógio errado na retomada — pausa de verdade precisa marcar o buraco no relógio |
| **Marcar momento durante a gravação** — botão no controle flutuante que força um frame e o marca | P | ★★★ | "este é o passo que importa" dito na hora vale mais que caçar depois; o botão já existe para arquivo, falta na gravação ao vivo |
| **Contagem regressiva 3-2-1** ao iniciar | P | ★ | evita o primeiro frame ser o seletor de tela |
| **Trocar a tela compartilhada no meio** | já existe | — | `surfaceSwitching:'include'` já está ligado |
| **Auto-parar após N minutos ou X MB** | P | ★ | proteção contra "esqueci gravando" |
| **Webcam num canto (picture-in-picture)** | G | ★ | pedido de quem grava tutorial com rosto; foge do caso de evidência |
| **Múltiplos monitores em sequência** | G | ★ | raro e complexo; o navegador só entrega uma superfície por vez |

## 3. Transcrição e áudio

| feature | esforço | prio | por quê |
|---|---|---|---|
| **Editar a fala por trecho na revisão** — clicar na legenda do frame e corrigir | M | ★★★ | o reconhecimento erra código de transação ("emê vinte e um ene"); hoje a correção é no textarea gigante do passo 3, longe da imagem |
| **Vocabulário do domínio** — lista de termos (ME21N, KI235, Fiori) que corrigem a saída do modelo | M | ★★ | pós-processamento por regex/fuzzy sobre a transcrição; barato e visível |
| **Rótulo de canal já existe** (Microfone / Computador) | já existe | — | mantém |
| **Tradução da transcrição** — gravou em português, documento em inglês | M | ★★ | **feito** — por dois caminhos, os dois no aparelho: o tradutor embutido do Chrome/Edge (38 idiomas, baixa o par uma vez) e o próprio Whisper traduzindo para inglês enquanto ouve (zero download extra). A API paga do Google Cloud foi descartada: exigiria uma chave nossa no código e enviaria o texto para um servidor |
| **Remover hesitações** ("é...", "hã") | P | ★ | limpeza opcional antes de virar anotação |

## 4. Saídas

| feature | esforço | prio | por quê |
|---|---|---|---|
| **HTML autocontido** | M | ★★ | **feito** — imagens em base64, estilo inline, sem script: um arquivo que abre em qualquer coisa |
| **Markdown** | P | ★★ | **feito** — com as imagens embutidas, para colar na wiki sem anexo separado |
| **CSV dos passos** | P | ★ | **feito** — ponto e vírgula e BOM, que é o que o Excel em português abre em colunas |
| **Logo do cliente no documento** — upload de uma imagem que entra no cabeçalho | M | ★★ | consultoria entrega evidência com a marca do cliente; é também a semente do plano pago |
| **Papel A4 / Carta** | P | ★ | **feito** — no PDF e no Word; as medidas saem do formato escolhido |
| **Numeração automática de evidência** — EV-001, EV-002 por sessão | P | ★ | pequeno, mas dá cara de sistema |
| **Enviar para o Google Docs** | M | ★★ | **feito** — o `.docx` montado aqui sobe para o Drive convertido em documento nativo, pelo mesmo `drive.file` do botão de abrir vídeo. É o único caminho da ferramenta em que o documento **sai do computador**, então pede confirmação explícita, tem borda tracejada e uma seta ↗ para se distinguir dos outros, e está descrito na política e na página de segurança. O `.docx` é o formato certo: o conversor de HTML do Drive descarta imagem em base64, e o documento é feito de imagens |
| **Assinatura da plataforma no documento** | P | ★★ | **feito** — bloco de autoria na abertura do PDF e do Word (marca de 13 mm, nome, endereço e a frase que explica o que o documento é), rodapé de página maior em todas as folhas, e o mesmo bloco no fim do HTML e do Markdown. Discreto nas páginas internas de propósito: propaganda em toda folha tira a seriedade de uma evidência de auditoria |
| **PDF/A** (arquivamento) | G | ★ | auditoria de longo prazo pede; jsPDF não gera PDF/A hoje — exigiria outra biblioteca |

## 5. Evidência e integridade

| feature | esforço | prio | por quê |
|---|---|---|---|
| **Perfil na aba** (sessionStorage) — "executado por", "sistema" sobrevivem ao F5, morrem com a aba | P | ★★★ | cinco casos seguidos = redigitar cinco vezes; a promessa "nada entre visitas" continua verdadeira ao pé da letra, com uma linha nova na política |
| **Exportar / importar o perfil** | P | ★★ | **feito** |
| **Verificador de integridade** | M | ★★ | **feito** — `/verificar` nos três idiomas, no navegador, com a ressalva do que NÃO prova |
| **Vários casos numa gravação** — dividir a sessão em capítulos, um documento por caso | G | ★★ | quem testa, testa uma tarde inteira; hoje é uma gravação por caso |
| **Campo "ambiente"** (DEV/QAS/PRD) no cabeçalho | P | ★ | auditor pergunta; é um select a mais |
| **Fuso horário explícito no documento** | P | ★★ | "12:58:45" sem fuso é ambíguo em empresa global; imprimir "UTC-3" ao lado custa nada |

## 6. Privacidade como feature

| feature | esforço | prio | por quê |
|---|---|---|---|
| **Aviso de dado sensível** | M | ★★★ | **feito** — CPF, CNPJ, e-mail, telefone e sequência de cartão sobre o texto do OCR, dizendo em quais passos. Avisa e para aí: tarjar sozinho apagaria o número que às vezes é a prova |
| **Tarjar automático do padrão achado** — um clique borra todas as ocorrências | M | ★★ | continuação natural do aviso |
| **Modo "sala limpa"** — desliga CDN/modelo, só o que roda sem rede | P | ★ | a versão offline já é isso; seria só um aviso na online |

## 7. Distribuição e plataforma

| feature | esforço | prio | por quê |
|---|---|---|---|
| **PWA instalável** | M | ★★ | **feito** — service worker rede-primeiro, para nunca servir HTML velho depois de um deploy |
| **Link pré-configurado** — `?modelo=evidencia&sistema=S4P/100` para o gestor mandar ao time | P | ★★ | padroniza a evidência de um time inteiro sem treinar ninguém; atenção: dados na URL ficam no histórico do navegador — documentar |
| **Alemão e francês** | M | ★ | SAP é forte na Alemanha; esperar sinal de tráfego |
| **Atalhos de teclado** no app (G grava, Espaço marca) | P | ★ | conforto de quem usa toda semana |

## 8. O que NÃO construir (e por quê)

- **Conta, nuvem, compartilhamento por link** — apagaria o argumento estrutural. Todo concorrente barato já é isso.
- **Aplicativo de desktop** — trocaria a única vantagem (zero instalação) por paridade com o FlowShare.
- **Leitura de campos do SAP GUI** — impossível no navegador; prometer seria mentir.
- **Edição de vídeo** (cortar, narrar por cima, música) — é outro produto, com donos gigantes.
- **"Conformidade garantida"** — 21 CFR/SOX/CSV não são features compráveis; o produto produz a evidência, a conformidade é do processo do cliente.
- **IA embutida para redigir a ata** — o prompt já entrega isso na IA que a pessoa tem; embutir modelo de linguagem no navegador hoje é peso sem ganho.

---

## Se eu fosse escolher o próximo trimestre

A leitura transversal das tabelas, em ordem:

1. **Tarjar área sensível** (1) + **aviso de dado sensível** (6) — juntos formam a feature "privacidade que age", que nenhum concorrente tem e que destrava o uso com dado de produção.
2. **Perfil na aba** (5) — o atrito mais reclamável do fluxo de evidência, resolvido em horas.
3. **Pausar/retomar** e **marcar momento na gravação** (2) — os dois buracos reais de quem grava teste longo.
4. **Editar a fala por trecho** (3) — fecha o ciclo fala → anotação → documento sem sair do cartão 4.
5. **HTML autocontido + Markdown** (4) — abre o caso "documentação de processo" quase de graça.

Os itens 1–4 são o produto dizendo "eu fui feito para evidência de verdade". O resto é
acabamento — importante, mas depois que houver gente usando para reclamar dele.
