import { itfModulos } from "@/lib/boleto/febraban";
import { BANCOS_COBRANCA } from "@/lib/boleto/bancos";
import { brl, dataBR } from "@/lib/formato";

// Ficha de compensação imprimível — usada pela página interna (/boleto/[id])
// e pela página pública do sacado (/b/[token]). Server component puro.

export type TituloFicha = {
  nosso_numero_fmt: string | null;
  numero_documento: string | null;
  valor: number;
  vencimento: string;
  sacado_nome: string | null;
  sacado_documento: string | null;
  sacado_logradouro: string | null;
  sacado_cep: string | null;
  sacado_municipio: string | null;
  sacado_uf: string | null;
  linha_digitavel: string | null;
  codigo_barras: string | null;
  criado_em: string;
};

export type EmpresaFicha = { nome: string; razao_social: string | null; cnpj_cpf: string | null } | null;

export type ContaFicha = {
  banco_codigo: string | null;
  agencia: string | null;
  agencia_dv: string | null;
  conta_numero: string | null;
  conta_dv: string | null;
  convenio: string | null;
  carteira: string | null;
  juros_mes_pct: number | null;
  multa_pct: number | null;
} | null;

function CodigoBarras({ codigo }: { codigo: string }) {
  const mods = itfModulos(codigo);
  const escala = 1.6;
  const altura = 50;
  let x = 0;
  const rects = mods.map((m, i) => {
    const w = m.w * escala;
    const r = m.bar ? <rect key={i} x={x} y={0} width={w} height={altura} fill="#000" /> : null;
    x += w;
    return r;
  });
  return (
    <svg width={x} height={altura} viewBox={`0 0 ${x} ${altura}`} role="img" aria-label="Código de barras do boleto">
      {rects}
    </svg>
  );
}

export default function FichaBoleto({
  t,
  empresa,
  conta,
}: {
  t: TituloFicha;
  empresa: EmpresaFicha;
  conta: ContaFicha;
}) {
  const bancoCod = String(conta?.banco_codigo ?? "").padStart(3, "0");
  const bancoNome = BANCOS_COBRANCA[bancoCod]?.nome ?? `Banco ${bancoCod}`;
  const agenciaConta = `${conta?.agencia ?? ""}${conta?.agencia_dv ? "-" + conta.agencia_dv : ""} / ${conta?.conta_numero ?? ""}${conta?.conta_dv ? "-" + conta.conta_dv : ""}`;
  const cedente = `${empresa?.razao_social ?? empresa?.nome ?? ""} — ${empresa?.cnpj_cpf ?? ""}`;

  const celula = "border border-neutral-400 px-2 py-1 align-top";
  const rotulo = "block text-[9px] uppercase tracking-wide text-neutral-500";
  const valorCls = "text-[12px] font-semibold text-neutral-900";

  return (
    <section className="border border-neutral-400 text-[11px]">
      {/* cabeçalho */}
      <div className="flex items-end gap-3 border-b-2 border-neutral-800 px-2 py-2">
        <span className="text-[15px] font-extrabold">{bancoNome}</span>
        <span className="border-x-2 border-neutral-800 px-3 text-[15px] font-extrabold">{bancoCod}</span>
        <span className="num flex-1 text-right text-[13px] font-bold tracking-wider">{t.linha_digitavel}</span>
      </div>

      {/* linha 1 */}
      <div className="grid grid-cols-[1fr_180px]">
        <div className={celula}>
          <span className={rotulo}>Beneficiário</span>
          <span className={valorCls}>{cedente}</span>
        </div>
        <div className={celula}>
          <span className={rotulo}>Vencimento</span>
          <span className={`num ${valorCls} text-[13px]`}>{dataBR(t.vencimento)}</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr_180px]">
        <div className={celula}>
          <span className={rotulo}>Agência / Código do beneficiário</span>
          <span className={`num ${valorCls}`}>{conta?.convenio ? `${conta.agencia} / ${conta.convenio}` : agenciaConta}</span>
        </div>
        <div className={celula}>
          <span className={rotulo}>Carteira</span>
          <span className={`num ${valorCls}`}>{conta?.carteira ?? ""}</span>
        </div>
        <div className={celula}>
          <span className={rotulo}>Nosso número</span>
          <span className={`num ${valorCls}`}>{t.nosso_numero_fmt}</span>
        </div>
        <div className={celula}>
          <span className={rotulo}>(=) Valor do documento</span>
          <span className={`num ${valorCls} text-[13px]`}>{brl(t.valor)}</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr_180px]">
        <div className={celula}>
          <span className={rotulo}>Número do documento</span>
          <span className={`num ${valorCls}`}>{t.numero_documento ?? ""}</span>
        </div>
        <div className={celula}>
          <span className={rotulo}>Data do documento</span>
          <span className={`num ${valorCls}`}>{dataBR(t.criado_em)}</span>
        </div>
        <div className={celula}>
          <span className={rotulo}>Espécie / Aceite</span>
          <span className={valorCls}>DM / N</span>
        </div>
        <div className={celula}>
          <span className={rotulo}>(-) Descontos / (+) Juros</span>
          <span className={valorCls}>&nbsp;</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_180px]">
        <div className={celula} style={{ minHeight: 64 }}>
          <span className={rotulo}>Instruções (texto de responsabilidade do beneficiário)</span>
          <span className="text-[11px]">
            {Number(conta?.multa_pct ?? 0) > 0 || Number(conta?.juros_mes_pct ?? 0) > 0 ? (
              <>
                Após o vencimento, cobrar
                {Number(conta?.multa_pct ?? 0) > 0 &&
                  ` multa de ${String(Number(conta?.multa_pct)).replace(".", ",")}%`}
                {Number(conta?.multa_pct ?? 0) > 0 && Number(conta?.juros_mes_pct ?? 0) > 0 && " e"}
                {Number(conta?.juros_mes_pct ?? 0) > 0 &&
                  ` juros de ${String(Number(conta?.juros_mes_pct)).replace(".", ",")}% ao mês`}
                . Em caso de dúvidas, fale com o beneficiário.
              </>
            ) : (
              <>Não receber após o vencimento sem os encargos combinados. Em caso de dúvidas, fale com o beneficiário.</>
            )}
          </span>
        </div>
        <div className={celula}>
          <span className={rotulo}>(=) Valor cobrado</span>
          <span className={valorCls}>&nbsp;</span>
        </div>
      </div>

      <div className={celula + " border-x border-b-0"}>
        <span className={rotulo}>Pagador</span>
        <span className={valorCls}>
          {t.sacado_nome} {t.sacado_documento ? `— ${t.sacado_documento}` : ""}
        </span>
        <span className="block text-[10px] text-neutral-700">
          {[t.sacado_logradouro, t.sacado_municipio && `${t.sacado_municipio}/${t.sacado_uf ?? ""}`, t.sacado_cep]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      {/* código de barras */}
      <div className="border-t border-neutral-400 px-2 py-3">
        {t.codigo_barras && <CodigoBarras codigo={t.codigo_barras} />}
        <p className="mt-1 text-[9px] text-neutral-500">Autenticação mecânica — Ficha de Compensação</p>
      </div>
    </section>
  );
}
