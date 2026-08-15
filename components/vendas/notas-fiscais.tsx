"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Settings, Send } from "lucide-react";
import type { Venda, VendaItem } from "@/components/vendas/vendas-avulsas";
import CentralNotas from "@/components/vendas/central-notas";
import EmptyState from "@/components/ui/empty-state";
import { brl, dataBR } from "@/lib/formato";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

export type NfseRow = {
  id: string;
  origem: string;
  venda_id: string | null;
  contrato_faturamento_id: string | null;
  cliente_fornecedor_id: string | null;
  valor_servico: number;
  status: string;
  ambiente: string;
  nfse_numero: string | null;
  dps_numero: number | null;
  pdf_url: string | null;
  motivo_erro: string | null;
  emitida_em: string | null;
  criado_em: string;
};

export type FatPendente = {
  id: string;
  contrato_id: string;
  competencia: string;
  valor: number;
  contrato: { nome: string | null; cliente_fornecedor_id: string } | null;
};

export type NfseConfigInfo = {
  codigo_municipio_ibge: string | null;
  inscricao_municipal: string | null;
  ambiente: string;
  cert_path: string | null;
  cert_validade: string | null;
} | null;

type Cliente = {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  municipio: string | null;
  codigo_ibge: string | null;
  cep: string | null;
  logradouro: string | null;
  endereco_numero: string | null;
};
type ServicoFiscal = { id: string; nome: string; item_lc116: string | null; codigo_tributacao_municipal: string | null };
type ContratoItemRef = { contrato_id: string; servico_id: string };

function mesBR(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export default function NotasFiscais({
  empresaId,
  vendas,
  vendaItens,
  fatsPendentes,
  notas,
  config,
  clientes,
  servicosFiscal,
  contratoItens,
}: {
  empresaId: string;
  vendas: Venda[];
  vendaItens: VendaItem[];
  fatsPendentes: FatPendente[];
  notas: NfseRow[];
  config: NfseConfigInfo;
  clientes: Cliente[];
  servicosFiscal: ServicoFiscal[];
  contratoItens: ContratoItemRef[];
}) {
  const router = useRouter();
  const [emitindo, setEmitindo] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [cancelando, setCancelando] = useState<NfseRow | null>(null);
  const [motivoCod, setMotivoCod] = useState("1");
  const [motivoTxt, setMotivoTxt] = useState("");
  const [enviandoCancel, setEnviandoCancel] = useState(false);
  const [reloadNotas, setReloadNotas] = useState(0);

  async function confirmarCancelamento() {
    if (!cancelando) return;
    setEnviandoCancel(true);
    const resp = await fetch("/api/nfse/cancelar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId, nfseId: cancelando.id, codigoMotivo: motivoCod, motivo: motivoTxt }),
    });
    const j = (await resp.json().catch(() => ({}))) as { ok?: boolean; erro?: string | null; error?: string; aviso?: string | null };
    setEnviandoCancel(false);
    if (j.ok) {
      // com `aviso`, a origem NÃO voltou para a fila — afirmar que voltou é
      // mandar a pessoa procurar o que não está lá
      setMsg(
        j.aviso
          ? { tipo: "erro", texto: j.aviso }
          : { tipo: "ok", texto: "NFS-e cancelada. A venda/faturamento voltou para a fila, caso precise reemitir." },
      );
      setCancelando(null);
      setMotivoTxt("");
      setReloadNotas((x) => x + 1);
    } else {
      setMsg({ tipo: "erro", texto: j.erro ?? j.error ?? "A Sefin recusou o cancelamento." });
    }
    router.refresh();
  }

  const clienteMap = useMemo(() => {
    const m = new Map<string, Cliente>();
    clientes.forEach((c) => m.set(c.id, c));
    return m;
  }, [clientes]);
  const servicoMap = useMemo(() => {
    const m = new Map<string, ServicoFiscal>();
    servicosFiscal.forEach((s) => m.set(s.id, s));
    return m;
  }, [servicosFiscal]);
  const itensPorVenda = useMemo(() => {
    const m = new Map<string, VendaItem[]>();
    vendaItens.forEach((i) => {
      const arr = m.get(i.venda_id) ?? [];
      arr.push(i);
      m.set(i.venda_id, arr);
    });
    return m;
  }, [vendaItens]);
  const itensPorContrato = useMemo(() => {
    const m = new Map<string, ContratoItemRef[]>();
    contratoItens.forEach((i) => {
      const arr = m.get(i.contrato_id) ?? [];
      arr.push(i);
      m.set(i.contrato_id, arr);
    });
    return m;
  }, [contratoItens]);

  // SP (capital) usa web service próprio com exigências diferentes do nacional.
  const emitenteEhSaoPaulo = (config?.codigo_municipio_ibge ?? "").replace(/\D/g, "") === "3550308";

  // ---- prontidão do emitente (global) ----
  const faltasGlobais: string[] = [];
  if (!config) faltasGlobais.push("dados do emitente não configurados");
  else {
    if (!config.codigo_municipio_ibge) faltasGlobais.push("código IBGE do município do emitente");
    // SP exige a Inscrição Municipal (CCM) do prestador no RPS.
    if (emitenteEhSaoPaulo && !config.inscricao_municipal) faltasGlobais.push("inscrição municipal (CCM) do emitente");
    if (!config.cert_path) faltasGlobais.push("certificado digital A1");
    else if (config.cert_validade && new Date(config.cert_validade).getTime() < Date.now())
      faltasGlobais.push("certificado A1 vencido — envie um válido");
  }
  const emitentePronto = faltasGlobais.length === 0;

  function faltasCliente(clienteId: string | null | undefined): string[] {
    const f: string[] = [];
    const c = clienteId ? clienteMap.get(clienteId) : null;
    if (!c) return ["cliente não encontrado"];
    if (!c.cpf_cnpj) f.push("cliente sem CPF/CNPJ");
    if (!c.municipio && !c.codigo_ibge) f.push("cliente sem município");
    return f;
  }
  function faltasServicos(servicoIds: string[]): string[] {
    const f: string[] = [];
    for (const id of servicoIds) {
      const s = servicoMap.get(id);
      if (!s) continue;
      // SP valida pela lista municipal própria; o nacional, pelo item da LC 116.
      if (emitenteEhSaoPaulo) {
        if (!s.codigo_tributacao_municipal) f.push(`serviço "${s.nome}" sem código de serviço de SP`);
      } else if (!s.item_lc116) {
        f.push(`serviço "${s.nome}" sem item LC 116`);
      }
    }
    return Array.from(new Set(f));
  }
  // Recomendações que NÃO bloqueiam a emissão (SP aceita sem endereço do
  // tomador, mas o ideal é ter para a nota sair completa).
  function recomendacoesCliente(clienteId: string | null | undefined): string[] {
    if (!emitenteEhSaoPaulo) return [];
    const c = clienteId ? clienteMap.get(clienteId) : null;
    if (!c) return [];
    const faltam: string[] = [];
    if (!c.cep) faltam.push("CEP");
    if (!c.logradouro) faltam.push("logradouro");
    if (!c.endereco_numero) faltam.push("número");
    return faltam.length ? [`endereço do tomador (${faltam.join(", ")})`] : [];
  }

  const vendasPend = vendas.filter((v) => v.status !== "cancelada" && v.gera_nfse && v.nfse_status === "pendente");

  const filaVendas = vendasPend.map((v) => {
    const itens = itensPorVenda.get(v.id) ?? [];
    const faltas = [...faltasCliente(v.cliente_fornecedor_id), ...faltasServicos(itens.map((i) => i.servico_id))];
    const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
    return { tipo: "venda" as const, id: v.id, titulo: clienteMap.get(v.cliente_fornecedor_id)?.nome ?? "Cliente", sub: `venda de ${dataBR(v.data_venda)}`, valor: total, faltas, recomendacoes: recomendacoesCliente(v.cliente_fornecedor_id) };
  });

  const filaFats = fatsPendentes.map((f) => {
    const itens = itensPorContrato.get(f.contrato_id) ?? [];
    const faltas = [
      ...faltasCliente(f.contrato?.cliente_fornecedor_id),
      ...faltasServicos(itens.map((i) => i.servico_id)),
    ];
    const nomeCli = f.contrato ? clienteMap.get(f.contrato.cliente_fornecedor_id)?.nome : null;
    return {
      tipo: "contrato" as const,
      id: f.id,
      titulo: nomeCli ?? "Cliente",
      sub: `contrato${f.contrato?.nome ? " " + f.contrato.nome : ""} · competência ${mesBR(f.competencia)}`,
      valor: f.valor,
      faltas,
      recomendacoes: recomendacoesCliente(f.contrato?.cliente_fornecedor_id),
    };
  });

  const fila = [...filaVendas, ...filaFats];

  async function emitir(tipo: "venda" | "contrato", id: string) {
    setEmitindo(`${tipo}-${id}`);
    setMsg(null);
    const resp = await fetch("/api/nfse/emitir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresaId,
        origem: tipo,
        vendaId: tipo === "venda" ? id : undefined,
        faturamentoId: tipo === "contrato" ? id : undefined,
      }),
    });
    const json = (await resp.json().catch(() => ({}))) as {
      ok?: boolean;
      homologacao?: boolean;
      nfseNumero?: string | null;
      pdfUrl?: string | null;
      erro?: string | null;
      error?: string;
      /** nota emitida, mas a origem não ficou marcada — reemitir duplica */
      aviso?: string | null;
    };
    setEmitindo(null);
    if (json.ok) {
      if (json.homologacao) {
        setMsg({
          tipo: "ok",
          texto: "RPS validado em homologação (teste). Nenhuma nota real foi gerada — mude para produção em Configurações → NFS-e para emitir de verdade.",
        });
      } else if (json.aviso) {
        // a nota existe; o que falhou foi a marca na venda/faturamento. Dizer
        // só "emitida" aqui é o que leva a pessoa a emitir de novo
        setMsg({ tipo: "erro", texto: `NFS-e emitida${json.nfseNumero ? ` (nº ${json.nfseNumero})` : ""}. ${json.aviso}` });
      } else {
        setMsg({ tipo: "ok", texto: `NFS-e emitida${json.nfseNumero ? ` (nº ${json.nfseNumero})` : ""}.` });
      }
    } else {
      setMsg({ tipo: "erro", texto: json.erro ?? json.error ?? "Falha na emissão — veja o motivo na lista de notas." });
    }
    setReloadNotas((x) => x + 1);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* prontidão do emitente */}
      {emitentePronto ? (
        <div className="flex items-center gap-2 rounded-xl2 bg-white p-4 shadow-card">
          <CheckCircle2 size={16} className="shrink-0 text-brand" />
          <p className="text-sm text-ink">
            Emitente configurado ({config?.ambiente === "producao" ? "produção" : "homologação"}).{" "}
            <Link href="/configuracoes/nfse" className="font-semibold text-brand hover:underline">
              Revisar
            </Link>
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl2 border border-danger/30 bg-rose-50 p-4">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
          <div className="text-sm text-ink">
            <p className="font-semibold">Para emitir, falta: {faltasGlobais.join("; ")}.</p>
            <Link href="/configuracoes/nfse" className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              <Settings size={12} /> Configurar NFS-e
            </Link>
          </div>
        </div>
      )}

      {msg && <p className={`text-xs font-semibold ${msg.tipo === "erro" ? "text-danger" : "text-brand"}`}>{msg.texto}</p>}

      {/* fila a emitir */}
      <div className="overflow-hidden rounded-xl2 bg-white shadow-card">
        <div className="border-b border-line bg-surface/50 px-4 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">A emitir ({fila.length})</p>
        </div>
        {fila.length === 0 ? (
          <EmptyState compacto titulo="Nada na fila" descricao="Vendas e faturamentos com a opção de NFS-e marcada aparecem aqui." />
        ) : (
          fila.map((f) => {
            const pronta = f.faltas.length === 0 && emitentePronto;
            const chave = `${f.tipo}-${f.id}`;
            return (
              <div key={chave} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{f.titulo}</p>
                  <p className="text-[11px] text-ink-soft">{f.sub}</p>
                  {f.faltas.length > 0 && (
                    <p className="mt-0.5 text-[11px] font-semibold text-danger">Falta: {f.faltas.join("; ")}</p>
                  )}
                  {f.faltas.length === 0 && f.recomendacoes.length > 0 && (
                    <p className="mt-0.5 text-[11px] font-semibold text-amber-600">Recomendado: {f.recomendacoes.join("; ")}</p>
                  )}
                </div>
                <span className="num shrink-0 text-sm font-semibold text-ink">{brl(f.valor)}</span>
                {pronta ? (
                  <button
                    type="button"
                    onClick={() => emitir(f.tipo, f.id)}
                    disabled={emitindo !== null}
                    className="flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                  >
                    <Send size={13} /> {emitindo === chave ? "Emitindo…" : "Emitir"}
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold text-ink-soft">
                    incompleta
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* notas processadas — central com filtros, busca e paginação */}
      <CentralNotas
        empresaId={empresaId}
        clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))}
        notasIniciais={notas}
        onCancelar={(n) => {
          setCancelando(n);
          setMotivoCod("1");
          setMotivoTxt("");
        }}
        onReemitido={() => router.refresh()}
        reloadSignal={reloadNotas}
      />

      {cancelando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 p-4">
          <div className="w-full max-w-md rounded-xl2 bg-white p-5 shadow-card" role="dialog" aria-modal="true" aria-labelledby="dlg-cancelar-nfse-titulo">
            <h3 id="dlg-cancelar-nfse-titulo" className="text-base font-bold text-ink">Cancelar NFS-e</h3>
            <p className="mt-1 text-xs text-ink-muted">
              {cancelando.nfse_numero ? `NFS-e ${cancelando.nfse_numero}` : "Nota"} de {brl(cancelando.valor_servico)}. O
              cancelamento é registrado na Sefin Nacional e não pode ser desfeito.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Motivo</label>
                <select
                  value={motivoCod}
                  onChange={(e) => setMotivoCod(e.target.value)}
                  className={classeControle("md")}
                >
                  <option value="1">Erro na emissão</option>
                  <option value="2">Serviço não prestado</option>
                  <option value="9">Outros</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Detalhe (mín. 15 caracteres)</label>
                <textarea
                  value={motivoTxt}
                  onChange={(e) => setMotivoTxt(e.target.value)}
                  rows={2}
                  placeholder="Ex.: valor do serviço informado incorretamente"
                  className={classeControle("md")}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  data-fechar
                  onClick={() => setCancelando(null)}
                  disabled={enviandoCancel}
                  className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface"
                >
                  Voltar
                </button>
                <Botao variante="perigo"
                  onClick={confirmarCancelamento}
                  disabled={enviandoCancel}
                >
                  {enviandoCancel ? "Cancelando…" : "Confirmar cancelamento"}
                </Botao>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
