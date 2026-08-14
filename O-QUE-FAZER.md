# O que fazer com o mapa dos concorrentes

Escrito em 14/08/2026, depois de "avalie dos concorrentes o que podemos fazer".
Complementa o `CONCORRENTES.md`: lá estão os fatos, aqui estão as decisões.

---

## O quadro em uma frase

Existe um concorrente muito bom no que você quer fazer (**FlowShare**), um andar de cima caro
demais para o seu público (**Tosca, qTest, Worksoft, Panaya**), um bairro cheio que não fala a
sua língua (**Scribe, Tango, Guidde**), e **duas ferramentas morrendo ao mesmo tempo** deixando
gente órfã com uma tarefa que continua obrigatória.

A briga não é de funcionalidade. É de **atrito**. E é a única briga que você tem chance de
ganhar sem dinheiro.

---

## As cinco jogadas, em ordem

### 1. A fala vira a anotação do passo — *pequeno, e é a jogada da casa*

Hoje o produto já transcreve o que você fala enquanto testa. Mas essa fala sai numa coluna
separada do documento, embaixo da imagem, como narração. **Ela deveria virar o rascunho da
anotação do passo** — o campo que o auditor lê.

Um botão no passo 4: *"usar a fala como anotação"*. Ele preenche a anotação de cada quadro com
o que foi dito naquela janela, e a pessoa corrige o que precisar. O pareamento imagem/fala já
existe no código (`falaDoFrame`); é ligar uma coisa na outra.

**Por que esta é a primeira:** é o único movimento que **nenhum concorrente pode copiar sem
mudar de arquitetura**. O FlowShare não escuta. O Scribe não escuta. O Tosca não escuta.
Você fala o teste em voz alta uma vez e sai um documento escrito — isso não é uma feature a
mais na lista, é a razão de existir.

E resolve o problema real: digitar quarenta anotações depois é tão chato quanto colar quarenta
prints, que é exatamente a dor que o produto promete matar.

### 2. Pegar os órfãos do Steps Recorder — *médio, e é o canal mais barato que existe*

O `psr.exe` está descontinuado desde fevereiro de 2024. A Microsoft manda usar Ferramenta de
Captura, Xbox Game Bar ou Clipchamp — **nenhuma produz documento de passos.** Tem gente
procurando substituto hoje, com uma tarefa que continua obrigatória, e ninguém respondendo bem.

Uma página `/substituto-do-steps-recorder` nos três idiomas, respondendo à pergunta que a
pessoa digita: *"Steps Recorder descontinuado"*, *"psr.exe alternativa"*, *"Steps Recorder
replacement"*, *"gravador de etapas Windows 11"*.

Do lado SAP, o mesmo movimento com data marcada: o **Solution Manager Test Suite sai da
manutenção principal no fim de 2027**, e o sucessor Cloud ALM pede screenshot anexado à mão.
Quem está planejando essa migração agora tem um buraco de evidência e sabe disso.

Isto é conteúdo, não código, e é o seu terreno — arquiteto SAP escrevendo sobre evidência de
teste é alguém falando do que faz.

### 3. Um layout "evidência", que se pareça com o que a pessoa já entrega — *pequeno*

Hoje os layouts são "sequência com a fala" e "grade de 6 por página". Falta o formato que a
pessoa já monta à mão no Word e que o Steps Recorder produzia: **um passo por bloco, numerado,
com a descrição em cima e a imagem embaixo**, sem a coluna de narração.

Quanto mais o documento se parecer com o que ela já entrega, menor a conversa interna sobre
"mudamos de ferramenta". Custo de troca zero é uma feature.

### 4. Parar de fazer a pessoa redigitar quem ela é — *pequeno*

Você faz cinco casos de teste seguidos e digita "Leandro B. de Oliveira / S4P / 100" cinco
vezes. O FlowShare lembra. Nós, de propósito, não guardamos nada.

Dá para resolver **sem quebrar a promessa**: `sessionStorage` morre quando a aba fecha, então
"não persiste entre visitas" continua verdadeiro ao pé da letra. A alternativa mais
conservadora é um par exportar/importar do perfil da evidência num arquivinho — mais atrito,
zero dúvida.

Eu iria de `sessionStorage` **com uma linha na política dizendo exatamente isso**. A promessa
só vale se for descrita com precisão, e "nada sobrevive ao fechar a aba" é uma promessa mais
forte do que a maioria dos concorrentes consegue fazer.

### 5. Um verificador de integridade — *médio, e pode esperar*

O SHA-256 hoje é uma lista impressa no anexo. Uma página que recebe o `.zip` ou o `.json`,
recalcula os hashes e responde *"as 12 imagens conferem"* transforma a lista em **ferramenta**.
Roda no navegador, como o resto, e funciona offline.

Nenhuma ferramenta pequena tem isso. Mas só vale depois que alguém estiver usando de verdade —
é credibilidade, não aquisição.

---

## O que NÃO fazer

**Não fazer aplicativo de desktop.** É a tentação óbvia depois de ler sobre o FlowShare, e
seria trocar a única vantagem estrutural que você tem — zero instalação — por paridade numa
disputa que você ainda perderia. Numa estação SAP travada por política, "instale este programa"
é um projeto com dono, aprovação e prazo; "abra este endereço" é um clique.

**Não perseguir o SAP GUI for Windows.** É a limitação honesta, ela existe, e ela encolhe todo
ano enquanto a SAP empurra todo mundo para Fiori. Melhor escrever isso na página do que deixar
a pessoa descobrir depois de gravar quarenta minutos.

**Não subir para o enterprise.** Tosca e qTest são outro comprador, outro ciclo de compra e
outra briga — automação de regressão, não evidência de teste manual. Chegar lá custa uma
equipe de vendas que você não tem.

**Não adicionar nuvem, conta ou compartilhamento.** Apagaria o argumento inteiro. Todo
concorrente barato já é nuvem; o que te diferencia é justamente o que eles não podem desfazer.

**Não prometer conformidade.** Nem 21 CFR Part 11, nem SOX, nem CSV. A frase que se pode dizer
com verdade já está no documento: *"produz a evidência visual; a trilha de aprovação continua
no seu sistema de mudanças"*.

---

## Preço, quando houver tráfego

Não agora — com zero tráfego, decidir preço é chutar. Mas o mapa dá o desenho:

O **Folge a €75–130 pagamento único** prova que existe disposição a pagar por uma ferramenta
**local**. O **FlowShare a €450/ano por pessoa** é o teto do mercado que interessa. Entre US$ 89
único e US$ 19 mil/ano não há nada — um vácuo de ~200×.

Quando fizer sentido, o lugar é claro: **cinco a dez vezes abaixo do FlowShare**, com o
argumento "sem instalação, sem aprovação, sem enviar nada". A camada gratuita continua sendo o
canal.

---

## A ordem que eu seguiria

| | o quê | esforço | por quê agora | estado |
|---|---|---|---|---|
| 1 | Fala → anotação do passo | pequeno | é o que ninguém pode copiar | **feito** |
| 2 | Página do substituto do Steps Recorder (+ ângulo SolMan 2027) | médio | demanda existente, sem resposta | **feito**, com a página de segurança junto |
| 3 | Layout "evidência", um passo por bloco | pequeno | custo de troca zero | **feito**, dentro do modelo de saída |
| 4 | Guardar o perfil da evidência na aba | pequeno | tira o atrito que o concorrente não tem | pendente |
| 5 | Verificador de integridade | médio | credibilidade, depois do uso | pendente |

Sobrou o item 4 (guardar o perfil da evidência na aba) e o 5 (verificador de integridade).

E antes dos dois: **publicar o que já está pronto.** As features de evidência, o modelo de saída
e as duas páginas novas estão construídos e testados, e não estão no ar.

---

## A página de segurança — a ideia que faltava (14/08/2026)

A sugestão de *"uma página para falar da segurança da informação e das certificações que
faltam"* fechou um buraco que nem o `CONCORRENTES.md` tinha visto.

A avaliação de fornecedor numa empresa segue uma lista que **pressupõe que o fornecedor recebe
alguma coisa**: onde ficam os dados, quem tem acesso, qual a certificação, qual o contrato de
tratamento. O Walkstamp não recebe nada — mas quem faz a avaliação não tem como saber disso sem
uma página que explique, e sem essa página a resposta padrão para "não tem ISO 27001?" é não.

A página faz três coisas, e a terceira é a que quase ninguém faz:

**Explica por que a pergunta muda de forma.** Não há dado nosso para proteger, porque o
processamento inteiro é na aba do navegador.

**Ensina a conferir sem confiar em nós.** `F12` → aba Rede → carregue um vídeo de vários
gigabytes → os bytes enviados continuam em zero. Um teste que a equipe de segurança do cliente
executa vale mais que qualquer selo, e leva menos tempo que ler a página. Junto vem a versão
offline, cujo build **falha** se sobrar endereço de medição dentro — trava de processo, não
promessa.

**Lista o que não temos, com o porquê de cada uma.** ISO 27001, SOC 2, 21 CFR Part 11, CSV/GAMP
5, SOX/ITGC, acordo HIPAA, relatório de pentest, seguro cibernético — todos "não", cada um com a
explicação de por que se aplica ou não a uma ferramenta que não recebe dados. E onde a decisão é
do cliente, a página diz que é do cliente, em vez de tranquilizar.

Essa lista parece um tiro no pé e é o contrário: quem avalia fornecedor está acostumado a
perguntar três vezes para descobrir o que falta. Uma página que já entrega a resposta muda o
tom da conversa inteira — e é coerente com o resto do produto, que também não promete
conformidade.

Junto saíram um `sitemap.xml` e um `robots.txt` com hreflang por idioma: a página do Steps
Recorder só serve se for encontrada.

---

## O modelo de saída — a ideia que amarrou tudo (14/08/2026)

A pergunta *"não poderíamos ter nossos casos de uso no modelo de saída?"* resolveu um problema
que os itens 1 e 3 sozinhos não resolviam.

O produto já sabia fazer quatro documentos diferentes, mas essa capacidade estava **espalhada em
quatro controles**: o layout num seletor perto do botão de PDF, o objetivo do prompt em outro
cartão, os dados da evidência num terceiro lugar, e o nome do arquivo em lugar nenhum. Para
chegar num documento de evidência decente a pessoa tinha que descobrir e combinar os quatro. Na
prática, ninguém descobriria.

Agora é **uma escolha só, no topo do cartão 4**, com quatro casos de uso:

| modelo | layout | dados da evidência | hora de relógio | prompt | arquivo |
|---|---|---|---|---|---|
| **Contexto para IA** (padrão) | automático | fechado | se souber | resumir | `analise-` |
| **Evidência de teste** | sequência | **aberto** | sim | ata de evidência | `evidencia-` |
| **Passo a passo** | sequência | fechado | **não** | passo a passo | `passo-a-passo-` |
| **Ata de reunião** | grade compacta | fechado | se souber | ata | `ata-` |

Três decisões que valem registrar:

**O padrão não mudou.** Quem abre e não mexe em nada continua recebendo o documento genérico de
sempre. Um seletor novo que muda a saída por baixo seria uma armadilha.

**O passo a passo não carimba hora.** Num tutorial, "2026-08-14 12:58:46" no título do passo é
sujeira — ninguém quer saber quando o autor gravou. A hora é dado de evidência, e só aparece
onde é evidência. O mesmo vale para a linha "Início da gravação" na primeira página.

**A anotação muda de papel conforme o modelo.** Na evidência ela é a *expectativa* e fica numa
linha própria acima da imagem, porque expectativa se lê antes do resultado. No passo a passo ela
é o *título* do passo, porque título não mora embaixo do próprio conteúdo. É a mesma caixinha
de texto produzindo dois documentos diferentes.

E os quatro controles antigos continuam lá, para quem quiser desviar do padrão do modelo. O
modelo os configura; ele não os tranca.
