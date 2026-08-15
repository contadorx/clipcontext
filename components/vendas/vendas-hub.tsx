"use client";

import { useState } from "react";
import { BadgeDollarSign, FileSignature, FileText, Receipt } from "lucide-react";
import VendasAvulsas, { type Venda, type VendaItem, type VendaParcela } from "@/components/vendas/vendas-avulsas";
import ContratosClient from "@/components/vendas/contratos-client";
import FaturarMes from "@/components/vendas/faturar-mes";
import NotasFiscais, { type NfseRow, type FatPendente, type NfseConfigInfo } from "@/components/vendas/notas-fiscais";
import Boletos, { type TituloRow, type Vinculo, type FatBoletoPendente, type ContaCobranca, type LancamentoReceber } from "@/components/vendas/boletos";

// Tipos de apoio compartilhados entre as abas
type Apoio = { id: string; nome: string };
type Cliente = {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  tipo: string;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  logradouro: string | null;
  endereco_numero: string | null;
  codigo_ibge: string | null;
};
type ServicoRef = { id: string; nome: string; valor: number; unidade: string | null; ativo: boolean; item_lc116: string | null; codigo_tributacao_municipal: string | null };

export default function VendasHub({
  empresaId,
  vendas,
  vendaItens,
  vendaParcelas,
  contratos,
  contratoItens,
  servicos,
  clientes,
  categorias,
  contas,
  nfseConfig,
  notas,
  fatsPendentes,
  titulos,
  vinculos,
  vinculosNoTeto,
  fatsBoleto,
  lancamentosReceber,
}: {
  empresaId: string;
  vendas: Venda[];
  vendaItens: VendaItem[];
  vendaParcelas: VendaParcela[];
  contratos: Parameters<typeof ContratosClient>[0]["initial"];
  contratoItens: Parameters<typeof ContratosClient>[0]["initialItens"];
  servicos: ServicoRef[];
  clientes: Cliente[];
  categorias: Apoio[];
  contas: ContaCobranca[];
  nfseConfig: NfseConfigInfo;
  notas: NfseRow[];
  fatsPendentes: FatPendente[];
  titulos: TituloRow[];
  /** vínculos de TODOS os títulos, em projeção mínima — ver page.tsx */
  vinculos: Vinculo[];
  vinculosNoTeto: boolean;
  fatsBoleto: FatBoletoPendente[];
  lancamentosReceber: LancamentoReceber[];
}) {
  const [aba, setAba] = useState<"vendas" | "contratos" | "notas" | "boletos">("vendas");

  const pendNfse =
    vendas.filter((v) => v.status !== "cancelada" && v.gera_nfse && v.nfse_status === "pendente").length +
    fatsPendentes.length;

  /*
    "Já tem boleto?" sai de `vinculos`, não de `titulos`.

    `titulos` tem teto de 200 e serve à Central. Usá-la aqui fazia o badge — e a
    fila da aba — contarem como pendente tudo que ficou fora dos 200 mais
    recentes: item já cobrado voltava a pedir cobrança. `vinculos` traz o vínculo
    de todos os títulos, em quatro colunas de id.

    O `status` vem na projeção para que título rejeitado pelo banco volte à
    fila — sem ele, o item ficaria fora do badge e sem caminho de refazer.
  */
  const ativos = vinculos.filter((t) => t.status !== "erro");
  const parcelasComTitulo = new Set(ativos.map((t) => t.venda_parcela_id).filter(Boolean));
  const fatsComTitulo = new Set(ativos.map((t) => t.contrato_faturamento_id).filter(Boolean));
  const vendasBoletoPend = new Set(
    vendas.filter((v) => v.status !== "cancelada" && v.gera_boleto && v.boleto_status === "pendente").map((v) => v.id),
  );
  const pendBoletos =
    vendaParcelas.filter((p) => vendasBoletoPend.has(p.venda_id) && !parcelasComTitulo.has(p.id)).length +
    fatsBoleto.filter((f) => !fatsComTitulo.has(f.id)).length;

  const abas = [
    { v: "vendas" as const, l: "Vendas avulsas", icon: BadgeDollarSign, badge: 0 },
    { v: "contratos" as const, l: "Contratos", icon: FileSignature, badge: 0 },
    { v: "notas" as const, l: "Notas fiscais", icon: FileText, badge: pendNfse },
    { v: "boletos" as const, l: "Boletos", icon: Receipt, badge: pendBoletos },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl2 bg-white p-1 shadow-card">
        {abas.map((a) => {
          const ativa = aba === a.v;
          const Icone = a.icon;
          return (
            <button
              key={a.v}
              type="button"
              onClick={() => setAba(a.v)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                ativa ? "bg-brand text-white" : "text-ink-muted hover:bg-surface"
              }`}
            >
              <Icone size={15} /> {a.l}
              {a.badge > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${ativa ? "bg-white/20 text-white" : "bg-brand-light text-brand-dark"}`}>
                  {a.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {aba === "vendas" && (
        <VendasAvulsas
          empresaId={empresaId}
          initial={vendas}
          initialItens={vendaItens}
          initialParcelas={vendaParcelas}
          servicos={servicos}
          clientes={clientes}
          categorias={categorias}
          contas={contas}
        />
      )}
      {aba === "contratos" && (
        <>
          <div className="flex items-center justify-between rounded-xl2 bg-white px-4 py-3 shadow-card">
            <p className="text-xs text-ink-muted">
              Rode a competência inteira — faturamento, NFS-e e boletos — em um clique.
            </p>
            <FaturarMes
              empresaId={empresaId}
              contratos={contratos}
              itens={contratoItens}
              clientes={clientes}
              servicos={servicos.map((s) => ({ id: s.id, nome: s.nome, item_lc116: s.item_lc116 }))}
              contas={contas}
              nfseConfig={nfseConfig}
            />
          </div>
          <ContratosClient
            empresaId={empresaId}
            initial={contratos}
            initialItens={contratoItens}
            servicos={servicos}
            clientes={clientes}
            categorias={categorias}
            contas={contas}
          />
        </>
      )}
      {aba === "notas" && (
        <NotasFiscais
          empresaId={empresaId}
          vendas={vendas}
          vendaItens={vendaItens}
          fatsPendentes={fatsPendentes}
          notas={notas}
          config={nfseConfig}
          clientes={clientes}
          servicosFiscal={servicos.map((s) => ({ id: s.id, nome: s.nome, item_lc116: s.item_lc116, codigo_tributacao_municipal: s.codigo_tributacao_municipal }))}
          contratoItens={contratoItens.map((i) => ({ contrato_id: i.contrato_id, servico_id: i.servico_id }))}
        />
      )}
      {aba === "boletos" && (
        <Boletos
          empresaId={empresaId}
          vendas={vendas}
          vendaParcelas={vendaParcelas}
          fatsBoleto={fatsBoleto}
          lancamentosReceber={lancamentosReceber}
          notas={notas}
          titulos={titulos}
          vinculos={vinculos}
          vinculosNoTeto={vinculosNoTeto}
          contas={contas}
          clientes={clientes}
        />
      )}
    </div>
  );
}
