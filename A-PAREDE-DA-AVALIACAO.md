# A parede da avaliação de fornecedor

**22 de agosto de 2026.** Escrito depois da observação do Leandro: *"a questão
sempre foi a política de privacidade das empresas, e isso permitir não esbarrar
nessa parede"*.

## A tese, e por que ela reordena a fila

Para o comprador que a Trilha D escolheu — QA, consultoria de implantação, key
user, quem executa UAT — **o obstáculo não é preço nem recurso. É a avaliação de
fornecedor.**

O caminho normal de uma ferramenta que toca dado de teste é este: a pessoa acha
a ferramenta, gosta, e aí descobre que precisa de aprovação de segurança. Dado
de teste costuma ser cópia de produção; subir isso para um SaaS aciona revisão
de fornecedor, questionário, DPA, às vezes jurídico. São semanas. Na maioria das
vezes o processo não é negado — ele simplesmente **não acontece**, porque ninguém
tem tempo de conduzi-lo por uma ferramenta de R$ 149/ano.

O Walkstamp tem uma resposta arquitetural para isso, e ela não é um argumento de
marketing: **o vídeo não sai da máquina, então não há o que avaliar.** A página
já diz isso. O que ela não faz é dizer o que isso *significa para o processo* —
e é aí que mora a diferença entre uma boa frase e uma venda.

> Hoje a página vende **uma postura** ("nada sai do seu computador").
> O que o comprador precisa comprar é **um atalho** ("você não precisa abrir um
> processo de avaliação para usar isto").

São a mesma verdade. A segunda é a que tira seis semanas do caminho.

## O que o produto já tem — e é mais do que a página aparenta

Levantado no repositório, não suposto:

| peça | onde | o que ela resolve na avaliação |
|---|---|---|
| **Não precisa de conta** | o plano Free inteiro | a pessoa avalia **sem** o fornecedor ser cadastrado. Não há contrato, não há acesso a conceder, não há nada para o TI aprovar |
| **A versão offline** | `offline/walkstamp-offline.html` | o caso extremo: arquivo único, funciona sem rede. Um revisor pode escaneá-lo, versioná-lo e distribuí-lo internamente |
| **A conferência sem confiança** | `/seguranca`, seção *"Como conferir, sem precisar confiar em nós"* | desligue a internet e use — se funciona sem rede, não está mandando nada. É a prova que não depende da nossa palavra |
| **O DPA** | `src/site/dpa.pt.html`, gerado em PDF | o documento que o jurídico pede, pronto |
| **A tabela de suboperadores** | `/privacidade`, `<table id="suboperadores">` | a lista que **toda** avaliação pede: quem mais toca o dado |
| **A trava entre os dois** | `testes/terceiros.mjs` | o DPA lista exatamente os terceiros que a política conhece — e a régua reprova se divergirem. O documento assinado não pode dizer menos que a página |
| **A integridade da evidência** | `/verificar` | o outro lado da avaliação: o auditor conferindo que o documento não foi adulterado |

**A peça mais forte é a primeira, e é a menos explorada.** "Não precisa de conta"
está escrito como conveniência — *sem cadastro, sem instalação* — quando na
verdade é a frase que dissolve a parede: **não existe fornecedor a avaliar.**
Ninguém revisa um fornecedor que não recebe dado nenhum e com quem não há
relação contratual.

## Onde a parede ainda pega

Quatro buracos, e três deles têm conserto barato.

### 1. Os documentos da avaliação só existem em português

Este é o mais caro, e ele está catalogado como "falha de teste" — o que faz
parecer manutenção quando é receita parada:

```
privacidade.en: falta <table id="suboperadores">
privacidade.es: falta <table id="suboperadores">
privacidade.de: falta <table id="suboperadores">
privacidade.fr: falta <table id="suboperadores">
```

E o DPA existe só como `dpa.pt.html`.

O produto vende em cinco idiomas. **Os dois artefatos construídos especificamente
para o revisor de segurança existem em um.** Um comprador alemão que chega ao
ponto de pedir a lista de suboperadores — que é o ponto mais avançado do funil
que existe — encontra uma tabela que ele não lê, ou não encontra nada.

Vale dizer o que isso não é: não é falta de tradução de conteúdo de marketing.
É o único momento do processo em que **outra pessoa** — segurança, jurídico,
DPO — entra no fluxo, e ela entra lendo. A conversão inteira do plano pago passa
por ali.

### 2. O plano pago reintroduz a parede, e não há uma página que responda isso

O Free não tem conta. O Personal e o Team têm — e com conta vem banco, vem
retenção, vem o anexo opcional de sessão. A política já diz isso com honestidade
(foi corrigido nesta rodada: *"não há conta, não há banco, não há rastreamento"*
era verdade e tinha deixado de ser).

Mas o revisor que aprovou o Free vai reabrir o processo quando a equipe quiser o
Team. E aí ele precisa de uma resposta **específica sobre o plano pago**, que
hoje está espalhada entre a política, a página de segurança e o FAQ.

Falta uma página de uma tela: *"o que muda na avaliação quando você passa para o
plano pago"* — com o que a conta guarda, o que ela nunca recebe, retenção,
expurgo (90 dias, já com código atrás), e o DPA anexado.

### 3. Não há certificação, e a resposta a isso precisa estar escrita

Todo questionário pergunta SOC 2 / ISO 27001. A resposta honesta do Walkstamp é
boa e incomum: **não há o que certificar no caminho do dado, porque o dado não
percorre caminho nenhum.** A certificação atesta controles sobre dados que a
empresa processa; aqui a empresa não processa.

Mas essa resposta só funciona se estiver **escrita para quem preenche o
questionário**, com as palavras dele. Não escrita, ela vira um "não" na planilha
do revisor — e um "não" na linha de certificação mata mais negócio que preço.

### 4. A prova de que nada sai depende de a pessoa executá-la

*"Desligue a internet e use"* é a prova mais forte do produto e ela é **ativa**:
alguém precisa fazer. O revisor médio não vai. O que fecha esse buraco é uma
gravação curta de alguém fazendo — a aba de rede aberta, o Wi-Fi desligado, o
documento saindo. Trinta segundos que substituem uma página de argumento.

*(Isto se soma ao vídeo do fluxo pago que já está pendente na D0 — provavelmente
é a mesma gravação, com dois recortes.)*

## O que eu faria, na ordem

1. **Traduzir a tabela de suboperadores para os quatro idiomas** (0,5 d). É o
   único item do repositório que hoje reprova uma régua *e* bloqueia receita ao
   mesmo tempo. `terceiros.mjs` já sabe dizer quando ficou certo.
2. **O DPA nos cinco idiomas** (1–1,5 d). O gerador já existe e lê a identidade
   de `src/marca.json`; o que falta é o corpo traduzido e a trava do
   `terceiros.mjs` estendida aos cinco.
3. **A página "avaliação de fornecedor em uma tela"** (1 d), escrita para quem
   preenche questionário: sem conta no Free, o que a conta paga guarda, retenção
   e expurgo, suboperadores, ausência de certificação com o argumento
   arquitetural, e os dois documentos para baixar.
4. **Reposicionar a frase da home** (0,5 d, dentro da D0 que já existe): "sem
   cadastro" deixa de ser conveniência e passa a ser *"a avaliação de fornecedor
   não se aplica: não há fornecedor recebendo nada"*.
5. **Os trinta segundos com a rede desligada** — depende de você gravar.

Somados: **3–3,5 dias**, e eles atacam o ponto do funil onde o negócio morre
mais tarde e mais caro — depois de a pessoa já ter gostado.

## A ressalva

Nada aqui é aconselhamento jurídico, e a análise não afirma conformidade com
LGPD ou GDPR. O que ela afirma é o que o repositório demonstra: qual dado sai da
máquina, qual não sai, quem mais toca nele, e o que está escrito nos documentos
que vão assinados. A leitura legal disso é de quem tem OAB, e as páginas já
nomeiam os papéis (controlador/operador) sem esticar a afirmação.
