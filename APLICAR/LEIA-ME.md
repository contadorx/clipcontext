# O que há nesta pasta

> **Os `.bundle` NÃO viajam dentro do zip — 23/08.**
> O pacote passou de 30 MB e não coube na entrega. O bundle é a mesma árvore
> outra vez, comprimida com a história junto: mandá-lo dentro do zip é mandar o
> projeto duas vezes. Ele vai **separado**, ao lado do zip, e este arquivo
> continua aqui explicando o que fazer com ele.
> Se você recebeu só o zip e quer a história, peça o bundle.

Dois bundles de git. Cada um traz commits com as mensagens inteiras, para quem
prefere aplicar a HISTÓRIA em vez de copiar a árvore por cima.

A árvore crua vem no zip do lado, já construída — `public/app.html` e
`offline/walkstamp-offline.html` estão gerados, e `src/precos.json`,
`src/figuras.json`, `src/rotas.json` e `src/marca.json` também. Para subir o
site não é preciso rodar `build.py`. Copiando a árvore, porém, a história se
perde.

Não vêm junto, porque se regeneram ou são enormes: `.git/`, `node_modules/`
(`npm install`) e `.next/` (`npm run build`).

---

## `builds-1-a-4.bundle` — a rodada de 23/08

**Base:** `7c90a97` (o `main` do GitHub, de 19/08).
**Traz:** oito commits.

1. **Sincroniza a árvore interna com o deploy de 22/08.** O repositório estava
   três dias atrás da árvore publicada na Vercel. 267 arquivos, nenhuma
   correção de defeito — é só o sincronismo.
2. **Build 1 — o chão.** As duas migrações novas, a régua rodando fora de uma
   máquina só, o vazamento do service worker, o curinga do convite, o
   middleware nos cinco idiomas, o offline que telefonava sozinho, e nove
   frases falsas fora do ar nos cinco idiomas.
3. **A pista de liberação**, mais as três réguas que ainda mentiam.
4. **Build 2 — não perder trabalho**, e a esteira de 70 para 12 minutos.
5. O bundle passa a trazer os dois builds.
6. **Build 3 — a esteira honesta**, mais as três decisões respondidas:
   a captura da lista sai, os 14 dias são anunciados, a Stripe fica para o fim.
7. **Build 4 — listas paralelas.** A tira de formatos passa a sair do catálogo
   (13 selos escritos à mão ao lado de 15 no catálogo), o mínimo do Team passa a
   ser lido de `lib/stripe.ts`, o `AUDITORIA-PENDENTE.md` passa a ser gerado, e
   uma régua nova varre o produto atrás de tabela de idioma incompleta — achou
   três, entre elas o OCR que lia a tela do cliente alemão com o modelo inglês.

Os relatórios estão em `BUILD-1.md`, `BUILD-2.md`, `BUILD-3.md` e `BUILD-4.md`,
na raiz. A fila dos próximos e as decisões abertas estão em `FILA.md`.

```bash
git fetch APLICAR/builds-1-a-4.bundle \
  claude/builds-deploys-sequence-0fatlg:claude/builds-deploys-sequence-0fatlg
git checkout claude/builds-deploys-sequence-0fatlg
```

> **Por que ele existe.** O push não passou: o proxy de git desta sessão
> respondeu `GitHub authentication required. Please reconnect your GitHub
> account.` — é a conexão do GitHub da conta, e não o repositório. Depois de
> reconectar em claude.ai → Configurações → Conectores, o push vai direto e
> este arquivo deixa de ser necessário.

---

## `rodada-precos.bundle` — a rodada de 22/08

**Base:** `7c90a97`. **Traz:** os seis commits da rodada de preços, que já estão
incluídos no commit 1 do bundle acima. Fica aqui como registro; quem aplicar o
`builds-1-a-4.bundle` não precisa dele.

```bash
git fetch APLICAR/rodada-precos.bundle \
  claude/relaxed-sagan-mnycup:claude/relaxed-sagan-mnycup
```

---

## Para rodar

```bash
npm install
npm run build            # python3 build.py && next build

# a pista de liberação: libera um build          (~1-3 min)
bash testes/liberar.sh

# a regressão inteira: libera uma entrega        (~12 min, 3 de cada vez)
bash testes/rodar.sh
```

A regressão sai com **140 ok · 4 PULADO · 0 FALHOU** de 144 réguas. Um pulado
**não conta como cobertura**, e o motivo de cada um sai impresso: três por falta
do emissor de chaves — que não viaja no pacote, de propósito —, e um pela
tradução jurídica pendente de alemão e francês.

O `testes/preparar.sh` gera as amostras de vídeo que sete testes consomem. Ele
precisa de Pillow e de um `ffmpeg` completo — a build mínima que vem com o
Playwright **não serve**, e `testes/amostras.py` agora diz isso pelo nome em vez
de falhar com "arquivo não encontrado".
