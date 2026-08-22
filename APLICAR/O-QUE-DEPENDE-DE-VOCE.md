# O que falta, e depende de você

Estado em 22/08/2026, depois da Trilha E. Nada aqui está bloqueando o meu
trabalho no que sobrou — cada item destrava uma coisa específica, e eu digo qual.

---

## 1. Decisões — rápidas, e cada uma libera uma tarefa minha

| # | Decisão | O que ela destrava | Meu tempo depois |
|---|---|---|---|
| 1.1 | **O produto continua sendo um arquivo único**, ou aceita um passo de build que junta módulos num arquivo só no fim? | A C3 inteira — modularizar as 20 mil linhas do `template.html` | 8–12 d |
| 1.2 | **Classificar as outras 92 funcionalidades** em `produção` / `beta` / `construção` / `descoberta` | O vocabulário da E2 vale para o catálogo inteiro, não só para as 2 que eu consegui verificar | 0,5 d |
| 1.3 | **Entrada por domínio de e-mail**: vira self-service com verificação de posse, ou continua manual? | Hoje ela está marcada `beta` na página. Se continuar manual, a página fica como está; se virar self-service, é trabalho novo | 2–3 d se for self-service |
| 1.4 | **O trial de 14 dias está de pé em produção?** | O CTA secundário do hero da home. Se não estiver, ele vira "Ver um caso completo" em vez de "Testar o roteiro" | 0,5 d |
| 1.5 | **A comparação nominal** com Claude, ChatGPT e Gemini volta com uma página datada, ou fica fora? | Ficar custa uma página com data e revalidação periódica — não é escrever uma vez | 1 d + manutenção |
| 1.6 | **Moeda**: BRL, USD e EUR juntos como hoje, ou detectar a localidade? | A primária já segue o idioma, então isto é menor do que a análise supunha | 0,5 d |
| 1.7 | **`DEMO-NATURA.md`**: mover, apagar ou manter? | O `semmarca.mjs` reprova por causa dele — é a única falha vermelha da suíte hoje. Enquanto ele estiver lá, a régua mente sobre o estado do repositório | 5 min |

---

## 2. Material que só você tem

| # | O que | Por que trava |
|---|---|---|
| 2.1 | **Uma planilha de casos de verdade** (entrada) e **o `.zip` que sai de uma execução** | É a prova da seção 7.6 da análise. Hoje a página de preços mostra o vídeo de 47 s e **não deixa ninguém conferir** — quem avalia fornecedor quer baixar e abrir, não assistir |
| 2.2 | **Quantos minutos custa montar uma evidência à mão** na sua operação | Destrava a calculadora de ROI (seção 7.5). Sem esse número ela **não deve subir**: calculadora com número inventado é o mesmo defeito que a E1 consertou, e pior, porque tem casas decimais |
| 2.3 | **Depoimento de cliente autorizado** | A análise pede, e é o único item de prova social que não dá para fabricar |
| 2.4 | **A gravação de 30 s com a rede desligada** | Item da D3 — a demonstração de que o produto funciona offline. Precisa da sua máquina com a rede caindo de verdade |

---

## 3. Painéis externos — eu não alcanço daqui

| # | Onde | O que fazer | Risco se não for feito |
|---|---|---|---|
| 3.1 | **Painel da Stripe** | Mover a URL do webhook para `https://<host>/api/stripe/webhook` **ANTES** de publicar a Edge Function que devolve 410 | Na ordem inversa fica uma janela em que **compra nenhuma concede plano** — a pessoa paga, a fatura aparece, e o plano não chega |
| 3.2 | **Stripe CLI** | `stripe listen --forward-to <host>/api/stripe/webhook`, uma vez | É o caminho de rede, e é a única parte do fluxo pago que eu não consigo provar daqui |
| 3.3 | **Supabase Auth** | Ligar a proteção de senha vazada (está desligada) | É um botão. O produto entra por link mágico, então o impacto é pequeno — mas aparece em avaliação de fornecedor |
| 3.4 | **Produção** | O seed continua lá: `modelo.example` ativo concedendo **Team com 5 assentos**, e 3 dos chamados são dele | Você pediu para não limpar. Fica registrado porque qualquer número de funil que você olhar tem isso dentro |

---

## 4. Validação que precisa de máquina e de gente

| # | O que | Tempo seu |
|---|---|---|
| 4.1 | **Leitor de tela** — NVDA + Chrome, VoiceOver + Safari, zoom 200%. Roteiro pronto em `testes/VALIDACAO-COM-LEITOR-DE-TELA.md`: 8 itens | 20–30 min |
| 4.2 | **Uma semana de funil com dados limpos.** A partir da versão publicada os números são de gente, e não do público somado à minha esteira de testes | passivo |

> 4.2 é o que responde de verdade a pergunta que abriu a C1 — *"o inglês abre 48 vezes e converte zero"*. Qualquer releitura dos 447 eventos anteriores responde pior, porque eles têm a régua dentro.

---

## 5. O que trava a entrega do meu lado

**O `git push` e o `git fetch` daqui falham** com `could not read Username for 'https://github.com'`, e o servidor MCP do GitHub precisa de um OAuth que esta sessão não consegue fazer. Você disse que subiu tudo — ótimo, mas **eu não consigo confirmar o que está no remoto nem me sincronizar com ele**.

Enquanto isso não voltar:

- os commits daqui vivem em `entrega-zip/master` (36 desde a base `d5db0f7`);
- a entrega é por **zip**, e o zip vem em dois arquivos porque o anexo trava em 30 MB: `walkstamp-codigo.zip` (24 MB) e `walkstamp-rodada.zip` (17 MB, só os vídeos novos);
- a pasta `APLICAR/` dentro do zip traz os patches por rodada e o `tudo.bundle`, que é a forma mais fiel de aplicar — `git bundle` preserva a história, o patch não.

Para autorizar do seu lado: conectores do claude.ai → GitHub, ou `claude mcp` numa sessão interativa.

---

## Ordem que eu sugeriria

1. **1.7** (`DEMO-NATURA.md`) — 5 minutos, e a suíte volta a ficar verde de verdade. Enquanto ela tiver uma falha "conhecida", a próxima falha real se esconde atrás dela.
2. **3.1** (URL da Stripe) — é o único item da lista com risco de dinheiro.
3. **2.2** (o número de minutos) — é uma pergunta, não um trabalho, e destrava a peça que a análise diz vender mais que a tabela de 93 linhas.
4. **4.1** (leitor de tela) — 30 minutos, e fecha a Trilha A.
5. **1.1** (arquivo único ou build) — é a decisão de maior consequência da lista, e a única que muda como o produto é escrito daqui para a frente.
