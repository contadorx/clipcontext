# A regressão

96 arquivos que afirmam coisas sobre o produto. Cada um roda sozinho com
`node <arquivo>.mjs` e sai com código 1 se alguma afirmação cair.

## Primeiro uso, depois de abrir o zip

```bash
bash testes/preparar.sh      # aponta os testes para onde o projeto está
```

Sem isso eles procuram o projeto em `/root/cc/walkstamp`, que é onde nasceram.
Ele também gera os **vídeos de amostra** que sete testes carregam de `/tmp`
(`amostra`, `cinco`, `retrato`, `so-relogio`) com `testes/amostras.py`. Eles não
viajam no zip por peso, e sem eles a esteira acusava `ENOENT` — que na saída é
indistinguível de defeito do produto.

Um oitavo é opcional e pesado, e por isso não é gerado sozinho:

```bash
python3 testes/amostras.py --longo    # 1 hora de vídeo, ~1 min, 8 MB
```

Ele alimenta `varredura.mjs`, que mede a varredura do passo 2 em material de
verdade. Sem ele, o teste **pula dizendo isso** em vez de falhar.

## O que NÃO roda a partir do zip

Três testes de licença (`licenca`, `liclink`, `licauto`) e um bloco do
`semmarca` precisam de `emitir-licenca.py` e de `PLANO-TIME.md`, que guardam as
chaves privadas e **não podem** viajar no pacote. Eles pulam, dizendo por quê.
Rode-os na máquina onde o emissor vive.

## As duas esteiras

```bash
bash testes/rapido.sh app      # a ferramenta: build + testes de tela   (~3 min)
bash testes/rapido.sh site     # o site: build + next build + páginas
bash testes/rapido.sh a.mjs b.mjs
bash testes/rodar.sh           # a regressão inteira                    (~40 min)
```

`rodar.sh` sobe um Next de verdade na 8802 antes de começar, porque sete testes
falam com ele em vez de ler `public/`.

## Antes de entregar um zip

O pacote é montado **de dentro** da pasta do projeto, nunca da pasta acima —
montado de fora, os padrões de `naovai.txt` não casam com o prefixo e as chaves
privadas vão junto. Já aconteceu.

```bash
cd <raiz do projeto>
zip -qr /tmp/walkstamp.zip . -x@testes/naovai.txt
```

Depois **confira**, não confie: `emitir-licenca.py`, as duas chaves privadas,
`node_modules`, `.next`, `.env` e `PLANO-TIME` têm que contar zero.

## Por que eles moram aqui

Moravam em `/tmp`. O zip entregue não levava teste nenhum: quem abrisse o pacote
recebia o produto sem a rede que prova que ele funciona, e qualquer sessão nova
começava sem saber o que já estava garantido. Um teste que não viaja junto com o
código é um teste que existe uma vez só.
