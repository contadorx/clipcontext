# Evidência de teste: o caso de uso que você acabou de achar

Escrito em 14/08/2026, depois de você dizer que usaria em teste de SAP.

---

## Por que isto é maior do que parece

Você achou algo que eu não tinha visto na análise, e que é melhor do que quase tudo que está lá.

Evidência de teste tem três propriedades que "contexto para IA" não tem:

**É obrigatória.** UAT sem evidência não passa em auditoria de ITGC/SOX. Não é uma melhoria de
produtividade que a pessoa adota se sobrar tempo — é um documento que alguém **tem** que entregar.

**Tem dono de orçamento.** Gerente de testes, QA, compliance. Diferente de "quero resumir esse vídeo",
que é uma dor pessoal sem verba.

**Não pode subir para lugar nenhum.** Teste de SAP roda com dado que costuma ser cópia de produção —
cliente, fornecedor, folha, custo. É exatamente o grupo 1 da análise, e aqui a privacidade deixa de ser
argumento de venda e vira **pré-requisito de entrada**: as ferramentas que pedem upload estão fora da
disputa antes de começar.

E o formato que a auditoria quer é **documento**, não prompt. Você já tem `.docx`.

## O que a auditoria realmente pede

Vale ler com atenção, porque muda o que o produto precisa fazer. Uma evidência boa de UAT não é um monte
de telas — é um **fio narrativo**: o pedido original, a expectativa, a execução, o resultado, quem
aprovou, quando. As telas são a parte cara de produzir; o resto é texto.

O que faz a documentação **reprovar**: mudança sem justificativa registrada, ausência de evidência de que
o teste foi feito, aprovação faltando, e trilha incompleta entre pedido e produção.

Ou seja: o ClipContext não entrega a evidência inteira, e não deveria prometer isso. Ele entrega **a
parte mais trabalhosa dela** — as telas certas, na ordem, com hora e com a narração do que estava sendo
feito — num arquivo que a pessoa completa com o resto.

## Quem já está nesse espaço, e onde está a fresta

Tricentis Tosca e Worksoft Certify dominam evidência de teste em SAP. São ferramentas de **automação de
regressão**: você modela o caso, ela executa, ela documenta. Licença cara, projeto de implantação,
equipe dedicada.

O que elas não cobrem é justamente o que mais se faz no dia a dia: **teste manual, exploratório, de uma
vez só.** Alguém senta, clica, confere, e precisa provar que conferiu. Hoje isso é `Print Screen` →
colar no Word → escrever a legenda → repetir quarenta vezes.

Essa fresta é grande e ninguém pequeno está nela. É onde o ClipContext entra sem competir de frente com
ninguém.

---

## O que precisa mudar no produto

Em ordem de gravidade. O primeiro item é eliminatório: sem ele, a saída **não serve** como evidência.

### 1. Hora de relógio, não tempo decorrido — *eliminatório*

Hoje cada frame é marcado com `00:14`, contado do início. Auditor não aceita tempo decorrido: ele precisa
de **data e hora**. `14/08/2026 12:58:45`.

O dado existe (a gravação sabe quando começou); só nunca foi guardado. É a mudança mais barata e a mais
importante desta lista.

Manteria os dois: `00:14` continua útil para achar o momento no vídeo, e a hora de relógio ao lado.

### 2. Um cabeçalho de identificação

A evidência precisa dizer **de quem, de onde, de quê**. Campos que eu poria, todos opcionais e livres:

| campo | exemplo |
|---|---|
| Caso de teste | `UAT-4711 — Criação de pedido de compra` |
| Sistema / mandante | `S4P / 100` |
| Executado por | `Leandro B. de Oliveira` |
| Chamado / mudança | `CHG0045231` |
| Resultado | Passou / Falhou / Bloqueado |

Isso vira a primeira página do `.docx` e o nome do arquivo — hoje o arquivo sai como `captura de tela`,
que é a pior coisa possível para anexar num chamado.

### 3. Numeração de passo por frame

`Passo 1`, `Passo 2`… junto do instante. Evidência é lida como sequência, e "frame 3 de 9" não é a mesma
coisa que "passo 3".

### 4. Uma anotação por frame

Um campo de texto curto em cada miniatura, na revisão. É onde entra *"expectativa: o sistema deve
recusar o lançamento"* — a linha que, segundo a auditoria, separa evidência boa de pilha de telas.

Custa pouco: o cartão de revisão já existe e já é onde a pessoa olha frame a frame.

### 5. Um modo "evidência" no passo 5

O gerador de prompt tem um seletor de objetivo. Um item novo — *"montar a ata de evidência de teste"* —
faria a IA transformar as telas e a narração num relatório com expectativa e resultado. Aqui a IA volta a
ter papel, e um papel melhor: não é o consumidor do documento, é quem **redige** o documento.

### 6. Marca de integridade — *opcional, e com cuidado*

Um hash SHA-256 de cada imagem no rodapé prova que o arquivo não foi editado depois. É barato e alguns
auditores gostam.

**Mas cuidado com o discurso.** Isso **não** faz o ClipContext atender 21 CFR Part 11, nem SOX, nem
CSV — essas normas falam de sistema controlado, trilha de auditoria e assinatura eletrônica, não de um
documento gerado no navegador. Prometer conformidade seria falso e é o tipo de promessa que destrói a
credibilidade que o produto tem. O que se pode dizer com verdade: *"produz a evidência visual; a trilha
de aprovação continua no seu sistema de mudanças"*.

---

## O discurso: o que eu mudaria, e o que eu não mudaria

**Não trocaria a manchete.** A landing acabou de ganhar o argumento do compressor, que é forte e
verdadeiro. Evidência de teste é um **caso de uso**, não a proposta inteira — e você ainda não sabe qual
dos dois traz mais gente, porque a medição começou anteontem.

**O que eu faria:** uma **página própria** para o caso, em `/evidencia-de-teste`. É barato, é reversível,
e é exatamente a jogada de conteúdo que está no `brand/onde-publicar.md` — a página responde a quem já
está procurando ("evidência de teste UAT SAP", "documentar teste sem subir print"), e o produto aparece
como consequência.

Se a página converter melhor que a home, aí sim a conversa sobre trocar a manchete tem dado por trás.

E há um ganho de reputação junto: esse é **o seu terreno**. Um arquiteto de soluções SAP escrevendo sobre
evidência de teste é alguém falando do que faz, não alguém divulgando ferramenta. É o post de LinkedIn
com maior chance de repercutir que você tem disponível.

---

## O nome

Pergunta certa, e minha resposta é: **não troque agora.**

**O que está bom:** curto, se escreve como se fala, o `.app` é seu, ninguém mais usa, e não significa nada
constrangedor em português, inglês ou espanhol. Não é um nome que atrapalha.

**O que é fraco:** ele descreve o *mecanismo* ("pedaço de vídeo" + "contexto"), não o *resultado*. E
"Context" está amarrado ao enquadramento de IA — se evidência de teste virar o negócio, o nome vai soar
deslocado. "Clip" também mora num bairro cheio: Clipchamp, Kapwing, e afins.

**Por que ainda assim eu não trocaria:**

1. **Não há equidade a proteger, mas também não há problema medido.** Zero tráfego significa que trocar é
   barato — e que também não há nenhuma evidência de que o nome esteja custando algo.
2. **Você trocaria duas vezes.** Não se sabe qual cunha vence: contexto para IA ou evidência de teste.
   Renomear antes disso é escolher no escuro e refazer depois.
3. **O que segura o produto hoje não é o nome.** É deploy, confiabilidade da gravação e distribuição.
   Trocar o nome é a forma mais confortável de parecer que se está trabalhando na coisa difícil.

**A regra de decisão que eu usaria:** se em três meses a página de evidência de teste trouxer mais gente
que a home, e se as conversas com pessoas de verdade convergirem para esse uso, aí o nome merece a
discussão — com audiência real para perguntar, que é a única forma de escolher nome que não é chute.

Até lá, o dinheiro está em fazer a gravação funcionar sempre e em colocar isso na frente de dez pessoas
que testam SAP.

---

## Se for para fazer, a ordem

| | o quê | esforço | por quê | estado |
|---|---|---|---|---|
| 1 | Hora de relógio nos frames e no documento | pequeno | sem isso não é evidência | **feito** |
| 2 | Cabeçalho de identificação + nome de arquivo | pequeno | é o que faz o `.docx` ser anexável | **feito** |
| 3 | Numeração de passo | trivial | evidência se lê como sequência | **feito** |
| 4 | Anotação por frame na revisão | médio | é o que separa evidência de pilha de telas | **feito** |
| 5 | Página `/evidencia-de-teste` nos três idiomas | médio | é o canal, e é o seu terreno | pendente |
| 6 | Modo "ata de evidência" no gerador de prompt | pequeno | dá papel novo à IA | **feito** |
| 7 | Hash por imagem | pequeno | opcional, e sem prometer conformidade | **feito** |

Os três primeiros somam menos de um dia e mudam a saída de "interessante" para "serve".

---

## O que foi implementado, em detalhe (14/08/2026)

Tudo dentro do cartão 4, que já é onde a pessoa olha quadro a quadro. Nada disso liga sozinho:
sem preencher nada, o documento sai igual ao que saía antes — só com "Passo N" no lugar de
"frame N".

**Hora de relógio.** Um campo *Início da gravação* guarda o instante zero. Numa gravação de
tela ele é preenchido sozinho, com a hora de verdade do relógio. Num arquivo que já existia é
**estimado** pela data de modificação menos a duração — e o campo avisa que é estimativa, com
um aviso que some assim que a pessoa corrige. Se o campo estiver vazio, **nenhuma hora
aparece em lugar nenhum**: inventar horário numa evidência é pior que não ter.

O formato é `AAAA-MM-DD hh:mm:ss` nos três idiomas, de propósito. Um documento que circula
entre times não pode deixar dúvida se `08/09` é agosto ou setembro.

**Cabeçalho de identificação.** Caso de teste, sistema/mandante, executado por,
chamado/mudança, resultado (passou/falhou/bloqueado) e o início. Vira a **primeira página** do
PDF e do `.docx`, o **título** do documento (no lugar de "Análise de vídeo") e o **nome do
arquivo baixado** — `analise-UAT-4711-Criacao-de-pedido-de-compra-CHG0045231.pdf` em vez de
`analise-captura-de-tela.pdf`, que era a pior coisa possível para anexar num chamado.

Nada disso vai para `localStorage`. A política de privacidade promete que não existe
identificador que sobreviva à visita, e "Executado por: Fulano" guardado no navegador seria
exatamente isso. O preço é redigitar; o ganho é a promessa continuar verdadeira.

**Numeração de passo.** A numeração é sobre os quadros **mantidos**, não sobre a lista: quem
descarta o terceiro quadro espera que o quarto vire o passo 3, e é o que acontece — a
miniatura renumera na hora. Se documento e tela discordassem, a evidência mentiria.

**Anotação por quadro.** Um campo de texto em cada miniatura. É onde entra *"expectativa: o
sistema deve recusar o lançamento"*. No documento ela vai **acima** da imagem, não abaixo:
expectativa se lê antes do resultado; embaixo viraria legenda, que é outra coisa. Ela também
manda no índice, na frente do trecho da narração.

Isso obrigou a mexer na acessibilidade da miniatura: ela era um `<figure role="button">`, e
um `<input>` dentro de `role=button` é controle dentro de controle — o leitor de tela anuncia
um e engole o outro. Agora o botão é um `<button>` de verdade e o campo é irmão dele, com o
foco devolvido ao mesmo elemento depois de cada renumeração.

**Modo "ata de evidência".** Item novo no seletor do passo 5. O prompt manda a IA escrever uma
linha do que foi feito e outra do resultado observado por passo, tratar a anotação como
expectativa, fechar com um parecer — e **não inventar aprovador nem número de chamado**.

**Impressão digital.** Caixa opcional. SHA-256 de cada imagem como ela está no documento, num
**anexo em lista** no fim do PDF (64 caracteres hexadecimais sob cada figura são ruído, e na
grade de 6 por página nem cabem) e sob cada imagem no `.docx`. O texto do anexo diz o que ela
prova e o que **não** prova: *"não é assinatura eletrônica e não atesta conformidade com norma
nenhuma"*.

**Saídas de máquina.** O `.json` ganhou o bloco `evidencia`, e cada quadro ganhou `passo`,
`horaDeRelogio` (ISO com fuso), `anotacao` e `sha256`. O `.zip` ganhou um `indice.txt` com a
identificação e a linha de cada figura — sem ele, um zip de evidência é uma pasta de JPEGs sem
passo, sem hora e sem anotação, que é exatamente o que a pessoa estava tentando não entregar.

**Verificação.** Suíte nova (`evidencia.mjs`, 30 asserções) que abre o PDF descomprimindo os
streams, o `.docx` e o `.zip` lendo as entradas, e o `.json`. Mais a regressão inteira:
`a11y`, `saidas`, `idiomas`, `dobra`, `curta`, `linhas`, `semsom`, `preview` — zero falhas.

---

## Fontes

- O que uma evidência de UAT precisa conter para passar em ITGC —
  https://a2q2.com/itgc-user-acceptance-testing-uat-approval-good-documentation/
- Controles gerais de TI e SOX em ambiente SAP — https://onapsis.com/blog/mastering-sap-itgc-sox-compliance/
- Tricentis para SAP (automação de regressão, o vizinho grande) — https://www.tricentis.com/sap
- Comparativo Tosca × Worksoft Certify — https://www.peerspot.com/products/comparisons/tricentis-tosca_vs_worksoft-certify
