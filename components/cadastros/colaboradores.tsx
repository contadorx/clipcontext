"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Plus, Trash2, Copy, Check, Link2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MultiSelect from "@/components/ui/multi-select";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import MessageStrip from "@/components/ui/message-strip";
import EmptyState from "@/components/ui/empty-state";
import Botao, { BotaoIcone } from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

type Empresa = { id: string; nome: string };
type Colab = {
  membro_id: string;
  user_id: string;
  email: string;
  papel: string;
  empresas: string[];
  menus: string[];
};

const PAPEL_LABEL: Record<string, string> = {
  owner: "Dono", admin: "Administrador", membro: "Membro", analista: "Analista", contabilidade: "Contabilidade",
};

// Telas que podem ser bloqueadas por colaborador. Carteira e Ajuda ficam sempre acessíveis.
const MENUS_BLOQUEAVEIS = [
  { value: "/painel", label: "Painel" },
  { value: "/movimentacoes", label: "Movimentações" },
  { value: "/agendamento", label: "Liquidações" },
  { value: "/conciliacao", label: "Conciliação" },
  { value: "/documentos", label: "Caixa de Entrada" },
  { value: "/clientes-fornecedores", label: "Clientes e Fornecedores" },
  { value: "/relatorios", label: "Relatórios" },
  { value: "/configuracoes", label: "Configurações" },
];

export default function Colaboradores({ empresas }: { empresas: Empresa[] }) {
  const [lista, setLista] = useState<Colab[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // convite
  const [convPapel, setConvPapel] = useState("analista");
  const [convEmpresas, setConvEmpresas] = useState<string[]>([]);
  const [convEmail, setConvEmail] = useState("");
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const opcoesEmpresas = empresas.map((e) => ({ value: e.id, label: e.nome }));

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("listar_colaboradores");
    if (error) {
      setErro(error.message);
      setCarregando(false);
      return;
    }
    const base = (data as Colab[]) ?? [];
    const { data: mm } = await supabase.from("membros").select("id, menus_bloqueados");
    const mapa = new Map(
      ((mm as { id: string; menus_bloqueados: string[] | null }[]) ?? []).map((m) => [
        m.id,
        m.menus_bloqueados ?? [],
      ])
    );
    setLista(base.map((c) => ({ ...c, menus: mapa.get(c.membro_id) ?? [] })));
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function gerarConvite() {
    setGerando(true);
    setErro(null);
    setEnviado(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("criar_convite", {
      p_papel: convPapel,
      p_empresas: convPapel === "analista" || convPapel === "contabilidade" ? convEmpresas : [],
    });
    setGerando(false);
    if (error) { setErro(error.message); return; }
    setLinkConvite(`${window.location.origin}/convite/${data as string}`);
  }

  async function enviarPorEmail() {
    setEnviando(true);
    setErro(null);
    setEnviado(null);
    setLinkConvite(null);
    try {
      const resp = await fetch("/api/convidar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: convEmail.trim(), papel: convPapel, empresas: convEmpresas }),
      });
      const json = await resp.json();
      if (!resp.ok) { setErro(json.error || "Falha ao enviar."); return; }
      setEnviado(convEmail.trim());
      setConvEmail("");
    } catch {
      setErro("Falha ao enviar o convite.");
    } finally {
      setEnviando(false);
    }
  }

  function copiar() {
    if (!linkConvite) return;
    navigator.clipboard.writeText(linkConvite).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function mudarPapel(c: Colab, papel: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc("definir_papel", { p_membro: c.membro_id, p_papel: papel });
    if (error) { setErro(error.message); return; }
    await carregar();
  }

  async function mudarEscopo(c: Colab, empresasSel: string[]) {
    setLista((l) => l.map((x) => (x.membro_id === c.membro_id ? { ...x, empresas: empresasSel } : x)));
    const supabase = createClient();
    const { error } = await supabase.rpc("definir_escopo", { p_membro: c.membro_id, p_empresas: empresasSel });
    if (error) { setErro(error.message); await carregar(); }
  }

  async function mudarMenus(c: Colab, menusSel: string[]) {
    setLista((l) => l.map((x) => (x.membro_id === c.membro_id ? { ...x, menus: menusSel } : x)));
    const supabase = createClient();
    const { error } = await supabase.rpc("definir_menus", { p_membro: c.membro_id, p_menus: menusSel });
    if (error) { setErro(error.message); await carregar(); }
  }

  async function remover(c: Colab) {
    // `confirm()` fica: a remoção passa por RPC e desfazer exigiria recriar o
    // vínculo com papel e escopo — não é um retrato de linha que se reinsere
    if (!confirm(`Remover ${c.email} da equipe?`)) return;
    const supabase = createClient();
    const { error } = await supabase.rpc("remover_colaborador", { p_membro: c.membro_id });
    if (error) { setErro(error.message); return; }
    await carregar();
  }

  return (
    <div className="space-y-5">
      {erro && <MessageStrip tipo="erro">{erro}</MessageStrip>}

      {/* Convidar */}
      <div className="rounded-xl2 bg-white p-4 shadow-card">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Plus size={16} className="text-brand" /> Convidar colaborador
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          Envie o convite por e-mail, ou gere um link para mandar por WhatsApp. A pessoa cria a conta, abre o link e entra na equipe.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="colab-papel" className="mb-1 block text-[11px] font-semibold text-ink-soft">
              Função
            </label>
            <select
              id="colab-papel"
              value={convPapel}
              onChange={(e) => setConvPapel(e.target.value)}
              className={classeControle("md")}
            >
              <option value="analista">Analista (acesso limitado)</option>
              <option value="contabilidade">Contabilidade (só exportação contábil)</option>
              <option value="admin">Administrador (acesso total)</option>
            </select>
          </div>
          {(convPapel === "analista" || convPapel === "contabilidade") && (
            <MultiSelect
              label="Empresas que pode acessar"
              opcoes={opcoesEmpresas}
              selecionados={convEmpresas}
              onChange={setConvEmpresas}
              placeholder="Buscar empresa…"
              textoTodos="Selecione as empresas"
            />
          )}
          <div>
            <label htmlFor="colab-email" className="mb-1 block text-[11px] font-semibold text-ink-soft">
              E-mail do colaborador
            </label>
            <input
              id="colab-email"
              type="email"
              value={convEmail}
              onChange={(e) => setConvEmail(e.target.value)}
              placeholder="pessoa@email.com"
              className={classeControle("md", false, "w-56")}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Botao variante="primario"
            onClick={enviarPorEmail}
            disabled={enviando || !convEmail.includes("@") || ((convPapel === "analista" || convPapel === "contabilidade") && convEmpresas.length === 0)}
          >
            <Send size={15} /> {enviando ? "Enviando…" : "Enviar convite por e-mail"}
          </Botao>
          <button
            type="button"
            onClick={gerarConvite}
            disabled={gerando || ((convPapel === "analista" || convPapel === "contabilidade") && convEmpresas.length === 0)}
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface disabled:opacity-50"
          >
            <Link2 size={15} /> {gerando ? "Gerando…" : "Só gerar link"}
          </button>
        </div>

        {enviado && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-brand-light/50 px-3 py-2 text-sm font-medium text-brand-dark">
            <Check size={15} /> Convite enviado para {enviado}.
          </p>
        )}

        {linkConvite && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-brand/30 bg-brand-light/40 p-2.5">
            <Link2 size={15} className="shrink-0 text-brand" />
            <span className="flex-1 truncate font-mono text-xs text-ink">{linkConvite}</span>
            <Botao variante="secundario" tamanho="sm"
              onClick={copiar}
            >
              {copiado ? <Check size={13} className="text-brand" /> : <Copy size={13} />} {copiado ? "Copiado" : "Copiar"}
            </Botao>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="rounded-xl2 bg-white shadow-card">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Users size={16} className="text-brand" />
          <h2 className="text-[13px] font-bold text-ink">Equipe</h2>
        </div>
        {carregando ? (
          <SkeletonLinhas linhas={4} colunas={3} />
        ) : lista.length === 0 ? (
          <EmptyState titulo="Só você por enquanto. Convide alguém acima." />
        ) : (
          <div className="divide-y divide-line">
            {lista.map((c) => {
              const ehDono = c.papel === "owner";
              return (
                <div key={c.membro_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{c.email}</p>
                    <p className="text-[11px] text-ink-soft">
                      {ehDono
                        ? "Dono — acesso total"
                        : c.papel === "analista" || c.papel === "contabilidade"
                          ? `${c.empresas.length} empresa(s) liberada(s)`
                          : `${PAPEL_LABEL[c.papel] ?? c.papel} — acesso total`}
                    </p>
                  </div>

                  {ehDono ? (
                    <span className="rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-semibold text-brand-dark">Dono</span>
                  ) : (
                    <>
                      {/*
                        Uma linha por colaborador: o rótulo visível repetiria
                        "Função" dezenas de vezes, e o nome de quem o select
                        afeta só existe na linha — por isso vai no `aria-label`.
                      */}
                      <select
                        id={`colab-${c.membro_id}-papel`}
                        aria-label={`Função de ${c.email}`}
                        value={c.papel}
                        onChange={(e) => mudarPapel(c, e.target.value)}
                        className={classeControle("md")}
                      >
                        <option value="analista">Analista</option>
                        <option value="contabilidade">Contabilidade</option>
                        <option value="admin">Administrador</option>
                        <option value="membro">Membro</option>
                      </select>
                      {(c.papel === "analista" || c.papel === "contabilidade") && (
                        <MultiSelect
                          opcoes={opcoesEmpresas}
                          selecionados={c.empresas}
                          onChange={(sel) => mudarEscopo(c, sel)}
                          placeholder="Buscar empresa…"
                          textoTodos="Nenhuma empresa"
                          className="min-w-[180px]"
                        />
                      )}
                      <MultiSelect
                        label="Telas bloqueadas"
                        opcoes={MENUS_BLOQUEAVEIS}
                        selecionados={c.menus}
                        onChange={(sel) => mudarMenus(c, sel)}
                        placeholder="Buscar tela…"
                        textoTodos="Nenhuma (vê tudo)"
                        className="min-w-[180px]"
                      />
                      <BotaoIcone rotulo={`Remover ${c.email} da equipe`} variante="perigo" onClick={() => remover(c)}>
                        <Trash2 size={15} />
                      </BotaoIcone>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
