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

// Consulta o endereço de um CEP no ViaCEP (gratuito, sem chave) e devolve os campos
// já normalizados para preencher o cadastro de cliente/fornecedor. O ViaCEP também
// retorna o código IBGE do município, útil para emissão de boleto/NFS-e.
export async function GET(_req: Request, { params }: { params: { cep: string } }) {
  if (!(await exigeSessao())) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const cep = (params.cep || "").replace(/\D/g, "");
  if (cep.length !== 8) {
    return NextResponse.json({ erro: "CEP deve ter 8 dígitos." }, { status: 400 });
  }
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ erro: "Falha ao consultar o CEP." }, { status: 502 });
    }
    const d = (await res.json()) as Record<string, unknown>;
    if (d.erro) {
      return NextResponse.json({ erro: "CEP não encontrado." }, { status: 404 });
    }
    return NextResponse.json({
      cep: (d.cep as string) ?? "",
      logradouro: (d.logradouro as string) ?? "",
      bairro: (d.bairro as string) ?? "",
      municipio: (d.localidade as string) ?? "",
      uf: (d.uf as string) ?? "",
      codigoIbge: (d.ibge as string) ?? "",
    });
  } catch {
    return NextResponse.json({ erro: "Não foi possível consultar agora. Tente de novo." }, { status: 502 });
  }
}
