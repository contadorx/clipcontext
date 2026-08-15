"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  Search,
  UploadCloud,
  Link2,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Repeat2,
  Lock,
  Unlock,
  Zap,
  Split,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { carregarRateios } from "@/lib/rateio";
import LancamentoModal, { type Tipo } from "@/components/lancamentos/lancamento-modal";
import LancamentoRapido from "@/components/lancamentos/lancamento-rapido";
import LinhaRapida from "@/components/lancamentos/linha-rapida";
import BarraVisoes from "@/components/ui/barra-visoes";
import FilterBar from "@/components/ui/filter-bar";
import MultiSelect from "@/components/ui/multi-select";
import { SortToggle, ordenar, toggleOrd, type Ordenacao } from "@/components/ui/sort";
import { useAtalhosModal } from "@/lib/atalhos";
import { useToast } from "@/components/ui/toast";
import { useVisoes } from "@/components/ui/use-visoes";
import ConfigColunasBotao, { useConfigColunas, type ColunaDef } from "@/components/ui/config-colunas";
import { usePreferencia } from "@/lib/preferencia-local";
import { queryParaFiltros, type Filtros } from "@/lib/visoes";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import ObjectStatus, { StatusIcone, type Tom } from "@/components/ui/object-status";
import EmptyState from "@/components/ui/empty-state";
import { brl, dataBR } from "@/lib/formato";
import FooterBar, { FooterSep } from "@/components/ui/footer-bar";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";
import { useListaNavegavel } from "@/components/ui/use-lista-navegavel";

type Lanc = {
  id: string;
  tipo: Tipo;
  valor: number;
  descricao: string | null;
  data_competencia: string;
  data_vencimento: string;
  data_pagamento: string | null;
  data_agendamento: string | null;
  conciliado: boolean;
  transferencia: boolean;
  transferencia_par_id: string | null;
  numero_documento: string | null;
  forma_pagamento: string | null;
  pagamento_dados: Record<string, string> | null;
  categoria_id: string | null;
  conta_id: string | null;
  cliente_fornecedor_id: string | null;
  centro_custo_id: string | null;
  recorrencia_id: string | null;
  exportado_em: string | null;
  categoria: { nome: string } | null;
  conta: { nome: string } | null;
  pessoa: { nome: string } | null;
};

type TipoFiltro = "todas" | "entrada" | "saida" | "transferencia";

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}
function inicioMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function fimMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

// Colunas configuráveis da tabela (as fixas nunca somem). "documento" e
// "competencia" nascem ocultas: existem para quem precisa e não pesam para quem não usa.
const COLUNAS_MOV: ColunaDef[] = [
  // só o ícone: "Entrada"/"Saída" por extenso repetia o que o sinal e a cor do
  // valor já dizem, e custava 55px de uma Descrição que truncava em quase
  // toda linha (ver D3 da auditoria)
  { id: "tipo", label: "Tipo", largura: "38px" },
  { id: "situacao", label: "Situação", largura: "104px" },
  { id: "venc", label: "Venc.", largura: "76px", fixa: true },
  { id: "competencia", label: "Competência", largura: "88px" },
  { id: "documento", label: "Documento", largura: "96px" },
  { id: "descricao", label: "Descrição", largura: "1.2fr", fixa: true },
  { id: "pessoa", label: "Cliente/Forn.", largura: "1fr" },
  { id: "categoria", label: "Categoria", largura: "1fr" },
  { id: "conta", label: "Conta", largura: "1fr" },
  { id: "valor", label: "Valor", largura: "116px", fixa: true },
];
const OCULTAS_PADRAO = ["competencia", "documento"];

const FORMA_LABEL: Record<string, string> = {
  boleto: "Boleto",
  pix: "Pix",
  ted: "TED",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  debito_automatico: "Déb. automático",
};

export default function LancamentosClient({
  empresaId,
  contaFixa,
}: {
  empresaId: string;
  /** Quando definido (string = conta; null = todas), a tela é controlada por fora
   *  (barra de contas) e o seletor de conta interno fica escondido. */
  contaFixa?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Padrão da tela: mês corrente. As chaves são as que aparecem na URL.
  const padrao = useMemo<Filtros>(
    () => ({
      tipo: "todas",
      de: inicioMes(),
      ate: fimMes(),
      q: "",
      contas: [],
      sit: [],
      conc: [],
      ord: "venc",
      dir: "desc",
    }),
    [],
  );
  // Estado inicial vem da URL — link com filtros abre exatamente o mesmo recorte.
  const inicial = useMemo(
    () => queryParaFiltros(new URLSearchParams(searchParams?.toString() ?? ""), padrao),
    // só na montagem: depois quem manda no state é o usuário
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>(inicial.tipo as TipoFiltro);
  const [de, setDe] = useState((inicial.de as string) || inicioMes());
  const [ate, setAte] = useState((inicial.ate as string) || fimMes());
  const [busca, setBusca] = useState(inicial.q as string);
  const [concSel, setConcSel] = useState<string[]>(inicial.conc as string[]);
  const [sitsSel, setSitsSel] = useState<string[]>(inicial.sit as string[]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [contasSel, setContasSel] = useState<string[]>(inicial.contas as string[]);
  const [categorias, setCategorias] = useState<{ id: string; nome: string; tipo: string }[]>([]);
  const [centros, setCentros] = useState<{ id: string; nome: string }[]>([]);

  const [lista, setLista] = useState<Lanc[]>([]);
  const [rateados, setRateados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [ord, setOrd] = useState<Ordenacao>({
    campo: (inicial.ord as Ordenacao["campo"]) ?? "venc",
    dir: (inicial.dir as Ordenacao["dir"]) ?? "desc",
  });

  // Colunas escolhidas por esta pessoa (localStorage, por tela)
  const colunas = useConfigColunas("movimentacoes", COLUNAS_MOV, OCULTAS_PADRAO);

  // Modal de lançamento (novo e edição) — unificado: entrada/saída/transferência
  const [modalAberto, setModalAberto] = useState(false);
  const [editTipo, setEditTipo] = useState<Tipo>("entrada");

  /**
   * Segunda linha na descrição: contexto da linha (forma de pagamento,
   * documento, recorrente, rateado, conciliado).
   *
   * É escolha, não decisão minha. Ligada, "Farinha de trigo — lote 22" deixa de
   * aparecer duas vezes igual e passa a dizer qual é a parcela 1/3 e qual é a
   * 2/3 — dá para reconhecer a linha sem abrir. Desligada, cabem mais linhas na
   * tela. As duas coisas são legítimas e dependem de para que a pessoa abriu a
   * lista; nasce ligada porque reconhecer sem abrir economiza mais do que ver
   * duas linhas a mais.
   */
  const [detalhe, setDetalhe] = usePreferencia<boolean>("mov_detalhe_linha", true);
  const [rapidoAberto, setRapidoAberto] = useState(false);
  const buscaRef = useRef<HTMLInputElement | null>(null);
  // a rolagem até a linha em foco é do hook (via `data-linha-id`)

  const carregar = useCallback(async () => {
    if (!empresaId) return;
    setCarregando(true);
    const supabase = createClient();
    const lancRes = await supabase
      .from("lancamentos")
      .select(
        "id, tipo, valor, descricao, data_competencia, data_vencimento, data_pagamento, data_agendamento, conciliado, transferencia, transferencia_par_id, numero_documento, forma_pagamento, pagamento_dados, categoria_id, conta_id, centro_custo_id, cliente_fornecedor_id, recorrencia_id, exportado_em, categoria:categorias(nome), conta:contas_bancarias(nome), pessoa:clientes_fornecedores(nome)",
      )
      .eq("empresa_id", empresaId)
      .gte("data_vencimento", de)
      .lte("data_vencimento", ate)
      .order("data_vencimento", { ascending: false });
    const linhas = ((lancRes.data as unknown) as Lanc[]) ?? [];
    setLista(linhas);
    // marca quais estão rateados entre centros (degrada em silêncio se a
    // tabela lancamento_rateios ainda não existir)
    const mapa = await carregarRateios(supabase, empresaId, linhas.map((l) => l.id));
    setRateados(new Set(Array.from(mapa.keys())));
    setCarregando(false);
  }, [empresaId, de, ate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      const supabase = createClient();
      const [c, cat, ce] = await Promise.all([
        supabase.from("contas_bancarias").select("id, nome").eq("empresa_id", empresaId).order("nome"),
        supabase.from("categorias").select("id, nome, tipo").eq("empresa_id", empresaId).order("nome"),
        supabase.from("centros_custo").select("id, nome").eq("empresa_id", empresaId).order("nome"),
      ]);
      setContas((c.data as { id: string; nome: string }[]) ?? []);
      setCategorias((cat.data as { id: string; nome: string; tipo: string }[]) ?? []);
      setCentros((ce.data as { id: string; nome: string }[]) ?? []);
    })();
  }, [empresaId]);

  // Recarrega quando algo é lançado em qualquer lugar (menu, painel, etc.)
  useEffect(() => {
    const h = () => carregar();
    window.addEventListener("fs-mov-changed", h);
    return () => window.removeEventListener("fs-mov-changed", h);
  }, [carregar]);

  // O command palette (⌘K) pede "Novo lançamento" de qualquer tela.
  useEffect(() => {
    const h = () => {
      setEditTipo("saida");
      setModalAberto(true);
    };
    window.addEventListener("fs-novo-lancamento", h);
    return () => window.removeEventListener("fs-novo-lancamento", h);
  }, []);

  // Quando a tela é controlada por fora (barra de contas), o filtro de conta
  // segue a conta selecionada lá. contaFixa === undefined => não controlado.
  useEffect(() => {
    if (contaFixa === undefined) return;
    setContasSel(contaFixa ? [contaFixa] : []);
  }, [contaFixa]);

  /* ------------------------------------------------- visões e URL --------- */

  const filtros = useMemo<Filtros>(
    () => ({
      tipo: tipoFiltro,
      de,
      ate,
      q: busca,
      contas: contasSel,
      sit: sitsSel,
      conc: concSel,
      ord: ord.campo,
      dir: ord.dir,
    }),
    [tipoFiltro, de, ate, busca, contasSel, sitsSel, concSel, ord],
  );

  // aplica um recorte (visão salva ou "limpar") de volta no estado da tela
  const aplicarFiltros = useCallback(
    (f: Filtros) => {
      setTipoFiltro((f.tipo as TipoFiltro) || "todas");
      setDe((f.de as string) || inicioMes());
      setAte((f.ate as string) || fimMes());
      setBusca((f.q as string) ?? "");
      if (contaFixa === undefined) setContasSel((f.contas as string[]) ?? []);
      setSitsSel((f.sit as string[]) ?? []);
      setConcSel((f.conc as string[]) ?? []);
      setOrd({ campo: (f.ord as Ordenacao["campo"]) ?? "venc", dir: (f.dir as Ordenacao["dir"]) ?? "desc" });
      setSel(new Set());
    },
    [contaFixa],
  );

  const vis = useVisoes({ empresaId, tela: "movimentacoes", padrao, filtros, aplicar: aplicarFiltros });

  function abrirNovoTipo(t: Tipo) {
    setEditTipo(t);
    setModalAberto(true);
  }
  function novo() {
    if (tipoFiltro === "entrada") abrirNovoTipo("entrada");
    else if (tipoFiltro === "saida") abrirNovoTipo("saida");
    else if (tipoFiltro === "transferencia") abrirNovoTipo("transferencia");
    else abrirNovoTipo("saida");
  }

  /**
   * Abrir um lançamento agora é navegar para a página dele
   * (`/movimentacoes/<id>`) — o item tem URL própria, abre em outra aba e volta
   * pelo botão do navegador. O diálogo ficou só para a criação rápida.
   */
  function abrirEdicao(l: Lanc) {
    if (l.transferencia) return; // transferências não se editam aqui
    router.push(`/movimentacoes/${l.id}`);
  }

  /* ------------------------------------------- deep link do lançamento ---- */

  // Compatibilidade: links antigos com ?lanc=<id> vão para a página do objeto.
  const lancUrlRef = useRef<string | null>(null);
  useEffect(() => {
    const alvo = searchParams?.get("lanc") ?? null;
    if (!alvo || alvo === lancUrlRef.current) return;
    lancUrlRef.current = alvo;
    router.replace(`/movimentacoes/${alvo}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function aoSalvar() {
    await carregar();
    router.refresh();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
  }

  async function reabrir(l: Lanc) {
    if (
      !confirm(
        "Este lançamento foi exportado para a contabilidade. Reabrir libera a edição e a exclusão — e ele voltará a sair numa próxima exportação. Continuar?"
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from("lancamentos").update({ exportado_em: null }).eq("id", l.id);
    if (error) { alert(error.message); return; }
    await carregar();
    router.refresh();
  }

  const [excluirAlvo, setExcluirAlvo] = useState<Lanc | null>(null);

  async function excluir(l: Lanc) {
    if (l.exportado_em) {
      alert("Este lançamento foi exportado para a contabilidade. Reabra-o antes de excluir.");
      return;
    }
    if (l.recorrencia_id) { setExcluirAlvo(l); return; }
    const isTransfer = l.transferencia;
    const supabase = createClient();

    // Guarda as linhas inteiras antes de apagar — é o que permite o "Desfazer"
    // no lugar do confirm() (menos clique por operação, e sem susto).
    const alvoIds =
      isTransfer && l.transferencia_par_id
        ? lista.filter((x) => x.transferencia_par_id === l.transferencia_par_id).map((x) => x.id)
        : [l.id];
    /*
      Sem backup não existe Desfazer — e aqui o Desfazer é o que substitui o
      `confirm()`. Se a leitura falha em silêncio, a pessoa exclui contando com
      o "voltar atrás" e só descobre que ele não existe quando o toast some,
      com a linha já apagada. Então quando não dá para preparar o Desfazer, a
      mensagem diz isso.
    */
    const backupRes = await supabase.from("lancamentos").select("*").in("id", alvoIds);

    const exclusao =
      isTransfer && l.transferencia_par_id
        ? await supabase.from("lancamentos").delete().eq("transferencia_par_id", l.transferencia_par_id)
        : await supabase.from("lancamentos").delete().eq("id", l.id);
    if (exclusao.error) { toast(exclusao.error.message, { tom: "erro" }); return; }
    await carregar();
    router.refresh();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));

    const linhas = backupRes.error ? [] : ((backupRes.data as Record<string, unknown>[] | null) ?? []);
    const base = isTransfer ? "Transferência excluída (as duas pontas)." : `Lançamento excluído: ${l.descricao || "sem descrição"}.`;
    toast(
      linhas.length ? base : `${base} Não foi possível preparar o Desfazer — para recuperar, lance de novo.`,
      {
        desfazer: linhas.length
          ? async () => {
              const { error: e2 } = await createClient().from("lancamentos").insert(linhas);
              if (e2) { toast(e2.message, { tom: "erro" }); return; }
              await carregar();
              router.refresh();
              if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
            }
          : undefined,
      },
    );
  }

  async function excluirSo() {
    if (!excluirAlvo) return;
    const supabase = createClient();
    const { error } = await supabase.from("lancamentos").delete().eq("id", excluirAlvo.id);
    if (error) { alert(error.message); return; }
    setExcluirAlvo(null);
    await carregar(); router.refresh();
  }

  async function excluirSerie() {
    if (!excluirAlvo?.recorrencia_id) return;
    const supabase = createClient();
    const { error } = await supabase.from("lancamentos").delete().eq("recorrencia_id", excluirAlvo.recorrencia_id);
    if (error) { alert(error.message); return; }
    setExcluirAlvo(null);
    await carregar(); router.refresh();
  }

  function classifica(l: Lanc): "previsto" | "agendada" | "efetivada" {
    if (l.data_pagamento) return "efetivada";
    if (l.data_agendamento) return "agendada";
    return "previsto";
  }

  function toggleSel(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Guarda o estado atual dos selecionados para conseguir reverter depois. */
  function snapshot(ids: string[]) {
    return lista
      .filter((l) => ids.includes(l.id))
      .map((l) => ({
        id: l.id,
        data_pagamento: l.data_pagamento,
        data_agendamento: l.data_agendamento,
        categoria_id: l.categoria_id,
        conta_id: l.conta_id,
        centro_custo_id: l.centro_custo_id,
      }));
  }

  /** Reverte campo a campo o que o snapshot guardou. */
  async function reverter(
    snap: ReturnType<typeof snapshot>,
    campos: ("data_pagamento" | "data_agendamento" | "categoria_id" | "conta_id" | "centro_custo_id")[],
  ) {
    const supabase = createClient();
    const rs = await Promise.all(
      snap.map((s) => {
        const patch: Record<string, unknown> = {};
        campos.forEach((c) => {
          patch[c] = s[c];
        });
        return supabase.from("lancamentos").update(patch).eq("id", s.id);
      }),
    );
    /*
      Desfazer que não desfaz e não avisa é a pior combinação: a pessoa confia
      que reverteu duzentos lançamentos marcados como efetivados por engano, e
      nada voltou.
    */
    const falhou = rs.filter((r) => r.error).length;
    if (falhou > 0) {
      toast(`${falhou} de ${snap.length} não puderam ser revertidos. Confira a lista.`, { tom: "erro" });
    }
    await carregar();
    router.refresh();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
  }

  async function mudarSituacao(novo: "previsto" | "agendada" | "efetivada") {
    if (sel.size === 0) return;
    const ids = Array.from(sel);
    const snap = snapshot(ids);
    const supabase = createClient();
    // efetivada -> pago hoje; previsto -> sem data; agendada -> data planejada = vencimento de cada um
    let error = null;
    if (novo === "agendada") {
      const alvos = lista.filter((l) => sel.has(l.id) && !l.transferencia);
      const res = await Promise.all(
        alvos.map((l) =>
          supabase.from("lancamentos").update({ data_pagamento: l.data_vencimento }).eq("id", l.id),
        ),
      );
      error = res.find((r) => r.error)?.error ?? null;
    } else {
      const data_pagamento = novo === "efetivada" ? hoje() : null;
      const res = await supabase.from("lancamentos").update({ data_pagamento }).in("id", ids);
      error = res.error;
    }
    if (error) {
      toast(error.message, { tom: "erro" });
      return;
    }
    setSel(new Set());
    await carregar();
    router.refresh();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
    const rotulo = novo === "efetivada" ? "efetivado(s)" : novo === "agendada" ? "agendado(s)" : "marcado(s) como previsto";
    toast(`${ids.length} lançamento(s) ${rotulo}.`, {
      desfazer: () => reverter(snap, ["data_pagamento", "data_agendamento"]),
    });
  }

  // troca categoria / conta / centro de custo dos selecionados (ignora transferências)
  async function aplicarEmMassa(campo: "categoria_id" | "conta_id" | "centro_custo_id", valor: string) {
    if (sel.size === 0 || !valor) return;
    const ids = lista.filter((l) => sel.has(l.id) && !l.transferencia).map((l) => l.id);
    if (ids.length === 0) return;
    const snap = snapshot(ids);
    const supabase = createClient();
    const { error } = await supabase.from("lancamentos").update({ [campo]: valor }).in("id", ids);
    if (error) { toast(error.message, { tom: "erro" }); return; }
    setSel(new Set());
    await carregar();
    router.refresh();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
    const nomeCampo = campo === "categoria_id" ? "Categoria" : campo === "conta_id" ? "Conta" : "Centro de custo";
    toast(`${nomeCampo} alterada em ${ids.length} lançamento(s).`, {
      desfazer: () => reverter(snap, [campo]),
    });
  }

  /**
   * Excluir os selecionados.
   *
   * Guarda as linhas inteiras antes de apagar e devolve um "Desfazer" no aviso,
   * como o excluir de um item já fazia. É o que permite não ter `confirm()`:
   * a saída do erro existe depois, e não custa um clique a cada acerto.
   *
   * Barra dois casos em vez de apagar pela metade: lançamento exportado para a
   * contabilidade (precisa ser reaberto antes) e lançamento de recorrência, que
   * pergunta "só este ou a série?" — pergunta que não cabe num lote.
   */
  async function excluirSelecionados() {
    const alvos = lista.filter((l) => sel.has(l.id));
    if (alvos.length === 0) return;

    const exportados = alvos.filter((l) => l.exportado_em);
    const recorrentes = alvos.filter((l) => l.recorrencia_id);
    if (exportados.length || recorrentes.length) {
      toast(
        [
          exportados.length && `${exportados.length} exportado(s) para a contabilidade — reabra antes`,
          recorrentes.length && `${recorrentes.length} de recorrência — exclua pela linha, para escolher entre este e a série`,
        ]
          .filter(Boolean)
          .join(" · "),
        { tom: "erro" },
      );
      return;
    }

    // transferência apaga as duas pontas: meia transferência é saldo errado
    const ids = new Set<string>();
    alvos.forEach((l) => {
      if (l.transferencia && l.transferencia_par_id) {
        lista.filter((x) => x.transferencia_par_id === l.transferencia_par_id).forEach((x) => ids.add(x.id));
      } else {
        ids.add(l.id);
      }
    });

    const supabase = createClient();
    const alvoIds = Array.from(ids);
    /*
      Sem backup não há exclusão.

      O `select("*")` que alimenta o Desfazer tinha o erro descartado: se ele
      falhasse, `backup` vinha nulo, os lançamentos eram apagados assim mesmo e
      o Desfazer não tinha o que restaurar. E o backup só existe na memória do
      toast, que fecha em seguida — a perda é definitiva.
    */
    const bk = await supabase.from("lancamentos").select("*").in("id", alvoIds);
    if (bk.error) {
      toast(`Não foi possível preparar o desfazer (${bk.error.message}). Nada foi excluído.`, { tom: "erro" });
      return;
    }
    const backup = bk.data;
    const { error } = await supabase.from("lancamentos").delete().in("id", alvoIds);
    if (error) {
      toast(error.message, { tom: "erro" });
      return;
    }
    setSel(new Set());
    await carregar();
    router.refresh();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));

    const linhas = (backup as Record<string, unknown>[] | null) ?? [];
    toast(`${alvoIds.length} lançamento(s) excluído(s).`, {
      desfazer: async () => {
        // a versão de item único já verificava; a de lote, não — e é ela que
        // pode perder duzentos lançamentos de uma vez
        if (linhas.length) {
          const r = await supabase.from("lancamentos").insert(linhas);
          if (r.error) {
            toast(`Não foi possível restaurar: ${r.error.message}`, { tom: "erro" });
            return;
          }
        }
        await carregar();
        router.refresh();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fs-mov-changed"));
      },
    });
  }

  // Cor = significado. Vermelho só quando há problema (vencido), âmbar para o
  // que vence hoje. Saída deixou de ser magenta: o magenta é cor de marca, não
  // de dado — quando tudo grita, nada grita.
  // Object status: texto colorido com marcador, em vez de pílula com fundo.
  // Numa lista de 100 linhas, 100 retângulos coloridos viram ruído; o texto
  // colorido mantém a leitura e continua dizendo a mesma coisa.
  function statusDe(l: Lanc): { texto: string; tom: Tom } {
    const s = classifica(l);
    if (s === "efetivada") return { texto: "Efetivada", tom: "positivo" };
    const hj = hoje();
    if (l.data_vencimento < hj) return { texto: "Vencido", tom: "negativo" };
    if (l.data_vencimento === hj) return { texto: "Vence hoje", tom: "critico" };
    if (s === "agendada") return { texto: "Agendada", tom: "info" };
    return { texto: "Previsto", tom: "neutro" };
  }

  function tipoDe(l: Lanc): { texto: string; classe: string; icon: typeof Repeat2 } {
    if (l.transferencia) return { texto: "Transf.", classe: "text-ink-soft", icon: Repeat2 };
    if (l.tipo === "entrada") return { texto: "Entrada", classe: "text-brand", icon: ArrowDownCircle };
    return { texto: "Saída", classe: "text-ink-muted", icon: ArrowUpCircle };
  }

  function venceu(l: Lanc): boolean {
    return !l.data_pagamento && l.data_vencimento < hoje();
  }

  const filtrada = lista.filter((l) => {
    if (tipoFiltro === "transferencia" && !l.transferencia) return false;
    if (tipoFiltro === "entrada" && (l.transferencia || l.tipo !== "entrada")) return false;
    if (tipoFiltro === "saida" && (l.transferencia || l.tipo !== "saida")) return false;
    if (contasSel.length > 0 && !contasSel.includes(l.conta_id ?? "")) return false;
    if (busca.trim() && !(l.descricao ?? "").toLowerCase().includes(busca.trim().toLowerCase())) return false;
    if (concSel.length === 1 && concSel[0] === "sim" && !l.conciliado) return false;
    if (concSel.length === 1 && concSel[0] === "nao" && l.conciliado) return false;
    if (sitsSel.length > 0 && !sitsSel.includes(classifica(l))) return false;
    return true;
  });

  const totEntradas = filtrada
    .filter((l) => !l.transferencia && l.tipo === "entrada")
    .reduce((s, l) => s + Number(l.valor), 0);
  const totSaidas = filtrada
    .filter((l) => !l.transferencia && l.tipo === "saida")
    .reduce((s, l) => s + Number(l.valor), 0);
  const saldo = totEntradas - totSaidas;

  // Totais do que está selecionado — confere o lote antes de efetivar.
  const selLinhas = lista.filter((l) => sel.has(l.id));
  const selEntradas = selLinhas.filter((l) => !l.transferencia && l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0);
  const selSaidas = selLinhas.filter((l) => !l.transferencia && l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
  const selSaldo = selEntradas - selSaidas;
  const selVencidos = selLinhas.filter((l) => venceu(l)).length;

  const ABAS_TIPO: { v: TipoFiltro; l: string }[] = [
    { v: "todas", l: "Todas" },
    { v: "entrada", l: "Entradas" },
    { v: "saida", l: "Saídas" },
    { v: "transferencia", l: "Transferências" },
  ];

  // grade: seleção (fixa) + colunas configuráveis + ações (fixa)
  const gridCols = `34px ${colunas.gridTemplate} 50px`;

  const selecionaveis = filtrada.filter((l) => !l.transferencia);
  // tipo homogêneo da seleção (entrada/saida) → habilita troca de categoria; seleção mista desabilita
  const selRows = lista.filter((l) => sel.has(l.id) && !l.transferencia);
  const tipoSel = selRows.length > 0 && selRows.every((l) => l.tipo === selRows[0].tipo) ? selRows[0].tipo : null;
  const catsParaSel = tipoSel ? categorias.filter((c) => c.tipo === (tipoSel === "entrada" ? "receber" : "pagar")) : [];
  const ordenada = ordenar(filtrada, ord, {
    venc: (l) => l.data_vencimento,
    valor: (l) => Number(l.valor),
  });
  const todosSelecionados = selecionaveis.length > 0 && selecionaveis.every((l) => sel.has(l.id));
  function alternarTodos() {
    setSel((s) => {
      if (selecionaveis.every((l) => s.has(l.id))) {
        const n = new Set(s);
        selecionaveis.forEach((l) => n.delete(l.id));
        return n;
      }
      const n = new Set(s);
      selecionaveis.forEach((l) => n.add(l.id));
      return n;
    });
  }

  /*
    Teclado e linha clicável: "/" foca a busca · ↑↓ percorre · Enter abre ·
    Espaço marca · N cria.

    Isto morava aqui, escrito à mão, e era a única tela do app que tinha. Virou
    `useListaNavegavel` para que Clientes, Liquidações, Contratos, Contas e
    Serviços não reimplementem cada uma a sua versão — e para que o conserto de
    um bug de teclado seja um conserto, não seis.

    A extração trouxe uma correção de graça: o foco passou a acompanhar o ITEM,
    não a posição. Antes era índice, então filtrar a lista mantinha o realce na
    terceira linha — que agora é outro lançamento. Enter abria o que não estava
    destacado.
  */
  const nav = useListaNavegavel({
    itens: ordenada,
    abrir: abrirEdicao,
    aoMarcar: (l) =>
      setSel((s) => {
        const n = new Set(s);
        if (n.has(l.id)) n.delete(l.id);
        else n.add(l.id);
        return n;
      }),
    aoNovo: novo,
    buscaRef,
    /*
      Os TRÊS diálogos, não dois. `excluirAlvo` (a pergunta sobre recorrente)
      ficava de fora desde a versão antiga: com ele aberto, ↑↓ mexiam na lista
      atrás e Enter navegava para outro lançamento com a caixa ainda na tela.
    */
    desligado: modalAberto || rapidoAberto || Boolean(excluirAlvo),
  });

  // Esc fecha o diálogo de exclusão de recorrente
  useAtalhosModal(!!excluirAlvo, { onFechar: () => setExcluirAlvo(null) });

  return (
    <div className="space-y-5">
      {/* Filter bar: recorte por tipo, visões salvas, campos adaptáveis e ações
          da tela — tudo na mesma faixa. As abas de tipo tinham linha própria e
          a lista começava 44px mais abaixo por causa disso. */}
      <FilterBar
        tela="movimentacoes"
        onLimpar={vis.limpar}
        segmentos={
          <div className="inline-flex overflow-hidden rounded-md border border-line">
            {ABAS_TIPO.map((t) => {
              const ativa = t.v === tipoFiltro;
              return (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setTipoFiltro(t.v)}
                  className={[
                    "border-r border-line px-3 py-1.5 text-[12.5px] font-semibold transition last:border-r-0",
                    ativa ? "bg-brand text-white" : "bg-white text-ink-muted hover:bg-surface hover:text-ink",
                  ].join(" ")}
                >
                  {t.l}
                </button>
              );
            })}
          </div>
        }
        variantes={
          <BarraVisoes
            visoes={vis.visoes}
            ativaId={vis.ativaId}
            sujo={vis.sujo}
            onAplicar={vis.aplicarVisao}
            onLimpar={vis.limpar}
            onSalvar={vis.salvar}
            onApagar={vis.apagar}
          />
        }
        campos={[
          {
            id: "de",
            label: "De",
            fixo: true,
            ativo: de !== padrao.de,
            min: "140px",
            node: (
              <input
                type="date"
                value={de}
                onChange={(e) => setDe(e.target.value)}
                className={classeControle("sm", false, "num")}
              />
            ),
          },
          {
            id: "ate",
            label: "Até",
            fixo: true,
            ativo: ate !== padrao.ate,
            min: "140px",
            node: (
              <input
                type="date"
                value={ate}
                onChange={(e) => setAte(e.target.value)}
                className={classeControle("sm", false, "num")}
              />
            ),
          },
          {
            id: "q",
            label: "Buscar",
            ativo: busca.trim() !== "",
            min: "180px",
            node: (
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  ref={buscaRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Descrição"
                  className={classeControle("sm", false, "pl-8 pr-2")}
                />
              </div>
            ),
          },
          {
            id: "sits",
            label: "Situação",
            ativo: sitsSel.length > 0,
            node: (
              <MultiSelect
                opcoes={[
                  { value: "previsto", label: "Previsto" },
                  { value: "agendada", label: "Agendada" },
                  { value: "efetivada", label: "Efetivada" },
                ]}
                selecionados={sitsSel}
                onChange={setSitsSel}
                placeholder="Filtrar situação…"
                textoTodos="Todas"
              />
            ),
          },
          ...(contaFixa === undefined
            ? [
                {
                  id: "contas",
                  label: "Conta",
                  ativo: contasSel.length > 0,
                  node: (
                    <MultiSelect
                      opcoes={contas.map((c) => ({ value: c.id, label: c.nome }))}
                      selecionados={contasSel}
                      onChange={setContasSel}
                      placeholder="Buscar conta…"
                      textoTodos="Todas as contas"
                    />
                  ),
                },
              ]
            : []),
          {
            id: "conc",
            label: "Conciliação",
            ativo: concSel.length > 0,
            node: (
              <MultiSelect
                opcoes={[
                  { value: "sim", label: "Conciliados" },
                  { value: "nao", label: "Não conciliados" },
                ]}
                selecionados={concSel}
                onChange={setConcSel}
                placeholder="Filtrar…"
                textoTodos="Todos"
              />
            ),
          },
        ]}
        acoes={
          <>
          <ConfigColunasBotao
            ordenadas={colunas.ordenadas}
            config={colunas.config}
            onChange={colunas.gravar}
            onResetar={colunas.resetar}
            extras={
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-surface">
                <input
                  type="checkbox"
                  checked={detalhe}
                  onChange={(e) => setDetalhe(e.target.checked)}
                  className="h-3.5 w-3.5 accent-brand"
                />
                <span className="flex-1 text-[13px] text-ink">
                  Segunda linha na descrição
                  <span className="block text-[10.5px] leading-tight text-ink-soft">
                    documento, forma de pagamento, recorrência e rateio
                  </span>
                </span>
              </label>
            }
          />
          <button
            type="button"
            onClick={() => setRapidoAberto(true)}
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-brand hover:text-brand"
          >
            <Zap size={15} /> Rápido
          </button>
          <Link
            href="/importar?tipo=lancamentos"
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:bg-surface"
          >
            <UploadCloud size={15} /> Importar
          </Link>
          <button
            type="button"
            onClick={novo}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${
              tipoFiltro === "saida" ? "bg-ink hover:bg-rail-hover" : "bg-brand hover:bg-brand-dark"
            }`}
          >
            <Plus size={15} />
            {tipoFiltro === "entrada"
              ? "Nova entrada"
              : tipoFiltro === "saida"
                ? "Nova saída"
                : tipoFiltro === "transferencia"
                  ? "Nova transferência"
                  : "Novo lançamento"}
            <kbd className="ml-1 hidden rounded border border-white/30 px-1.5 text-[10px] font-semibold text-white/80 sm:inline">N</kbd>
          </button>
          </>
        }
      />

      {/* Footer bar: as ações do lote ficam presas no rodapé, sempre no mesmo
          lugar, em vez de empurrar a tabela para baixo quando você seleciona. */}
      <FooterBar
        quando={sel.size > 0}
        info={
          <>
            <span className="font-semibold text-brand-dark">{sel.size} selecionado(s)</span>
            <span className="num text-ink-muted">
              saldo <b className={selSaldo >= 0 ? "text-brand-dark" : "text-ink"}>{brl(selSaldo)}</b>
              {selEntradas > 0 && selSaidas > 0 && (
                <span className="ml-1 text-ink-soft">
                  (+{brl(selEntradas)} / −{brl(selSaidas)})
                </span>
              )}
            </span>
            {selVencidos > 0 && <ObjectStatus tom="negativo">{selVencidos} vencido(s)</ObjectStatus>}
            <FooterSep />
            <span className="text-ink-soft">Marcar como:</span>
          </>
        }
      >
          <button
            type="button"
            onClick={() => mudarSituacao("previsto")}
            className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-surface"
          >
            Previsto
          </button>
          <button
            type="button"
            onClick={() => mudarSituacao("agendada")}
            className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
          >
            Agendada
          </button>
          <button
            type="button"
            onClick={() => mudarSituacao("efetivada")}
            className="rounded-lg border border-brand/40 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-dark transition hover:bg-brand-light"
          >
            Efetivada
          </button>
          <span className="h-4 w-px bg-brand/20" />
          <span className="text-ink-soft">Mudar:</span>
          <select
            value=""
            disabled={!tipoSel}
            onChange={(e) => aplicarEmMassa("categoria_id", e.target.value)}
            title={tipoSel ? "Trocar a categoria dos selecionados" : "Selecione lançamentos de um só tipo (entradas ou saídas)"}
            className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-semibold text-ink-muted outline-none focus:border-brand disabled:opacity-50"
          >
            <option value="">{tipoSel ? "Categoria…" : "Categoria (1 tipo)"}</option>
            {catsParaSel.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          {contas.length > 0 && (
            <select
              value=""
              onChange={(e) => aplicarEmMassa("conta_id", e.target.value)}
              title="Trocar a conta dos selecionados"
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-semibold text-ink-muted outline-none focus:border-brand"
            >
              <option value="">Conta…</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          )}
          {centros.length > 0 && (
            <select
              value=""
              onChange={(e) => aplicarEmMassa("centro_custo_id", e.target.value)}
              title="Trocar o centro de custo dos selecionados"
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-semibold text-ink-muted outline-none focus:border-brand"
            >
              <option value="">Centro…</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          )}
          <span className="h-4 w-px bg-brand/20" />
          <button
            type="button"
            onClick={excluirSelecionados}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-danger hover:bg-rose-50 hover:text-danger"
          >
            <Trash2 size={14} /> Excluir
          </button>
          <button
            type="button"
            onClick={() => setSel(new Set())}
            className="text-xs font-medium text-ink-soft underline-offset-2 hover:underline"
          >
            limpar seleção
          </button>
      </FooterBar>

      {/* `max-xl:overflow-x-auto` e não `overflow-x-auto`: um contêiner com
          rolagem horizontal também vira contêiner de rolagem vertical, e aí o
          cabeçalho `sticky` gruda nele (que não rola) em vez de grudar na
          página. A partir de xl (1280px) a tabela cabe sem rolar de lado —
          então lá o contêiner some e o cabeçalho funciona. Abaixo disso, volta
          a rolar de lado, sem cabeçalho preso. O corte é xl e não lg porque em
          1024px ainda faltam ~200px para os 980px da tabela. */}
      <div className="rounded-xl2 bg-white shadow-card max-xl:overflow-x-auto">
        <div className="min-w-[980px]">
          <div
            className="sticky top-[calc(52px_+_var(--fs-cab,0px))] z-10 grid gap-3 border-b border-line bg-white px-4 py-2.5 text-[11px] font-semibold text-ink-soft"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span className="flex items-center">
              <input
                type="checkbox"
                checked={todosSelecionados}
                onChange={alternarTodos}
                className="h-4 w-4 accent-brand"
                title="Selecionar todos (filtrados)"
              />
            </span>
            {colunas.visiveis.map((c) => (
              <span key={c.id} className={c.id === "valor" ? "text-right" : undefined}>
                {c.id === "venc" ? (
                  <SortToggle label="Venc." campo="venc" ord={ord} inicial="asc" onToggle={(k, i) => setOrd((o) => toggleOrd(o, k, i))} />
                ) : c.id === "valor" ? (
                  <SortToggle label="Valor" campo="valor" align="right" ord={ord} onToggle={(k, i) => setOrd((o) => toggleOrd(o, k, i))} />
                ) : (
                  c.label
                )}
              </span>
            ))}
            <span className="text-right">Ações</span>
          </div>

          {/* linha de lançamento dentro da tabela: Enter grava e continua */}
          <LinhaRapida
            empresaId={empresaId}
            contas={contas}
            categorias={categorias}
            contaPadrao={contaFixa ?? contasSel[0] ?? contas[0]?.id}
            tipoPadrao={tipoFiltro === "entrada" ? "entrada" : "saida"}
            gridCols={gridCols}
            colunasVisiveis={colunas.visiveis.map((c) => c.id)}
            onSalvo={aoSalvar}
          />

          {carregando ? (
            <SkeletonLinhas linhas={8} colunas={6} />
          ) : filtrada.length === 0 ? (
            <EmptyState
              filtrado
              titulo="Nenhuma movimentação neste período"
              descricao="Amplie o intervalo de datas ou limpe os filtros para ver mais."
            />
          ) : (
            ordenada.map((l) => {
              const st = statusDe(l);
              const tp = tipoDe(l);
              const TpIcon = tp.icon;
              const corValor = l.transferencia
                ? "text-ink-soft"
                : l.tipo === "entrada"
                  ? "text-brand-dark"
                  : venceu(l)
                    ? "text-danger"
                    : "text-ink";
              const sinal = l.transferencia ? "" : l.tipo === "entrada" ? "+" : "−";
              const { onClick: abrirPelaLinha, emFoco, ...propsLinha } = nav.propsLinha(l);
              return (
                <div
                  key={l.id}
                  {...propsLinha}
                  // A linha e o lápis levam ao MESMO lugar: a página do objeto.
                  // O lápis fica porque a linha clicável é atalho, não porta —
                  // quem navega por Tab e quem usa leitor de tela precisam de um
                  // alvo com nome acessível. Transferência não tem página
                  // própria: `abrirEdicao` sai sem fazer nada, e a linha não
                  // ganha cursor de clique para não prometer o que não cumpre.
                  onClick={abrirPelaLinha}
                  style={{ gridTemplateColumns: gridCols }}
                  className={`grid items-center gap-3 border-b border-line px-4 py-3 text-sm last:border-0 ${
                    l.transferencia ? "" : "cursor-pointer hover:bg-brand-50"
                  } ${
                    emFoco
                      ? "bg-brand-light/50 ring-1 ring-inset ring-brand"
                      : sel.has(l.id)
                        ? "bg-brand-light/30"
                        : venceu(l)
                          ? // Vencido se distingue pela linha, não só pelo número.
                            // Numa lista de quarenta linhas, o que está vencido é o
                            // que precisa de você hoje — e um rótulo de 11px não
                            // encontra ninguém de longe. Fundo bem lavado: marca a
                            // linha sem competir com foco nem com seleção, que são
                            // estados de interação e continuam ganhando.
                            "bg-rose-50/60"
                          : ""
                  }`}
                >
                  <span className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    {!l.transferencia && (
                      <input
                        type="checkbox"
                        checked={sel.has(l.id)}
                        onChange={() => toggleSel(l.id)}
                        className="h-4 w-4 accent-brand"
                      />
                    )}
                  </span>
                  {colunas.visiveis.map((c) => {
                    if (c.id === "tipo")
                      return (
                        // o texto virou `title` e nome acessível: quem lê com os
                        // olhos reconhece o ícone, quem lê com leitor de tela
                        // continua ouvindo "Entrada"/"Saída"
                        <span
                          key={c.id}
                          className={`flex items-center ${tp.classe}`}
                          title={tp.texto}
                          aria-label={tp.texto}
                          role="img"
                        >
                          <TpIcon size={15} />
                        </span>
                      );
                    if (c.id === "situacao")
                      return (
                        <span key={c.id} className="flex items-center gap-1.5">
                          <ObjectStatus tom={st.tom}>{st.texto}</ObjectStatus>
                          {l.conciliado && (
                            <StatusIcone tom="positivo" title="Conciliado com o extrato">
                              <Link2 size={11} />
                            </StatusIcone>
                          )}
                          {l.exportado_em && (
                            <StatusIcone title={`Exportado para a contabilidade em ${dataBR(l.exportado_em)}`}>
                              <Lock size={10} />
                            </StatusIcone>
                          )}
                          {rateados.has(l.id) && (
                            <StatusIcone title="Rateado entre centros de custo">
                              <Split size={10} />
                            </StatusIcone>
                          )}
                        </span>
                      );
                    if (c.id === "venc")
                      return (
                        <span key={c.id} className="num text-ink-muted">
                          {dataBR(l.data_vencimento)}
                        </span>
                      );
                    if (c.id === "competencia")
                      return (
                        <span key={c.id} className="num text-ink-muted">
                          {dataBR(l.data_competencia)}
                        </span>
                      );
                    if (c.id === "documento")
                      return (
                        <span key={c.id} className="num truncate text-ink-muted">
                          {l.numero_documento || "—"}
                        </span>
                      );
                    if (c.id === "descricao") {
                      // Os mesmos dados de antes, em outro lugar: eram etiquetas
                      // coladas ao fim do texto, que roubavam largura da própria
                      // descrição e sumiam no truncamento. Descem para uma linha
                      // de contexto, quando a pessoa a quer ligada.
                      const contexto = detalhe
                        ? [
                            l.numero_documento && !colunas.visiveis.some((x) => x.id === "documento")
                              ? l.numero_documento
                              : null,
                            l.forma_pagamento ? FORMA_LABEL[l.forma_pagamento] ?? null : null,
                            l.recorrencia_id ? "Recorrente" : null,
                            rateados.has(l.id) ? "Rateado" : null,
                            l.conciliado ? "Conciliado" : null,
                          ].filter(Boolean)
                        : [];
                      return (
                        <span key={c.id} className="min-w-0">
                          <span className="block truncate text-ink">{l.descricao || "—"}</span>
                          {contexto.length > 0 && (
                            <span className="block truncate text-[11px] leading-tight text-ink-soft">
                              {contexto.join(" · ")}
                            </span>
                          )}
                          {!detalhe && l.numero_documento && !colunas.visiveis.some((x) => x.id === "documento") && (
                            <span className="ml-1.5 rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                              {l.numero_documento}
                            </span>
                          )}
                        </span>
                      );
                    }
                    if (c.id === "pessoa")
                      return (
                        <span key={c.id} className="truncate text-ink-muted">
                          {l.pessoa?.nome || "—"}
                        </span>
                      );
                    if (c.id === "categoria")
                      return (
                        <span key={c.id} className="truncate text-ink-muted">
                          {l.transferencia ? "—" : l.categoria?.nome || "—"}
                        </span>
                      );
                    if (c.id === "conta")
                      return (
                        <span key={c.id} className="truncate text-ink-muted">
                          {l.conta?.nome || "—"}
                        </span>
                      );
                    if (c.id === "valor")
                      return (
                        <span key={c.id} className={`num text-right font-semibold ${corValor}`}>
                          {sinal}
                          {brl(Number(l.valor))}
                        </span>
                      );
                    return <span key={c.id} />;
                  })}
                  <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {l.exportado_em ? (
                      <button
                        type="button"
                        onClick={() => reabrir(l)}
                        title={`Exportado em ${dataBR(l.exportado_em)} — clique para reabrir`}
                        className="flex h-8 items-center gap-1 rounded-lg px-2 text-ink-soft transition hover:bg-surface hover:text-ink"
                      >
                        <Unlock size={14} /> <span className="text-[11px] font-semibold">Reabrir</span>
                      </button>
                    ) : (
                      <>
                        {/*
                          A lixeira saiu daqui e foi para o rodapé, junto da
                          seleção. Eram doze botões de apagar visíveis ao mesmo
                          tempo, e apagar quase nunca é um item só: pelo rodapé
                          vale para os marcados, de uma vez.
                        */}
                        {!l.transferencia && (
                          <button
                            type="button"
                            onClick={() => abrirEdicao(l)}
                            title="Editar sem sair da lista"
                            aria-label="Editar sem sair da lista"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-ink"
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </span>
                </div>
              );
            })
          )}

          <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-line px-4 py-3 text-sm">
            <span className="text-ink-soft">
              Entradas <span className="num font-semibold text-brand">{brl(totEntradas)}</span>
            </span>
            <span className="text-ink-soft">
              Saídas <span className="num font-semibold text-ink">{brl(totSaidas)}</span>
            </span>
            <span className="font-semibold text-ink-muted">
              Saldo calculado{" "}
              <span className={`num font-bold ${saldo >= 0 ? "text-brand" : "text-ink"}`}>{brl(saldo)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Atalhos ficam escritos: um atalho que ninguém descobre não existe. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11.5px] text-ink-soft">
        <span>
          <Tecla>↑</Tecla>
          <Tecla>↓</Tecla> navegar
        </span>
        <span>
          <Tecla>Enter</Tecla> abrir
        </span>
        <span>
          <Tecla>Espaço</Tecla> selecionar
        </span>
        <span>
          <Tecla>N</Tecla> novo
        </span>
        <span>
          <Tecla>/</Tecla> buscar
        </span>
        <span>
          <Tecla>⌘K</Tecla> ir para
        </span>
      </div>


      {/* Só criação: editar acontece na página do lançamento. */}
      <LancamentoModal
        empresaId={empresaId}
        aberto={modalAberto}
        tipo={editTipo}
        onFechar={() => setModalAberto(false)}
        onSalvo={aoSalvar}
      />

      <LancamentoRapido
        empresaId={empresaId}
        aberto={rapidoAberto}
        categorias={categorias}
        contas={contas}
        onFechar={() => setRapidoAberto(false)}
        onSalvo={aoSalvar}
      />

      {excluirAlvo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 p-4" onClick={() => setExcluirAlvo(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="dlg-excluir-recorrente-titulo" className="w-full max-w-sm rounded-xl2 bg-white p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
            <h3 id="dlg-excluir-recorrente-titulo" className="mb-2 text-base font-bold text-ink">Excluir lançamento recorrente</h3>
            <p className="mb-5 text-sm text-ink-muted">
              Este lançamento faz parte de uma série recorrente. O que deseja excluir?
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={excluirSo}
                className="rounded-lg border border-line px-4 py-2.5 text-left text-sm font-semibold text-ink transition hover:bg-surface">
                Só este lançamento
              </button>
              <Botao variante="perigo" className="text-left" onClick={excluirSerie}>
                Excluir toda a série
              </Botao>
              <button type="button" onClick={() => setExcluirAlvo(null)}
                className="rounded-lg px-4 py-2 text-sm text-ink-soft transition hover:bg-surface">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 rounded border border-line bg-white px-1.5 py-px text-[10px] font-semibold text-ink-muted">
      {children}
    </kbd>
  );
}
