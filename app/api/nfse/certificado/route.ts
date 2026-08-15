import { NextResponse } from "next/server";
import forge from "node-forge";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cifrarSegredo } from "@/lib/nfse/cripto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "certificados";

// Valida que o usuário autenticado é membro do escritório dono da empresa.
async function empresaDoUsuario(empresaId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // RLS: só retorna a empresa se o usuário for membro do escritório dono.
  const { data } = await supabase.from("empresas").select("id").eq("id", empresaId).maybeSingle();
  return data ? user : null;
}

export async function POST(req: Request) {
  try {
    if (!process.env.NFSE_CRYPTO_KEY || process.env.NFSE_CRYPTO_KEY.length !== 64) {
      return NextResponse.json(
        { error: "NFSE_CRYPTO_KEY não configurada no ambiente (64 caracteres hex)." },
        { status: 500 },
      );
    }
    const form = await req.formData();
    const empresaId = String(form.get("empresaId") ?? "");
    const senha = String(form.get("senha") ?? "");
    const arquivo = form.get("arquivo");
    if (!empresaId || !senha || !(arquivo instanceof File)) {
      return NextResponse.json({ error: "Informe o arquivo .pfx e a senha." }, { status: 400 });
    }
    if (arquivo.size > 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo maior que o esperado para um A1 (limite 1 MB)." }, { status: 400 });
    }
    const user = await empresaDoUsuario(empresaId);
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    // 1) valida o PFX com a senha e extrai titular/validade
    const buf = Buffer.from(await arquivo.arrayBuffer());
    let cn = "";
    let validade: Date | null = null;
    try {
      const asn1 = forge.asn1.fromDer(forge.util.createBuffer(buf.toString("binary")));
      const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
      const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = bags[forge.pki.oids.certBag]?.[0];
      const cert = certBag?.cert;
      if (!cert) throw new Error("sem certificado no arquivo");
      cn = cert.subject.getField("CN")?.value ?? "";
      validade = cert.validity.notAfter;
    } catch {
      return NextResponse.json(
        { error: "Não foi possível abrir o certificado — confira se o arquivo é um A1 (.pfx) e se a senha está correta." },
        { status: 400 },
      );
    }
    if (validade && validade.getTime() < Date.now()) {
      return NextResponse.json(
        { error: `Este certificado está vencido (${validade.toLocaleDateString("pt-BR")}). Envie um A1 válido.` },
        { status: 400 },
      );
    }

    // 2) armazena o arquivo no bucket privado (somente service role acessa)
    const admin = createAdminClient();
    const path = `${empresaId}.pfx`;
    const up = await admin.storage.from(BUCKET).upload(path, buf, {
      upsert: true,
      contentType: "application/x-pkcs12",
    });
    if (up.error) {
      return NextResponse.json({ error: `Falha ao armazenar: ${up.error.message}` }, { status: 500 });
    }

    // 3) grava config com a senha cifrada
    const { error: errCfg } = await admin.from("nfse_config").upsert(
      {
        empresa_id: empresaId,
        cert_path: path,
        cert_senha_cripto: cifrarSegredo(senha),
        cert_validade: validade?.toISOString() ?? null,
        cert_cn: cn || null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "empresa_id" },
    );
    if (errCfg) return NextResponse.json({ error: errCfg.message }, { status: 500 });

    return NextResponse.json({ ok: true, cn, validade: validade?.toISOString() ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro inesperado." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { empresaId } = (await req.json().catch(() => ({}))) as { empresaId?: string };
    if (!empresaId) return NextResponse.json({ error: "Empresa não informada." }, { status: 400 });
    const user = await empresaDoUsuario(empresaId);
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const admin = createAdminClient();
    await admin.storage.from(BUCKET).remove([`${empresaId}.pfx`]);
    const { error } = await admin
      .from("nfse_config")
      .update({ cert_path: null, cert_senha_cripto: null, cert_validade: null, cert_cn: null })
      .eq("empresa_id", empresaId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro inesperado." }, { status: 500 });
  }
}
