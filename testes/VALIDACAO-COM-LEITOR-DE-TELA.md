# Validação com leitor de tela — o que falta do A2

O `testes/etapas.mjs` cobra os **atributos**: que existe `aria-current="step"`,
que o estado entra por palavra no `aria-label`, que o botão bloqueado não
navega, que o foco vai para o `<h2>`. Isso é o que uma máquina consegue afirmar.

O que ela **não** consegue afirmar é o que uma pessoa **ouve**. Um `role="status"`
pode estar no HTML e não ser anunciado; um `aria-label` pode estar certo e ser
lido junto com o texto visível, dobrado; um `aria-hidden` pode falhar e a mesma
etapa ser dita duas vezes seguidas. Por isso esta parte é sua, e não minha: ela
precisa de NVDA e de VoiceOver rodando de verdade.

São **20 a 30 minutos**. Anote o que falhar com o número do item.

---

## Preparação

- **Windows:** NVDA (nvaccess.org, gratuito) + Chrome. Ligue com `Ctrl+Alt+N`.
  Desligue com `Insert+Q`. Silencie no meio com `Ctrl`.
- **macOS:** VoiceOver (`Cmd+F5`) + Safari. Em Safari,
  *Preferências → Avançado → mostrar recursos para desenvolvedores* não é
  preciso; mas em *Preferências → Avançado*, marque **"pressionar Tab destaca
  cada item"**, senão os botões da barra não recebem foco por teclado.
- Abra a ferramenta em **português** (`/app.html?lang=pt`) e tenha à mão um
  vídeo curto — o de exemplo serve.

Uma dica que economiza tempo: no NVDA, `Insert+F7` abre a lista de elementos.
Com **"Botões"** marcado dá para ler os nomes acessíveis dos três de uma vez,
sem navegar até eles.

---

## Os oito itens

### 1. A barra tem nome, e os três botões também

Navegue por região/marco (NVDA: `D`; VoiceOver: `VO+Cmd+N`) até a navegação.

- **Deve ouvir:** *"As três etapas, navegação"*.
- Tabulando pelos três, deve ouvir **número, nome e estado**, nesta ordem:
  *"1. Entrada — concluída, botão"*, *"2. Conferir — atual, botão"*,
  *"3. Baixar — bloqueada, botão"*.

**Por que importa:** o estado está na tela por cor — visto verde, `!` âmbar,
cinza. Cor não chega a quem não a distingue, e "bloqueada" é a única informação
que explica por que o clique não levou a lugar nenhum. O número entra porque
quem controla por voz diz *"clicar em 2 Conferir"*.

**Reprova se:** o estado não for dito; ou o nome vier duplicado
(*"2 Conferir 2. Conferir — atual"*), que é `aria-label` brigando com o texto.

### 2. A etapa atual é dita como etapa atual

No botão do meio, com a etapa 2 ativa.

- **Deve ouvir:** algo como *"atual"*, *"item atual"* ou *"passo atual"* — o
  NVDA e o VoiceOver dizem de formas diferentes, e qualquer uma serve.

**Reprova se:** os três soarem idênticos.

### 3. A linha curta do celular **não** é lida

Estreite a janela para ~360 px de largura. Aparece uma linha
*"Etapa 2 de 3 · Conferir"* acima dos botões.

- **Deve ouvir:** **nada** dela. Ela é `aria-hidden="true"` de propósito, porque
  diz exatamente o que o `<nav>` abaixo já anuncia.

**Reprova se:** a etapa for anunciada duas vezes seguidas.

### 4. A frase da próxima ação é anunciada sozinha

Com o leitor ligado e **sem tocar em nada**, carregue um vídeo e deixe a
varredura terminar. A etapa muda de 1 para 2.

- **Deve ouvir**, sem ter navegado até lá: *"Próxima ação: conferir os quadros"*
  (ou a frase que estiver valendo).

**Por que importa:** este é o item mais frágil de todos, e o único que justifica
o `role="status"`. `aria-current` muda **em silêncio** — quem não enxerga
ficaria numa etapa nova sem ser avisado.

**Reprova se:** nada for dito na mudança de etapa; ou se **cada** repintura
falar, virando tagarelice.

### 5. Clicar numa etapa leva o foco para o título

Com a etapa 1 concluída, tabule até *"1. Entrada"* e tecle Enter.

- **Deve ouvir:** o título da etapa — *"1 O vídeo, título nível 2"* — e não o
  silêncio de uma página que rolou sem dizer nada.
- A tabulação seguinte deve continuar **de dentro** daquele cartão.

**Reprova se:** o foco ficar no botão da barra e só a página rolar.

### 6. A etapa bloqueada avisa, e não engole o clique

Recarregue a página sem vídeo nenhum. Tabule até *"3. Baixar"*.

- **Deve** receber foco e dizer *"bloqueada"*.
- Enter **não** pode levar a lugar nenhum.

**Por que importa:** ela usa `aria-disabled="true"` e não `disabled`. Um botão
`disabled` some da tabulação — e some junto a explicação de por que ele está
apagado. Aqui a pessoa chega nele, ouve o motivo e segue.

### 7. A travessia não rouba o cursor de quem escreve

Comece a digitar numa anotação de um quadro e deixe a varredura terminar
enquanto você escreve.

- **Deve:** o cursor **ficar** onde está. A barra repinta, a página não salta.

**Reprova se:** o foco pular para o título da etapa nova no meio de uma frase.

### 8. Zoom 200% e a barra grudada

`Ctrl+ +` (ou `Cmd+ +`) até 200%, em 1280×800.

- A barra das etapas continua visível ao rolar, **abaixo** do cabeçalho.
- Clicar numa etapa não pode deixar o título **atrás** da barra: ele tem que
  aparecer inteiro, com uma folga.
- Nada de rolagem horizontal.

**Por que importa:** a altura do cabeçalho é medida, não cravada — em alemão a
900 px ele quebra em duas linhas. Se este item falhar, é a medida que falhou.

---

## Como reportar

Para cada item que reprovar, me mande: **o número do item, o leitor e o
navegador, e o que foi dito** (ou o silêncio, se foi silêncio). O texto exato é
o que importa — *"leu duas vezes"* e *"leu o rótulo em vez do nome"* levam a
correções diferentes.

Se os oito passarem nos dois pares, o A2 fecha e a Trilha A vai a zero.
