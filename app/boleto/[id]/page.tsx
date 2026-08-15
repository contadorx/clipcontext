import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BotaoImprimir from "@/components/boleto/botao-imprimir";
import FichaBoleto, { type ContaFicha, type EmpresaFicha, type TituloFicha } from "@/components/boleto/ficha-boleto";

export const dynamic = "force-dynamic";

export default async function BoletoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  // RLS: só membros do escritório dono enxergam o título.
  const { data: t } = await supabase
    .from("cobranca_titulos")
    .select(
      "id, empresa_id, conta_id, nosso_numero_fmt, numero_documento, valor, vencimento, sacado_nome, sacado_documento, sacado_logradouro, sacado_cep, sacado_municipio, sacado_uf, linha_digitavel, codigo_barras, criado_em, status",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!t) notFound();

  const [{ data: empresa }, { data: conta }] = await Promise.all([
    supabase.from("empresas").select("nome, razao_social, cnpj_cpf").eq("id", t.empresa_id).maybeSingle(),
    supabase
      .from("contas_bancarias")
      .select("banco_codigo, agencia, agencia_dv, conta_numero, conta_dv, convenio, carteira, juros_mes_pct, multa_pct")
      .eq("id", t.conta_id)
      .maybeSingle(),
  ]);

  return (
    <main className="mx-auto max-w-[800px] p-6 font-sans text-neutral-900 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-neutral-600">
          Boleto {t.status === "gerado" ? "(ainda não registrado no banco — registre via remessa antes de enviar ao cliente)" : ""}
        </p>
        <BotaoImprimir />
      </div>
      <FichaBoleto t={t as TituloFicha} empresa={empresa as EmpresaFicha} conta={conta as ContaFicha} />
      <p className="mt-3 text-[10px] text-neutral-500 print:hidden">
        Corte aqui e entregue a via ao pagador. Linha digitável: <span className="num">{t.linha_digitavel}</span>
      </p>
    </main>
  );
}
