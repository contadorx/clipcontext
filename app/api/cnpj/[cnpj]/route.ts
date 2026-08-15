import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/*
  Exige sessão.

  Estas rotas são proxy de consulta a serviços públicos (ViaCEP, base de CNPJ) e
  não liam dado nosso — por isso nunca tiveram guarda. Enquanto `/api` passava
  pelo middleware, a checagem de sessão de lá as protegia por acidente; com
  `/api` fora do matcher, o acidente acabou. Sem guarda, viram proxy aberto no
  nosso domínio: o limite de requisição do provedor é gasto por terceiros e o
  bloqueio, quando vier, cai sobre quem está cadastrando fornecedor.
*/
async function exigeSessao(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

// Consulta dados públicos do CNPJ com cadeia de fontes (resiliência).
// A base pública da Receita é instável e de fonte única em cada provedor;
// tentamos em ordem e usamos a primeira que responder com dados.

type Saida = {
  razaoSocial: string;
  nomeFantasia: string;
  uf: string;
  municipio: string;
  regimeSugerido: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
};

async function buscar(
  url: string,
  ms = 7000,
): Promise<{ status: number; data: Record<string, unknown> | null } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    let data: Record<string, unknown> | null = null;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch {
    return null; // timeout ou erro de rede
  } finally {
    clearTimeout(t);
  }
}

// Shape "minha-receita" (BrasilAPI e minhareceita.org compartilham os campos).
function normMinhaReceita(d: Record<string, unknown>): Saida | null {
  const razao = (d.razao_social as string) ?? "";
  const fantasia = (d.nome_fantasia as string) ?? "";
  if (!razao && !fantasia) return null;
  const mei = d.opcao_pelo_mei === true;
  const simples = d.opcao_pelo_simples === true;
  return {
    razaoSocial: razao,
    nomeFantasia: fantasia,
    uf: (d.uf as string) ?? "",
    municipio: (d.municipio as string) ?? "",
    regimeSugerido: mei ? "MEI" : simples ? "Simples Nacional" : "",
    cep: ((d.cep as string) ?? "").replace(/\D/g, ""),
    logradouro: (d.logradouro as string) ?? "",
    numero: (d.numero as string) ?? "",
    complemento: (d.complemento as string) ?? "",
    bairro: (d.bairro as string) ?? "",
  };
}

// Shape ReceitaWS (infra/fonte diferente; rate limit baixo, por isso é o último).
function normReceitaWS(d: Record<string, unknown>): Saida | null {
  if (d.status === "ERROR") return null;
  const nome = (d.nome as string) ?? "";
  if (!nome) return null;
  const simplesObj = d.simples as Record<string, unknown> | undefined;
  const simples = simplesObj?.optante === true;
  return {
    razaoSocial: nome,
    nomeFantasia: (d.fantasia as string) ?? "",
    uf: (d.uf as string) ?? "",
    municipio: (d.municipio as string) ?? "",
    regimeSugerido: simples ? "Simples Nacional" : "",
    cep: ((d.cep as string) ?? "").replace(/\D/g, ""),
    logradouro: (d.logradouro as string) ?? "",
    numero: (d.numero as string) ?? "",
    complemento: (d.complemento as string) ?? "",
    bairro: (d.bairro as string) ?? "",
  };
}

export async function GET(_req: Request, { params }: { params: { cnpj: string } }) {
  if (!(await exigeSessao())) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const cnpj = (params.cnpj || "").replace(/\D/g, "");
  if (cnpj.length !== 14) {
    return NextResponse.json({ erro: "CNPJ deve ter 14 dígitos." }, { status: 400 });
  }

  const fontes: { url: string; norm: (d: Record<string, unknown>) => Saida | null }[] = [
    { url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, norm: normMinhaReceita },
    { url: `https://minhareceita.org/${cnpj}`, norm: normMinhaReceita },
    { url: `https://receitaws.com.br/v1/cnpj/${cnpj}`, norm: normReceitaWS },
  ];

  let naoEncontrado = false;

  for (const f of fontes) {
    const r = await buscar(f.url);
    if (!r) continue; // rede/timeout: tenta a próxima fonte
    if (r.status === 404) {
      naoEncontrado = true;
      continue;
    }
    if (r.status === 200 && r.data) {
      const saida = f.norm(r.data);
      if (saida) return NextResponse.json(saida);
    }
    // outros status (429, 5xx): cai para a próxima fonte
  }

  if (naoEncontrado) {
    return NextResponse.json({ erro: "CNPJ não encontrado na base da Receita." }, { status: 404 });
  }
  return NextResponse.json(
    {
      erro: "As bases públicas da Receita estão instáveis agora. Tente de novo em instantes ou preencha manualmente.",
    },
    { status: 502 },
  );
}
