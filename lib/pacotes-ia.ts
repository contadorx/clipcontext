// Pacotes de crédito para análises por IA. Editável em um lugar só.
export type PacoteIA = { id: string; creditos: number; preco: number; selo?: string };

export const PACOTES_IA: PacoteIA[] = [
  { id: "p10", creditos: 10, preco: 3.99 },
  { id: "p30", creditos: 30, preco: 9.9, selo: "mais popular" },
  { id: "p100", creditos: 100, preco: 24.9, selo: "melhor valor" },
];

export function pacotePorId(id: string): PacoteIA | undefined {
  return PACOTES_IA.find((p) => p.id === id);
}
