# O que há nesta pasta

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

## `builds-1-a-3.bundle` — a rodada de 23/08

**Base:** `7c90a97` (o `main` do GitHub, de 19/08).
**Traz:** seis commits.

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

Os relatórios estão em `BUILD-1.md`, `BUILD-2.md` e `BUILD-3.md`, na raiz. A fila dos próximos e as
decisões abertas estão em `FILA.md`.

```bash
git fetch APLICAR/builds-1-a-3.bundle \
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
`builds-1-a-3.bundle` não precisa dele.

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

# a regressão inteira: libera uma entrega        (~70 min)
bash testes/rodar.sh
```

O `testes/preparar.sh` gera as amostras de vídeo que sete testes consomem. Ele
precisa de Pillow e de um `ffmpeg` completo — a build mínima que vem com o
Playwright **não serve**, e `testes/amostras.py` agora diz isso pelo nome em vez
de falhar com "arquivo não encontrado".
