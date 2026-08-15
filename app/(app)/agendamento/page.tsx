import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import AgendamentoClient from "@/components/agendamento/agendamento-client";
import type { ContaPagadora } from "@/lib/cnab/gerar-remessas";
import ProcessarRetorno, { type MapaRemessa } from "@/components/cnab/processar-retorno";
import ProcessarRetornoCobranca from "@/components/cnab/processar-retorno-cobranca";
import GerarRemessaCobranca from "@/components/cnab/gerar-remessa-cobranca";
import RemessasEnviadas, { type RemessaResumo } from "@/components/cnab/remessas-enviadas";

type ContaRow = {
  id: string;
  nome: string;
  agencia: string | null;
  conta_numero: string | null;
  conta_dv: string | null;
  banco_codigo: string | null;
  pagador_documento: string | null;
  pagador_nome: string | null;
  cnab_sequencial: number | null;
  convenio: string | null;
  convenio_pagamento: string | null;
  agencia_dv: string | null;
};

export default async function PagamentosPage() {
  const { atual } = await getEmpresaContext();
  const empresaId = atual?.id ?? "";
  const supabase = createClient();

  const [{ data: contasData }, { data: remessasData }] = await Promise.all([
    supabase
      .from("contas_bancarias")
      .select(
        "id, nome, agencia, conta_numero, conta_dv, banco_codigo, pagador_documento, pagador_nome, cnab_sequencial, convenio, convenio_pagamento, agencia_dv",
      )
      .eq("empresa_id", empresaId)
      .order("nome"),
    supabase
      .from("cnab_remessas")
      .select("id, criado_em, tipo, quantidade, valor_total, sequencial, itens")
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false })
      .limit(30),
  ]);

  const contas = (contasData as ContaRow[]) ?? [];
  const contasCnab: ContaPagadora[] = contas
    .filter((c) => !!c.banco_codigo)
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      banco_codigo: c.banco_codigo,
      agencia: c.agencia,
      conta_numero: c.conta_numero,
      conta_dv: c.conta_dv,
      pagador_documento: c.pagador_documento,
      pagador_nome: c.pagador_nome,
      cnab_sequencial: c.cnab_sequencial ?? 0,
      convenio: c.convenio,
      convenio_pagamento: c.convenio_pagamento,
      agencia_dv: c.agencia_dv,
    }));

  const remessasRaw = (remessasData ?? []) as Array<RemessaResumo & { itens: MapaRemessa[] | null }>;
  const remessas: RemessaResumo[] = remessasRaw.map(({ itens, ...r }) => r);
  const mapa: MapaRemessa[] = [];
  for (const r of remessasRaw) {
    for (const it of r.itens ?? []) {
      if (it?.seu_numero && it?.lancamento_id) mapa.push(it);
    }
  }

  return (
    <div className="space-y-8">
      <AgendamentoClient empresaId={empresaId} contasCnab={contasCnab} />

      <section className="space-y-4">
        <div className="border-t border-line pt-6">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Remessas e retorno (CNAB)</h2>
          <p className="text-sm text-ink-soft">
            Histórico das remessas geradas e a baixa pelo arquivo retorno. Para gerar uma nova remessa, selecione os
            pagamentos na lista acima e use “Gerar remessa CNAB”. O setup de banco/convênio fica em Configurações → CNAB.
          </p>
        </div>

        <RemessasEnviadas remessas={remessas} />
        <ProcessarRetorno mapa={mapa} />

        <div className="rounded-xl2 bg-white p-4 shadow-card">
          <h3 className="text-[13px] font-bold text-ink">Remessa de cobrança (boletos a registrar)</h3>
          <p className="mb-3 mt-0.5 text-xs text-ink-soft">
            Gera a remessa (.REM) de todos os boletos gerados aguardando registro — inclusive os avulsos, não só os de faturamento.
          </p>
          <GerarRemessaCobranca empresaId={empresaId} />
        </div>

        <div className="rounded-xl2 bg-white p-4 shadow-card">
          <h3 className="text-[13px] font-bold text-ink">Retorno de cobrança (boletos recebidos)</h3>
          <p className="mb-3 mt-0.5 text-xs text-ink-soft">
            Processe aqui o arquivo retorno (.RET) dos boletos de cobrança. Os títulos liquidados dão baixa automática no contas a receber.
          </p>
          <ProcessarRetornoCobranca empresaId={empresaId} />
        </div>
      </section>
    </div>
  );
}
