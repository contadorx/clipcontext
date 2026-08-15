// Motor de importação agnóstico — configuração das entidades e utilitários de parse.
// Compartilhado pelo importador genérico (clientes, categorias, contas, plano de contas).

export type CampoTipo = "texto" | "valor" | "data" | "opcao" | "bool" | "ref";
export type OpcaoVal = { canonico: string; rotulo: string; sin: string[] };
export type CampoDef = {
  id: string;
  col: string; // coluna de destino no banco
  label: string;
  obrig?: boolean;
  dica?: string;
  tipo: CampoTipo;
  sinonimos: string[];
  opcoes?: OpcaoVal[]; // para tipo "opcao"
  refKey?: string; // para tipo "ref": qual mapa de referência usar
};
export type EntidadeConfig = {
  id: string;
  nome: string;
  tabela: string;
  descricao: string;
  campos: CampoDef[];
  refsUsadas?: string[];
  // ajustes finais no payload (ex.: derivar natureza, defaults)
  posProcessar?: (p: Record<string, unknown>, brutos: Record<string, string>) => Record<string, unknown>;
  modeloCsv: { header: string; exemplos: string[] };
};

export function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
export function decodificar(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (utf8.includes("\uFFFD")) {
    try { return new TextDecoder("windows-1252").decode(buf); } catch { return utf8; }
  }
  return utf8;
}
export function detectarDelim(linha: string): string {
  const pv = (linha.match(/;/g) || []).length;
  const v = (linha.match(/,/g) || []).length;
  const tab = (linha.match(/\t/g) || []).length;
  if (tab > 0 && tab >= pv && tab >= v) return "\t";
  return pv >= v ? ";" : ",";
}
export function parseCSV(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
export function parseData(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = "20" + y;
  const pad = (x: string) => x.padStart(2, "0");
  return `${y}-${pad(mo)}-${pad(d)}`;
}
export function parseValor(s: string): number {
  let t = s.replace(/[^\d.,-]/g, "").trim().replace(/-/g, "");
  if (!t) return 0;
  const temPonto = t.includes("."), temVirg = t.includes(",");
  if (temPonto && temVirg) {
    if (t.lastIndexOf(",") > t.lastIndexOf(".")) t = t.replace(/\./g, "").replace(",", ".");
    else t = t.replace(/,/g, "");
  } else if (temVirg) t = t.replace(",", ".");
  const n = parseFloat(t);
  return isNaN(n) ? 0 : Math.abs(n);
}
export function parseBool(s: string): boolean | null {
  const n = norm(s);
  if (!n) return null;
  if (/(analitic|sim|verdadeir|^s$|^v$|^x$|^1$|true|yes)/.test(n)) return true;
  if (/(sintetic|nao|falso|^n$|^f$|^0$|false|no|grupo|totaliz)/.test(n)) return false;
  return null;
}
export function casarOpcao(s: string, opcoes: OpcaoVal[]): string | null {
  const n = norm(s);
  if (!n) return null;
  for (const o of opcoes) if (o.sin.some((sin) => n === sin || n.includes(sin))) return o.canonico;
  return null;
}

// ───────────────────────── ENTIDADES ─────────────────────────

export const ENTIDADES: EntidadeConfig[] = [
  {
    id: "clientes",
    nome: "Clientes e fornecedores",
    tabela: "clientes_fornecedores",
    descricao: "Cadastro de pessoas: clientes, fornecedores, com CPF/CNPJ e contato.",
    campos: [
      { id: "nome", col: "nome", label: "Nome", obrig: true, tipo: "texto", sinonimos: ["nome", "razao social", "cliente", "fornecedor", "contato", "nome/razao social", "razao"] },
      { id: "tipo", col: "tipo", label: "Tipo", tipo: "opcao", sinonimos: ["tipo", "tipo de cadastro"],
        opcoes: [
          { canonico: "cliente", rotulo: "Cliente", sin: ["cliente", "client", "receber"] },
          { canonico: "fornecedor", rotulo: "Fornecedor", sin: ["fornecedor", "forn", "supplier", "pagar"] },
          { canonico: "ambos", rotulo: "Ambos", sin: ["ambos", "os dois", "cliente e fornecedor"] },
        ] },
      { id: "pessoa_tipo", col: "pessoa_tipo", label: "Pessoa (PF/PJ)", tipo: "opcao", sinonimos: ["pessoa", "tipo de pessoa", "pf/pj", "natureza juridica"],
        opcoes: [
          { canonico: "pf", rotulo: "Pessoa física", sin: ["pf", "fisica", "pessoa fisica", "cpf"] },
          { canonico: "pj", rotulo: "Pessoa jurídica", sin: ["pj", "juridica", "pessoa juridica", "cnpj"] },
        ] },
      { id: "cpf_cnpj", col: "cpf_cnpj", label: "CPF / CNPJ", tipo: "texto", sinonimos: ["cpf_cnpj", "cpf/cnpj", "documento", "cnpj", "cpf", "doc"] },
      { id: "email", col: "email", label: "E-mail", tipo: "texto", sinonimos: ["email", "e-mail", "mail"] },
      { id: "telefone", col: "telefone", label: "Telefone", tipo: "texto", sinonimos: ["telefone", "fone", "celular", "whatsapp", "tel"] },
      { id: "municipio", col: "municipio", label: "Município", tipo: "texto", sinonimos: ["municipio", "cidade"] },
      { id: "uf", col: "uf", label: "UF", tipo: "texto", sinonimos: ["uf", "estado"] },
      { id: "codigo_contabil", col: "codigo_contabil", label: "Conta contábil", tipo: "texto", sinonimos: ["codigo contabil", "conta contabil", "classificacao contabil", "reduzido", "codigo reduzido"] },
    ],
    posProcessar: (p) => {
      if (!p.tipo) p.tipo = "cliente";
      const doc = String(p.cpf_cnpj ?? "").replace(/\D/g, "");
      if (!p.pessoa_tipo && doc) p.pessoa_tipo = doc.length > 11 ? "pj" : "pf";
      return p;
    },
    modeloCsv: {
      header: "nome;tipo;cpf_cnpj;email;telefone;municipio;uf;codigo_contabil",
      exemplos: [
        "Padaria Estrela LTDA;cliente;12.345.678/0001-90;contato@estrela.com;11 99999-0000;São Paulo;SP;1.1.2.001",
        "João da Silva;fornecedor;123.456.789-00;joao@email.com;11 98888-0000;Santo André;SP;",
      ],
    },
  },
  {
    id: "categorias",
    nome: "Categorias financeiras",
    tabela: "categorias",
    descricao: "Plano de categorias de receitas e despesas, com a conta contábil de cada uma.",
    refsUsadas: ["grupos"],
    campos: [
      { id: "nome", col: "nome", label: "Nome", obrig: true, tipo: "texto", sinonimos: ["nome", "categoria", "descricao"] },
      { id: "tipo", col: "tipo", label: "Tipo", obrig: true, tipo: "opcao", sinonimos: ["tipo", "natureza", "receita/despesa", "entrada/saida"],
        opcoes: [
          { canonico: "receber", rotulo: "Receita (a receber)", sin: ["receber", "receita", "entrada", "credito", "credito"] },
          { canonico: "pagar", rotulo: "Despesa (a pagar)", sin: ["pagar", "despesa", "saida", "custo", "debito"] },
        ] },
      { id: "grupo", col: "grupo_id", label: "Grupo", tipo: "ref", refKey: "grupos", sinonimos: ["grupo", "grupo de categoria", "secao", "agrupamento"] },
      { id: "codigo_contabil", col: "codigo_contabil", label: "Conta contábil", tipo: "texto", sinonimos: ["codigo contabil", "conta contabil", "classificacao", "reduzido", "codigo reduzido", "conta"] },
    ],
    modeloCsv: {
      header: "nome;tipo;grupo;codigo_contabil",
      exemplos: ["Receita com serviços;receita;Receitas;3.1.01.001", "Energia elétrica;despesa;Despesas operacionais;4.1.02.005"],
    },
  },
  {
    id: "contas",
    nome: "Contas bancárias",
    tabela: "contas_bancarias",
    descricao: "Bancos e caixas, com saldo inicial e conta contábil.",
    campos: [
      { id: "nome", col: "nome", label: "Nome / apelido", obrig: true, tipo: "texto", sinonimos: ["nome", "conta", "descricao", "apelido"] },
      { id: "banco", col: "banco", label: "Banco", tipo: "texto", sinonimos: ["banco", "instituicao"] },
      { id: "agencia", col: "agencia", label: "Agência", tipo: "texto", sinonimos: ["agencia", "ag"] },
      { id: "conta_numero", col: "conta_numero", label: "Número da conta", tipo: "texto", sinonimos: ["conta corrente", "numero da conta", "conta numero", "cc", "numero"] },
      { id: "saldo_inicial", col: "saldo_inicial", label: "Saldo inicial", tipo: "valor", sinonimos: ["saldo", "saldo inicial", "saldo atual"] },
      { id: "codigo_contabil", col: "codigo_contabil", label: "Conta contábil", tipo: "texto", sinonimos: ["codigo contabil", "conta contabil", "classificacao", "reduzido"] },
    ],
    posProcessar: (p) => { if (p.saldo_inicial == null || p.saldo_inicial === "") p.saldo_inicial = 0; return p; },
    modeloCsv: {
      header: "nome;banco;agencia;conta_numero;saldo_inicial;codigo_contabil",
      exemplos: ["Conta Corrente;Itaú;1234;56789-0;1500,00;1.1.1.002", "Caixa;;;;0,00;1.1.1.001"],
    },
  },
  {
    id: "plano",
    nome: "Plano de contas contábil",
    tabela: "plano_contas",
    descricao: "Estrutura contábil (código, nome, tipo). Habilita o de-para das categorias.",
    campos: [
      { id: "codigo", col: "codigo", label: "Código", obrig: true, tipo: "texto", sinonimos: ["codigo", "conta", "classificacao", "codigo reduzido", "reduzido", "conta contabil"] },
      { id: "nome", col: "nome", label: "Nome / descrição", obrig: true, tipo: "texto", sinonimos: ["nome", "descricao", "titulo", "conta"] },
      { id: "tipo", col: "tipo", label: "Tipo", tipo: "opcao", sinonimos: ["tipo", "grupo", "natureza da conta", "classe"],
        opcoes: [
          { canonico: "ativo", rotulo: "Ativo", sin: ["ativo"] },
          { canonico: "passivo", rotulo: "Passivo", sin: ["passivo"] },
          { canonico: "patrimonio", rotulo: "Patrimônio líquido", sin: ["patrimonio", "pl", "patrimonio liquido"] },
          { canonico: "receita", rotulo: "Receita", sin: ["receita", "receitas"] },
          { canonico: "despesa", rotulo: "Despesa", sin: ["despesa", "despesas", "custo", "custos"] },
        ] },
      { id: "natureza", col: "natureza", label: "Natureza", tipo: "opcao", sinonimos: ["natureza", "d/c", "devedora/credora"],
        opcoes: [
          { canonico: "devedora", rotulo: "Devedora", sin: ["devedora", "devedor", "d"] },
          { canonico: "credora", rotulo: "Credora", sin: ["credora", "credor", "c"] },
        ] },
      { id: "analitica", col: "analitica", label: "Analítica?", tipo: "bool", sinonimos: ["analitica", "analitica/sintetica", "tipo conta", "nivel", "natureza conta"] },
    ],
    posProcessar: (p) => {
      if (!p.natureza && p.tipo) p.natureza = ["ativo", "despesa"].includes(String(p.tipo)) ? "devedora" : "credora";
      if (p.analitica == null) p.analitica = true;
      if (!p.tipo) p.tipo = "ativo";
      return p;
    },
    modeloCsv: {
      header: "codigo;nome;tipo;natureza;analitica",
      exemplos: ["3.1.01.001;Receita de serviços;receita;credora;analitica", "4.1.02.005;Energia elétrica;despesa;devedora;analitica"],
    },
  },
];

// Lê CSV ou Excel (.xlsx/.xls) e devolve as linhas como matriz de strings.
// O Excel é lido pela biblioteca SheetJS, carregada sob demanda (não pesa o bundle inicial).
export async function lerArquivoComoGrid(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  if (/\.xlsx?$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "", blankrows: false }) as unknown[][];
    return rows
      .map((r) => r.map((c) => (c == null ? "" : String(c).trim())))
      .filter((r) => r.some((c) => c !== ""));
  }
  const texto = decodificar(buf);
  const primeira = texto.split("\n").find((l) => l.trim() !== "") ?? "";
  return parseCSV(texto, detectarDelim(primeira));
}
