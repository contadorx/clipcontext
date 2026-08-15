# Medição

Ligada em 14/08/2026. Antes disso o ClipContext não sabia se alguém tinha aberto a página — o que
tornava impossível decidir onde melhorar. Este documento explica o desenho, por que ele é assim, e como
ler os números.

---

## O princípio que não foi abandonado

A promessa do produto é **"seu vídeo não sai da sua máquina"**. Ela continua inteira: nada de vídeo,
áudio, transcrição, nome de arquivo, tamanho ou duração é enviado. O que passou a existir é a contagem
de que *alguma* pessoa passou por *algum* marco — sem qualquer forma de saber quem, e sem forma de ligar
dois marcos à mesma pessoa.

"Não coletamos nada" e "não sabemos se existimos" não são a mesma promessa. A primeira valia a pena
manter; a segunda era só o custo acidental da primeira.

---

## As duas medições, e por que são separadas

| | o quê | onde | por quê separado |
|---|---|---|---|
| **Visitas** | pageview, referrer, país, dispositivo | Vercel Web Analytics | responde *"chegou gente, e por onde?"* |
| **Funil** | três marcos de uso | Supabase | responde *"quem chegou terminou?"* |

Não é gosto por complexidade. **Eventos personalizados no Vercel Web Analytics são recurso de plano
pago.** No plano gratuito só há visita de página. Como o funil é justamente o número que importa, ele
foi para um banco próprio — que, de quebra, é dado seu e não de terceiro.

---

## Os três marcos

| nome | quando dispara | campos que vão junto |
|---|---|---|
| `abriu_ferramenta` | a interface do app terminou de montar | idioma |
| `carregou_video` | o navegador **conseguiu abrir** o vídeo | idioma, origem (`arquivo`, `drive`, `gravacao`, `exemplo`) |
| `baixou_saida` | um arquivo de saída foi salvo | idioma, formato (`pdf`, `docx`, `zip`, `json`, `vtt`) |

Duas decisões que valem explicação:

**`carregou_video` dispara no `onloadedmetadata`, não no começo do `load()`.** Só conta o vídeo que o
navegador realmente abriu. O que cai no `onerror` — HEVC, MKV, ProRes — é outro número, e misturar os
dois esconderia justamente a dor que o plano pago existe para resolver. A diferença entre
`abriu_ferramenta` e `carregou_video` já mede isso indiretamente; se um dia essa diferença precisar de
nome, o marco de falha entra separado.

**`exemplo` é uma origem própria.** Quem clica no vídeo de demonstração não é quem trouxe material seu.
Somar os dois transformaria curiosidade em uso, que é o jeito mais fácil de ler o gráfico errado.

## O que **não** é enviado

Nome de arquivo, tamanho, duração, resolução, conteúdo, transcrição, frame, e-mail, identificador de
sessão, cookie. A função do lado do servidor aceita apenas palavras de um vocabulário fechado — qualquer
coisa fora dele é **descartada no banco**, não no cliente. Isso é proposital: a garantia não depende do
código que roda no navegador de quem usa.

O teste `/tmp/medicao.mjs` afirma isso diretamente: ele coleta tudo o que sai e falha se aparecer
qualquer chave além de `p_nome`, `p_idioma`, `p_origem`, `p_formato`.

## Quem pode desligar

- **Do Not Track** e **Global Privacy Control**: se o navegador envia qualquer um dos dois, os marcos
  não são enviados. Verificado em teste.
- **O build offline**: o `build.py` troca os tokens de endereço por string vazia e **quebra o build** se
  sobrar `supabase.co` ou `_vercel/insights` no arquivo. O arquivo único não fala com ninguém, e dá para
  conferir procurando por "supabase" nele.

---

## Onde os dados ficam

A conta do Supabase já tinha dois projetos gratuitos (o limite), então o ClipContext mora num **schema
próprio dentro do projeto do SalaVox**: `clipcontext.evento` e `clipcontext.interesse`.

O schema **não é publicado pela API**. Nem com a chave publicável em mãos dá para ler ou escrever nas
tabelas. O navegador só alcança duas funções em `public`, ambas `security definer`, ambas só sabendo
inserir:

- `clipcontext_evento(p_nome, p_formato, p_idioma, p_origem)` → `void`
- `clipcontext_interesse(p_email, p_idioma)` → `'ok'` ou `'invalido'`

E-mail repetido responde `'ok'`: para quem enviou, deu certo das duas vezes, e não é da conta do
formulário revelar quem já estava na lista.

O linter do Supabase marca as duas funções como *"Public Can Execute SECURITY DEFINER Function"*. É
intencional e é o desenho inteiro — a alternativa seria expor as tabelas, que é estritamente pior.

**Quando houver vaga de projeto gratuito**, mover para um projeto próprio é: rodar a mesma migração lá,
trocar `SUPA_URL`/`SUPA_KEY` no `build.py`, e derrubar o schema daqui.

---

## Como ler os números

```sql
-- O funil dos últimos 30 dias, e a taxa que importa
select nome, count(*) as n
from clipcontext.evento
where criado_em > now() - interval '30 days'
group by nome order by 2 desc;

-- Conclusão: de quem abriu um vídeo, quantos baixaram alguma coisa?
-- (não é por pessoa — não há pessoa — mas a razão entre marcos é o sinal)
select
  count(*) filter (where nome = 'abriu_ferramenta') as abriram,
  count(*) filter (where nome = 'carregou_video')   as carregaram,
  count(*) filter (where nome = 'baixou_saida')     as baixaram,
  round(100.0 * count(*) filter (where nome = 'baixou_saida')
              / nullif(count(*) filter (where nome = 'carregou_video'), 0), 1) as pct_conclusao
from clipcontext.evento
where criado_em > now() - interval '30 days';

-- Material próprio ou só curiosidade?
select origem, count(*) from clipcontext.evento
where nome = 'carregou_video' group by 1 order by 2 desc;

-- Qual saída as pessoas realmente querem (o .docx e o .zip valeram a pena?)
select formato, count(*) from clipcontext.evento
where nome = 'baixou_saida' group by 1 order by 2 desc;

-- A lista de aviso
select idioma, count(*), max(criado_em) from clipcontext.interesse group by 1;
```

### O que cada resultado significa

| se você vir | o problema é | e o remédio é |
|---|---|---|
| poucos `abriu_ferramenta` | ninguém chega | distribuição, não produto |
| muitos abriram, poucos carregaram vídeo | a pessoa chegou e não entendeu, ou desistiu na primeira tela | a primeira tela |
| `origem` quase toda `exemplo` | curiosidade, não uso | a proposta não está clara o bastante para valer o próprio arquivo |
| carregaram e não baixaram | o meio do caminho é caro demais — provavelmente o download do modelo | a transcrição, que é o passo mais pesado |
| `pdf` sozinho, `docx`/`zip` em zero | os formatos extras não valeram o esforço | não é urgente, mas é bom saber |

Vale repetir o óbvio: **com pouco tráfego, nenhum desses números significa nada.** Antes de algumas
centenas de visitas, são ruído. O valor deles é acumular a partir de hoje, e não estar zerado no dia em
que houver o que ler.

---

## O que falta fazer, e não é código

1. **Habilitar Web Analytics no painel da Vercel** (projeto → Analytics → Enable). Sem isso, a rota
   `/_vercel/insights/script.js` não existe e o navegador loga um erro inofensivo mas feio no console.
   Se você decidir não usar, tire o `ANALYTICS` do `build.py` — não deixe o snippet apontando para o
   vazio.
2. **Conferir o CORS em produção.** O ambiente onde isto foi construído não tem saída de rede para o
   `supabase.co`, então o caminho servidor foi testado direto no banco e o navegador foi testado contra
   um endpoint simulado. O que falta é uma passada real. Abra `walkstamp.com/app` e, no console:

   ```js
   fetch('https://zyqncemxjobkvdveordz.supabase.co/rest/v1/rpc/clipcontext_evento', {
     method:'POST',
     headers:{'Content-Type':'application/json',
              apikey:'sb_publishable_HQDSfL4rTtPx2wwbgh_huw_llog8ZJk',
              Authorization:'Bearer sb_publishable_HQDSfL4rTtPx2wwbgh_huw_llog8ZJk'},
     body:JSON.stringify({p_nome:'abriu_ferramenta',p_idioma:'pt'})
   }).then(r => console.log(r.status))   // 200 = está no ar
   ```

   Depois apague a linha de teste com `delete from clipcontext.evento where criado_em > now() - interval '5 minutes';`
3. **Uma rotina de retenção.** A política publicada promete 18 meses para os marcos e 24 meses de
   inatividade para a lista. Promessa sem rotina é promessa quebrada com atraso:

   ```sql
   delete from clipcontext.evento    where criado_em < now() - interval '18 months';
   delete from clipcontext.interesse where criado_em < now() - interval '24 months';
   ```

   Rodar isso uma vez por mês (pg_cron, ou na mão com lembrete) é o que faz a política ser verdade.

---

## A parte legal, ligada em 14/08/2026

Os Termos e a Política de Privacidade passaram a identificar o controlador — exigência da LGPD que faltava
e que ficou mais séria no dia em que passou a existir um e-mail guardado.

Tudo sai de três constantes no `build.py`, para não haver CNPJ digitado errado em nove lugares:

```python
EMPRESA = "Produtize Produtos e Serviços Inteligentes Ltda."
CNPJ    = "48.417.292/0001-99"
CONTATO = "privacidade@clipcontext.app"
```

O que entrou nos dois documentos, nos três idiomas:

- **Quem é responsável** — razão social, CNPJ, e o canal do encarregado (art. 41).
- **Bases legais, finalidades e prazos** — uma tabela com os quatro tratamentos que existem: e-mail da
  lista (consentimento), os três marcos e as visitas (dado anonimizado, art. 12, com legítimo interesse
  como fundamento subsidiário) e os registros de acesso do servidor (obrigação legal — Marco Civil,
  art. 15, seis meses).
- **Onde os dados ficam** — Supabase em São Paulo, ou seja, em território brasileiro; Vercel com rede
  global, o que caracteriza transferência internacional (art. 33) e está dito com esse nome.
- **Seus direitos** — a lista do art. 18 inteira, o prazo de 15 dias, e a informação de que na prática
  isso quase sempre significa tirar o e-mail da lista, sem pedir documento nem justificativa.
- **Reclamação à ANPD.**
- **Cookies** e **Menores** — as duas seções que afirmavam coisas que deixaram de ser verdade quando a
  medição entrou. A de cookies agora explica por que *não há* aviso de cookies: sem cookie, não há o que
  consentir.
- Nos Termos: identificação da empresa no artigo 1, e um artigo novo dizendo que **não há nada à venda**
  e que deixar o e-mail não é compra nem reserva.

### Duas ressalvas honestas

**Não sou advogado, e isto não é parecer jurídico.** O texto foi escrito para ser verdadeiro e legível,
não para sobreviver a um contencioso. Antes de faturar o primeiro real, um advogado precisa revisar —
principalmente o artigo de limitação de responsabilidade e o de foro, que é onde a redação amadora custa
caro.

**O endereço `privacidade@clipcontext.app` precisa existir e ser lido.** Publicar canal de titular que não
responde é pior do que não publicar: o prazo do art. 19 corre igual, e a omissão fica documentada na
própria página. Se preferir usar um endereço que você já lê, é uma linha no `build.py`.
