# Build 55 — a CSP estava relatando para ninguém

## O defeito

A política entrou em `Report-Only` em 24/08 com a intenção escrita no
`next.config.mjs`: *"ela não barra nada: o navegador confere e AVISA"*.

Medido em 02/09: **não havia `report-uri` nem `report-to`.** O navegador
conferia, montava o aviso e jogava fora, porque não havia para quem mandar.

Uma semana de produção que devia ter virado dados virou trabalho de CPU na
máquina dos outros. E a segunda metade da DEC-12 — travar — dependia justamente
desses dados para não ser aposta: a régua `csp.mjs` não alcança o caminho da
transcrição, porque a CDN do modelo não é acessível da máquina onde ela roda.

## O que passou a existir

`/api/csp`, nos **dois** formatos que os navegadores mandam — o antigo
`application/csp-report`, com chaves separadas por hífen, e o novo
`application/reports+json`, um array de `{type, body}` em camelCase. Aceitar só
um perde metade dos navegadores, e a metade que falta é sempre a que tinha a
resposta.

Na política, os dois nomes (`report-uri` e `report-to`) mais o cabeçalho
`Reporting-Endpoints` — porque `report-to` é só um **nome**, e sem o cabeçalho
ele não aponta para lugar nenhum. E o navegador não avisa que não avisou.

## O desenho vem de a rota ser aberta por natureza

Quem escreve nela é o navegador de qualquer pessoa, sem sessão, e sem que a
nossa página tenha pedido — o aviso nasce do próprio navegador quando algo é
barrado. Então **não dá para exigir origem** como o convite e o chamado exigem:
o `Origin` de um relatório é a página que violou, e barrá-lo recusaria
justamente os avisos que interessam.

Sobram as travas que não dependem de saber quem é:

- **corpo de no máximo 16 KB**, recusado sem ser lido;
- **só os campos conhecidos**, truncados — e o banco corta de novo, porque quem
  chama não é de confiança;
- **agregação** por (diretiva, barrado, origem), com um contador. Provado no
  banco: **mil avisos iguais viram uma linha com `vezes = 1000`**. Sem isso, um
  site que embutisse o nosso numa moldura encheria a tabela em minutos;
- **limite por quem manda**, com o mesmo hash com sal do chamado.

## A lição, e ela ficou escrita na régua

Mandei os dois formatos contra o servidor local e recebi **204 nos dois**. O
banco continuou **vazio** — o servidor tinha subido sem chave de serviço.

A rota responde 204 mesmo quando não guarda, e isso é deliberado: um navegador
não faz nada com um erro nosso, e um 429 aqui só encheria o console de quem
visita. Mas quer dizer que **"deu 204" e "guardou" são perguntas diferentes**, e
o status nunca responde a segunda.

Por isso a régua olha as **gravações**, não a resposta — e o bloco [2] diz isso
na própria linha: *"e GRAVOU — que é outra pergunta que o 204 não responde"*.

## E um verde que não valia nada, meia hora antes

A primeira rodada fechou verde com **20 réguas** — e a `csprelato.mjs`, que é a
régua que este build inteiro existe para criar, **não estava entre elas**.

O Build 51 travou o diff **vazio**. Mas a esteira roda o `build.py` antes de
tudo, e ele reescreve o carimbo de hora, o `app.html` e o pacote offline. Um
build já comitado não aparece com zero arquivos: aparece com **três**, todos
gerados pela própria esteira. A trava não pegou porque o diff não estava vazio —
estava cheio do que ela mesma acabara de escrever.

Agora um diff só de artefato é recusado igual ao vazio, dizendo o que aconteceu:
*"é o rastro de quem já comitou antes de rodar"*. Provado nos quatro casos: só
artefatos recusa, vazio recusa, artefatos mais um arquivo de verdade segue,
produto sozinho segue.

## Esteira

`bash testes/liberar.sh HEAD~2` — **29 de 173**, verde, com a `csprelato.mjs`
entre elas. A base é `HEAD~2` porque o container reiniciou no meio do build e eu
comitei para não perder o trabalho; rodar contra `HEAD` mediria o rastro do
próprio commit.

## O que isto destrava

Publicado, os relatórios começam a chegar. Em alguns dias a tabela responde o
que a régua não alcança daqui — inclusive o caminho da transcrição — e **travar
a CSP deixa de ser aposta**. É a segunda metade da DEC-12, agora com dado.
