# Auditoria pendente — a página de preços

> **GERADO POR `build.py`. Não edite à mão.**
> Uma linha por promessa que os cartões e a comparação publicam: a frase,
> e o teste que a comprova — ou `sem teste`, com todas as letras.
> Onde está `sem teste`, **não quer dizer que não funcione**: quer dizer
> que nada no repositório reprova se parar de funcionar.

## Cartão — Crie a evidência (Free)

| A frase publicada | O teste |
|---|---|
| Evidência completa, com impressão digital e tarja de dado sensível | `evidencia.mjs` |
| Tudo processado no seu computador | **sem teste** — terceiros.mjs prova a lista de suboperadores, não o processamento local |
| Todos os formatos de saída | `saidas.mjs` |
| Link pré-configurado para colar no Jira, no Zephyr, no Xray ou no TestRail — é um endereço, não uma integração | `linkpage.mjs` |
| Sem conta para usar | **sem teste** |

## Cartão — Execute o seu roteiro (Personal)

| A frase publicada | O teste |
|---|---|
| Importe a planilha de casos de teste | `roteiro.mjs` |
| Abra cada caso já preenchido | `roteiro.mjs` |
| Devolva situação, data, executor e impressão digital na mesma planilha | `roteiro.mjs` |
| Guarde o seu padrão de documento e o seu cliente | `modelos.mjs`, `planos.mjs` |
| A sua marca no topo de todos os formatos | `marca.mjs` |

## Cartão — Coordene a rodada (Team)

| A frase publicada | O teste |
|---|---|
| Distribua e reatribua os casos do roteiro | `roteiro.mjs` |
| Acompanhe o que está pendente e quem está executando | `roteiro.mjs` |
| Padrão da equipe aplicado no documento de todo mundo | `modelos.mjs` |
| Assentos, convite, bloqueio e prazo de revogação | `licenca.mjs`, `convite.mjs` |
| Classificação e campo de emissor no documento | `emissor.mjs` |

## A comparação curta

| A linha | O teste |
|---|---|
| Criar a evidência | `evidencia.mjs` |
| Guardar o seu padrão e o seu cliente | `modelos.mjs` |
| Executar um roteiro de casos | `roteiro.mjs` |
| Atribuir e acompanhar quem executa | `roteiro.mjs` |
| Padronizar o documento da equipe | `modelos.mjs` |

---

**2 promessa(s) sem trava** de 20.

---

## As afirmações soltas da página — escritas à mão, e por quê

Estas moram dentro dos cinco `src/site/bodies/precos.<idioma>.html`, e não na
lista de dados do `build.py`. O gerador **não as gera**, e diz que não gera:
prometer gerar o que não se gera é o defeito que ele veio consertar.

O arquivo desta seção é `src/auditoria-solta.md`, e o `build.py` o cola aqui a
cada build. Editar o `AUDITORIA-PENDENTE.md` não adianta — ele é reescrito.

| A frase publicada | O teste |
|---|---|
| Vídeo, áudio e transcrição não saem do seu computador | `precos.mjs` prova que **a página** não chama a rede; **sem teste** para a ferramenta |
| Cobrança anual, renova sozinha, cancela na conta | **sem teste** |
| A partir de 3 pessoas, e o total mínimo anual | `precos.mjs`, `cinco.mjs`, `promessa.mjs` — o número sai de `lib/stripe.ts`, e desde o Build 4 o `build.py` o lê de lá em vez de repetir |
| As suas colunas voltam como estavam | `roteiro.mjs` |
| Nenhum número da calculadora sai do navegador | `precos.mjs` |
| Os formatos abrem em Word, PowerPoint, navegador e LMS | `saidas.mjs`, `figuras.mjs` (a tira), `pptx.mjs`, `scorm.mjs` |
| É um endereço, não uma integração automática | **sem teste** — mas é uma negação, e negação que se cumpre sozinha |
| A licença é conferida no seu computador e funciona sem internet | `licenca.mjs`, `licauto.mjs` |
| Revogar respeita o prazo de 1 a 90 dias | `licauto.mjs` |
| A nota fiscal vem depois do pagamento, pela Stripe | **sem teste** |
| A quantidade de assentos é ajustável | **sem teste** |

## O que continua pendente, e onde ele está agora

**Duas funcionalidades publicam com selo, e não como prontas.** Três linhas de
`src/features.json` carregam `estado`: duas em `construcao` (a lista de termos
guardada, que hoje mora em `sessionStorage` e morre com a aba) e uma em `beta`
(entrada automática por domínio de e-mail). Elas aparecem **só dentro da lista
completa recolhida**, nunca num cartão — `precos.mjs` cobra que nenhum selo
apareça nos cartões. A decisão continua sua: ou as três passam a existir de
verdade, ou o selo fica.

**O clique de compra não leva a intenção consigo.** Quem clica "Assinar o Team"
chega à conta e escolhe de novo. O piso de 3 assentos já é recusado no servidor
(`app/conta/acoes.ts`, saindo de `PLANOS[plano].assentos`), então ninguém compra
1 ou 2 — o que falta é a ponte. É o primeiro item do **Build 5**, em `FILA.md`.

**`npm run stripe:conferir` nunca rodou.** Sem `STRIPE_SECRET_KEY` no ambiente,
e ele recusa chave de produção, que é o comportamento certo. Falta confirmar com
a chave de teste que o preço do Team continua `per unit`: em `tiered` ou
`volume`, comprar 12 assentos cobra por 1. É a **DEC-14**, represada por sua
instrução.

**O vocabulário do domínio não fala alemão nem francês.** Achado no Build 4 pela
`tabelas.mjs`. É a **DEC-17**.

> Resolvidos e tirados desta lista: o vídeo `/demo/rodada.*` que dava 404 nos
> cinco idiomas (a figura de quatro estados entrou no lugar), o bloco de apoio
> em Pix, a lista de aviso do plano pago (Build 3, DEC-16), e a bala do cartão
> Personal que vendia o vocabulário guardado — a metade que não existe — sem
> mencionar a que existe e é gratuita. O motivo desta última está escrito no
> `build.py`, em cima da bala, porque é o tipo de erro que volta.

