import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ibgePorMunicipioUf } from "@/lib/nfse/ibge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// Resolve o código IBGE do município emissor a partir de município + UF
// (que a empresa já tem cadastrados, vindos da Receita). Evita digitação manual
// do código, que ninguém sabe de cabeça.
export async function GET(req: Request) {
  if (!(await exigeSessao())) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const municipio = searchParams.get("municipio") ?? "";
  const uf = searchParams.get("uf") ?? "";
  if (!municipio.trim() || uf.trim().length !== 2) {
    return NextResponse.json({ erro: "Informe município e UF (2 letras)." }, { status: 400 });
  }
  const codigo = await ibgePorMunicipioUf(municipio, uf);
  if (!codigo) {
    return NextResponse.json(
      { erro: "Município não encontrado no IBGE. Confira a grafia do município e a UF no cadastro da empresa." },
      { status: 404 },
    );
  }
  return NextResponse.json({ codigoIbge: codigo, municipio: municipio.trim(), uf: uf.trim().toUpperCase() });
}
