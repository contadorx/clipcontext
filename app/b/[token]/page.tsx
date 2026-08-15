import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import BotaoImprimir from "@/components/boleto/botao-imprimir";
import FichaBoleto, { type ContaFicha, type EmpresaFicha, type TituloFicha } from "@/components/boleto/ficha-boleto";

export const dynamic = "force-dynamic";

// Página pública do boleto (2ª via para o sacado). Acesso por token
// aleatório de 64 caracteres — sem login, sem listagem, sem enumeração.

export default async function BoletoPublicoPage({ params }: { params: { token: string } }) {
  const token = params.token ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) notFound();

  const admin = createAdminClient();
  const { data: t } = await admin
    .from("cobranca_titulos")
    .select(
      "id, empresa_id, conta_id, nosso_numero_fmt, numero_documento, valor, vencimento, sacado_nome, sacado_documento, sacado_logradouro, sacado_cep, sacado_municipio, sacado_uf, linha_digitavel, codigo_barras, criado_em, status",
    )
    .eq("token_publico", token)
    .maybeSingle();
  if (!t) notFound();

  const [{ data: empresa }, { data: conta }] = await Promise.all([
    admin.from("empresas").select("nome, razao_social, cnpj_cpf").eq("id", t.empresa_id).maybeSingle(),
    admin
      .from("contas_bancarias")
      .select("banco_codigo, agencia, agencia_dv, conta_numero, conta_dv, convenio, carteira, juros_mes_pct, multa_pct")
      .eq("id", t.conta_id)
      .maybeSingle(),
  ]);

  const pago = t.status === "liquidado";

  return (
    <main className="mx-auto max-w-[800px] p-6 font-sans text-neutral-900 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          <p className="text-sm font-semibold text-neutral-800">
            Boleto de {empresa?.razao_social ?? empresa?.nome ?? "cobrança"}
          </p>
          <p className="text-xs text-neutral-500">
            {pago
              ? "Este boleto já consta como pago — nenhuma ação necessária."
              : "Pague pelo código de barras, pela linha digitável ou imprima a via."}
          </p>
        </div>
        {!pago && <BotaoImprimir />}
      </div>
      {pago ? (
        <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-8 text-center">
          <p className="text-lg font-bold text-neutral-800">Boleto pago ✓</p>
          <p className="mt-1 text-sm text-neutral-600">
            O pagamento deste boleto já foi identificado. Em caso de dúvidas, fale com{" "}
            {empresa?.razao_social ?? empresa?.nome ?? "o beneficiário"}.
          </p>
        </div>
      ) : (
        <FichaBoleto t={t as TituloFicha} empresa={empresa as EmpresaFicha} conta={conta as ContaFicha} />
      )}
    </main>
  );
}
