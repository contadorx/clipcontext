"use client";

import MASSA from "@/lib/bancada/massa.json";

/**
 * Faz a tela acreditar que tem banco.
 *
 * As bancadas montam telas de verdade, e telas de verdade buscam do Supabase.
 * Na máquina de quem escreveu isto, quem respondia era o Playwright — mas no
 * deploy não há Playwright nenhum, e as telas ficariam em esqueleto para
 * sempre. A massa precisa viajar junto com o app.
 *
 * Então isto troca o `fetch` do navegador: pedido para `/rest/v1/<tabela>`
 * devolve a tabela de `lib/bancada/massa.json`; escrita responde ok e não muda
 * nada; qualquer outra URL segue o caminho normal.
 *
 * Entende os filtros simples do PostgREST — `eq`, `neq`, `is`, `gt`, `gte`,
 * `lt`, `lte`, `in` — mais `order` e `limit`. Não entende junção nem `or`.
 *
 * A primeira versão devolvia a tabela inteira e deixava a tela filtrar, e isso
 * bastou até chegar a Conciliação: ela pergunta "as pendentes **desta** conta" e
 * "as pendentes das **outras**" na mesma tela, e sem filtro as duas respostas
 * eram iguais. Uma tela que se contradiz não serve de bancada.
 *
 * A troca acontece quando **o módulo carrega**, não dentro do componente. Na
 * primeira tentativa ela morava no inicializador de um `useState`, e não
 * funcionava: a página renderiza no servidor, chega ao navegador como HTML de
 * esqueleto, e qualquer tropeço entre isso e a hidratação deixa o esqueleto
 * para sempre — que foi exatamente o que aconteceu. Efeito de módulo roda ao
 * carregar o pedaço de JavaScript, antes de qualquer render, e não depende de a
 * hidratação dar certo.
 */
type Tabelas = Record<string, unknown>;

function cabecalho(init: RequestInit | undefined, nome: string): string {
  const h = init?.headers;
  if (!h) return "";
  if (h instanceof Headers) return h.get(nome) ?? "";
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === nome)?.[1] ?? "";
  const rec = h as Record<string, string>;
  return rec[nome] ?? rec[nome.toLowerCase()] ?? rec[nome.toUpperCase()] ?? "";
}

type Registro = Record<string, unknown>;

/** `eq.ct-1` → compara com `ct-1`; `is.null` → nulo; `in.(a,b)` → pertence. */
function passa(valor: unknown, expr: string): boolean {
  const i = expr.indexOf(".");
  if (i < 0) return true;
  const op = expr.slice(0, i);
  const bruto = expr.slice(i + 1);

  if (op === "is") return bruto === "null" ? valor == null : String(valor) === bruto;
  if (op === "in") {
    const itens = bruto.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
    return itens.includes(String(valor));
  }

  // `true`/`false` chegam como texto na URL; do outro lado são booleanos
  const alvo = bruto === "true" ? true : bruto === "false" ? false : bruto;
  switch (op) {
    case "eq":
      return String(valor) === String(alvo);
    case "neq":
      return String(valor) !== String(alvo);
    case "gt":
      return String(valor) > String(alvo);
    case "gte":
      return String(valor) >= String(alvo);
    case "lt":
      return String(valor) < String(alvo);
    case "lte":
      return String(valor) <= String(alvo);
    default:
      // operador que esta bancada não conhece (`like`, `or`, `not`): deixa passar,
      // porque esconder linha por ignorância é pior do que mostrar demais
      return true;
  }
}

const NAO_SAO_FILTRO = new Set(["select", "order", "limit", "offset", "apikey", "columns", "on_conflict"]);

function filtrar(linhas: Registro[], url: string): Registro[] {
  let q: URLSearchParams;
  try {
    q = new URL(url, "https://exemplo.local").searchParams;
  } catch {
    return linhas;
  }

  // `Array.from` em vez de `for…of` sobre o iterador: o alvo do TypeScript
  // deste projeto é anterior a es2015 e não itera iteradores diretamente
  const condicoes = Array.from(q.entries()).filter(([chave]) => !NAO_SAO_FILTRO.has(chave));
  let saida = linhas.filter((linha) => condicoes.every(([chave, expr]) => passa(linha[chave], expr)));

  const order = q.get("order");
  if (order) {
    const [campo, dir] = order.split(".");
    const desc = dir === "desc";
    saida = [...saida].sort((a, b) => {
      const x = String(a[campo] ?? "");
      const y = String(b[campo] ?? "");
      return desc ? (x < y ? 1 : x > y ? -1 : 0) : x < y ? -1 : x > y ? 1 : 0;
    });
  }

  const limit = Number(q.get("limit"));
  if (Number.isFinite(limit) && limit > 0) saida = saida.slice(0, limit);
  return saida;
}

function instalar(): boolean {
  if (typeof window === "undefined") return true;
  const w = window as unknown as { __bancadaFetch?: boolean };
  if (w.__bancadaFetch) return true;
  w.__bancadaFetch = true;

  const original = window.fetch.bind(window);
  const dados = MASSA as Tabelas;

  window.fetch = async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;

    if (url.includes("/auth/v1/")) {
      return new Response(JSON.stringify({ user: { id: "user-1", email: "bancada@exemplo" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const m = /\/rest\/v1\/([^?/]+)/.exec(url);
    if (!m) return original(entrada, init);

    const metodo =
      init?.method ??
      (typeof entrada === "object" && "method" in entrada ? (entrada as Request).method : "GET") ??
      "GET";
    // `HEAD` é leitura, não escrita: é o que o Supabase manda quando a tela pede
    // só a contagem (`{ count: "exact", head: true }`). Tratá-lo como escrita
    // devolvia lista vazia e a tela dizia "0 pendentes" com seis no arreio.
    const eLeitura = metodo.toUpperCase() === "GET" || metodo.toUpperCase() === "HEAD";
    if (!eLeitura) {
      return new Response("[]", { status: 201, headers: { "content-type": "application/json" } });
    }

    const linhas = filtrar((dados[m[1]] as Registro[]) ?? [], url);
    // `.single()` e `.maybeSingle()` pedem objeto, não lista — sem isto, toda
    // tela que busca um registro só recebe um array e quebra
    const aceita = cabecalho(init, "Accept");
    const corpo = aceita.includes("vnd.pgrst.object") ? linhas[0] ?? null : linhas;

    /*
      `Content-Range` no formato do PostgREST, e corpo vazio — não `null` — na
      contagem.

      O `fetch` do navegador aceita `null` como corpo, mas o cliente do Supabase
      tenta lê-lo mesmo em `HEAD`; com `null` a leitura falha e derruba o
      `Promise.all` inteiro da tela, que fica sem lista **e** sem contagem. Foi
      o que manteve a Conciliação vazia mesmo depois de a massa estar certa.

      Quando não há linha nenhuma, o PostgREST responde `* /0`, não `0-0/0` —
      `0-0` significaria "um item".
    */
    const total = linhas.length;
    const faixa = total === 0 ? `*/0` : `0-${total - 1}/${total}`;
    const ehHead = metodo.toUpperCase() === "HEAD";
    return new Response(ehHead ? "" : JSON.stringify(corpo), {
      status: 200,
      headers: { "content-type": "application/json", "content-range": faixa },
    });
  };
  return true;
}

// efeito de módulo: acontece assim que este arquivo é avaliado no navegador
instalar();

export default function DadosFalsos({ children }: { children: React.ReactNode }) {
  // o componente existe para marcar, no JSX, quais telas usam massa inventada —
  // quem instala é a linha acima
  return <>{children}</>;
}
