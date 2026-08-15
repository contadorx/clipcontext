// Registry de bancos para CNAB. Define, por banco, quais layouts já estão
// disponíveis. Hoje só o Itaú tem o gerador de PAGAMENTO implementado e testado;
// os demais ficam com pagamento=false (a UI mostra "ainda não disponível" em vez
// de gerar um arquivo no formato errado). Cobrança (boletos a receber) é futuro.

export type CapacidadesBanco = {
  codigo: string;
  nome: string;
  prefixoArquivo: string; // usado no nome do .REM
  pagamento: boolean; // remessa de pagamento (saída) disponível?
  cobranca: boolean; // remessa de cobrança/boletos (entrada) disponível?
};

export const BANCOS_CNAB: Record<string, CapacidadesBanco> = {
  "341": { codigo: "341", nome: "Itaú", prefixoArquivo: "ITAU", pagamento: true, cobranca: false },
  "001": { codigo: "001", nome: "Banco do Brasil", prefixoArquivo: "BB", pagamento: true, cobranca: false },
  "033": { codigo: "033", nome: "Santander", prefixoArquivo: "SANTANDER", pagamento: true, cobranca: false },
  "237": { codigo: "237", nome: "Bradesco", prefixoArquivo: "BRADESCO", pagamento: true, cobranca: false },
  "756": { codigo: "756", nome: "Sicoob", prefixoArquivo: "SICOOB", pagamento: true, cobranca: false },
  "104": { codigo: "104", nome: "Caixa Econômica Federal", prefixoArquivo: "CAIXA", pagamento: true, cobranca: false },
};

export function bancoCnab(codigo: string | null | undefined): CapacidadesBanco | null {
  if (!codigo) return null;
  return BANCOS_CNAB[codigo] ?? null;
}

export function nomeBancoCnab(codigo: string | null | undefined): string {
  return bancoCnab(codigo)?.nome ?? (codigo || "—");
}

export function suportaPagamento(codigo: string | null | undefined): boolean {
  return !!bancoCnab(codigo)?.pagamento;
}

export function suportaCobranca(codigo: string | null | undefined): boolean {
  return !!bancoCnab(codigo)?.cobranca;
}

// Nomes dos bancos que já têm geração de remessa de pagamento (para textos da UI).
export function nomesBancosPagamento(): string {
  const nomes = Object.values(BANCOS_CNAB)
    .filter((b) => b.pagamento)
    .map((b) => b.nome);
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}
