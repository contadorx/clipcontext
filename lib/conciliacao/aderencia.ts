// ============================================================
// Aderência de conciliação — scoring transação ↔ lançamento
// Puro (sem dependências) para ser testável fora do app.
//
// Score 0–100 composto de:
//   valor  (até 45): exato = 45; diferença pequena decai proporcionalmente
//   data   (até 30): mesmo dia = 30; decai até 0 em ~25 dias
//   texto  (até 25): similaridade entre a descrição bancária e o
//                    lançamento (descrição + nome do cliente/fornecedor)
// ============================================================

const RUIDO_BANCARIO = new Set([
  "pix", "ted", "doc", "transf", "transferencia", "pagamento", "pagto", "pgto",
  "recebimento", "receb", "compra", "debito", "credito", "cartao", "boleto",
  "tarifa", "liquidacao", "liq", "cobranca", "cob", "titulo", "deb", "cred",
  "em", "de", "do", "da", "dos", "das", "para", "por", "com", "ltda", "me",
  "epp", "sa", "eireli", "cia", "ref", "referente", "fatura", "nf", "nfe",
  "enviado", "recebido", "autorizado", "internet", "banking", "agencia", "conta",
]);

export function normalizarTextoBanco(s: string | null | undefined): string[] {
  if (!s) return [];
  const semAcento = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return semAcento
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !RUIDO_BANCARIO.has(t) && !/^\d+$/.test(t));
}

// Similaridade 0–1 por sobreposição de tokens (Dice), com casamento
// por prefixo para abreviações bancárias ("estrel" ~ "estrela").
export function similaridadeTexto(a: string | null | undefined, b: string | null | undefined): number {
  const ta = normalizarTextoBanco(a);
  const tb = normalizarTextoBanco(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  let casados = 0;
  const usados = new Set<number>();
  for (const x of ta) {
    for (let i = 0; i < tb.length; i++) {
      if (usados.has(i)) continue;
      const y = tb[i];
      const menor = x.length <= y.length ? x : y;
      const maior = x.length <= y.length ? y : x;
      if (menor.length >= 4 ? maior.startsWith(menor.slice(0, Math.max(4, menor.length - 1))) : x === y) {
        usados.add(i);
        casados++;
        break;
      }
    }
  }
  return (2 * casados) / (ta.length + tb.length);
}

export type EntradaScore = {
  valorTransacao: number; // absoluto
  valorLancamento: number;
  diasDistancia: number; // |Δ| em dias
  textoTransacao: string | null;
  textoLancamento: string | null; // descrição + nome da pessoa concatenados
};

export function scoreAderencia(e: EntradaScore): number {
  const dif = Math.abs(e.valorTransacao - e.valorLancamento);
  const base = Math.max(e.valorTransacao, e.valorLancamento, 0.01);
  // valor: exato vale 45; diferença pequena decai suave (raiz) até 5%; acima, 0
  const pctDif = dif / base;
  const sValor = dif < 0.005 ? 45 : pctDif <= 0.05 ? Math.round(45 * Math.sqrt(1 - pctDif / 0.05) * 0.9) : 0;
  // data: 30 no mesmo dia, decai até 0 em 25 dias
  const d = Math.min(Math.abs(e.diasDistancia), 25);
  const sData = Math.round(30 * (1 - d / 25));
  // texto
  const sTexto = Math.round(25 * similaridadeTexto(e.textoTransacao, e.textoLancamento));
  return sValor + sData + sTexto;
}

export function bandaDoScore(score: number): "alta" | "media" | "baixa" {
  if (score >= 75) return "alta";
  if (score >= 50) return "media";
  return "baixa";
}

// Tolerância para sugerir par 1×1 com diferença (juros/multa ou desconto):
// até 5% do valor, com piso de R$ 1,00 e teto de R$ 50,00.
export function dentroDaTolerancia(valorTransacao: number, valorLancamento: number): boolean {
  const dif = Math.abs(valorTransacao - valorLancamento);
  if (dif < 0.005) return false; // exato não é "aproximado"
  const base = Math.max(valorTransacao, valorLancamento);
  return dif <= Math.min(Math.max(base * 0.05, 1), 50);
}
