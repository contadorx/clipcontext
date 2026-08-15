// Helper de acesso à API do Asaas (servidor apenas).
// Configure no ambiente:
//   ASAAS_API_KEY  -> chave da API (produção ou sandbox)
//   ASAAS_API_URL  -> base da API. Produção: https://api.asaas.com/v3
//                                   Sandbox:   https://api-sandbox.asaas.com/v3

const BASE = process.env.ASAAS_API_URL || "https://api.asaas.com/v3";

export type Ciclo = "mensal" | "semestral" | "anual";

export function cicloAsaas(ciclo: Ciclo): "MONTHLY" | "SEMIANNUALLY" | "YEARLY" {
  if (ciclo === "anual") return "YEARLY";
  if (ciclo === "semestral") return "SEMIANNUALLY";
  return "MONTHLY";
}

export async function asaasFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY não configurada no ambiente.");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: key,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const d = data as { errors?: { description?: string }[]; message?: string };
    const msg = d?.errors?.[0]?.description || d?.message || `Asaas retornou ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

// Data de hoje no formato YYYY-MM-DD (aceita por nextDueDate).
export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}
