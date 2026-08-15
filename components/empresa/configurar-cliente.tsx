"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ListTree,
  Landmark,
  Repeat,
  Users,
  ReceiptText,
  Check,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Copy,
} from "lucide-react";
import { selecionarEmpresa } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import Botao from "@/components/ui/botao";
import MessageStrip from "@/components/ui/message-strip";

export type StatusConfig = {
  plano: boolean;
  conta: boolean;
  recorrencias: boolean;
  portal: boolean;
  nfse: boolean;
};

type PassoKey = keyof StatusConfig;

const PASSOS: {
  key: PassoKey;
  icon: typeof Building2;
  titulo: string;
  desc: string;
  rota: string;
  opcional: boolean;
}[] = [
  {
    key: "plano",
    icon: ListTree,
    titulo: "Plano de contas",
    desc: "As categorias padrão já vêm prontas. Revise se quiser ajustar.",
    rota: "/configuracoes/categorias",
    opcional: false,
  },
  {
    key: "conta",
    icon: Landmark,
    titulo: "Conta bancária",
    desc: "Cadastre a conta bancária para conciliação e boletos.",
    rota: "/configuracoes/contas-bancarias",
    opcional: false,
  },
  {
    key: "recorrencias",
    icon: Repeat,
    titulo: "Lançamentos recorrentes",
    desc: "Despesas e receitas fixas que se repetem todo mês.",
    rota: "/configuracoes/recorrencias",
    opcional: false,
  },
  {
    key: "portal",
    icon: Users,
    titulo: "Portal do cliente",
    desc: "Libere o acesso para o cliente acompanhar com a sua marca.",
    rota: "/configuracoes/portal",
    opcional: false,
  },
  {
    key: "nfse",
    icon: ReceiptText,
    titulo: "Nota fiscal (NFS-e)",
    desc: "Configure a emissão de NFS-e para esta empresa.",
    rota: "/configuracoes/nfse",
    opcional: true,
  },
];

const OBRIGATORIOS: PassoKey[] = ["plano", "conta", "recorrencias", "portal"];

export default function ConfigurarCliente({
  empresaId,
  nome,
  status,
  outras,
}: {
  empresaId: string;
  nome: string;
  status: StatusConfig;
  outras: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [indo, setIndo] = useState<PassoKey | null>(null);
  const [origemId, setOrigemId] = useState("");
  const [copiando, setCopiando] = useState(false);
  const [msgCopia, setMsgCopia] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function irPara(key: PassoKey, rota: string) {
    setIndo(key);
    await selecionarEmpresa(empresaId);
    router.push(rota);
  }

  async function copiarPlano() {
    if (!origemId) return;
    setCopiando(true);
    setMsgCopia(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("copiar_plano_contas", {
      p_origem: origemId,
      p_destino: empresaId,
    });
    setCopiando(false);
    if (error) {
      // erro e sucesso caíam no mesmo `<p>` cinza: falhar parecia ter dado certo
      setMsgCopia({ tipo: "erro", texto: error.message });
      return;
    }
    setMsgCopia({ tipo: "ok", texto: "Plano de contas copiado desta empresa." });
    router.refresh();
  }

  const feitos = OBRIGATORIOS.filter((k) => status[k]).length;
  const pct = Math.round((feitos / OBRIGATORIOS.length) * 100);
  const tudoPronto = feitos === OBRIGATORIOS.length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Cabeçalho + progresso */}
      <div className="rounded-xl2 bg-white p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl2 bg-brand-light text-brand">
            <Building2 size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
              Configurar empresa
            </p>
            <h1 className="truncate text-lg font-bold text-ink">{nome}</h1>
            <p className="mt-0.5 text-xs text-ink-muted">
              Empresa criada. Conclua os passos abaixo para deixar a empresa pronta para operar.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">
              {feitos} de {OBRIGATORIOS.length} passos essenciais
            </span>
            <span className="text-ink-soft">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Copiar de outra empresa */}
      {outras.length > 0 && (
        <div className="mt-4 rounded-xl2 bg-white p-4 shadow-card">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-muted">
              <Copy size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">Começar a partir de outra empresa</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Copie o plano de contas de uma empresa parecida. <b>Substitui</b> os grupos e categorias desta
                empresa (não copia contas, recorrências, portal nem NFS-e). As recorrências já cadastradas ficam,
                religadas à categoria de mesmo nome no plano novo; o que não casar aparece sem categoria em
                Recorrências.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {/*
                  Rótulo por `aria-label`: o campo divide a linha com o botão de
                  copiar, e "Começar a partir de outra empresa" logo acima já é
                  o rótulo visível — repeti-lo em cima do select diria o mesmo
                  duas vezes.
                */}
                <select
                  id="configurar-empresa-origem"
                  aria-label="Empresa de origem do plano de contas"
                  value={origemId}
                  onChange={(e) => {
                    setOrigemId(e.target.value);
                    setMsgCopia(null);
                  }}
                  className="min-w-[200px] flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-sm outline-none focus:border-brand"
                >
                  <option value="">Escolha uma empresa…</option>
                  {outras.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
                <Botao variante="primario"
                  onClick={copiarPlano}
                  disabled={!origemId || copiando}
                >
                  {copiando ? "Copiando…" : "Copiar plano de contas"}
                </Botao>
              </div>
              {msgCopia && (
                <div className="mt-2">
                  <MessageStrip tipo={msgCopia.tipo}>{msgCopia.texto}</MessageStrip>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Passos */}
      <div className="mt-4 space-y-2.5">
        {PASSOS.map((p) => {
          const feito = status[p.key];
          const Icone = p.icon;
          const carregando = indo === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => irPara(p.key, p.rota)}
              disabled={carregando}
              className="group flex w-full items-center gap-3 rounded-xl2 bg-white p-4 text-left shadow-card transition hover:border-brand/50 hover:shadow-md disabled:opacity-60"
            >
              <div
                className={
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl2 " +
                  (feito ? "bg-brand text-white" : "bg-surface text-ink-soft")
                }
              >
                {feito ? <Check size={18} /> : <Icone size={18} />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink">{p.titulo}</span>
                  {p.opcional && (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                      opcional
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-muted">{p.desc}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {feito ? (
                  <span className="hidden text-xs font-semibold text-brand sm:inline">Revisar</span>
                ) : (
                  <span className="hidden text-xs font-semibold text-ink-muted sm:inline">
                    {carregando ? "Abrindo…" : "Configurar"}
                  </span>
                )}
                <ChevronRight
                  size={18}
                  className="text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-brand"
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Rodapé */}
      <div className="mt-5 flex flex-col items-center gap-3">
        {tudoPronto ? (
          <div className="flex items-center gap-2 rounded-xl2 bg-brand-light px-4 py-2 text-sm font-semibold text-brand-dark">
            <Sparkles size={16} /> Tudo pronto! Esta empresa está configurada.
          </div>
        ) : (
          <p className="text-center text-xs text-ink-soft">
            Você pode concluir os passos agora ou voltar quando quiser pela carteira.
          </p>
        )}
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="flex-1 rounded-lg border border-line bg-white py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-surface"
          >
            Atualizar status
          </button>
          <button
            type="button"
            onClick={() => router.push("/carteira")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            Ir para a carteira <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
