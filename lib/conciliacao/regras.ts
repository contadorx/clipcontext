// ============================================================
// Regras de classificação — matcher compartilhado
// A mesma mecânica da conciliação (assinatura por palavras-chave,
// contenção total, regra mais específica vence), extraída para
// agir também no modal de lançamento e na importação.
// Pura (sem dependências) para ser testável fora do app.
// ============================================================

export type RegraClassificacao = {
  id: string;
  padrao: string;
  tipo: string; // "entrada" | "saida"
  categoria_id: string;
  cliente_fornecedor_id: string | null;
};

export function tokensRegra(str: string | null | undefined): string[] {
  return (str ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

export function palavrasChaveRegra(s: string | null | undefined): string[] {
  return tokensRegra(s).filter((w) => !/^\d+$/.test(w));
}

export function assinaturaRegra(s: string | null | undefined): string {
  return palavrasChaveRegra(s).join(" ");
}

// Casa a melhor regra para uma descrição: todas as palavras do padrão
// precisam estar na descrição; entre as que casam, vence a mais específica.
export function matchRegra(
  descricao: string | null | undefined,
  tipo: string,
  regras: RegraClassificacao[],
): RegraClassificacao | null {
  const palavras = new Set(palavrasChaveRegra(descricao));
  if (palavras.size === 0) return null;
  let melhor: RegraClassificacao | null = null;
  let melhorN = 0;
  for (const r of regras) {
    if (r.tipo !== tipo) continue;
    const rp = r.padrao.split(" ").filter(Boolean);
    if (rp.length === 0) continue;
    if (rp.every((w) => palavras.has(w)) && rp.length > melhorN) {
      melhor = r;
      melhorN = rp.length;
    }
  }
  return melhor;
}

// ---------- regras de ESCRITÓRIO (escopo carteira) ----------
// Guardam NOMES (categoria/pessoa), resolvidos para os IDs da empresa
// corrente na hora de aplicar. Categoria inexistente na empresa → a
// regra é descartada; pessoa inexistente → aplica só a categoria.

export type RegraEscritorio = {
  id: string;
  padrao: string;
  tipo: string;
  categoria_nome: string;
  pessoa_nome: string | null;
};

export function normNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function resolverRegrasEscritorio(
  globais: RegraEscritorio[],
  categorias: { id: string; nome: string; tipo: string }[],
  pessoas: { id: string; nome: string }[],
): RegraClassificacao[] {
  const catPorNome = new Map<string, { id: string; tipo: string }[]>();
  for (const c of categorias) {
    const k = normNome(c.nome);
    catPorNome.set(k, [...(catPorNome.get(k) ?? []), { id: c.id, tipo: c.tipo }]);
  }
  const pessoaPorNome = new Map<string, string>();
  for (const p of pessoas) pessoaPorNome.set(normNome(p.nome), p.id);

  const out: RegraClassificacao[] = [];
  for (const g of globais) {
    const tCat = g.tipo === "entrada" ? "receber" : "pagar";
    const cands = catPorNome.get(normNome(g.categoria_nome)) ?? [];
    const cat = cands.find((c) => c.tipo === tCat) ?? cands[0];
    if (!cat) continue; // a empresa não tem essa categoria — regra não vale aqui
    out.push({
      id: g.id,
      padrao: g.padrao,
      tipo: g.tipo,
      categoria_id: cat.id,
      cliente_fornecedor_id: g.pessoa_nome ? (pessoaPorNome.get(normNome(g.pessoa_nome)) ?? null) : null,
    });
  }
  return out;
}

// Local vence a global no mesmo padrão+tipo (override por empresa).
export function combinarRegras(
  locais: RegraClassificacao[],
  globaisResolvidas: RegraClassificacao[],
): (RegraClassificacao & { origem: "empresa" | "escritorio" })[] {
  const chavesLocais = new Set(locais.map((r) => `${r.padrao}\u0000${r.tipo}`));
  return [
    ...locais.map((r) => ({ ...r, origem: "empresa" as const })),
    ...globaisResolvidas
      .filter((g) => !chavesLocais.has(`${g.padrao}\u0000${g.tipo}`))
      .map((r) => ({ ...r, origem: "escritorio" as const })),
  ];
}
