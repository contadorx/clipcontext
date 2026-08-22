# Como gerar a entrega

Arquivos ZIP não são versionados neste repositório. Eles são binários, não
produzem um diff revisável e algumas esteiras de revisão recusam esse tipo de
arquivo. O pacote de entrega deve ser gerado a partir do commit que será
publicado:

```bash
bash testes/empacotar.sh /tmp/walkstamp-latest.zip
```

O empacotador monta o projeto a partir da raiz e audita tanto os arquivos
obrigatórios quanto a ausência de credenciais, `.env`, `.git`, `.next`,
`node_modules` e outros conteúdos que não podem viajar.

Depois de gerar, descompacte o arquivo e envie **a raiz inteira** à Vercel. Não
publique apenas a pasta `public/`, pois as configurações do Next.js e da Vercel
também ficam na raiz.
