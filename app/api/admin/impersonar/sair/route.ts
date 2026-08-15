import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = cookies();
  const raw = cookieStore.get("fx_admin_sess")?.value;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { a: string; r: string; uid: string };
      const supabase = createClient();
      // restaura a sessão original do admin
      await supabase.auth.setSession({ access_token: parsed.a, refresh_token: parsed.r });
    } catch {
      /* cookie corrompido: apenas limpa abaixo */
    }
  }

  cookieStore.delete("fx_admin_sess");
  cookieStore.delete("fx_imp");

  return NextResponse.json({ ok: true });
}
