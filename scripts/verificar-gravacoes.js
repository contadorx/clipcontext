/**
 * Reprova escrita no banco cujo erro não é lido.
 *
 * `supabase-js` devolve `{ data, error }` e **não lança**. Então
 * `await supabase.from("x").update(y).eq("id", id)` compila, roda, falha e segue
 * em frente — sem exceção, sem log, sem nada. `tsc` não vê, `next build` não vê,
 * e a tela mostra "salvo".
 *
 * O preço já foi cobrado várias vezes neste app: lançamento órfão dado como
 * salvo, boleto emitido duas vezes, remessa CNAB entregue ao banco sem registro,
 * baixa de recebimento perdida com a tela dizendo "liquidado com baixa no
 * financeiro", recorrência que diz "pausada" e continua gerando, crédito de IA
 * pago e não entregue, e webhook de pagamento respondendo 200 sem ter gravado
 * nada.
 *
 * Em todos os casos o diagnóstico já estava escrito num comentário ao lado. O
 * que faltou foi alguém verificar. Esta varredura é esse alguém.
 *
 * O que ela aceita:
 *   const { error } = await supabase.from("x").update(y).eq(...);
 *   const r = await supabase.from("x").insert(y);  if (r.error) ...
 *   return await supabase.from("x").insert(y);        // erro sobe para quem chamou
 *
 * O que ela reprova:
 *   await supabase.from("x").update(y).eq("id", id);
 *   const { data } = await supabase.from("x").insert(y).select().single();
 *   await supabase.rpc("estornar_credito_ia", { ... });
 *
 * Exceções conscientes vão em `PERMITIDAS`, com o motivo — que é o ponto: a
 * decisão de ignorar passa a estar escrita, não implícita.
 *
 * ---
 *
 * Nota sobre o critério, que já falhou uma vez.
 *
 * A primeira versão aceitava a escrita se a palavra `error` aparecesse em
 * qualquer lugar dentro de 40 linhas. Isso absolvia código pelo motivo errado:
 * o `error` de uma operação vizinha, ou de um comentário explicando justamente
 * que o erro não é tratado, dava o carimbo. Uma varredura que passa por
 * coincidência é pior que varredura nenhuma, porque produz confiança sem
 * cobertura.
 *
 * Agora o vínculo tem que ser explícito: ou o `error` é desestruturado no mesmo
 * comando, ou é lido pelo nome da variável que recebeu a escrita, ou o valor é
 * devolvido para quem chamou, ou passa por um helper que verifica por dentro.
 */
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const PASTAS = ["components", "app", "lib"];
// `.delete()` e também `.delete({ count: "exact" })` — a forma com opções
// existe no app e escapava da varredura por causa do `\(\s*\)`
const ESCRITA = /\.(insert|update|upsert)\(|\.delete\(\s*[){]/;
const TABELA = /\.from\(["'`]/;
const RPC = /\.rpc\(\s*["'`]([\w]+)["'`]/;

/**
 * `rpc()` que só lê. A falha aqui degrada a tela (lista vazia, painel sem
 * número) em vez de corromper dado, e o caminho de conserto é recarregar. As
 * demais — que reservam, estornam, creditam, criam, definem — passam pela
 * varredura como qualquer escrita.
 */
const RPC_LEITURA = new Set([
  "painel_negocio",
  "listar_colaboradores",
  "convite_info",
  "portal_dados",
]);

/*
  `portal_validar_sessao` e `portal_validar_magiclink` saíram desta lista: os
  dois consomem o token e devolvem sessão, ou seja, gravam. Os chamadores de
  hoje já leem o erro; a isenção só serviria para absolver um chamador futuro.
*/

/**
 * Casos já julgados. A varredura não falha por eles — mas cada um tem o motivo
 * escrito, que é a diferença entre uma decisão e um esquecimento.
 *
 * `ACEITAS`: ignorar o erro é a resposta certa ali.
 * `PENDENTES`: dívida conhecida, com o efeito descrito. Sai desta lista quando
 * for consertada; entrar nela exige escrever o que acontece se falhar.
 */
const ACEITAS = new Map([
  // arquivos inteiros
  ["components/ajuda/ajuda-client.tsx", "voto de utilidade em FAQ: telemetria, e insistir num voto perdido não vale um erro na tela"],
  ["components/suporte/suporte-chat.tsx", "registro da conversa de suporte: a mensagem já foi enviada por outro caminho"],
  ["app/api/suporte-ia/route.ts", "histórico do assistente: perder um turno de conversa não muda a resposta já entregue"],
  ["app/api/cron/digest-diario/route.ts", "marca de envio do digest: o pior caso é reenviar amanhã, e o cron confere a data antes"],
  ["app/api/cron/resumo-socio/route.ts", "idem, no resumo do sócio"],
  ["app/api/cron/regua-comunicacao/route.ts", "registro de toque da régua: o próximo ciclo recalcula pelo estado da assinatura"],
  ["app/api/cron/lembretes-boletos/route.ts", "limpeza de lembrete obsoleto: o registro velho não dispara nada sozinho"],
  ["lib/negocio.ts", "faturamento consolidado do painel do negócio: número gerencial, recalculado na próxima execução"],
  // linhas específicas
  ["components/conciliacao/conciliacao-client.tsx:2195", "aprender regra a partir do aceite: o próximo aceite tenta de novo, e falhar aqui não pode barrar a conciliação que já deu certo"],
  ["components/lancamentos/lancamento-modal.tsx:768", "idem — aprendizado de regra a partir do lançamento salvo"],
  ["app/api/cron/regua-cobranca/route.ts:250", "reversão de cupom expirado: `cupom_expira_em` continua preenchido, então o escritório volta à lista amanhã e o PUT no Asaas é idempotente — se conserta sozinho"],
  ["app/api/portal/enviar-documento/route.ts:149", "auditoria append-only do upload: o documento já foi registrado com verificação acima, e travar o envio do cliente por causa do log seria pior"],
]);

/**
 * Dívida conhecida. Cada entrada descreve o que acontece quando a gravação
 * falha — sem isso a linha não entra aqui.
 *
 * A chave é `arquivo:linha` e por isso envelhece: qualquer edição acima
 * desloca o número e o caso volta a aparecer como novo. É de propósito. Uma
 * chave que sobrevive a refatoração é uma chave que continua absolvendo código
 * que já mudou.
 */
const PENDENTES = new Map([
  ["components/vendas/boletos.tsx:464", "marca de venda totalmente coberta por boletos; a fila reavalia pelo vínculo dos títulos"],
  ["app/api/admin/impersonar/route.ts:72", "registro de impersonação: auditoria interna, mas deveria ser bloqueante"],
  ["app/api/admin/nfse/emitir/route.ts:127", "cache do código IBGE do município: a emissão desta vez funciona, a próxima consulta o município de novo"],
  ["app/api/nfse/emitir/route.ts:71", "idem, na emissão do próprio escritório"],
  ["app/api/documentos/baixar/route.ts:45", "documento aberto continua marcado como 'Novo' na Caixa de entrada: ninguém perde arquivo, mas a fila não anda"],
  ["app/api/documentos/extrair/route.ts:117", "consumo de IA no trial não contabilizado na extração: uso além da franquia"],
  ["app/api/ia/classificar/route.ts:178", "consumo de IA no trial não contabilizado: uso além da franquia"],
  ["app/api/ia/classificar/route.ts:216", "cache de sugestões da IA não gravado: a próxima classificação gasta crédito de novo pelo mesmo texto"],
  ["app/api/cron/regua-cobranca/route.ts:218", "marca de recuperação de churn enviada: o mesmo e-mail pode sair de novo amanhã para quem já recebeu"],
  ["app/api/ia/comprar/route.ts:43", "id de cliente Asaas não guardado: cria cliente duplicado na próxima compra"],
]);

/**
 * Arquivos inteiros já julgados (chave sem linha). Usado só onde a decisão vale
 * para o arquivo todo — telemetria, histórico de conversa, marca de cron.
 */
const ARQUIVOS_ACEITOS = new Set([...ACEITAS.keys()].filter((k) => !k.includes(":")));

function arquivos(dir, acc = []) {
  for (const nome of fs.readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next") continue;
    const p = path.join(dir, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) arquivos(p, acc);
    else if (/\.(ts|tsx)$/.test(nome)) acc.push(p);
  }
  return acc;
}

/**
 * O erro desta escrita está vinculado a ela? Só isso conta como tratado.
 *
 * @param head   linha onde o comando começa (`const … = await …`)
 * @param janela texto do comando até 40 linhas adiante
 */
function erroVinculado(head, janela, comando, texto, longa) {
  // const { data, error } = await …   /  const { error: e2 } = await …
  if (/(const|let|var)\s*\{[^}]*\berror\b/.test(head)) return true;
  // o valor sobe para quem chamou — a verificação é lá
  if (/^\s*return\s/.test(head)) return true;
  /*
    `const r = …` (ou `r = …`, ou o ternário `const r = cond ? … : …`) e depois
    `r.error` em algum lugar adiante. O alvo da atribuição é o que amarra: sem
    ele, qualquer `error` solto na vizinhança serviria de álibi.
  */
  // `=(?!=)` e não `=[^=]`: no ternário quebrado em linhas o `=` é o último
  // caractere da linha (`const marca =`), e exigir um caractere depois dele
  // fazia a variável não ser reconhecida justamente nos casos multilinha
  const nomeVar = /^\s*(?:const|let|var)?\s*(\w+)\s*=(?!=)/.exec(head);
  if (nomeVar) {
    const n = nomeVar[1];
    /*
      Janela longa aqui de propósito: `let resp; … resp = await …` é seguido de
      três ramos alternativos e o `if (resp.error)` comum vem sessenta linhas
      abaixo. O nome da variável é vínculo forte o bastante para aguentar a
      distância — diferente da palavra `error` solta, que não é.
    */
    const usoErro = new RegExp(`\\b${n}\\??\\.error\\b`).exec(longa);
    /*
      …mas só até a próxima declaração do MESMO nome.

      Nomes curtos (`r`, `ins`, `resp`, `rem`) se repetem a cada handler. Sem
      este corte, um `const r = await …update(…)` sem verificação era absolvido
      pelo `if (r.error)` de outro `const r` sessenta linhas abaixo, em outra
      função. O escopo real exigiria um parser; a redeclaração é a fronteira
      barata que resolve o caso que acontece de verdade.
    */
    if (usoErro) {
      // pula a própria linha do comando: a declaração que interessa é uma
      // SEGUNDA, mais adiante, que troca o significado do nome
      const inicioCorpo = longa.indexOf("\n") + 1;
      const antes = longa.slice(inicioCorpo, Math.max(inicioCorpo, usoErro.index));
      const redeclara = new RegExp(`(const|let|var)\\s+${n}\\s*=`, "g");
      if (!redeclara.test(antes)) return true;
    }
    // `await Promise.all([...])` devolve uma lista de respostas: o erro é lido
    // percorrendo, não em `.error` direto
    if (new RegExp(`\\b${n}\\.(filter|some|find|every|map|forEach)\\([\\s\\S]{0,80}?\\.error`).test(janela)) return true;
    /*
      `const q = supabase.from(...).delete()` sem `await` não escreve nada: é um
      construtor de consulta. A escrita acontece onde ele é executado —
      `const { error } = await q.eq(...)` — ou na função que o recebe de volta.
    */
    if (!/\bawait\b/.test(head)) {
      // a desestruturação tem que ser DO await deste construtor. Aceitar
      // qualquer `const { error }` da vizinhança é o mesmo erro de sempre:
      // `const q = …delete(); await q;` seguido de outra consulta verificada
      // passava sem que o `q` fosse checado por ninguém.
      if (new RegExp(`\\{[^}]*\\berror\\b[^}]*\\}\\s*=\\s*await\\s+${n}\\b`).test(janela)) return true;
      if (new RegExp(`\\b${n}\\s*=\\s*await\\s+${n}\\b`).test(janela)) return true;
      if (new RegExp(`return[^\\n]*\\b${n}\\b`).test(janela)) return true;
    }
  }
  /*
    Escrita empilhada para um `Promise.all` mais adiante:

      updates.push(supabase.from("x").update(y).eq("id", id));
      ...
      const resultados = await Promise.all(updates);
      const falhou = resultados.find((r) => r.error);

    O vínculo aqui é o nome do array, e a confirmação tem que estar no arquivo,
    não na janela — o `Promise.all` costuma vir dezenas de linhas depois.
  */
  const empilha = /(\w+)\.push\(/.exec(comando);
  if (empilha) {
    const arr = empilha[1];
    /*
      Não basta existir um `Promise.all(arr)` e um `.error` solto no arquivo —
      isso é de novo "a palavra error aparece por perto". O resultado do
      `Promise.all` precisa ser recebido numa variável e essa variável precisa
      ser percorrida procurando `.error`.
    */
    const recebe = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*await\\s+Promise\\.all\\(\\s*${arr}\\s*\\)`).exec(texto);
    if (recebe) {
      const res = recebe[1];
      if (new RegExp(`\\b${res}\\.(filter|some|find|every|map|forEach)\\([\\s\\S]{0,80}?\\.error`).test(texto)) return true;
    }
  }
  /*
    `.then(({ error }) => …)` — mas só no MESMO comando.

    Testar isto contra a janela de 40 linhas absolvia a escrita de cima pelo
    `.then` da escrita de baixo. Duas gravações vizinhas, uma verificada e uma
    não, e a varredura passava as duas.
  */
  if (/\.then\(\s*\(?\s*\{[^}]*\berror\b/.test(comando)) return true;
  /*
    Não existe mais regra de "tem o nome de um helper por perto".

    Havia uma lista — `gravar(`, `gravarSemBloquear(`, `gravarLinks(`,
    `liberarConciliacao(`… — testada contra a janela inteira. Ela absolvia
    qualquer escrita não verificada que estivesse a até 40 linhas de uma chamada
    desses nomes, inclusive DENTRO de `gravarLinks` e `liberarConciliacao`, que
    são as funções de maior risco do app. Pior: `gravarSemBloquear` e
    `lib/gravar.ts` nunca existiram neste repositório — a regra absolvia em nome
    de um helper imaginário. Quem quiser ignorar um erro conscientemente entra
    em `ACEITAS`, com o motivo escrito.
  */
  return false;
}

const achados = [];
for (const pasta of PASTAS) {
  const base = path.join(RAIZ, pasta);
  if (!fs.existsSync(base)) continue;
  for (const arq of arquivos(base)) {
    const rel = path.relative(RAIZ, arq).split(path.sep).join("/");
    if (ARQUIVOS_ACEITOS.has(rel)) continue;
    const texto = fs.readFileSync(arq, "utf8");
    const linhas = texto.split("\n");
    /*
      Dentro de bloco `/* … *\/`? Este projeto explica os problemas em
      comentários longos, e eles citam `.rpc()`, `.insert()` e `.delete()` como
      exemplo. Sem acompanhar o bloco, a varredura reprova a explicação do bug
      em vez do bug.
    */
    let emBloco = false;
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      const abre = l.lastIndexOf("/*");
      const fecha = l.lastIndexOf("*/");
      const eraBloco = emBloco;
      if (!emBloco && abre !== -1 && fecha < abre) emBloco = true;
      else if (emBloco && fecha !== -1 && fecha > abre) emBloco = false;
      if (eraBloco || emBloco) continue;
      if (/^\s*(\/\/|\*)/.test(l)) continue;
      /*
        `.rpc("nome", …)` com nome literal é classificado pela lista de leitura;
        `.rpc(variavel, …)` não dá para classificar, e o padrão seguro é tratar
        como escrita — errar para o lado de pedir verificação.
      */
      const mRpc = RPC.exec(l);
      const ehRpc = mRpc ? !RPC_LEITURA.has(mRpc[1]) : /\.rpc\(/.test(l);
      if (!ESCRITA.test(l) && !ehRpc) continue;

      /*
        Sobe até 12 linhas para achar onde o comando começa.

        Parar no primeiro `await` que aparece era errado no ternário:

          const resp = editId
            ? await supabase.from("x").update(...)   // <- parava aqui
            : await supabase.from("x").insert(...);
          if (resp.error) ...                        // <- e não via isto

        O começo é a linha que abre um comando (`const`/`let`/`return`/`await`
        na coluna) ou a primeira depois de um fim de comando.
      */
      let ini = i;
      for (let k = i; k >= Math.max(0, i - 12); k--) {
        ini = k;
        if (/^\s*(const|let|var|return|await)\s/.test(linhas[k])) break;
        const anterior = k > 0 ? linhas[k - 1].trimEnd() : "";
        if (anterior === "" || /[;{}]\s*$/.test(anterior)) break;
      }
      if (!ehRpc) {
        /*
          O `.from("tabela")` tem que estar no MESMO comando.

          Olhar seis linhas para trás pegava coisas como
          `createHash("sha256").update(token)` só porque havia um `.from(` num
          comando anterior. `update`/`insert`/`delete` são nomes comuns demais
          para aceitar vizinhança como prova.
        */
        if (!TABELA.test(linhas.slice(ini, i + 1).join(" "))) continue;
      }

      /*
        A janela precisa ser generosa: uma escrita com `.select().single()` e
        payload longo ocupa quinze linhas, e o `if (x.error)` vem depois disso.
        Ela é generosa no ALCANCE, não no critério — quem decide é
        `erroVinculado`, que exige o vínculo com esta escrita.
      */
      const janela = linhas.slice(ini, Math.min(linhas.length, i + 40)).join("\n");
      const longa = linhas.slice(ini, Math.min(linhas.length, i + 150)).join("\n");
      if (erroVinculado(linhas[ini], janela, linhas.slice(ini, i + 1).join("\n"), texto, longa)) continue;

      const chave = `${rel}:${ini + 1}`;
      if (PENDENTES.has(chave) || ACEITAS.has(chave)) continue;
      // um ternário tem duas escritas no mesmo comando: um achado, não dois
      if (achados.some((a) => a.chave === chave)) continue;
      achados.push({ chave, trecho: linhas[ini].trim().slice(0, 100) });
    }
  }
}

if (PENDENTES.size > 0) {
  console.warn(`aviso: ${PENDENTES.size} escrita(s) com erro descartado conhecidas e ainda não tratadas (ver PENDENTES).`);
}
if (achados.length === 0) {
  console.log(`ok: nenhuma escrita nova com erro descartado (${ACEITAS.size} aceitas, ${PENDENTES.size} pendentes).`);
  process.exit(0);
}

console.error(`\n${achados.length} escrita(s) no banco com o erro descartado:\n`);
for (const a of achados) console.error(`  ${a.chave}\n      ${a.trecho}`);
console.error(
  "\nsupabase-js não lança em erro de banco: sem ler `.error`, a falha é silenciosa e a tela mostra sucesso.",
);
console.error(
  "Leia `.error` e diga na tela o que ficou pendente. Se ignorar for mesmo a decisão certa, registre em ACEITAS neste arquivo com o motivo escrito.\n",
);
process.exit(1);
