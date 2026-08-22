# Auditoria de usabilidade e código — Walkstamp

**Data:** 20/08/2026
**Escopo:** ferramenta local (`src/template.html`), build, documentação de decisões e esteira de testes.
**Foco pedido:** reduzir o tempo percebido e o tempo real da transcrição.

## Resumo executivo

O Walkstamp já tomou várias decisões corretas e incomuns para um produto que transcreve no navegador:
áudio mono a 16 kHz, filtro/compactação de silêncio, CPU com até quatro threads quando há isolamento,
WebGPU opcional, modelo `base` como padrão, pipeline reutilizado, download e decodificação em paralelo,
progresso parcial, previsão de término e caminho rápido para importar a transcrição que já existe. Não
recomendo reimplementar essas soluções.

O maior risco encontrado está justamente no mecanismo de recuperação da transcrição: se a primeira
inferência na GPU falhar, o código chama `soltarPipe()` de dentro de uma inferência ainda contabilizada
como ativa. A função espera até 60 segundos por essa própria inferência terminar, mas o contador só é
reduzido no `finally`, depois da espera. Além do minuto artificial, o pipeline de recuperação não fixa
`device: 'wasm'`. É um problema **P0**, porque atinge uma classe de máquinas já reconhecida pelo código
e acontece no momento mais caro do fluxo, depois do download.

Para velocidade, a próxima decisão não deveria ser mais uma otimização sem número. O repositório mede
bem a varredura, mas ainda não tem uma régua reproduzível de **tempo até a primeira fala**, **tempo de
montagem**, **fator de tempo real por motor/modelo** e **tempo perdido em cada fallback**. Sem isso,
trocar janela, modelo ou runtime é palpite. A prioridade é corrigir o P0 e instrumentar o funil antes de
alterar o algoritmo.

## Método e limites

Esta é uma avaliação heurística e estática, apoiada na documentação e no código. Foram examinados:

- o fluxo principal, configurações, estados de espera, transcrição de arquivo e captura ao vivo;
- montagem, reutilização, troca e descarte do pipeline Whisper/ONNX;
- decodificação, reamostragem, seleção de janelas e descarte de silêncio;
- decisões registradas em `README.md` e `DESEMPENHO.md`;
- estrutura e portabilidade da regressão automatizada.

O build local foi executado. Os testes de navegador não puderam rodar neste contêiner: a suíte fixa um
executável Chromium inexistente e o download do navegador pelo Playwright respondeu HTTP 403. Portanto,
os achados de interação abaixo são heurísticos; não substituem sessões observadas com participantes,
tecnologia assistiva e máquinas reais com WebGPU/WASM.

### Escala usada

| Campo | Significado |
|---|---|
| **P0** | interrompe ou degrada gravemente a tarefa principal; corrigir antes de otimizar |
| **P1** | alto impacto em velocidade, conclusão ou confiança |
| **P2** | fricção relevante, dívida que amplia regressões ou observabilidade insuficiente |
| **P3** | acabamento ou oportunidade de menor impacto |
| **Baixa** | até cerca de 1 dia, alteração localizada |
| **Média** | 2–5 dias, envolve estados/testes ou mais de uma camada |
| **Alta** | mais de 1 semana, pesquisa, arquitetura ou validação ampla |

## Achados priorizados

### 1. P0 — o fallback da GPU pode se autobloquear por 60 segundos

**Dificuldade:** baixa.
**Área:** velocidade real, confiabilidade, código.

`transcrever()` incrementa `usandoPipe`, captura o erro da GPU e chama `soltarPipe()`. Essa função espera
enquanto `usandoPipe > 0`, até 600 ciclos de 100 ms. O decremento está no `finally` de `transcrever()` —
logo, só acontece depois que o próprio `catch` e `soltarPipe()` terminarem. Na falha reconhecida da GPU,
o usuário paga aproximadamente um minuto parado antes de o fallback sequer começar.

O pipeline substituto ainda é criado apenas com `{ dtype: 'q8' }`; sem `device: 'wasm'`, a biblioteca
pode selecionar novamente o backend que falhou. Ele também contorna `trocarPipe()`/`buildPipe()`, a fila
de montagem, as opções de threads, o diagnóstico e a combinação lembrada.

**Ação:** separar “inferência ativa” de “pipeline que pode ser descartado”, ou encerrar a contabilização
antes de solicitar a troca; fazer o fallback passar por uma única API de troca, explicitamente com
WASM/q8; criar teste que simule erro na **primeira inferência** e afirme (a) latência abaixo de um limite,
(b) apenas um pipeline vivo, (c) retry no mesmo segmento e (d) `device === 'wasm'`.

**Ganho esperado:** elimina até 60 s de espera e uma possível segunda falha em toda queda GPU → CPU.

### 2. P1 — falta uma régua ponta a ponta da transcrição

**Dificuldade:** média.
**Área:** velocidade, produto, observabilidade.

Há bons contadores de áudio processado e tempo de inferência, mas não existe uma matriz automatizada e
reproduzível que separe:

1. leitura do arquivo;
2. decodificação/reamostragem;
3. cache ou download;
4. criação da sessão ONNX;
5. tempo até o primeiro texto;
6. inferência total;
7. fallback e descarte;
8. quantidade de áudio original versus áudio efetivamente enviado.

Sem essa decomposição, o número final mistura tempos com causas diferentes. A própria documentação
registra que o dominante da transcrição continua sem medição local. Isso impede responder se a próxima
melhoria deve atacar download, sessão, silêncio, janela ou inferência.

**Ação:** adicionar um modo de benchmark com amostras versionadas de 1, 10 e 40 minutos (fala contínua,
reunião realista e silêncio), exportando JSON; medir cold cache/warm cache, CPU 1/4 threads e GPU; definir
baseline e orçamento de regressão. Registrar `performance.mark()` em cada fronteira acima.

**Ganho esperado:** não acelera sozinho, mas evita investir no lugar errado e torna cada ganho seguinte
demonstrável.

### 3. P1 — a arquitetura de fallback pode multiplicar downloads e montagens

**Dificuldade:** média.
**Área:** velocidade de início, rede, código.

Em uma máquina sem combinação lembrada, `buildPipe()` percorre ambientes, runtimes, opções de
quantização, repositório reserva, cache limpo e fp32. A resiliência é valiosa, mas algumas falhas podem
levar a downloads adicionais de aproximadamente 73–200 MB e novas compilações. A lista contém ainda
uma URL sem versão (`@huggingface/transformers`), o que reduz reprodutibilidade.

**Ação:** classificar erros em rede, arquivo, incompatibilidade de operador, memória, worker/COEP e
backend; cada classe deve saltar diretamente para o próximo fallback pertinente. Fixar todas as versões
e manter um manifesto testado de biblioteca ↔ runtime ↔ modelo. Mostrar antes de um fallback caro:
“a alternativa baixa mais 73 MB”; nunca limpar cache automaticamente sem evidência de corrupção.

**Ganho esperado:** grande no pior caso; reduz minutos e centenas de MB, sem alterar a velocidade da
inferência que já funciona.

### 4. P1 — o caminho mais rápido existe, mas fica atrás de “Ajustes”

**Dificuldade:** média.
**Área:** usabilidade, velocidade percebida.

O produto oferece duas decisões que mudam o tempo por uma ordem de grandeza — modelo e GPU — dentro de
uma gaveta de ajustes junto com idioma, microfone, nomes de canal, sensibilidade e limite de quadros.
Para iniciantes, “Transcrever a fala” parece uma ação única; custo, precisão e motor aparecem como
configuração técnica. A oferta de “Acelerar” só surge depois de duas janelas e quando a previsão passa
de cinco minutos, ou seja, depois de o usuário já investir no caminho lento.

**Ação:** antes do clique, apresentar uma escolha orientada ao resultado: **Mais rápido** (base + melhor
motor disponível, recomendado) e **Mais preciso** (small/turbo, com download e estimativa). Manter os
controles técnicos na gaveta. Se houver benchmark local anterior, mostrar uma estimativa desde o início;
se não houver, declarar “calculando após o primeiro trecho”.

**Ganho esperado:** reduz tempo por escolha melhor, sem mudança no motor.

### 5. P1 — não há cancelamento efetivo por segmento nem retomada da transcrição de arquivo

**Dificuldade:** alta.
**Área:** controle do usuário, confiabilidade.

A interface informa que a pessoa pode deixar a tarefa em segundo plano, mas o laço de transcrição de
arquivo é sequencial e não expõe uma ação de parar/aproveitar o que já saiu equivalente à varredura de
frames. Fechar ou recarregar perde o trabalho; uma inferência lenta também não é abortável no meio.

**Ação:** primeiro, oferecer “Parar e ficar com o que já saiu” entre janelas (média dificuldade). Depois,
persistir checkpoints textuais por hash do arquivo, modelo e plano de janelas, permitindo retomar sem
guardar áudio (alta dificuldade). Não prometer abortar a inferência corrente se o runtime não suporta;
dizer “parando após este trecho”.

**Ganho esperado:** não reduz o benchmark feliz, mas reduz drasticamente tempo desperdiçado e risco de
abandono em vídeos longos.

### 6. P1 — a estratégia carrega o arquivo inteiro e o áudio inteiro na memória

**Dificuldade:** alta.
**Área:** desempenho, estabilidade.

`decodeTo16k()` chama `file.arrayBuffer()` e depois `decodeAudioData()`; vídeos longos coexistem como
arquivo comprimido, buffer decodificado e `Float32Array` mono. Mesmo com 16 kHz, a entrada comprimida
inteira continua no heap. Em dispositivos com pouca memória, paginação, coleta de lixo ou encerramento
da aba podem ser mais graves que a inferência lenta.

**Ação:** medir pico de memória por duração e navegador antes de redesenhar. Se o limite for confirmado,
extrair/decodificar em blocos com WebCodecs quando suportado, mantendo o caminho atual como fallback.
Uma alternativa intermediária é liberar referências o mais cedo possível e bloquear antecipadamente
combinações de duração/modelo que excedam um orçamento medido.

**Ganho esperado:** principalmente estabilidade; pode melhorar velocidade ao evitar pressão de memória.

### 7. P2 — compactação de silêncio melhora custo, mas aumenta risco de palavras cortadas

**Dificuldade:** média.
**Área:** qualidade versus velocidade.

O plano de janelas compacta trechos falados e mantém margens, o que é superior a apenas pular janelas
totalmente mudas. Porém a decisão usa energia, não VAD semântico; fala baixa, fricativas e início/fim de
palavra podem cair perto do limiar. A mesma otimização que acelera pode degradar o texto sem um sinal
visível ao usuário.

**Ação:** incluir na régua áudio de voz baixa, ruído, pausas e microfone distante; medir WER/CER e palavras
de borda com e sem compactação. Guardar no diagnóstico a porcentagem removida. Se a qualidade cair,
ajustar margens/histerese antes de adicionar um modelo VAD, que aumentaria download e complexidade.

**Ganho esperado:** preserva o ganho atual evitando regressão de qualidade.

### 8. P2 — `transcrever()` depende de estado global mutável durante tarefas assíncronas

**Dificuldade:** alta.
**Área:** código, concorrência, regressões.

`pipe`, `pipeId`, `pipeDev`, `libMod`, `motorEmUso`, `montando`, `adiantando`, `trocaPedida`, `relogio` e
`usandoPipe` cooperam por convenção. Captura ao vivo, pré-carregamento, transcrição de arquivo e troca de
modo alcançam o mesmo ciclo de vida. O autobloqueio do item 1 é um sintoma dessa propriedade distribuída.

**Ação:** encapsular o motor em uma máquina de estados (`idle`, `loading`, `ready`, `inferring`,
`switching`, `disposing`, `failed`) com uma fila e dono explícito da sessão. Separar métricas por job.
Fazer essa migração em etapas, mantendo testes de contrato nas APIs atuais.

**Ganho esperado:** indireto; diminui vazamentos, corridas e regressões nas próximas otimizações.

### 9. P2 — o arquivo-fonte de 20 mil linhas torna mudanças caras e frágeis

**Dificuldade:** alta.
**Área:** manutenção, código.

HTML, CSS, traduções, regras de produto, áudio, OCR, gravação, PDF/Word/ZIP, licenças e telemetria vivem
em `src/template.html`. A decisão de entregar um HTML autocontido é válida, mas não exige que a fonte
também seja monolítica: o build já existe e pode concatenar módulos.

**Ação:** preservar exatamente um arquivo no artefato e dividir apenas a fonte por domínios. Começar pelo
motor ASR e pelos parsers, com funções puras e testes sem navegador. Proibir edição do gerado continua
correto.

**Ganho esperado:** não acelera o usuário diretamente; reduz dificuldade e risco de todos os itens acima.

### 10. P2 — a suíte não é portátil no estado atual

**Dificuldade:** baixa.
**Área:** qualidade, experiência de desenvolvimento.

Os testes usam `const RAIZ = '/root/walkstamp'` e um caminho absoluto para Chromium. O script
`testes/preparar.sh` só substitui o caminho histórico `/root/cc/walkstamp`, portanto informou “0 arquivos”
e deixou o caminho inválido. Isso contradiz a promessa do `testes/LEIA-ME.md` de preparar o projeto onde
ele estiver. O executável fixo também impede usar o browser gerenciado pela versão instalada do
Playwright.

**Ação:** derivar a raiz com `import.meta.url`/`process.cwd()`, centralizar um helper, deixar Playwright
resolver o executável por padrão e aceitar override por variável de ambiente. Fazer `preparar.sh` apenas
gerar amostras/verificar dependências, sem reescrever fontes.

**Ganho esperado:** feedback mais rápido e confiável para cada alteração de desempenho.

### 11. P2 — sucesso, progresso e detalhe técnico usam a mesma região textual

**Dificuldade:** média.
**Área:** usabilidade, acessibilidade.

Download, montagem, fallback, transcrição e erro escrevem em `#astatus`; o relógio para quando outro
texto assume a região. Isso resolve concorrência visual, mas uma única linha precisa comunicar etapa,
progresso, ETA, motivo do fallback e consequência. Mudanças frequentes também podem ser ruidosas para
leitores de tela.

**Ação:** separar estado estável (“Transcrevendo no processador”), progresso/ETA e detalhe expansível.
Usar `role="status"`/`aria-live="polite"` somente para transições significativas e uma barra com
`aria-valuenow` quando determinada. Validar com NVDA/VoiceOver, não só por inspeção de DOM.

**Ganho esperado:** melhora a velocidade percebida e reduz recargas por falsa impressão de travamento.

### 12. P3 — a hierarquia do produto ainda expõe muitas capacidades no fluxo principal

**Dificuldade:** média.
**Área:** usabilidade.

O produto já agrupou várias ações, mas a revisão reúne importação de transcrição, vocabulário,
hesitações, tradução, multi-idioma, deduplicação, silêncio, OCR, notas, revisão quadro a quadro e muitas
saídas. É poder funcional, porém eleva a carga de decisão para quem só quer “vídeo → documento”.

**Ação:** definir um caminho básico de três decisões e revelar ferramentas avançadas após o primeiro
resultado. Rodar cinco sessões moderadas com tarefas distintas (reunião já transcrita, vídeo sem legenda,
captura ao vivo, sessão UX e revisão de evidência), medindo tempo até iniciar, erros de caminho e pedidos
de ajuda.

**Ganho esperado:** menor tempo de aprendizagem e maior taxa de conclusão.

## Avaliação dura da experiência de uso

O plano de solução correspondente — com nova arquitetura da informação, fluxos, estados, microcópia,
implantação e testes de aceite — está em `PLANO-REDESENHO-UX.md`.

### Veredito de UX: poderoso para quem construiu; cansativo para quem acabou de chegar

**Nota heurística geral: 4/10 para primeiro uso e 7/10 para usuário recorrente especializado.**

O aplicativo parece ter crescido respondendo corretamente a muitos casos reais, mas cada resposta ficou
visível no mesmo fluxo. O resultado é uma ferramenta tecnicamente cuidadosa que transfere ao usuário o
trabalho de entender sua arquitetura. Ela não é “difícil” porque os botões sejam obscuros; é difícil
porque pede contexto, escolhas e revisão demais antes de oferecer uma linha de chegada inequívoca.

Uma pessoa experiente consegue produzir um documento muito rico. Uma pessoa nova precisa compreender,
na mesma página, cenário, documento anterior, roteiro, captura, arquivo, Drive, transcrição pronta,
modelo de voz, frames, deduplicação, OCR, vocabulário, identificação, formato, layout, papel, sistemas de
destino, dados de recuperação e prompt. O problema central não é ausência de explicação — é **excesso de
explicação para compensar excesso de decisões**.

### Placar heurístico

| Dimensão | Nota | Diagnóstico duro |
|---|---:|---|
| Facilidade para começar | **4/10** | o passo 1 começa com decisões de taxonomia, não com a tarefa |
| Leitura e escaneabilidade | **5/10** | há boa redação local, mas texto demais e baixa relação sinal/ruído |
| Seguimento dos passos | **4/10** | quatro passos aparentes escondem letras, subpassos e caminhos paralelos |
| Prevenção/recuperação de erros | **8/10** | mensagens, parcial, espelho e diagnóstico são pontos fortes reais |
| Confiança durante esperas | **7/10** | progresso e ETA são bons, embora disputem a mesma região |
| Clareza da conclusão | **3/10** | gerar, guardar, entregar e criar prompt competem como finais diferentes |
| Eficiência de uso recorrente | **7/10** | recursos avançados têm valor depois de aprendido o modelo mental |
| Acessibilidade cognitiva | **4/10** | a quantidade de opções e textos penaliza atenção, memória e dislexia |

### A jornada real não tem quatro passos

A interface anuncia quatro passos, mas o usuário encontra algo mais próximo disto:

1. escolher o tipo de documento;
2. decidir se recupera trabalho anterior;
3. decidir se traz um roteiro;
4. escolher entre gravar, enviar arquivo, Drive ou exemplo;
5. decidir se haverá transcrição e por qual caminho;
6. aguardar captura, extração, modelo e/ou transcrição;
7. conferir quadros;
8. reduzir ou acrescentar quadros;
9. revisar fala e aplicar transformações;
10. identificar o documento;
11. escolher entre muitos formatos e destinos;
12. guardar uma cópia recuperável;
13. gerar prompt;
14. decidir se acabou de verdade.

As letras `a/b/c` não eliminam essa complexidade; só evitam que dois sistemas usem números. Para a
pessoa, continuam sendo etapas. Chamar “Revisão” de passo 3 e colocar dentro dele quatro subpassos —
“Conferir os quadros”, “Revisar a fala”, “Identificar o documento” e “Gerar” — faz o indicador principal
deixar de representar esforço e progresso.

**Consequência:** o usuário não consegue prever quanto falta. Uma sequência longa sem mapa confiável
parece maior do que é e favorece abandono ou geração precoce sem revisão.

### Os dez maiores problemas de facilidade de uso

#### UX-1 — P0: não existe um caminho básico visualmente dominante

**Dificuldade:** média.
O fluxo principal e o avançado dividem a mesma página. “Gravar uma tela e gerar PDF” deveria ser uma
linha quase reta, mas recebe praticamente o mesmo peso estrutural de reabrir JSON/ZIP, importar roteiro,
configurar webcam/clipe, OCR, tradução múltipla, pacote por tarefa, Jira, Google Docs, SCORM e dados de
recuperação.

**Correção:** criar um modo básico como padrão: **1. trazer/gravar → 2. conferir → 3. baixar**. Recursos
avançados continuam acessíveis por “Personalizar documento” e “Outros formatos”. Não basta recolher
algumas caixas; é preciso mudar a hierarquia da página.

#### UX-2 — P0: a conclusão é ambígua e fragmentada

**Dificuldade:** média.
O produto tem pelo menos quatro finais concorrentes: documento baixado, JSON guardado, entrega a outro
sistema e prompt gerado. O passo 4 é “O pedido para a IA”, embora para muitos usuários o trabalho tenha
terminado ao baixar PDF/Word. Para outros, baixar PDF sem JSON significa perder a capacidade de editar
depois. A interface diz “dá para baixar mais de um”, mas não define um pacote mínimo nem confirma que a
tarefa está segura.

**Correção:** após gerar, abrir um estado de conclusão único: “Documento pronto e salvo”. A ação primária
é baixar o formato recomendado; a secundária é “Guardar projeto para editar depois”; prompt e integrações
ficam em “Próximos passos”. Mostrar checklist: documento baixado, projeto recuperável guardado, gravação
descartada/retida.

#### UX-3 — P1: o cenário obrigatório chega antes de o valor estar claro

**Dificuldade:** baixa.
O primeiro gesto exigido é escolher entre “evidência”, “tutorial”, “ata”, “usabilidade”, “contexto para
IA” e “outro”. Esses termos descrevem a taxonomia interna do produto. Um usuário que apenas quer testar
precisa prever o documento final antes de ver um exemplo dele; escolher errado é apresentado como caro.

**Correção:** usar uma pergunta reconhecível — “O que você quer obter?” — com três opções de alto nível e
prévia visual curta. Permitir trocar depois sem ameaça de refazer a gravação. Se a escolha realmente muda
somente metadados/layout/prompt, ela deve ser reversível até gerar.

#### UX-4 — P1: o passo 1 mistura alternativas com complementos

**Dificuldade:** média.
Gravar tela, abrir vídeo e Drive são **fontes alternativas**. Reabrir documento é um fluxo diferente.
Roteiro é um **complemento opcional**. Cenário é configuração de saída. Todos aparecem no mesmo cartão,
com letras sequenciais, sugerindo que devam ser percorridos em ordem. Isso cria leitura falsa: a pessoa
pode achar que precisa reabrir ou trazer roteiro antes de gravar.

**Correção:** separar semanticamente:

- **Começar novo:** gravar tela ou escolher vídeo;
- **Continuar trabalho:** reabrir projeto;
- **Opcional:** adicionar roteiro.

Não numerar alternativas como se fossem tarefas consecutivas.

#### UX-5 — P1: “A fala — opcional” contradiz o posicionamento e o comportamento

**Dificuldade:** baixa.
A promessa central combina frames e transcrição, mas o passo 2 chama a fala de opcional. Ao mesmo tempo,
a captura pode transcrever ao vivo, um arquivo pode iniciar extração automática, e a revisão posterior
traz novamente a transcrição. O usuário precisa descobrir se o passo 2 é uma ação, um resultado, uma
configuração ou um fallback.

**Correção:** tratar fala como estado, não etapa: “Fala: pronta / sendo transcrita / sem fala / adicionar
transcrição”. Se há áudio, oferecer uma recomendação contextual. Se já foi transcrito ao vivo, marcar
concluído e não manter um passo aparentemente pendente.

#### UX-6 — P1: texto bom demais está tentando salvar uma arquitetura ruim

**Dificuldade:** alta.
As microcópias são específicas e honestas, mas a página depende de parágrafos para explicar por que cada
controle existe, quando usar, o que não acontece e qual exceção se aplica. Em uma tarefa operacional, o
usuário não lê documentação linear: escaneia substantivos, botões e estados. Quanto mais texto é
adicionado para impedir interpretação errada, menor a chance de o texto crítico ser lido.

**Correção:** cortar pelo menos metade do texto visível no caminho básico. Manter uma frase de decisão e
mover causa técnica, privacidade detalhada e casos raros para ajuda contextual. Testar compreensão sem
permitir que o moderador explique a interface.

#### UX-7 — P1: a revisão oferece ações demais antes de mostrar o mínimo necessário

**Dificuldade:** média.
“Descartar repetidos”, “Descartar sem fala”, “Manter todos”, “Adicionar tela”, OCR, preencher fala com
nota, revisão quadro a quadro, vocabulário, hesitações, tradução e múltiplos idiomas são expostos como
trabalho potencial. Isso transforma uma verificação de qualidade em uma lista de deveres, sem dizer o
que é obrigatório.

**Correção:** começar com uma revisão automática resumida: “32 telas; 4 parecem repetidas; 2 não têm
fala”. Uma ação recomendada resolve o lote; “Revisar uma por uma” fica secundária. Marcar explicitamente
“opcional — seu documento já pode ser gerado”.

#### UX-8 — P1: a escolha de saída causa paralisia e não traduz formato em necessidade

**Dificuldade:** média.
Formatos são agrupados, mas o usuário ainda precisa conhecer PDF, DOCX, HTML, PPTX, ZIP, JSON, SCORM,
Jira e Google Docs. “Formato”, “O documento”, “Entregar em outro sistema” e “Dados e recuperação” são
categorias do sistema, não a pergunta do usuário: “o que devo baixar?”.

**Correção:** recomendar uma saída pelo cenário: “PDF para enviar à IA”, “Word para editar”, “Pacote de
evidências para anexar”. Ocultar o restante em “Ver todos os formatos”. JSON deve se chamar primeiro
“Projeto editável do Walkstamp”, deixando `.json` como detalhe.

#### UX-9 — P2: o fluxo vertical longo destrói contexto entre ação e resultado

**Dificuldade:** média.
Processos começam em um cartão, escrevem progresso em outro e produzem resultados muito abaixo. Mesmo
com rolagem automática e cartões expansíveis, a pessoa precisa lembrar onde estava, o que abriu e qual
passo mudou sozinho. Em notebooks, a conclusão frequentemente fica fora da dobra.

**Correção:** usar um cabeçalho de progresso persistente com estado e próxima ação; ao concluir uma etapa,
recolhê-la em um resumo e mover foco/rolagem para a única próxima ação. Nunca fazer conteúdo novo aparecer
acima da posição atual sem anúncio.

#### UX-10 — P2: a interface usa linguagem interna e alterna unidades conceituais

**Dificuldade:** baixa.
Quadro, frame, tela, passo, momento, trecho, tarefa, capítulo, documento, sessão e caso podem representar
objetos próximos, às vezes configuráveis pelo usuário. Isso é flexível nos documentos gerados, mas na
interface aumenta a carga mental: “passo 3” da ferramenta contém “Passo 3” do vídeo.

**Correção:** reservar **etapa** para o fluxo da ferramenta, **tela capturada** para imagem e **passo do
procedimento** para o conteúdo. O nome configurável deve afetar o documento final, não a navegação da
ferramenta.

### Leitura das informações

#### O que funciona

- mensagens explicam causa e consequência, não apenas “erro”;
- downloads mostram bytes, percentual e estimativa;
- resultados parciais aparecem durante a transcrição;
- ações irreversíveis costumam dizer o que será perdido;
- o caminho de privacidade é consistente e gera confiança.

#### O que falha

- a densidade faz mensagens importantes parecerem mais um parágrafo;
- “opcional” aparece em elementos que ainda ocupam grande espaço e atenção;
- comentários e decisões internas são excelentes, mas a interface resultante ainda reflete todas elas;
- há muitos rótulos compostos e explicativos, reduzindo velocidade de escaneamento;
- estado, instrução, alerta e justificativa frequentemente têm peso visual semelhante;
- a página exige leitura de cima a baixo, mas o comportamento é assíncrono e muda partes diferentes.

**Regra recomendada:** cada estado visível deve responder apenas três coisas: **o que aconteceu, o que
fazer agora e o que acontece se eu não fizer**. Explicações técnicas vão para “Detalhes”.

### Seguimento dos passos

O fluxo deveria ser progressivo, mas hoje é uma página de trabalho com etapas sugeridas. Os cartões
abertos, subpassos e ações paralelas permitem avançar antes de concluir, voltar sem perceber e gerar com
conteúdo parcial. Essa liberdade beneficia especialistas, porém enfraquece a orientação de iniciantes.

Recomendo um **wizard flexível**, não um bloqueio rígido:

1. barra persistente com `Entrada → Revisão → Saída`;
2. uma ação primária por estado;
3. etapas concluídas recolhidas em resumos editáveis;
4. avisos apenas quando a saída ficará materialmente incompleta;
5. “Pular revisão e gerar” disponível, com consequência concreta;
6. retorno a qualquer etapa sem perder dados.

### Conclusão da tarefa

Este é o ponto mais fraco. A interface sabe quando um arquivo foi gerado, mas não transforma isso em um
fim psicológico claro. Um download iniciado não garante que a pessoa saiba:

- onde o arquivo foi salvo;
- se contém fala completa;
- se poderá voltar e corrigir;
- se o vídeo/áudio ainda está na memória;
- se precisa também do JSON;
- se o prompt é obrigatório;
- qual é o próximo passo recomendado.

O estado final deveria ocupar o lugar do fluxo e dizer:

> **Pronto — seu documento foi baixado.** 32 telas e 118 trechos de fala. A transcrição está completa.
> Guarde também o projeto editável se pretende corrigir depois.

Com três ações, nesta ordem:

1. **Abrir/baixar novamente o documento**;
2. **Guardar projeto editável**;
3. **Criar outro documento**.

“Entregar ao Jira”, “copiar prompt”, “traduzir” e demais possibilidades devem aparecer depois, como
continuação opcional — não como prova de que o usuário talvez ainda não tenha terminado.

### Redesenho mínimo recomendado

Sem reescrever o produto, a maior melhora viria destas seis mudanças:

1. reduzir a navegação principal de quatro passos mais letras para três etapas reais;
2. dividir passo 1 em “novo”, “continuar” e “opcional”, sem letras sequenciais;
3. transformar fala em estado contextual, não em etapa opcional separada;
4. mostrar revisão automática resumida e esconder ferramentas avançadas;
5. recomendar uma saída e recolher os demais formatos;
6. criar uma tela inequívoca de conclusão com documento + projeto recuperável.

### Teste de usabilidade necessário

A avaliação acima é deliberadamente dura, mas continua heurística. Antes de redesenhar, executar cinco a
oito sessões de primeiro uso, sem tutorial, com gravação de tela e *think aloud*. Tarefas:

1. gravar dois minutos e gerar um PDF;
2. usar uma reunião já transcrita pelo Meet sem acionar Whisper;
3. corrigir uma tela e gerar novamente;
4. fechar e reabrir o trabalho;
5. dizer, ao final, se o trabalho está salvo e o que ainda falta.

Medir: tempo até a primeira ação correta, escolhas erradas, retornos de rolagem, textos efetivamente
lidos, pedidos de ajuda, tempo até documento, entendimento do JSON e confiança de conclusão. Critério
duro: se a pessoa perguntar “o que faço agora?” em mais de uma etapa, o fluxo falhou — não a pessoa.

## Ordem de execução recomendada

### Semana 1 — proteger a tarefa principal

1. Corrigir o autobloqueio e forçar WASM no fallback GPU → CPU.
2. Criar o teste de primeira inferência falhando.
3. Tornar os testes portáteis.
4. Adicionar marcas de tempo do funil e exportação do diagnóstico.

### Semanas 2–3 — medir e encurtar

1. Rodar a matriz cold/warm cache em pelo menos Windows/Chrome, macOS/Chrome e Safari.
2. Classificar erros e encurtar a árvore de fallback.
3. Antecipar a escolha “Mais rápido / Mais preciso”.
4. Adicionar “Parar e ficar com o parcial”.

### Depois dos números

1. Só investir em decodificação por blocos se o pico de memória for limitante real.
2. Só alterar compactação/VAD se a matriz apontar ganho com qualidade aceitável.
3. Encapsular o motor ASR e modularizar a fonte antes de ampliar backends/modelos.
4. Validar o fluxo em sessões de uso e com tecnologia assistiva.

## Métricas de aceite sugeridas

| Métrica | Meta inicial |
|---|---|
| Tempo até o primeiro texto, cache quente | p50 e p90 registrados por motor; sem regressão >10% |
| Fallback GPU → CPU | sem espera artificial; retry inicia em <2 s após descarte possível |
| Pipelines residentes | no máximo 1 depois de qualquer troca/falha |
| Fator de tempo real | publicado por modelo/motor/máquina de teste |
| Áudio enviado ao Whisper | percentual do áudio original, com cenário e qualidade associados |
| Trabalho parcial | 100% dos segmentos concluídos continuam copiáveis após parar/erro |
| Portabilidade da suíte | roda sem editar caminhos absolutos |
| Usabilidade | ≥4/5 participantes iniciam o caminho adequado sem ajuda |

## O que não recomendo agora

- aumentar threads além de quatro sem medir captura concorrente;
- trocar o modelo padrão antes de comparar tempo e qualidade em áudio representativo;
- adicionar um VAD neural apenas para “ter VAD”;
- virtualizar a grade ou otimizar JPEG para resolver lentidão da transcrição;
- contratar backend/GPU remota, pois contradiz a restrição local documentada;
- remover os fallbacks: eles devem ficar mais seletivos, não desaparecer;
- converter o artefato final em bundle com dependências de runtime: modularizar a **fonte** preserva a
  proposta do HTML único.

## Veredito

O Walkstamp tem uma base de desempenho mais madura do que a média de ferramentas browser-only, e a
documentação de decisões evita repetir experiências já refutadas. O maior retorno imediato não está em
um modelo novo: está em consertar o ciclo de vida do fallback, medir o funil completo e conduzir a pessoa
ao modo rápido antes de ela começar. Depois disso, árvore de fallback, cancelamento parcial e memória são
os próximos investimentos; uma reescrita ampla seria mais arriscada que útil.
