
### A etiqueta do plano saiu do cabeçalho (mesma rodada)

Ela era a última peça que ainda fazia o menu da ferramenta ser diferente do das
outras telas: um botão a mais, de largura variável — o nome do cliente vai
dentro dele —, no meio de um menu que passou a ser o mesmo em toda parte. Uma
moldura igual em quatro telas que ganha uma peça só numa delas volta a ser
quatro molduras.

Ela foi para a **barra lateral, uma linha abaixo do e-mail**: é lá que a
pergunta "em nome de quem estou vendo isto" já é respondida, e é lá que o painel
da conta também a responde. E lá ela não repete o nome do cliente — o e-mail
está uma linha acima —, então diz só **"Plano Team"**, com as mesmas palavras
que o painel usa.

Ela continua sendo **botão**, e não texto: clicar abre a caixa da licença, que é
onde se troca a chave e se vê o cliente. Era o que a etiqueta do cabeçalho
fazia, e o caminho não podia sumir junto com ela.

**Duas fontes, uma regra de desempate.** O servidor sabe o que a CONTA tem
(`/api/menu` passou a devolver o rótulo pronto); a licença guardada sabe o que
foi ATIVADO nesta máquina. Elas discordam no caso normal do primeiro dia — chave
de Time colada num navegador cuja conta ainda não virou Time. Ganha o que está
ativo aqui: dizer "Plano Free" ao lado de recursos de Time destravados seria a
tela contradizendo a si mesma.

O `testes/barraapp.mjs` tem uma lista fechada dos campos que `/api/menu` pode
devolver — ela existe para que uma entrada nova seja uma decisão, e não um
descuido. `plano` entrou por ali: é da mesma classe do `email`, o que a pessoa
já lê no primeiro parágrafo da própria conta, e viaja como **rótulo**, sem
`motivo`, `vence_em` ou `assinante` junto.

### E o blog era a QUARTA casca

O menu do blog não tinha o próprio blog. Faltar justo ali é o pior dos casos:
quem está lendo um post não tem como voltar para a lista sem o botão de voltar
do navegador. A régua passou a medir as quatro telas — site, ferramenta, conta e
blog — e as quatro batem: logo em x=272, menu terminando em 1168, cabeçalho e
rodapé de 940.
