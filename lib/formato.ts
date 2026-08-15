// Utilitários de máscara e formatação para inputs (pt-BR).
// Moeda usa o modelo "centavos": o usuário digita os dígitos e a formatação
// (vírgula decimal + ponto de milhar) é aplicada ao vivo.

export function soDigitos(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

// ---------- Moeda ----------

/** Formata o texto digitado como moeda pt-BR (sem símbolo). Ex.: "150000" -> "1.500,00". */
export function mascaraMoeda(input: string): string {
  const d = soDigitos(input);
  if (!d) return "";
  const n = parseInt(d, 10);
  return (n / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Converte o texto (mascarado ou cru) em número. Ex.: "1.500,00" -> 1500. */
export function parseMoeda(input: string): number {
  const d = soDigitos(input);
  if (!d) return 0;
  return parseInt(d, 10) / 100;
}

/** Converte um número para o formato exibido no input. Ex.: 1500.5 -> "1.500,50". */
export function moedaParaInput(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "";
  return Number(n).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------- CPF / CNPJ ----------

/** Aplica máscara de CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) conforme o tamanho. */
export function mascaraCpfCnpj(input: string): string {
  const d = soDigitos(input).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

// ---------- Telefone ----------

/** Aplica máscara de telefone: (00) 0000-0000 (fixo) ou (00) 00000-0000 (celular). */
export function mascaraTelefone(input: string): string {
  const d = soDigitos(input).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

// ---------- CEP ----------

/** Aplica máscara de CEP: 00000-000. */
export function mascaraCep(input: string): string {
  return soDigitos(input).slice(0, 8).replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

// ---------- Exibição (leitura) ----------
//
// Havia 58 cópias de `brl` em 53 arquivos e 22 de `dataBR`. A maioria idêntica,
// mas não todas: três telas definiam `brl` SEM o símbolo (só os dois decimais),
// porque o cabeçalho da coluna já dizia "R$". Por isso são duas funções com
// nomes diferentes, e não uma com flag — a diferença é de significado, e um
// parâmetro booleano acabaria sendo esquecido em algum lugar.

/** Valor monetário com símbolo: 1234.5 -> "R$ 1.234,50" */
export function brl(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Número com dois decimais, sem símbolo: 1234.5 -> "1.234,50" */
export function num2(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Valor abreviado para eixo de gráfico: 5400 -> "R$ 5k".
 *
 * Mantém o formato que os quatro gráficos já usavam. Trocar por "R$ 5 mil"
 * alargaria o rótulo do eixo e apertaria a área do desenho — o eixo existe para
 * dar ordem de grandeza, não para ser lido com precisão.
 */
export function brlCurto(v: number | null | undefined): string {
  const n = v ?? 0;
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
}

/**
 * Data ISO (AAAA-MM-DD) para o formato do dia a dia (DD/MM/AAAA).
 *
 * Faz o corte na string em vez de criar um `Date`: `new Date("2026-08-13")` é
 * interpretado como UTC meia-noite e, em fuso negativo, volta 12/08. Esse bug
 * já apareceu em relatório de fechamento.
 */
export function dataBR(s: string | null | undefined): string {
  if (!s) return "—";
  const [a, m, d] = s.slice(0, 10).split("-");
  if (!a || !m || !d) return s;
  return `${d}/${m}/${a}`;
}

/**
 * Moeda sem centavos, para o portal do cliente.
 *
 * O portal é leitura, não conferência: quem abre quer a ordem de grandeza do
 * mês, e "R$ 184.320" lê mais rápido do que "R$ 184.320,45". Dentro do app, que
 * é onde se confere valor contra extrato, os centavos ficam.
 */
export function brlRedondo(v: number | null | undefined): string {
  return Math.round(v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * A data de um **timestamp** (`timestamptz`), no fuso de quem está lendo.
 *
 * Use só para instantes gravados pelo sistema — "criado em", "enviado em". Para
 * data pura (`AAAA-MM-DD`: vencimento, competência, pagamento) use `dataBR`:
 * passar uma data pura por aqui a interpreta como UTC meia-noite e devolve o dia
 * anterior em fuso negativo, que é o bug que `dataBR` existe para evitar.
 *
 * Não mostra a hora — o nome diz de onde o valor vem, não o que aparece.
 */
export function dataDeTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}
