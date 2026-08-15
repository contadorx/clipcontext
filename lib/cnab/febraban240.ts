// Motor CNAB 240 (FEBRABAN) — núcleo compartilhado entre os bancos.
// Reúne os formatadores, o construtor de registro de 240 bytes e os helpers comuns
// usados por todos os geradores de remessa. As primitivas abaixo foram extraídas do
// gerador do Itaú (já homologado), sem alteração de comportamento.
// Cada banco fornece um BancoConfig e reutiliza estas primitivas.

// ---------- formatação ----------
export const so = (s: string | number | null | undefined) => String(s ?? "").replace(/\D/g, "");

export function semAcento(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ");
}
export function txt(v: string, len: number): string {
  return semAcento(String(v ?? ""))
    .toUpperCase()
    .slice(0, len)
    .padEnd(len, " ");
}
// Igual ao txt, mas SEM forçar maiúsculas (chave Pix aleatória é minúscula; e-mail é case-sensitive).
export function txtCase(v: string, len: number): string {
  return semAcento(String(v ?? "")).slice(0, len).padEnd(len, " ");
}
export function num(v: string | number, len: number): string {
  return so(v).slice(-len).padStart(len, "0");
}
export function valorCent(v: number, len: number): string {
  const c = Math.round((v || 0) * 100);
  return String(c).slice(-len).padStart(len, "0");
}
export function ddmmaaaa(iso: string): string {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}${m[2]}${m[1]}` : "00000000";
}
export function dataHoje(d: Date): string {
  return (
    String(d.getDate()).padStart(2, "0") +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getFullYear())
  );
}
export function horaAgora(d: Date): string {
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join("");
}

// Linha digitável (47) -> código de barras (44). null se não for boleto bancário.
export function linhaParaBarras(linha: string): string | null {
  const l = so(linha);
  if (l.length !== 47) return null;
  const banco = l.slice(0, 3);
  const moeda = l.slice(3, 4);
  const c1 = l.slice(4, 9);
  const c2 = l.slice(10, 20);
  const c3 = l.slice(21, 31);
  const dvGeral = l.slice(32, 33);
  const fatorValor = l.slice(33, 47); // fator de vencimento (4) + valor (10)
  return banco + moeda + dvGeral + fatorValor + (c1 + c2 + c3); // 44 posições
}

// Construtor posicional de um registro de 240 bytes (posições 1-based).
export function registro() {
  const arr = new Array(240).fill(" ");
  return {
    put(start: number, len: number, val: string) {
      const s = (val ?? "").padEnd(len, " ").slice(0, len);
      for (let i = 0; i < len; i++) arr[start - 1 + i] = s[i];
    },
    build() {
      return arr.join("");
    },
  };
}

// Tipo de chave Pix conforme Nota 37 (01 telefone, 02 e-mail, 03 CPF/CNPJ, 04 aleatória).
export function tipoChavePix(chave: string): "01" | "02" | "03" | "04" {
  const c = (chave || "").trim();
  if (c.includes("@")) return "02";
  if (c.startsWith("+")) return "01";
  const dig = c.replace(/\D/g, "");
  if (/^\d+$/.test(c) && (dig.length === 11 || dig.length === 14)) return "03";
  return "04"; // chave aleatória (UUID) ou fallback
}

// Configuração por banco para o layout CNAB 240. Cresce conforme cada banco é
// implementado e homologado (posições e particularidades vêm do manual de cada banco).
export type BancoConfig = {
  codigo: string; // código FEBRABAN do banco (3 dígitos), ex.: "341"
  nome: string; // nome do banco no header de arquivo, ex.: "BANCO ITAU SA"
  versaoLayoutArquivo: string; // versão de layout do header de arquivo (3 díg.)
  versaoLayoutLote: string; // versão de layout do header de lote (3 díg.)
  pixArquivoSeparado: boolean; // se Pix deve trafegar em arquivo próprio (Itaú/Caixa)
};
