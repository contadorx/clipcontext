// Bancos prioritários para CNAB (código FEBRABAN).
export type Banco = { codigo: string; nome: string };

export const BANCOS: Banco[] = [
  { codigo: "001", nome: "Banco do Brasil" },
  { codigo: "033", nome: "Santander" },
  { codigo: "237", nome: "Bradesco" },
  { codigo: "341", nome: "Itaú" },
  { codigo: "756", nome: "Sicoob" },
];

export function nomeBanco(codigo: string | null | undefined): string {
  if (!codigo) return "—";
  return BANCOS.find((b) => b.codigo === codigo)?.nome ?? codigo;
}
