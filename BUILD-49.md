# Build 49 — o vocabulário fica guardado, se a pessoa pedir *(DEC-5, caminho A)*

## O que existia

Duas linhas do catálogo vendiam isto com selo de **"em construção"**: a lista de
termos do sistema volta na próxima visita, em qualquer máquina. Medido:
`vocLista` morava em `sessionStorage` e morria com a aba.

## Por que é opt-in, e desmarcado

A lista carrega **termos do seu cliente**: nome de sistema, de produto, de
projeto, código de transação. Não é conteúdo de gravação, mas em muita empresa o
nome do projeto é justamente o que está sob confidencialidade. Guardar isso no
nosso servidor sem a pessoa pedir contraria a única coisa que este produto
vende — que o que é seu não sai da sua máquina.

Então: **caixa desmarcada por padrão**, uma frase que diz o que acontece ao
marcar, e **desmarcar apaga o que estava guardado** — "pare de guardar" e
"esqueça o que guardou" são a mesma frase para quem se arrepende. Sem plano
pago o controle nem aparece: a lista continua vivendo na aba, e um controle que
não faz nada é pior do que controle nenhum.

**Duas colunas e não uma.** `voc_guardar` é a escolha e existe separada do
texto: quem marca e depois apaga a lista continua tendo marcado. Uma coluna só
faria a escolha sumir junto com o conteúdo.

**Mora no `usuario`, não na `config`.** A `config` é da empresa e o
administrador empurra para todo mundo; o vocabulário é de quem trabalha naquele
sistema. Na `config`, o termo de uma pessoa apareceria na ferramenta de outra.

## Aplicado e medido no banco

Migração aplicada no Supabase e provada lá mesmo, seis afirmações num bloco só:
sem marca não guarda · com marca guarda · o perfil devolve · o `meus_dados`
conta · o apagar leva · sem conta recusa com `sem_conta`.

`walkstamp-meus` **version 3** no ar, com a primeira escrita da função. Ela veio
para cá e não para uma rota do Next pelo mesmo motivo do `modelo`: a sessão da
ferramenta chega no **fragmento** do link mágico e nunca alcança servidor
nenhum, então não há cookie para uma rota ler.

## O erro que eu cometi, e que a régua pegou

Para acrescentar o vocabulário eu reescrevi o `perfil_do_usuario` — e parti da
versão de **16/08**, não da atual. Com isso **perdi o filtro `dono_email`**, que
tinha entrado em 24/08 para fechar um vazamento: o modelo pessoal de uma pessoa
aparecia para o time inteiro. **Isso chegou a ir para produção.**

A `modelopessoal.mjs` reprovou — `e o WHERE filtra por dono_email → o select
traz a tabela inteira do cliente`. O filtro voltou ao disco e ao banco, e a
correção está medida contra o banco de verdade: B não vê o modelo pessoal de A,
continua vendo o do time, e A não perde o próprio.

A lição está escrita dentro da migração: **reescrever uma função é herdar tudo o
que ela aprendeu.** Sem isso um conserto antigo volta de carona numa mudança que
não tem nada a ver com ele.

## A página que dizia "tudo o que guardamos de você" tinha lista própria

As cinco linhas da tabela estavam escritas uma a uma. O vocabulário novo
simplesmente **não apareceria** — na página que existe justamente para não
esconder nada, e sem nada reprovar.

Agora ela percorre o que o `meus_dados` devolveu, com um mapa de rótulos ao
lado. **Chave sem rótulo sai crua**, e é de propósito: linha feia alguém
conserta, linha que some não aparece para ninguém. A régua manda uma chave que a
tela nunca viu (`coisaNovaDoBanco: 9`) e cobra que ela apareça.

## A `resumo.mjs`, que falhava antes deste build

Ela reprovava também no build anterior ao meu — então não era contenção, era a
régua. Ela esperava a lista de quadros **parar de crescer** (seis leituras
iguais, 1,2 s). **Imobilidade não é fim: é o intervalo entre dois quadros visto
de fora.** Nesta máquina a varredura ficava parada em 3 por mais de 1,2 s, o
bloco seguia, e dois quadros chegavam durante os blocos seguintes — a premissa
caía três passos adiante.

Agora ela pergunta ao produto: `window.__trabalhos()` diz se a `varredura` ainda
corre. Acabou a aposta na velocidade da máquina.

## Provas por falha

- tirando o opt-in (mandar sempre): `FALHA desmarcada, digitar não manda a lista
  para lugar nenhum → 0 → 1`;
- a `modelopessoal.mjs` pegou o vazamento que eu mesmo reintroduzi.

## Esteira

`bash testes/liberar.sh` — **89 de 171**, verde.

## O catálogo agora

**Zero linhas em `construcao`.** Sobra um único item com estado no catálogo
inteiro: `dominioAutomatico`, em `beta` — funciona, mas quem cadastra o domínio
somos nós. É o Build 50.

## A seguir

**Build 50** — a entrada automática por domínio sai do `beta`: o administrador
cadastra o domínio dele sozinho, na conta. E, por ser múltiplo de cinco, a
esteira **completa** (`rodar.sh`) roda nele.
