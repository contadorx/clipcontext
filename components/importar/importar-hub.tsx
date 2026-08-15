"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Receipt, Users, Tags, Landmark, BookText, ArrowLeft, ChevronRight } from "lucide-react";
import ImportarCsv from "@/components/importar/importar-csv";
import ImportadorGenerico from "@/components/importar/importador-generico";
import { ENTIDADES } from "@/lib/importador/config";

type Opt = { id: string; nome: string; tipo?: string };
type RefItem = { id: string; nome: string };

const ICONES: Record<string, typeof Receipt> = {
  lancamentos: Receipt, clientes: Users, categorias: Tags, contas: Landmark, plano: BookText,
};

const ORDEM = [
  { id: "clientes", nome: "Clientes e fornecedores", desc: "Pessoas com CPF/CNPJ, contato e conta contábil." },
  { id: "categorias", nome: "Categorias financeiras", desc: "Receitas e despesas, com a conta contábil de cada uma." },
  { id: "contas", nome: "Contas bancárias", desc: "Bancos e caixas, com saldo inicial." },
  { id: "plano", nome: "Plano de contas contábil", desc: "Estrutura contábil que alimenta o de-para das categorias." },
  { id: "lancamentos", nome: "Lançamentos", desc: "Entradas e saídas (contas a pagar e a receber)." },
];
const TIPOS_VALIDOS = ORDEM.map((o) => o.id);

export default function ImportarHub({
  empresaId,
  categorias,
  contas,
  pessoas,
  centros,
  grupos,
  inicial,
  contagens,
}: {
  empresaId: string;
  categorias: Opt[];
  contas: Opt[];
  pessoas: Opt[];
  centros: Opt[];
  grupos: RefItem[];
  inicial?: string;
  contagens?: { lancamentos: number; plano: number };
}) {
  const router = useRouter();
  const tipoInicial = inicial && TIPOS_VALIDOS.includes(inicial) ? inicial : null;
  const modoDireto = !!tipoInicial;
  const [sel, setSel] = useState<string | null>(tipoInicial);

  // Assistente de migração: progresso derivado dos dados reais (nada de checkbox manual).
  const passosMigracao: { id: string; nome: string; qtd: number; dica: string; opcional?: boolean }[] = [
    { id: "clientes", nome: "Clientes e fornecedores", qtd: pessoas.length, dica: "Exporte a lista de pessoas do seu sistema atual em Excel ou CSV (nome, CPF/CNPJ, contato)." },
    { id: "categorias", nome: "Categorias financeiras", qtd: categorias.length, dica: "Exporte o plano financeiro (receitas e despesas). Se as categorias padrão já servem, pule." },
    { id: "contas", nome: "Contas bancárias", qtd: contas.length, dica: "Cadastre ou importe as contas com o saldo inicial na data de corte da migração." },
    { id: "lancamentos", nome: "Lançamentos em aberto", qtd: contagens?.lancamentos ?? 0, dica: "Exporte as contas a pagar e a receber em aberto. Os exports do Conta Azul são reconhecidos automaticamente — arquivos separados de pagar/receber funcionam (escolha o tipo fixo no passo de mapeamento)." },
    { id: "plano", nome: "Plano de contas contábil", qtd: contagens?.plano ?? 0, dica: "Só se você usa a exportação contábil — alimenta o de-para das categorias.", opcional: true },
  ];

  // Hub completo (só aparece quando NÃO veio direto de uma tela de cadastro).
  if (!sel) {
    return (
      <div className="space-y-3">
        <details className="rounded-xl2 bg-white shadow-card open:pb-1">
          <summary className="cursor-pointer list-none px-4 py-3.5">
            <span className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-bold text-ink">Migrando do Conta Azul ou de outro sistema?</span>
                <span className="block text-xs text-ink-muted">Siga esta ordem — cada passo prepara o seguinte. O progresso reflete os dados já cadastrados.</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-ink-soft transition-transform [details[open]_&]:rotate-90" />
            </span>
          </summary>
          <div className="divide-y divide-line/60 border-t border-line/60">
            {passosMigracao.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSel(p.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface/60"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    p.qtd > 0 ? "bg-brand text-white" : "bg-surface text-ink-soft ring-1 ring-inset ring-line"
                  }`}
                >
                  {p.qtd > 0 ? "✓" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">
                    {p.nome}
                    {p.opcional && <span className="ml-1.5 text-[10px] font-semibold text-ink-soft">(opcional)</span>}
                  </span>
                  <span className="block text-xs text-ink-muted">{p.dica}</span>
                </span>
                <span className="num shrink-0 text-[11px] font-semibold text-ink-soft">
                  {p.qtd > 0 ? `${p.qtd} no sistema` : "pendente"}
                </span>
              </button>
            ))}
            <p className="px-4 py-2.5 text-[11px] text-ink-soft">
              Para fechar: confira o saldo de cada conta em Movimentações e concilie o primeiro extrato em Conciliação.
            </p>
          </div>
        </details>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ORDEM.map((o) => {
            const Icone = ICONES[o.id];
            return (
              <button key={o.id} type="button" onClick={() => setSel(o.id)}
                className="group flex items-start gap-3 rounded-xl2 bg-white p-4 text-left shadow-card transition hover:border-brand">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand"><Icone size={20} /></span>
                <span className="flex-1">
                  <span className="flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">{o.nome}</span>
                    <ChevronRight size={16} className="text-ink-soft transition group-hover:text-brand" />
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{o.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="rounded-xl2 border border-line bg-surface/50 px-4 py-3 text-xs text-ink-muted">
          <b className="text-ink">Dica de migração:</b> importe na ordem clientes/fornecedores → categorias → contas → plano de contas → lançamentos.
          Assim, quando os lançamentos entrarem, eles casam pelo nome com cadastros que já existem.
        </div>
      </div>
    );
  }

  // Botão de voltar: ao hub (se veio de Configurações) ou à tela anterior (se veio direto).
  const voltar = modoDireto ? (
    <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-brand">
      <ArrowLeft size={14} /> Voltar
    </button>
  ) : (
    <button type="button" onClick={() => setSel(null)} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-brand">
      <ArrowLeft size={14} /> Outros tipos de importação
    </button>
  );

  if (sel === "lancamentos") {
    return (
      <div className="space-y-3">
        {voltar}
        <ImportarCsv empresaId={empresaId} categorias={categorias} contas={contas} pessoas={pessoas} centros={centros} />
      </div>
    );
  }

  const entidade = ENTIDADES.find((e) => e.id === sel);
  if (!entidade) return null;
  const refs: Record<string, RefItem[]> = {};
  if (entidade.refsUsadas?.includes("grupos")) refs.grupos = grupos;

  return (
    <div className="space-y-3">
      {modoDireto && voltar}
      <ImportadorGenerico
        entidade={entidade}
        empresaId={empresaId}
        refs={refs}
        onVoltar={modoDireto ? undefined : () => setSel(null)}
      />
    </div>
  );
}
