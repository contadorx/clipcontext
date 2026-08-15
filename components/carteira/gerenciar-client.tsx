"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Building2, Search, X, AlertTriangle, Pencil, TrendingUp, Trash2 } from "lucide-react";
import { definirStatusEmpresa, salvarEmpresaGestao, excluirEmpresa } from "@/app/actions";
import { configDeRow, precoMensalBase, type CicloDef } from "@/lib/precos";
import { brl, dataBR, mascaraCpfCnpj, mascaraMoeda, moedaParaInput, parseMoeda } from "@/lib/formato";
import MessageStrip from "@/components/ui/message-strip";
import EmptyState from "@/components/ui/empty-state";
import Modal, { useSujo } from "@/components/ui/modal";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

export type EmpresaGestao = {
  id: string;
  nome: string;
  cnpj_cpf: string | null;
  status: string;
  entrada_em: string | null;
  arquivada_em: string | null;
  honorario: number | null;
  responsavel_id: string | null;
};

type Colaborador = { user_id: string; email: string };

export default function GerenciarClient({
  empresas,
  colaboradores,
  cfg,
}: {
  empresas: EmpresaGestao[];
  colaboradores: Colaborador[];
  cfg: { faixas: { ate: number | null; preco: number }[]; piso: number; ciclos: CicloDef[] };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [indo, setIndo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [confirmar, setConfirmar] = useState<EmpresaGestao | null>(null);
  const [excluir, setExcluir] = useState<EmpresaGestao | null>(null);
  const [confTexto, setConfTexto] = useState("");
  const [erroEx, setErroEx] = useState<string | null>(null);
  /** falha de arquivar/reativar/salvar — fora dos diálogos, que fecham */
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  /** deu certo, mas sobrou algo para conferir (arquivo no armazenamento) */
  const [avisoAcao, setAvisoAcao] = useState<string | null>(null);
  const [editar, setEditar] = useState<EmpresaGestao | null>(null);
  const [edHon, setEdHon] = useState("");
  const [edResp, setEdResp] = useState("");
  // guarda contra perder honorário/responsável já digitados ao clicar fora ou apertar Esc
  const formEditar = useSujo(editar);

  const emailDe = (uid: string | null) => colaboradores.find((c) => c.user_id === uid)?.email ?? null;

  const q = busca.trim().toLowerCase();
  const filtradas = empresas.filter((e) => e.nome.toLowerCase().includes(q));
  const ativas = filtradas.filter((e) => e.status === "ativa");
  const arquivadas = filtradas.filter((e) => e.status === "arquivada");

  // licenças
  const cfgM = useMemo(() => configDeRow(cfg), [cfg]);
  const nAtivas = empresas.filter((e) => e.status === "ativa").length;
  const valorAtual = precoMensalBase(nAtivas, cfgM);
  const economiaArquivar = nAtivas > 0 ? valorAtual - precoMensalBase(nAtivas - 1, cfgM) : 0;
  const idxFaixa = cfgM.faixas.findIndex((f) => nAtivas <= f.ate);
  const faixaAtual = idxFaixa >= 0 ? cfgM.faixas[idxFaixa] : cfgM.faixas[cfgM.faixas.length - 1];
  const proximaFaixa = idxFaixa >= 0 && idxFaixa < cfgM.faixas.length - 1 ? cfgM.faixas[idxFaixa + 1] : null;
  const limiarProxima = faixaAtual.ate + 1;

  function mudarStatus(e: EmpresaGestao, arquivar: boolean) {
    setIndo(e.id);
    setErroAcao(null);
    start(async () => {
      // arquivar/reativar que falha em silêncio parece clique que não pegou:
      // o `router.refresh()` redesenha a linha exatamente como estava
      const r = await definirStatusEmpresa(e.id, arquivar);
      setIndo(null);
      /*
        O diálogo fecha ANTES de a mensagem aparecer.

        `erroAcao` é desenhado no topo da página; deixar o diálogo aberto punha
        a explicação atrás da cortina escura, e o botão só voltava de
        "Arquivando…" para "Arquivar" sem que nada mais acontecesse. Quem não
        tem permissão ficava clicando para sempre num botão mudo.
      */
      setConfirmar(null);
      if (!r.ok) {
        setErroAcao(r.error ?? "Não foi possível alterar o status desta empresa.");
        return;
      }
      router.refresh();
    });
  }

  function fazerExcluir() {
    if (!excluir) return;
    setIndo(excluir.id);
    setErroEx(null);
    start(async () => {
      const r = await excluirEmpresa(excluir.id);
      setIndo(null);
      if (!r.ok) {
        setErroEx(r.error ?? "Falha ao excluir.");
        return;
      }
      setExcluir(null);
      setConfTexto("");
      // arquivo que sobrou no armazenamento não desfaz a exclusão, mas alguém
      // precisa saber que continua sendo cobrado por ele. É aviso, não erro:
      // pintar de vermelho um sucesso convida a repetir a ação destrutiva
      if (r.aviso) setAvisoAcao(r.aviso);
      router.refresh();
    });
  }

  function abrirEditar(e: EmpresaGestao) {
    setEditar(e);
    setEdHon(e.honorario != null ? moedaParaInput(e.honorario) : "");
    setEdResp(e.responsavel_id ?? "");
  }
  function salvar() {
    if (!editar) return;
    const hon = edHon.trim() === "" ? null : parseMoeda(edHon);
    setErroAcao(null);
    start(async () => {
      const r = await salvarEmpresaGestao(editar.id, {
        honorario: Number.isFinite(hon as number) ? hon : null,
        responsavel_id: edResp || null,
      });
      setEditar(null);
      if (!r.ok) {
        setErroAcao(r.error ?? "Não foi possível salvar.");
        return;
      }
      router.refresh();
    });
  }

  /**
   * Função chamada, não componente. Definida no corpo do render e usada como
   * `<Linha>`, ela teria identidade nova a cada render e o React remontaria toda a
   * subárvore — o que aqui destrói e recria a lista inteira a cada tecla na
   * busca, e em outros lugares do app fez campo de texto aceitar só uma letra.
   * A `key` vai no elemento de raiz.
   */
  const linha = (e: EmpresaGestao, arquivada: boolean) => {
    const carregando = pending && indo === e.id;
    const resp = emailDe(e.responsavel_id);
    return (
      <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl2 bg-white px-4 py-3 shadow-card">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{e.nome}</p>
          <p className="num truncate text-xs text-ink-soft">
            {mascaraCpfCnpj(e.cnpj_cpf ?? "") || "sem CNPJ"} · {arquivada ? `arquivada em ${dataBR(e.arquivada_em)}` : `desde ${dataBR(e.entrada_em)}`}
          </p>
          {!arquivada && (e.honorario != null || resp) && (
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {e.honorario != null && <span className="num font-semibold text-ink">{brl(e.honorario)}/mês</span>}
              {e.honorario != null && resp && " · "}
              {resp && <span>resp. {resp}</span>}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!arquivada && (
            <button
              type="button"
              onClick={() => abrirEditar(e)}
              className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand"
            >
              <Pencil size={13} /> Editar
            </button>
          )}
          {arquivada ? (
            <>
              <button
                type="button"
                onClick={() => mudarStatus(e, false)}
                disabled={carregando}
                className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand disabled:opacity-60"
              >
                <RotateCcw size={13} /> {carregando ? "..." : "Reativar"}
              </button>
              <button
                type="button"
                onClick={() => { setExcluir(e); setConfTexto(""); setErroEx(null); }}
                disabled={carregando}
                title="Excluir definitivamente"
                className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-danger hover:text-danger disabled:opacity-60"
              >
                <Trash2 size={13} /> Excluir
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmar(e)}
              disabled={carregando}
              className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-danger hover:text-danger disabled:opacity-60"
            >
              <Archive size={13} /> Arquivar
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {erroAcao && (
        <MessageStrip tipo="erro" fechavel onFechar={() => setErroAcao(null)}>
          {erroAcao}
        </MessageStrip>
      )}
      {avisoAcao && (
        <MessageStrip tipo="alerta" fechavel onFechar={() => setAvisoAcao(null)}>
          {avisoAcao}
        </MessageStrip>
      )}
      {/* painel de licenças */}
      <div className="rounded-xl2 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light text-brand">
              <Building2 size={22} />
            </div>
            <div>
              <p className="num text-2xl font-extrabold text-ink">{nAtivas}</p>
              <p className="text-xs text-ink-muted">empresas ativas no plano</p>
            </div>
          </div>
          <div className="text-right">
            <p className="num text-2xl font-extrabold text-brand">{brl(valorAtual)}</p>
            <p className="text-xs text-ink-muted">valor mensal de referência</p>
          </div>
          <div className="relative w-full sm:w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            {/*
              Rótulo por `aria-label`: o campo tem a lupa sobreposta e vive no
              cabeçalho do painel, ao lado dos números — um rótulo em cima
              desalinharia o bloco inteiro.
            */}
            <input
              id="gerenciar-busca"
              aria-label="Buscar empresa"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa…"
              className="w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line pt-3 text-xs text-ink-muted">
          <span>
            Faixa atual: <span className="num font-semibold text-ink">{brl(faixaAtual.preco)}/empresa</span>
          </span>
          {proximaFaixa ? (
            <span className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-brand" />
              A partir da {limiarProxima}ª empresa, cada nova entra por{" "}
              <span className="num font-semibold text-brand">{brl(proximaFaixa.preco)}/mês</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-brand" />
              Você já está na melhor faixa por volume (
              <span className="num font-semibold text-ink">{brl(faixaAtual.preco)}/empresa</span>)
            </span>
          )}
          <Link href="/configuracoes/assinatura" className="font-semibold text-brand hover:underline">
            Ver / ajustar assinatura
          </Link>
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">
          Valor de referência por volume. A cobrança real considera o ciclo e a quantidade contratada — ajuste na Assinatura
          para refletir mudanças.
        </p>
      </div>

      {/* ativas */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Ativas ({ativas.length})</h2>
        {ativas.length === 0 ? (
          <EmptyState compacto titulo="Nenhuma empresa ativa" />
        ) : (
          ativas.map((e) => linha(e, false))
        )}
      </section>

      {/* arquivadas */}
      {arquivadas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Arquivadas ({arquivadas.length})</h2>
          {arquivadas.map((e) => linha(e, true))}
        </section>
      )}

      {/* editar honorário + responsável */}
      {editar && (
        <Modal
          rotulo={`Honorário e responsável — ${editar.nome}`}
          onFechar={() => setEditar(null)}
          sujo={formEditar.sujo}
          largura="max-w-sm"
        >
          <div className="p-5" {...formEditar.campos}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">Editar {editar.nome}</h3>
              <button aria-label="Fechar" type="button" onClick={() => formEditar.confirmar() && setEditar(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface">
                <X size={16} />
              </button>
            </div>
            <label htmlFor="gerenciar-honorario" className="mt-4 mb-1 block text-[11px] font-semibold text-ink-soft">
              Honorário mensal (R$)
            </label>
            <input
              id="gerenciar-honorario"
              value={edHon}
              onChange={(e) => setEdHon(mascaraMoeda(e.target.value))}
              inputMode="decimal"
              placeholder="0,00"
              className={classeControle("md")}
            />
            <label htmlFor="gerenciar-responsavel" className="mt-3 mb-1 block text-[11px] font-semibold text-ink-soft">
              Responsável
            </label>
            <select
              id="gerenciar-responsavel"
              value={edResp}
              onChange={(e) => setEdResp(e.target.value)}
              className={classeControle("md")}
            >
              <option value="">Sem responsável</option>
              {colaboradores.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.email}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditar(null)} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface">
                Cancelar
              </button>
              <Botao variante="primario"
                onClick={salvar}
                disabled={pending}
              >
                {pending ? "Salvando…" : "Salvar"}
              </Botao>
            </div>
          </div>
        </Modal>
      )}

      {/* confirmar arquivar — sem campo nenhum, nada a perder ao fechar */}
      {confirmar && (
        <Modal rotulo={`Arquivar ${confirmar.nome}`} onFechar={() => setConfirmar(null)} largura="max-w-sm">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                <AlertTriangle size={16} className="text-danger" /> Arquivar empresa
              </h3>
              <button aria-label="Fechar" type="button" onClick={() => setConfirmar(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface">
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              <span className="font-semibold text-ink">{confirmar.nome}</span> sai da operação e do seletor, libera uma licença
              e deixa de contar na cobrança. O histórico é preservado e você pode reativar quando quiser.
            </p>
            {economiaArquivar > 0 && (
              <p className="mt-2 text-xs text-ink-soft">
                Reduz o valor de referência em <span className="num font-semibold">{brl(economiaArquivar)}/mês</span>. A
                cobrança real é ajustada na Assinatura.
              </p>
            )}
            {nAtivas === 1 && (
              <div className="mt-3 flex gap-2 rounded-lg bg-surface p-3 text-xs text-ink-muted">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" />
                <span>
                  Esta é a sua última empresa ativa. Sem nenhuma empresa ativa, o sistema volta para a tela de configuração
                  inicial até você reativar esta ou criar outra.
                </span>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmar(null)} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => mudarStatus(confirmar, true)}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                <Archive size={14} /> {pending ? "Arquivando…" : "Arquivar"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/*
        Excluir: sem `sujo`. O único campo é a digitação do nome para confirmar —
        redigitá-lo não é trabalho perdido, e a pergunta ali seria só ruído.
      */}
      {excluir && (
        <Modal rotulo={`Excluir ${excluir.nome} definitivamente`} onFechar={() => setExcluir(null)} largura="max-w-sm">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                <AlertTriangle size={16} className="text-danger" /> Excluir definitivamente
              </h3>
              <button aria-label="Fechar" type="button" onClick={() => setExcluir(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface">
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              Isso apaga <span className="font-semibold text-ink">{excluir.nome}</span> e todo o histórico: lançamentos,
              contas, conciliação, documentos, portal e acessos. <span className="font-semibold text-danger">Não dá para desfazer.</span>
            </p>
            <label htmlFor="gerenciar-confirmar-nome" className="mt-4 mb-1 block text-[11px] font-semibold text-ink-soft">
              Para confirmar, digite o nome da empresa:
            </label>
            <input
              id="gerenciar-confirmar-nome"
              value={confTexto}
              onChange={(e) => setConfTexto(e.target.value)}
              placeholder={excluir.nome}
              // mesma comparação do botão logo abaixo (`trim()` dos dois lados):
              // vermelho só quando o texto já não pode virar o nome da empresa
              className={classeControle(
                "md",
                confTexto.trim().length > 0 && !excluir.nome.trim().startsWith(confTexto.trim()),
              )}
            />
            {erroEx && <MessageStrip tipo="erro">{erroEx}</MessageStrip>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setExcluir(null)} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface">
                Cancelar
              </button>
              <Botao variante="perigo"
                onClick={fazerExcluir}
                disabled={pending || confTexto.trim() !== excluir.nome.trim()}
              >
                <Trash2 size={14} /> {pending ? "Excluindo…" : "Excluir"}
              </Botao>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
