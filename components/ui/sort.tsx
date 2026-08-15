"use client";

import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export type Dir = "asc" | "desc";
export type Ordenacao = { campo: string; dir: Dir };

type Getter<T> = (x: T) => number | string | null | undefined;

// Alterna a direção quando o mesmo campo é clicado; troca de campo recomeça na direção inicial.
export function toggleOrd(prev: Ordenacao, campo: string, inicial: Dir = "desc"): Ordenacao {
  if (prev.campo === campo) return { campo, dir: prev.dir === "asc" ? "desc" : "asc" };
  return { campo, dir: inicial };
}

// Ordena uma cópia do array. Valores nulos vão sempre para o fim, independente da direção.
export function ordenar<T>(arr: T[], ord: Ordenacao, getters: Record<string, Getter<T>>): T[] {
  const g = getters[ord.campo];
  if (!g) return arr;
  const fator = ord.dir === "asc" ? 1 : -1;
  return [...arr].sort((a, b) => {
    const va = g(a);
    const vb = g(b);
    const na = va == null || va === "";
    const nb = vb == null || vb === "";
    if (na && nb) return 0;
    if (na) return 1;
    if (nb) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * fator;
    return String(va).localeCompare(String(vb), "pt-BR") * fator;
  });
}

// Cabeçalho clicável. Funciona dentro de <th>, <span> de grid, etc.
export function SortToggle({
  label,
  campo,
  ord,
  onToggle,
  align = "left",
  inicial = "desc",
  className = "",
}: {
  label: string;
  campo: string;
  ord: Ordenacao;
  onToggle: (campo: string, inicial: Dir) => void;
  align?: "left" | "right";
  inicial?: Dir;
  className?: string;
}) {
  const ativo = ord.campo === campo;
  const Icon = !ativo ? ArrowUpDown : ord.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(campo, inicial)}
      className={`group inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""} font-semibold transition hover:text-ink ${ativo ? "text-ink" : ""} ${className}`}
      title={`Ordenar por ${label}`}
    >
      <span>{label}</span>
      <Icon size={12} className={ativo ? "text-brand" : "text-ink-soft/50 group-hover:text-ink-soft"} />
    </button>
  );
}
