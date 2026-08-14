# Quem são os concorrentes

Escrito em 14/08/2026, depois de "há quem são os concorrentes".

O Walkstamp tem dois casos de uso e, por isso, dois mapas de concorrência que quase não se
tocam. Vale ler separado — no primeiro você está entrando num bairro cheio; no segundo,
numa rua vazia.

---

## Mapa 1 — evidência de teste (o terreno bom)

### O concorrente que dói: FlowShare

`getflowshare.com`. É o mais perigoso porque faz quase tudo o que você quer fazer, e faz há
anos.

- Windows nativo. Captura **SAP GUI e Fiori** — inclusive o cliente pesado.
- Screenshot por passo, com descrição gerada automaticamente do que foi clicado.
- Exporta PDF, Word, HTML e PowerPoint.
- Diz com todas as letras que **funciona on-premise e sem dependência de nuvem**.
- **€37,50 por usuário/mês no plano anual** (≈ €450/ano).

**Onde ele perde:** não tem narração nem transcrição — a documentação sai muda. Não carimba
hora de relógio por passo. E, o mais importante para o seu público: **é um `.exe`**. Numa
estação de trabalho SAP travada por política corporativa, "instale este programa" é um
projeto com dono, aprovação e prazo. "Abra este site, nada sai da máquina" não é.

### Folge

`folge.me`. Desktop local, exporta PDF/Word/PPT/SCORM, marketing em cima de *"doesn't share
or send any information to the server"*. **Pagamento único: €75 pessoal, €130 empresarial.**
É o mais barato do grupo e o mais direto no argumento de privacidade. Mesma limitação do
FlowShare: instalação.

### O mundo enterprise

| ferramenta | o que faz | preço |
|---|---|---|
| **Tricentis Tosca** (DokuSnapper) | consolida evidência **por TestCase**, não por passo | não público — PeerSpot relata €10–20 mil/licença/ano |
| **qTest Explorer + qTest OnPremises** | a combinação enterprise mais próxima de "sem nuvem" | não público — ~US$ 19 mil/ano para 19 licenças |
| **Worksoft Certify** | automação de regressão SAP, documenta o que executa | projeto de implantação |
| **Panaya Test Dynamix** | vende literalmente "Automatic Test Evidence" — o posicionamento mais próximo do seu | nuvem |
| **Original Software** (Qualify/TestDrive) | *"captures every click and keystroke… rich audit trails"*, suporta ECC e S/4 | enterprise |
| **OpenText Sprinter** | teste manual, screenshot por passo, exporta Excel, roda sem licença de ALM | o legado esquecido |

Todas são ferramentas de **automação**: você modela o caso, elas executam, elas documentam.
Nenhuma resolve teste manual e exploratório feito uma vez só — que é a maior parte do que se
faz num UAT de verdade.

### Duas coisas que abrem espaço agora

**O Steps Recorder da Microsoft está descontinuado.** O banner apareceu na atualização do
Windows 11 de fevereiro de 2024. Ele ainda existe, mas a Microsoft recomenda Ferramenta de
Captura, Xbox Game Bar e Clipchamp — **nenhuma das três produz um documento de passos.**
Milhares de times de UAT e auditoria ficaram órfãos com uma tarefa que ainda é obrigatória.

**O SAP Solution Manager Test Suite sai da manutenção principal no fim de 2027** (estendida
até 2030). O sucessor, SAP Cloud ALM, exige **anexar screenshot à mão**. Ou seja: a
plataforma oficial da SAP está empurrando gente exatamente para o problema que você resolve.

(E o **SAP Signavio não é concorrente** — é process mining, outra coisa.)

---

## Mapa 2 — captura de passos e "contexto para IA" (o bairro cheio)

Scribe (US$ 13/usuário/mês), Tango (US$ 15), Guidde (US$ 19), Supademo (US$ 38), iorad
(US$ 500/mês por time). Todos bons, todos com muito mais dinheiro que você.

E todos com o mesmo buraco: **são exclusivamente nuvem, e são analfabetos em conformidade.**
Nenhum menciona evidência, retenção, integridade, 21 CFR Part 11 ou SOX. Eles vendem
produtividade para times de suporte e onboarding; não vendem prova para auditoria.

O único 100% navegador que achei é o **Mimik** (`github.com/westpoint-io/mimik`, MIT, ~79
estrelas, IndexedDB, sem backend). É prova de que a arquitetura funciona — e prova de que
ninguém profissionalizou a ideia.

---

## As cinco frestas

1. **Ninguém junta narração falada + transcrição à evidência.** Você fala enquanto testa; sai
   documentado. É o diferencial mais defensável que o produto tem.
2. **Ninguém carimba hora de relógio por passo.** Era o item eliminatório da sua lista — agora
   está feito.
3. **"Local" só existe como instalador de desktop.** Zero-install no navegador é uma fresta
   real, e é justamente a que importa numa máquina corporativa travada.
4. **Há um vácuo de preço de ~200×** entre US$ 89 pagamento único e US$ 19–70 mil/ano. Não há
   nada no meio.
5. **Integridade de evidência está intocada** por qualquer ferramenta pequena.

## A limitação que é honesto admitir

Navegador não enxerga **SAP GUI for Windows** (cliente pesado). O Walkstamp cobre Fiori, S/4
web, Ariba, SuccessFactors, Concur — e a captura de tela inteira pega qualquer janela que o
sistema operacional deixe compartilhar, mas sem a leitura de campo que o FlowShare faz no GUI.

Nesse terreno específico o FlowShare ganha, e dizer isso na página é melhor do que deixar a
pessoa descobrir depois de gravar. Quem só usa Fiori — que é para onde a SAP está empurrando
todo mundo — não perde nada.

---

## O que eu faria com este mapa

**Não competir com o FlowShare em cobertura.** Competir em **atrito**: ele precisa de
instalação, aprovação e €450/ano por pessoa; você precisa de um endereço. Numa comunidade de
testadores SAP, "abre e usa hoje" chega a dez pessoas antes de o FlowShare passar pela
segurança de uma.

**Roubar os órfãos do Steps Recorder.** É um público que já tinha a ferramenta, já tinha o
hábito, e ficou sem substituto. A busca por isso existe hoje e ninguém está respondendo bem.

**Nunca prometer conformidade.** Nem 21 CFR Part 11, nem SOX, nem CSV. O que se pode dizer com
verdade: *"produz a evidência visual; a trilha de aprovação continua no seu sistema de
mudanças"*. É o que está escrito no rodapé do documento gerado, e é o que sustenta a
credibilidade que o produto tem.
