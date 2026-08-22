# Proposta completa de redesenho de UX — Walkstamp

**Objetivo:** tornar o primeiro uso óbvio sem retirar poder de quem usa o Walkstamp todos os dias.
**Princípio:** esconder complexidade até ela ser necessária, nunca esconder capacidade.
**Resultado esperado:** uma pessoa nova consegue ir de vídeo a documento sem ajuda em três etapas.

## 1. A solução em uma frase

Substituir a página longa de quatro passos, letras e subpassos por um fluxo progressivo de três etapas:

> **1. Entrada → 2. Conferir → 3. Baixar**

Cada etapa tem uma ação primária, um resumo do que já está pronto e uma porta explícita para opções
avançadas. Transcrição deixa de ser um passo independente e passa a ser um estado do material. Prompt,
integrações, tradução e formatos raros passam a ser próximos passos depois do documento pronto.

## 2. Princípios obrigatórios

1. **Uma decisão principal por tela.** Decisões secundárias não competem visualmente.
2. **Falar em objetivos, não em formatos ou mecanismos.** “Editar no Word” antes de “DOCX”.
3. **Alternativas não são passos.** Gravar, escolher vídeo e continuar projeto são portas diferentes.
4. **O padrão deve funcionar.** A pessoa só abre ajustes para discordar da recomendação.
5. **Progresso representa trabalho real.** Nada de quatro passos que escondem outros sete.
6. **Resultado primeiro, ferramentas depois.** Mostrar o documento possível antes de oferecer refinamentos.
7. **Conclusão inequívoca.** O produto declara quando terminou e se o trabalho pode ser recuperado.
8. **Sem perda silenciosa.** Toda saída incompleta diz exatamente o que falta.
9. **Especialistas mantêm atalhos.** O modo simples reduz ruído, não reduz capacidade.
10. **Privacidade curta no fluxo, completa nos detalhes.** Uma promessa clara e um link para a explicação.

## 3. Nova arquitetura da informação

### Navegação persistente

```text
[1 Entrada ✓] ─── [2 Conferir] ─── [3 Baixar]
                  Próxima ação: remover 4 telas repetidas
```

- fica visível no topo enquanto a pessoa rola;
- mostra `atual`, `concluída`, `com atenção` e `bloqueada`;
- clicar em etapa concluída volta sem apagar nada;
- em celular, vira `Etapa 2 de 3 · Conferir` e uma barra curta;
- abaixo dela há sempre uma única frase: **“Próxima ação: …”**.

### Menu secundário

Fora do caminho principal:

- **Novo documento**;
- **Abrir projeto**;
- **Ajuda**;
- **Diagnóstico**;
- **Conta**.

“Abrir projeto” deixa de ocupar espaço permanente no primeiro cartão. Recuperação automática de uma
captura interrompida continua aparecendo como aviso contextual, pois é exceção urgente e relevante.

### Vocabulário fixo

| Conceito | Palavra na interface | Não usar na navegação |
|---|---|---|
| fase do Walkstamp | **etapa** | passo |
| imagem capturada | **tela** | frame, quadro, trecho |
| ação mostrada no material | **passo do procedimento** | etapa |
| trabalho que pode ser reaberto | **projeto Walkstamp** | JSON |
| arquivo final | **documento** | saída, artefato |
| divisão de uma gravação | **tarefa** | capítulo, sessão, caso |

O cenário pode continuar alterando o vocabulário **dentro do documento**, mas não muda os termos da
interface do Walkstamp.

## 4. Etapa 1 — Entrada

### Objetivo da etapa

Responder apenas: **de onde vem o material?**

### Tela inicial proposta

```text
Crie um documento a partir de uma gravação

[ Gravar minha tela ]                    ação primária
[ Escolher um vídeo ]                    ação secundária

Já começou antes?  Abrir projeto Walkstamp

──────────────────────────────────────────────────────────
Tudo acontece neste computador. O vídeo não é enviado.
```

Google Drive aparece dentro de “Escolher um vídeo”, como origem do seletor, não como uma terceira tarefa
de mesmo peso. “Experimentar com exemplo” aparece abaixo, como link discreto para onboarding.

### Quando perguntar o tipo de documento

Depois que a fonte for escolhida e antes de iniciar o processamento:

```text
O que você quer obter?

(●) Documento para explicar uma tela ou processo     recomendado
( ) Registro de reunião
( ) Evidência de teste ou homologação
( ) Relatório de sessão de usabilidade

[Continuar]
```

“Tutorial” e “Contexto para IA” entram no primeiro grupo; diferenças finas podem ser escolhidas em
“Personalizar documento”. “Outro” deixa de ser necessário se o primeiro formato for verdadeiramente
genérico.

Cada opção deve ter uma miniatura de uma página final ou um link “ver exemplo”. A escolha permanece
editável até gerar o documento; nunca insinuar que é necessário regravar.

### Roteiro existente

Só aparece quando acrescenta valor ao cenário escolhido:

```text
Você já tem a lista de passos?                     opcional
Ela ajuda a nomear as telas enquanto você grava.
[Colar ou abrir roteiro]  [Agora não]
```

Para reunião e contexto genérico, não aparece. Para evidência/tutorial, surge depois do tipo de
documento, pois é complemento e não fonte.

### Opções de gravação

Antes de gravar, mostrar somente:

- `Transcrever a fala` — ligado e recomendado;
- `Parar sozinho após 45 min` — ligado;
- link `Opções de gravação`.

Dentro de opções: nomes dos canais, microfone, webcam, clipes, limite, modelo e motor. O modelo deve ser
expresso por intenção:

- **Rápido — recomendado**;
- **Mais preciso — demora mais**;
- **Máxima precisão — para gravações curtas**.

Tamanho do download e motor ficam como consequência abaixo da opção, não como decisão separada.

### Entrada por vídeo

Depois de escolher o arquivo:

```text
reuniao-abril.mp4 · 42 min

Fala
(●) Usar uma transcrição que já existe             mais rápido
( ) Transcrever neste computador                   ~18 min nesta máquina
( ) Continuar sem fala

[Continuar]
```

Se a pessoa escolher transcrição pronta, oferecer Meet/Teams/Zoom, legenda ou colar texto. Se escolher
Whisper, começar com o modo rápido e permitir “Mais precisão” em detalhes. Essa decisão elimina o atual
passo “A fala — opcional” e evita baixar modelo quando o texto já existe.

### Estado de processamento

Usar uma linha de produção, não regiões que competem:

```text
Preparando seu documento

✓ Vídeo aberto
✓ 38 telas encontradas
● Transcrevendo no processador · 46% · faltam cerca de 7 min
○ Pronto para conferir

[Parar e ficar com o que já está pronto]
```

Detalhes técnicos, tentativas de fallback e diagnóstico ficam recolhidos em `Detalhes`. Se houver ação
útil — ativar GPU, escolher modo rápido — ela aparece ao lado do ganho estimado e nunca interrompe o que
já saiu.

### Critérios de conclusão da etapa 1

- existe ao menos uma tela capturada, ou há mensagem explícita explicando por que não;
- fala tem um dos estados: `completa`, `em andamento`, `não solicitada`, `indisponível`;
- a pessoa pode seguir com resultado parcial consciente;
- o foco e a rolagem vão para “Conferir”.

## 5. Etapa 2 — Conferir

### Objetivo da etapa

Responder: **o material está bom o suficiente para gerar?**

### Resumo automático primeiro

```text
Seu material está pronto para conferência

38 telas encontradas · 34 com fala
4 telas parecem repetidas · 2 podem conter dados pessoais

[Aplicar limpeza recomendada]                 ação primária
[Revisar tela por tela]

Você também pode gerar agora sem revisar.
```

A limpeza recomendada nunca descarta itens marcados manualmente. Antes de aplicar, mostra a consequência;
depois, oferece desfazer.

### Grade simplificada

Cada cartão mostra apenas:

- número e instante;
- miniatura;
- primeira linha da fala ou “sem fala”;
- estado `incluída/fora`;
- menu `Editar`.

Anotação, tarja, recorte, comparação, classificação de UX, tarefa e clipe ficam dentro de `Editar`. Clique
na miniatura abre a revisão; não alterna descarte silenciosamente, pois clicar em imagem normalmente
significa ampliar. Incluir/excluir deve ter controle textual próprio.

### Barra de ações em lote

```text
34 de 38 telas incluídas
[Revisar uma por uma] [Desfazer limpeza] [Mais ações ▾]
```

Dentro de “Mais ações”:

- remover telas sem fala;
- remover repetidas;
- incluir todas;
- adicionar tela;
- ler texto da tela (OCR);
- manter apenas marcadas.

Assim, a operação recomendada fica visível e as seis alternativas não competem.

### Fala como painel contextual

No topo da revisão:

```text
Fala · 118 trechos · completa                         [Revisar]
```

Ao abrir:

- texto e marcações de tempo;
- abrir/substituir transcrição;
- corrigir termos;
- retirar hesitações;
- traduzir.

Vocabulário, hesitações e tradução só aparecem dentro deste painel. “Vários idiomas” deve migrar para
depois do primeiro documento, porque é distribuição, não conferência do original.

### Identificação progressiva

Não manter uma subetapa permanente chamada “Identificar”. Exibir somente os campos necessários para o
cenário antes de gerar:

```text
Falta uma informação para o cabeçalho
Sistema ou produto: [________________]
[Salvar e continuar]
```

Campos opcionais ficam em “Adicionar detalhes ao documento”. Nenhum campo opcional bloqueia ou parece
pendência.

### Ação de saída da etapa

Rodapé persistente:

```text
34 telas incluídas · fala completa
[Continuar para baixar]
```

Se a fala ainda estiver sendo transcrita:

```text
Ainda faltam cerca de 3 min de fala.
[Esperar] [Continuar sem o restante da fala]
```

Nunca gerar incompleto apenas porque um botão já estava habilitado.

## 6. Etapa 3 — Baixar

### Objetivo da etapa

Responder: **qual documento resolve o trabalho agora?**

### Recomendação por cenário

```text
Seu documento está pronto para ser gerado

Recomendado para você
┌──────────────────────────────────────────────┐
│ PDF para compartilhar ou entregar a uma IA  │
│ 34 telas · fala completa · cerca de 8 MB    │
│ [Gerar PDF]                                 │
└──────────────────────────────────────────────┘

[Preciso editar: gerar Word]
[Ver todos os formatos]
```

Recomendações:

| Cenário | Primária | Secundária |
|---|---|---|
| contexto/explicação | PDF | Word |
| ata | Word | PDF |
| evidência | PDF ou pacote de evidências | Word |
| tutorial | Word | HTML |
| usabilidade | Word | PDF |

O sistema pode lembrar a última escolha do usuário recorrente, desde que continue identificada como
preferência pessoal, não como recomendação universal.

### “Ver todos os formatos”

Organizar por necessidade:

- **Editar:** Word;
- **Apresentar:** PowerPoint;
- **Publicar:** HTML;
- **Anexar evidências:** pacote ZIP;
- **Plataforma de ensino:** SCORM;
- **Integrações:** Jira e Google Docs;
- **Dados e recuperação:** projeto Walkstamp e dados JSON.

Layout e papel aparecem depois de escolher um formato que usa essas propriedades. Não perguntar tamanho
de papel antes de saber se a pessoa quer PDF.

### Geração

Enquanto gera:

```text
Gerando PDF · página 12 de 34
[Cancelar]
```

Ao terminar, substituir a etapa pela conclusão. Não deixar a pessoa olhando os mesmos botões como se
nada tivesse acontecido.

## 7. Estado final — conclusão inequívoca

```text
✓ Documento pronto

walkstamp-reuniao-abril.pdf foi baixado.
34 telas · 118 trechos de fala · transcrição completa

[Baixar novamente]
[Guardar projeto para editar depois]
[Criar outro documento]

Próximos passos
Copiar instrução para uma IA · Enviar ao Jira · Traduzir · Outros formatos
```

### Segurança do trabalho

Após baixar o documento, explicar uma única vez:

- `Documento baixado`;
- `Projeto ainda não guardado`;
- `Vídeo nunca foi enviado`;
- `clipes temporários serão apagados ao começar outro`, se aplicável.

O botão “Guardar projeto” gera o formato recuperável, mas o nome principal é humano. Extensão e detalhes
técnicos aparecem abaixo: `Projeto Walkstamp (.json)`.

### Prompt para IA

Deixa de ser “passo 4”. Aparece em “Próximos passos” somente quando o cenário comporta uso com IA:

```text
Vai entregar este PDF a uma IA?
[Copiar instrução pronta]
```

Depois de copiar, confirmar em uma linha. Objetivos alternativos ficam no painel expandido.

## 8. Modo avançado e usuário recorrente

### Como preservar eficiência

- atalhos `G`, `M` e `P` permanecem;
- usuário pode ativar “Mostrar opções avançadas sempre” na conta ou localmente;
- última fonte, cenário e formato podem ser lembrados;
- ajustes avançados ficam acessíveis sem sair da etapa;
- links profundos de roteiro/caso continuam preenchendo contexto automaticamente;
- abrir vários projetos e consolidação vivem no menu “Abrir projeto”;
- nenhuma capacidade é removida do artefato final.

### Modo avançado não deve ser uma segunda aplicação

Ele apenas expande:

- controles finos de captura;
- detector de telas;
- motor/modelo;
- ferramentas em lote;
- formatos e integrações;
- campos opcionais.

O estado, os dados e a ordem das três etapas permanecem iguais. Assim documentação, suporte e testes não
precisam cobrir dois produtos divergentes.

## 9. Sistema visual e leitura

### Hierarquia

Em cada etapa:

1. título e objetivo em uma frase;
2. ação primária sólida;
3. alternativas secundárias com contorno;
4. links para detalhes;
5. estado/resultado abaixo da ação que o causou.

Limites:

- no máximo uma ação sólida por viewport;
- no máximo três alternativas antes de “Mais opções”;
- parágrafo operacional com até duas linhas em desktop;
- detalhe técnico nunca ocupa o mesmo nível do próximo passo;
- avisos amarelos apenas para risco real; informação neutra não parece alerta.

### Microcópia

Trocar:

| Atual/conceitual | Proposto |
|---|---|
| “Escolha o cenário” | “O que você quer obter?” |
| “A fala — opcional” | “Fala: pronta” ou “Adicionar fala” |
| “Descartar repetidos” | “Remover 4 telas repetidas” |
| “JSON” | “Projeto editável do Walkstamp” |
| “Escolha um formato” | “Recomendado: PDF para compartilhar” |
| “Pronto — ir para o prompt” | “Documento pronto” |
| “Começar outro documento” | manter, somente após conclusão |

### Estados assíncronos

Separar visual e semanticamente:

- **etapa atual:** `Transcrevendo`;
- **progresso:** `46%` + barra acessível;
- **previsão:** `faltam cerca de 7 min`;
- **motor:** detalhe recolhido;
- **ação:** `Parar e ficar com o parcial`.

Leitor de tela recebe anúncios apenas em início, mudança relevante, erro e conclusão; não a cada ponto
percentual.

## 10. Regras de comportamento

### Botão primário

- exatamente um por etapa;
- desabilitado apenas quando a causa aparece imediatamente ao lado;
- rótulo descreve resultado: `Continuar para conferir`, não `Continuar` isolado;
- ao clicar, recebe estado de trabalho e impede clique duplicado;
- erro devolve foco ao controle que resolve o problema.

### Salvamento e saída

- avisar ao sair apenas quando existe trabalho não recuperável;
- distinguir `documento baixado` de `projeto guardado`;
- checkpoint textual da transcrição e espelho de telas continuam automáticos;
- “Novo documento” lista claramente o que será descartado;
- se download falhar, manter todo o material e oferecer tentar novamente.

### Desfazer

Toda ação em lote — remover repetidas, remover sem fala, OCR que substitui texto, limpeza de hesitações,
tradução — deve oferecer desfazer no mesmo local. Recarregar página não pode ser apresentado como método
normal de desfazer.

### Conteúdo parcial

Um documento parcial pode ser gerado, mas exige escolha explícita com consequência mensurável:

> “A fala está em 62%. O documento ficará sem aproximadamente 16 minutos finais.”

Evitar frases abstratas como “pode sair incompleto”.

## 11. Plano de implementação

### Fase 0 — instrumentar antes de mover (2–3 dias)

- eventos de entrada, etapa, ação primária, volta, erro e conclusão;
- tempo até primeira ação correta;
- tempo em cada etapa;
- formatos gerados e se projeto recuperável foi guardado;
- abandono por estado, sem enviar vídeo, fala, imagem ou texto;
- baseline com cinco sessões observadas.

### Fase 1 — hierarquia sem mudar motores (5–7 dias)

- barra `Entrada → Conferir → Baixar`;
- agrupar fontes em novo/continuar;
- mover roteiro para contexto;
- uma ação primária por etapa;
- recolher opções avançadas;
- manter IDs e manipuladores existentes sempre que possível.

Esta fase deve mudar principalmente HTML/CSS e orquestração de visibilidade, não algoritmos de captura ou
transcrição.

### Fase 2 — revisão e saída recomendadas (5–8 dias)

- resumo automático da revisão;
- limpeza recomendada com desfazer;
- painel contextual de fala;
- formato recomendado por cenário;
- “Ver todos os formatos”;
- renomear JSON para projeto recuperável.

### Fase 3 — conclusão (3–5 dias)

- estado final após download;
- checklist documento/projeto/temporários;
- próximos passos;
- prompt removido da numeração principal;
- novo documento somente dentro da conclusão ou menu.

### Fase 4 — acessibilidade e validação (5 dias)

- foco e rolagem em transições;
- `aria-current="step"`, barra e anúncios;
- teclado completo e zoom 200%;
- NVDA + Chrome e VoiceOver + Safari;
- cinco a oito novos testes moderados;
- ajustes segundo evidência.

## 12. Estratégia técnica para o HTML único

O redesenho não exige abandonar o artefato autocontido. Recomenda-se:

- criar um controlador pequeno de etapas com estado derivado dos dados existentes;
- usar `hidden`/classes para revelar painéis sem duplicá-los;
- mover fisicamente componentes apenas quando necessário para ordem de foco correta;
- não criar cópias de controles com IDs diferentes;
- manter funções de domínio existentes e trocar a camada de apresentação gradualmente;
- criar testes de transição independentes dos testes de processamento pesado.

Estado mínimo sugerido:

```js
{
  etapa: 'entrada' | 'conferir' | 'baixar' | 'concluido',
  entrada: 'captura' | 'arquivo' | 'drive' | 'projeto',
  fala: 'ausente' | 'carregando' | 'parcial' | 'completa' | 'dispensada' | 'erro',
  telas: 'vazias' | 'processando' | 'prontas' | 'erro',
  revisao: 'pendente' | 'aceita',
  documento: 'nao_gerado' | 'gerando' | 'baixado' | 'erro',
  projetoGuardado: false
}
```

A próxima ação deve ser derivada desse estado, não escrita por diversos manipuladores concorrentes.

## 13. Testes de aceitação

### Primeiro uso

- 4 de 5 participantes geram PDF sem ajuda;
- mediana até selecionar fonte abaixo de 30 s;
- ninguém tenta executar reabrir projeto e roteiro como passos obrigatórios;
- ninguém baixa modelo quando já recebeu VTT/DOCX da reunião;
- ninguém pergunta se o prompt é obrigatório;
- 4 de 5 sabem dizer se o projeto pode ser reaberto.

### Leitura

- participante identifica a próxima ação em até 5 s em cada etapa;
- texto crítico continua compreensível com leitura apenas de títulos, botões e estados;
- zoom de 200% não mistura ação primária e alternativas;
- nenhuma mudança assíncrona importante ocorre fora da região anunciada.

### Seguimento

- indicador mostra sempre a etapa real;
- voltar não perde seleção, transcrição, telas ou revisão;
- uma etapa concluída tem resumo editável;
- conteúdo parcial exige confirmação explícita;
- apenas um botão primário está visível em cada viewport do caminho básico.

### Conclusão

- download bem-sucedido abre estado final;
- estado final informa completude da fala e quantidade de telas;
- baixar novamente funciona sem reprocessar;
- guardar projeto funciona depois de gerar;
- começar outro documento descreve e apaga apenas o esperado;
- falha no download não apaga o trabalho.

### Usuário recorrente

- atalhos continuam funcionando;
- opções avançadas permanecem alcançáveis em até dois cliques;
- roteiro vindo por link continua pré-preenchido;
- todos os formatos atuais continuam disponíveis;
- tempo para repetir o último fluxo não aumenta mais de 10%.

## 14. O que deve ser removido da rota principal

Não remover do produto; retirar do caminho obrigatório:

- reabrir e consolidar projetos como bloco permanente;
- detalhes de modelo/runtime;
- webcam e clipe;
- controles finos do detector;
- OCR e ações raras em lote;
- tradução múltipla;
- Jira, Google Docs e SCORM;
- layout e papel antes de escolher formato;
- JSON como termo primário;
- prompt como quarta etapa;
- diagnóstico técnico sem erro presente.

## 15. Prioridade final

| Ordem | Mudança | Impacto | Dificuldade |
|---:|---|---|---|
| 1 | conclusão única após download | muito alto | média |
| 2 | três etapas reais | muito alto | média |
| 3 | separar novo/continuar/opcional | alto | baixa |
| 4 | fala como estado contextual | alto | média |
| 5 | saída recomendada + demais recolhidas | alto | média |
| 6 | revisão automática resumida | alto | média |
| 7 | uma ação primária por etapa | alto | baixa |
| 8 | vocabulário consistente | médio | baixa |
| 9 | progresso persistente e acessível | médio | média |
| 10 | modo avançado lembrado | médio | baixa |

## Veredito

O Walkstamp não precisa de menos capacidade; precisa parar de apresentar toda capacidade como parte da
tarefa principal. A solução é uma camada progressiva sobre o que já existe: três etapas verdadeiras,
uma recomendação por vez e um final claro. Isso resolve facilidade de uso, leitura, seguimento e
conclusão sem sacrificar a proposta local, os formatos, os cenários ou a eficiência dos especialistas.
