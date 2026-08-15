// Helper para chamar a API da Anthropic (servidor apenas).
// Configure no ambiente:
//   ANTHROPIC_API_KEY  -> chave da API
//   ANTHROPIC_MODEL    -> opcional; padrão claude-sonnet-4-6

export type ContentBlock = Record<string, unknown>;
type Msg = { role: "user" | "assistant"; content: string | ContentBlock[] };

export async function anthropic(messages: Msg[], system: string, maxTokens = 1200, modelo?: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada.");
  const model = (modelo && modelo.trim()) || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message || `Anthropic retornou ${res.status}`;
    throw new Error(msg);
  }
  const blocks = ((data as { content?: { type: string; text?: string }[] }).content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text || "");
  return blocks.join("\n").trim();
}
