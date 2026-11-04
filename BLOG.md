# O blog

Arquivos no projeto, publicados no site, em português e inglês, sempre os dois.

- **Endereços:** `/blog`, `/en/blog`, `/es/blog`, `/de/blog`, `/fr/blog`.
- **Onde mora:** `conteudo/blog/` (texto) e `public/img/blog/` (figuras).

> **Desde o Build 70.** Até o Build 69 o blog morava no Supabase e era escrito
> num editor em `/conta/negocio/blog`. Com o Supabase saindo, os 8 posts foram
> copiados para cá:
>
> - os 16 textos foram conferidos byte a byte contra o banco. A cópia saiu com
>   MD5 verificado, e só mudaram a quebra de linha (`\r\n` → `\n`) e os dois
>   endereços de figura dentro do corpo;
> - as 9 figuras são baixadas com o MD5 que tinham no balde.
>
> O editor saiu. Publicar virou um commit.

## Escrever um post

Um post é **uma pasta**, com as versões dentro:

```
conteudo/blog/<chave>/
  post.json    datas, autor, etiquetas, capa, figuras e, por idioma,
               slug, título e resumo
  pt.md        o corpo em português
  en.md        o corpo em inglês
public/img/blog/<chave>/<arquivo>   as figuras
```

1. **Copie a pasta de um post existente** e troque a `chave` (o nome da pasta
   e o campo `chave` têm de ser iguais; ela não é o endereço público).
2. **Escreva `pt.md` e `en.md`.** No `post.json`, preencha `slug`, `titulo` e
   `resumo` de cada idioma.
3. **Figuras:**
   - ponha o arquivo em `public/img/blog/<chave>/`;
   - liste-o em `figuras`, com `arquivo` e `alt`;
   - para a capa, escreva o nome do arquivo em `capa`;
   - no corpo, a figura entra como `![texto alternativo](/img/blog/<chave>/<arquivo>)`.
4. **Data:** `publicado_em` com data e hora (`2026-11-10T09:00:00+00:00`).
   - Sem `publicado_em`, é rascunho: fica no projeto e não sai no site.
   - Com data futura, o post entra sozinho na hora marcada, sem novo deploy.
5. **Rode `python3 build.py`** e faça o commit. O build gera `src/blog.json`,
   que é o que o site lê. Esse arquivo fica fora do git e é reescrito a cada
   build; a Vercel roda o mesmo build antes de publicar.

**O build para, dizendo o que falta,** quando:

- falta título, slug ou corpo em algum idioma;
- dois posts têm o mesmo slug no mesmo idioma;
- uma data não é data;
- um post publicado não tem português **e** inglês;
- uma figura citada não está em `public/img/blog/`, ou, quando o `post.json`
  registra o MD5 dela, o arquivo não bate com ele;
- o corpo ainda aponta para o Supabase.

O endereço de um post publicado **não** muda quando o título muda: mudar o
`slug` quebraria todo link que alguém já compartilhou.

## A regra que decide o desenho

**Um post é uma coisa só, com as versões dentro**, e não um post por idioma.
Guardar "o post em português" e "o post em inglês" como duas coisas
independentes é como o alemão deste site ficou sem `hreflang`: duas linhas para
a mesma coisa, uma atualizada e a outra não.

## O `hreflang` sai do que existe

A página de um post anuncia apenas os idiomas em que ele **realmente** tem
título. Anunciar uma versão alemã que não existe manda o buscador para um 404 do
próprio site.

## O corpo é markdown, e o escape vem primeiro

O texto vira HTML numa página pública. Se o que estivesse guardado fosse HTML,
um `<script>` num post rodaria na tela de todo visitante, com o domínio do
produto na barra.

`paraHtml`, em `lib/blog.ts`, faz **uma** coisa antes de qualquer outra: escapa
tudo. Só depois aplica as marcas permitidas: títulos `##`, `**negrito**`,
`_itálico_`, `[link](endereço)`, listas, citação, código, imagem e linha.

Links só aceitam `http(s)`, caminho do próprio site, `mailto:` e âncora.
`javascript:` num link é a mesma execução que o escape evitou, e fechar uma
porta deixando a outra aberta não fecha nada.

## Compartilhar

| canal | por quê |
|---|---|
| **LinkedIn** | onde o público está, e onde o link tem contexto profissional |
| **E-mail** | o canal de dentro da empresa; muita gente não tem rede aberta no trabalho |
| **WhatsApp** | no Brasil é o canal real de equipe, inclusive corporativa |
| **X** | alcance de nicho técnico, barato de manter |
| **Copiar o link** | o que a pessoa cola no Teams, no Slack, no Jira |

Ficaram de fora:

- **Instagram e TikTok**, que não deixam pôr link em publicação. "Compartilhar
  um artigo" lá é um botão que não compartilha nada.
- **Facebook**, que para texto técnico B2B é um ícone que ninguém aperta.

**Nenhum deles carrega script de terceiro.** São links `href` montados no
servidor. Um botão oficial de rede social traz o rastreador da rede junto, e a
política de privacidade deste site diz que não há rastreador de terceiro. O
teste confere que a página do post não faz nenhum pedido a domínio de fora.

## As réguas

- **`testes/blog.mjs`:**
  - os arquivos contra o JSON gerado e as figuras contra o MD5;
  - as regras de publicação, com o `lib/blog.ts` de verdade sobre dados de
    ensaio;
  - o escape;
  - o site no ar, sem nenhum pedido ao Supabase.
- **`testes/seo.mjs`:**
  - sitemap, dados estruturados, RSS, etiquetas e autor, sobre um post de
    ensaio passado pelo `WALKSTAMP_BLOG_TESTE`;
  - a Vercel ignora essa variável.
