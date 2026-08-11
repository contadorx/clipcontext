# Arquitetura do plano pago

Documento de decisão, não de implementação. Reúne o que precisa existir para cobrar, quanto custa,
quanto cobrar, e o que quebra no discurso atual quando isso entrar no ar.

Preços verificados em agosto de 2026. Confira antes de comprometer números — tarifas mudam.

---

## 1. O problema a resolver

Hoje o ClipContext inteiro roda no navegador. Isso é a força do produto e o motivo de não haver o que
cobrar: qualquer trava no código do cliente é contornável com o inspetor do navegador.

Cobrar exige vender algo que o navegador **não consegue** fazer. São três coisas:

| O que | Por que o navegador não faz | Vale pagar? |
|---|---|---|
| Converter HEVC, MKV, ProRes | O navegador não tem esses decodificadores | **Sim** — é a dor mais frequente e concreta |
| Transcrição de alta precisão | Modelo grande não cabe na memória do navegador | Sim, se a qualidade for visivelmente melhor |
| Lote e vídeos muito longos | Trava a máquina do usuário por horas | Sim, para uso profissional |
| API / MCP | Não existe cliente para consumir | **Sim** — maior margem, público que paga sem atrito |

Tudo isso tem uma coisa em comum: exige servidor. É aí que a conta muda de natureza — deixa de ser
custo zero e passa a ter custo por vídeo.

---

## 2. Componentes

```
navegador  ──upload──►  armazenamento de objetos  ◄──lê── worker (ffmpeg + ASR)
    │                            │                            │
    │                            └──URL assinada──────────────┘
    │                                                          │
    └──POST /jobs──► API (controle) ──►  fila  ────────────────┘
                          │                     │
                          ├── banco (usuários, jobs, créditos)
                          └── webhook do processador de pagamento
```

**API de controle** — cria job, informa estado, valida assinatura. Funções serverless servem bem
(Vercel Functions, já que o projeto está lá). Curta duração, escala a zero.

**Worker** — onde o ffmpeg roda de verdade. **Não pode ser função serverless**: converter vídeo leva
minutos e estoura o tempo limite. Precisa ser um processo contínuo numa máquina.

**Fila** — separa quem pede de quem processa. Com pouco volume, uma tabela no Postgres com
`SELECT ... FOR UPDATE SKIP LOCKED` basta; não precisa de Redis nem de serviço de fila no início.

**Armazenamento de objetos** — recebe o upload e guarda o resultado. Aqui o custo que morde é o
**tráfego de saída**: escolher um provedor sem cobrança de egresso muda a conta inteira.

**Banco** — usuários, assinaturas, jobs, créditos consumidos. O projeto já tem Supabase conectado, que
resolve banco, autenticação e armazenamento numa coisa só. É o caminho de menor atrito.

---

## 3. Custo real por vídeo

Tomando como referência um vídeo de **30 minutos, 1 GB, 1080p**:

**Conversão de formato.** Transcodificar 30 minutos num servidor de 4 vCPU leva algo entre 10 e 20
minutos de processador. Num Hetzner CPX32 (4 vCPU, 8 GB) a algo em torno de €14/mês — os preços da
Hetzner subiram cerca de 33% em abril de 2026 — a hora de máquina sai perto de €0,02. O vídeo custa,
então, **menos de €0,01** de processamento. Praticamente nada.

**Transcrição.** É aqui que o dinheiro vai embora, e a escolha do fornecedor decide a viabilidade do plano:

| Fornecedor | Preço por minuto | 30 min de vídeo | Observação |
|---|---|---|---|
| Groq (Whisper) | ~US$ 0,00067 | **US$ 0,02** | O mais barato e o mais rápido |
| OpenAI (Whisper) | US$ 0,006 | US$ 0,18 | 9x mais caro que o Groq |
| Google (Chirp 2.0) | US$ 0,006 | US$ 0,18 | Melhor precisão medida |
| AssemblyAI | US$ 0,0065 a 0,0125 | US$ 0,20 a 0,38 | Inclui separação de locutores |

**A conta que importa:** um plano de R$ 29/mês com uso justo de 20 vídeos de 30 minutos custa cerca de
**US$ 0,40** em transcrição pelo Groq — e **US$ 3,60** pela OpenAI. No primeiro caso a margem é
confortável; no segundo, a taxa do cartão e o custo somados já comem quase metade da mensalidade.

Vale rodar o Whisper no próprio servidor? Só quando o volume for alto o bastante para manter uma
máquina ocupada. Antes disso, API cobrada por uso é mais barata e não dá manutenção.

**Armazenamento e tráfego.** Com apagamento automático em poucas horas, o volume guardado é
irrelevante. O egresso é o risco: escolha um provedor que não cobre por ele.

---

## 4. Quanto cobrar

Com custo marginal perto de US$ 0,02 por vídeo, o preço não é ditado pelo custo, e sim pelo valor
percebido e pela taxa do meio de pagamento.

**Taxas no Brasil (Stripe, agosto de 2026):** 3,99% + R$ 0,39 no cartão nacional, mais 0,7% sobre o
volume de assinaturas. Numa mensalidade de R$ 29, isso dá cerca de **R$ 1,75 — perto de 6% do ticket**.
Pix sai bem mais barato, 1,19%, mas na Stripe é liberado por convite. O Mercado Pago costuma ter menos
exigências de formalização para quem está começando; confirme o que cada um exige de você como pessoa
física ou jurídica antes de escolher.

**Consequência prática:** mensalidade abaixo de R$ 15 é ruim — a taxa fixa de R$ 0,39 pesa demais em
tickets pequenos. Ou você cobra R$ 25–39 por mês, ou vende crédito avulso em pacotes maiores.

Sugestão de estrutura, a validar com gente de verdade:

- **Pro — R$ 29/mês.** Formatos que o navegador recusa, transcrição de alta precisão, vídeos longos,
  uso justo de 20 vídeos/mês.
- **Créditos avulsos — R$ 19 por 10 vídeos.** Para quem tem necessidade esporádica e não quer assinar.
- **API — por uso**, com mínimo mensal. É onde a margem é maior e o cliente reclama menos.

---

## 5. O problema do discurso, que é o mais sério

Hoje a landing diz, em destaque: *"Não temos seus arquivos porque não temos servidor"*. No dia em que
existir plano pago, isso deixa de ser verdade para quem paga.

Isso não inviabiliza nada, mas exige honestidade explícita — e é exatamente o tipo de coisa que, mal
resolvida, destrói a credibilidade que o produto tem hoje:

1. **Delimitar a promessa.** "O plano gratuito processa tudo no seu navegador. O plano pago envia o
   arquivo para nossos servidores, porque é a única forma de converter formatos que o navegador não lê."
   Dito assim, na frente, vira prova de honestidade em vez de pegadinha.
2. **Apagamento automático e curto.** Arquivo original e resultado apagados em, digamos, 6 horas.
   Publicado como compromisso, não como configuração escondida.
3. **Nunca treinar modelo com conteúdo de usuário.** Declarar isso explicitamente.
4. **Atualizar a política de privacidade** com uma seção separada para o plano pago: quais dados,
   por quanto tempo, quais subprocessadores (o fornecedor de transcrição é um deles), e como pedir
   exclusão. Isso passa a ser tratamento de dados pessoais de verdade, sujeito à LGPD.
5. **Manter o gratuito intacto.** Se o gratuito piorar quando o pago nascer, todo o argumento cai.

Nada disso é aconselhamento jurídico — antes de faturar, um advogado precisa revisar política, termos
e contrato de assinatura.

---

## 6. Ordem de construção

**Fase 0 — medir a demanda (agora, custo zero).**
Não construa nada ainda. Hoje, quando um formato falha, a ferramenta só mostra um aviso. Troque por
um convite a reportar — um link que abre uma issue no GitHub. Em algumas semanas você sabe se o
problema do HEVC é real ou se era teoria minha. Sem rastreamento, sem coleta: a pessoa relata se quiser.

**Fase 1 — conversão, e só isso.**
O menor produto vendável: sobe o arquivo, recebe um MP4 que a ferramenta gratuita abre. Sem contas
ainda: pagamento avulso por link, com o resultado entregue por URL temporária. Testa se alguém paga
antes de existir sistema de assinatura.

**Fase 2 — contas e assinatura.**
Só depois que a Fase 1 vender. Autenticação por link mágico, tabela de jobs, portal de assinatura do
processador de pagamento. Aqui entra também a transcrição de alta precisão.

**Fase 3 — API e MCP.**
O endpoint que recebe vídeo e devolve frames, transcrição e JSON. E o servidor MCP, para agentes
consumirem direto. Maior margem, e o público que você já alcança.

---

## 7. O que não construir

- **Painel de métricas de uso** antes de ter usuários. Você tem um.
- **Múltiplos níveis de assinatura** no lançamento. Um plano pago e créditos avulsos bastam.
- **Whisper no próprio servidor** enquanto a API por uso for mais barata que manter a máquina.
- **Fila dedicada, Kubernetes, microsserviços.** Um processo com ffmpeg e uma tabela no Postgres
  aguentam muito mais volume do que você terá no primeiro ano.
- **Coleta de e-mail para lista de espera** enquanto a página se vender por não coletar nada. Se um
  dia fizer, deixe claro o porquê e permita sair.

---

## Fontes dos números

- Preços de transcrição: [TokenMix — Whisper API pricing 2026](https://tokenmix.ai/blog/whisper-api-pricing)
- Preços de servidor: [Better Stack — Hetzner Cloud Review 2026](https://betterstack.com/community/guides/web-servers/hetzner-cloud-review/)
- Taxas de pagamento: [Stripe — Preços e tarifas](https://stripe.com/br/pricing)
