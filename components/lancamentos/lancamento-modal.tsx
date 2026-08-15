"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Repeat2,
  ArrowRight,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Link as LinkIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mascaraMoeda, parseMoeda, moedaParaInput } from "@/lib/formato";
import {
  arredonda2,
  carregarRateios,
  dividirIgualmente,
  salvarRateioEmLote,
  validarRateio,
} from "@/lib/rateio";
import { matchRegra, assinaturaRegra, type RegraClassificacao } from "@/lib/conciliacao/regras";
import { carregarRegrasCombinadas } from "@/lib/conciliacao/regras-client";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

export type Tipo = "entrada" | "saida" | "transferencia";

export type LancEdit = {
  id: string;
  valor: number;
  descricao: string | null;
  categoria_id: string | null;
  conta_id: string | null;
  cliente_fornecedor_id: string | null;
  centro_custo_id: string | null;
  data_competencia: string;
  data_vencimento: string;
  data_pagamento: string | null;
  data_agendamento?: string | null;
  numero_documento: string | null;
  forma_pagamento: string | null;
  pagamento_dados: Record<string, string> | null;
};

type Cat = { id: string; nome: string; tipo: string };
type Conta = { id: string; nome: string };
type Pessoa = { id: string; nome: string; tipo: string };
type Centro = { id: string; nome: string };
type Grupo = { id: string; nome: string; eh_receita: boolean };

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

// Soma k meses a uma data ISO (YYYY-MM-DD), preservando o dia (com clamp no fim do mês).
function addDias(iso: string, k: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + k);
  return d.toISOString().slice(0, 10);
}
function addMeses(iso: string, k: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const base = new Date(a, m - 1 + k, 1);
  const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d, ultimoDia));
  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function LancamentoModal({
  empresaId,
  aberto,
  tipo,
  editLanc = null,
  onFechar,
  onSalvo,
  permitirTransferencia = true,
  travar = false,
  onNavegar,
  linkDireto,
  comoPagina = false,
}: {
  empresaId: string;
  aberto: boolean;
  tipo: Tipo;
  editLanc?: LancEdit | null;
  onFechar: () => void;
  onSalvo: () => void;
  permitirTransferencia?: boolean;
  travar?: boolean;
  /** Navega para o lançamento anterior/próximo da lista sem fechar o modal. */
  onNavegar?: (dir: 1 | -1) => void;
  /** URL direta deste lançamento — habilita o botão de copiar link. */
  linkDireto?: string | null;
  /** Renderiza o mesmo formulário como bloco de página (sem overlay nem
   *  cabeçalho próprio) — usado pela página do lançamento. */
  comoPagina?: boolean;
}) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  // rateio entre centros de custo (ver lib/rateio.ts e fx_lancamento_rateios.sql)
  const [rateando, setRateando] = useState(false);
  const [tinhaRateio, setTinhaRateio] = useState(false);
  const [partesRateio, setPartesRateio] = useState<{ centro_custo_id: string; valorTexto: string }[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [usarCentro, setUsarCentro] = useState(false);

  // criação inline de categoria / pessoa
  const [criarCat, setCriarCat] = useState(false);
  const [novaCatNome, setNovaCatNome] = useState("");
  const [novaCatGrupo, setNovaCatGrupo] = useState("");
  const [salvandoCat, setSalvandoCat] = useState(false);
  const [criarPessoa, setCriarPessoa] = useState(false);
  const [novaPessoaNome, setNovaPessoaNome] = useState("");
  const [salvandoPessoa, setSalvandoPessoa] = useState(false);

  const [aba, setAba] = useState<Tipo>(tipo);

  // comuns
  const [valor, setValor] = useState("");
  const [juros, setJuros] = useState("");
  const [multa, setMulta] = useState("");
  const [desconto, setDesconto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [situacao, setSituacao] = useState<"previsto" | "agendado" | "efetivado">("previsto");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // entrada / saída
  const [numeroDoc, setNumeroDoc] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [contaId, setContaId] = useState("");
  const [pessoaId, setPessoaId] = useState("");
  const [centroId, setCentroId] = useState("");
  const [dataComp, setDataComp] = useState(hoje());
  const [dataVenc, setDataVenc] = useState(hoje());
  const [dataPag, setDataPag] = useState(hoje());
  const [repetir, setRepetir] = useState(false);
  const [qtd, setQtd] = useState(12);
  const [recModo, setRecModo] = useState<"contar" | "semfim">("contar");
  const [forma, setForma] = useState("");
  const [fLinha, setFLinha] = useState("");
  const [fChave, setFChave] = useState("");
  const [fCopia, setFCopia] = useState("");
  const [fBanco, setFBanco] = useState("");
  const [fAgencia, setFAgencia] = useState("");
  const [fConta, setFConta] = useState("");
  const [fFavorecido, setFFavorecido] = useState("");

  // transferência
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");

  // anti-duplicidade: clientes com contrato ativo (receitas deles nascem em Serviços)
  const [clientesComContrato, setClientesComContrato] = useState<Set<string> | null>(null);
  // regras de classificação da empresa (as mesmas da conciliação, agindo aqui também)
  const [regras, setRegras] = useState<RegraClassificacao[]>([]);
  // competências fechadas (bloqueiam alteração; o banco também bloqueia, isto é só UX)
  const [compsFechadas, setCompsFechadas] = useState<Set<string>>(new Set());
  const [regraAplicada, setRegraAplicada] = useState<string | null>(null);
  // ao salvar com categoria manual, memoriza a regra (mesma tabela da conciliação)
  const [criarRegra, setCriarRegra] = useState(true);
  // sugestão do último lançamento da pessoa selecionada
  const [hintPessoa, setHintPessoa] = useState<{ valor: number; data: string } | null>(null);
  // aviso de possível duplicado (não bloqueante: o 2º clique confirma)
  const [avisoDup, setAvisoDup] = useState<string | null>(null);

  /**
   * "Mexeu" = alguém alterou algum campo desde que o formulário abriu.
   *
   * Um `onChange` no contêiner pega os eventos de todos os inputs, selects e
   * textareas de dentro (eles borbulham). É bem mais confiável do que comparar
   * quarenta estados com um retrato inicial — e não exige tocar em cada campo.
   *
   * Serve para uma coisa só: não jogar fora o que foi digitado quando alguém
   * aperta Esc ou clica fora sem querer.
   */
  const [mexeu, setMexeu] = useState(false);
  /**
   * O mesmo "mexeu", mas em ref.
   *
   * A carga inicial é assíncrona e o formulário fica **editável antes de ela
   * terminar** — na página do lançamento ele já está na tela, sem diálogo para
   * abrir, então dá para começar a digitar de imediato. Quando as consultas
   * voltavam, o preenchimento automático passava por cima do que a pessoa tinha
   * acabado de escrever: digitava a descrição e um segundo depois ela voltava a
   * ser a antiga.
   *
   * Precisa ser ref, não estado: quem consulta é uma closure `async` criada no
   * início do efeito, e ela enxergaria para sempre o valor daquele render.
   */
  /**
   * Escreve no campo o que veio do banco — **a não ser que a pessoa já tenha
   * escrito ali**.
   *
   * A forma funcional do `setState` não é estilo: é o único jeito de ler o valor
   * de agora. Quem preenche é uma closure `async` criada no começo do efeito, e
   * uma leitura direta do estado devolveria o valor daquele render — de antes de
   * a pessoa digitar.
   *
   * `intocado` diz o que é "ainda não mexido" para aquele campo: texto começa
   * vazio, data começa em hoje.
   */
  function preencher<T>(
    set: React.Dispatch<React.SetStateAction<T>>,
    valor: T,
    intocado: (atual: T) => boolean,
  ) {
    set((atual) => (intocado(atual) ? valor : atual));
  }
  const vazio = (a: string) => a === "";
  const eHoje = (a: string) => a === hoje();
  function tentarFechar() {
    if (mexeu && !confirm("Há alterações não salvas neste lançamento. Descartar?")) return;
    onFechar();
  }
  useEffect(() => {
    if (!aberto || clientesComContrato !== null) return;
    const supabase = createClient();
    supabase
      .from("contratos")
      .select("cliente_fornecedor_id")
      .eq("empresa_id", empresaId)
      .eq("status", "ativo")
      .then(({ data }) => {
        setClientesComContrato(new Set((data ?? []).map((c) => c.cliente_fornecedor_id as string)));
      });
    supabase
      .from("competencias_fechadas")
      .select("competencia")
      .eq("empresa_id", empresaId)
      .then(({ data }) => setCompsFechadas(new Set((data ?? []).map((c) => (c.competencia as string).slice(0, 7)))));

  }, [aberto, clientesComContrato, empresaId]);

  // descrição digitada bate numa regra → preenche categoria/pessoa vazias
  function aplicarRegraDescricao(desc: string) {
    if (editLanc || ehTransfer || !desc.trim()) return;
    const r = matchRegra(desc, ehEntrada ? "entrada" : "saida", regras);
    if (!r) return;
    let usou = false;
    if (!categoriaId && r.categoria_id && catsDoTipo.some((c) => c.id === r.categoria_id)) {
      setCategoriaId(r.categoria_id);
      usou = true;
    }
    if (!pessoaId && r.cliente_fornecedor_id && pessoasDoTipo.some((p) => p.id === r.cliente_fornecedor_id)) {
      setPessoaId(r.cliente_fornecedor_id);
      usou = true;
    }
    if (usou) setRegraAplicada(r.padrao);
  }

  // pessoa selecionada → puxa o último lançamento dela como sugestão
  /** último fornecedor cujo palpite foi pedido — ver a conferência lá embaixo */
  const pedidoHint = useRef("");

  async function carregarHintPessoa(pid: string) {
    pedidoHint.current = pid;
    setHintPessoa(null);
    if (!pid || editLanc) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("lancamentos")
      .select("valor, categoria_id, data_vencimento")
      .eq("empresa_id", empresaId)
      .eq("cliente_fornecedor_id", pid)
      .eq("tipo", ehEntrada ? "entrada" : "saida")
      .not("transferencia", "is", true)
      .order("data_vencimento", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Chegou tarde: a pessoa já trocou de fornecedor. O palpite é do fornecedor
    // anterior e não vale mais — sem isto, escolher A e logo B mostra o palpite
    // de A se a consulta de A voltar por último.
    if (pedidoHint.current !== pid) return;
    if (!data) return;
    if (data.categoria_id && catsDoTipo.some((c) => c.id === data.categoria_id)) {
      // A guarda precisa ler a categoria de **agora**, não a do render em que o
      // fornecedor foi escolhido. Quem escolhe o fornecedor e em seguida a
      // categoria via a categoria saltar sozinha meio segundo depois, para a do
      // último lançamento daquele fornecedor — e salvava sem perceber.
      setCategoriaId((atual) => atual || (data.categoria_id as string));
    }
    setHintPessoa({ valor: Number(data.valor), data: data.data_vencimento });
  }
  const [dataTransf, setDataTransf] = useState(hoje());

  const ehTransfer = aba === "transferencia";
  const ehEntrada = aba === "entrada";
  const corBtn = ehTransfer
    ? "bg-brand hover:bg-brand-dark"
    : ehEntrada
      ? "bg-brand hover:bg-brand-dark"
      : "bg-ink hover:bg-rail-hover";
  const tipoCategoria = ehEntrada ? "receber" : "pagar";
  const catsDoTipo = cats.filter((c) => c.tipo === tipoCategoria);
  const pessoasDoTipo = pessoas.filter((p) =>
    ehEntrada ? p.tipo === "cliente" || p.tipo === "ambos" : p.tipo === "fornecedor" || p.tipo === "ambos",
  );
  const gruposDoTipo = grupos.filter((g) => (ehEntrada ? g.eh_receita : !g.eh_receita));

  async function criarCategoriaInline() {
    const nome = novaCatNome.trim();
    if (!nome) return;
    if (!novaCatGrupo) {
      setErro("Escolha um grupo para a nova categoria.");
      return;
    }
    setSalvandoCat(true);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("categorias")
      .insert({ empresa_id: empresaId, nome, tipo: tipoCategoria, grupo_id: novaCatGrupo })
      .select("id, nome, tipo")
      .single();
    setSalvandoCat(false);
    if (error) {
      setErro(error.message);
      return;
    }
    const nova = data as Cat;
    setCats((arr) => [...arr, nova].sort((a, b) => a.nome.localeCompare(b.nome)));
    setCategoriaId(nova.id);
    setNovaCatNome("");
    setNovaCatGrupo("");
    setCriarCat(false);
  }

  async function criarPessoaInline() {
    const nome = novaPessoaNome.trim();
    if (!nome) return;
    setSalvandoPessoa(true);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clientes_fornecedores")
      .insert({ empresa_id: empresaId, nome, tipo: ehEntrada ? "cliente" : "fornecedor" })
      .select("id, nome, tipo")
      .single();
    setSalvandoPessoa(false);
    if (error) {
      setErro(error.message);
      return;
    }
    const nova = data as Pessoa;
    setPessoas((arr) => [...arr, nova].sort((a, b) => a.nome.localeCompare(b.nome)));
    setPessoaId(nova.id);
    setNovaPessoaNome("");
    setCriarPessoa(false);
  }

  useEffect(() => {
    setCriarCat(false);
    setCriarPessoa(false);
    setNovaCatNome("");
    setNovaCatGrupo("");
    setNovaPessoaNome("");
  }, [aba]);

  /**
   * Abrir zera o formulário — **de forma síncrona**.
   *
   * O componente não desmonta ao fechar (`if (!aberto) return null` mantém o
   * estado vivo), então sem isto a segunda abertura herda tudo da primeira:
   * descrição, valor, categoria — e a marca de "repetir mensalmente", que
   * sozinha transforma um lançamento em doze parcelas.
   *
   * Este zerar precisa acontecer aqui e não dentro da carga assíncrona, que é
   * onde ele morava. Lá ele chegava tarde demais: rodava depois de a pessoa já
   * ter começado a digitar, e apagava o que ela escreveu. Separando os dois, a
   * abertura limpa antes de qualquer tecla e a carga só **preenche** —
   * respeitando quem digitou primeiro (ver `preencher`).
   */
  useEffect(() => {
    setMexeu(false);
    setAba(tipo);
    setValor("");
    setJuros("");
    setMulta("");
    setDesconto("");
    setDescricao("");
    setNumeroDoc("");
    setCategoriaId("");
    setContaId("");
    setPessoaId("");
    setCentroId("");
    setDataComp(hoje());
    setDataVenc(hoje());
    setDataPag(hoje());
    setSituacao(tipo === "transferencia" ? "efetivado" : "previsto");
    setRepetir(false);
    setQtd(12);
    setForma("");
    setFLinha("");
    setFChave("");
    setFCopia("");
    setFBanco("");
    setFAgencia("");
    setFConta("");
    setFFavorecido("");
    setOrigem("");
    setDestino("");
    setDataTransf(hoje());
    setRateando(false);
    setTinhaRateio(false);
    setPartesRateio([]);
    setRegraAplicada(null);
    setHintPessoa(null);
    setAvisoDup(null);
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, editLanc?.id]);

  useEffect(() => {
    if (!aberto || !empresaId) return;
    (async () => {
      const supabase = createClient();
      setErro(null);
      const [c, ct, p, ce, esc, gr] = await Promise.all([
        supabase.from("categorias").select("id, nome, tipo").eq("empresa_id", empresaId).order("nome"),
        supabase.from("contas_bancarias").select("id, nome").eq("empresa_id", empresaId).order("nome"),
        supabase.from("clientes_fornecedores").select("id, nome, tipo").eq("empresa_id", empresaId).order("nome"),
        supabase.from("centros_custo").select("id, nome").eq("empresa_id", empresaId).order("nome"),
        supabase.from("escritorios").select("usar_centro_custo").limit(1).maybeSingle(),
        supabase.from("grupos_categoria").select("id, nome, eh_receita").eq("empresa_id", empresaId).order("ordem"),
      ]);
      const contasArr = (ct.data as Conta[]) ?? [];
      setCats((c.data as Cat[]) ?? []);
      setContas(contasArr);
      setPessoas((p.data as Pessoa[]) ?? []);
      setCentros((ce.data as Centro[]) ?? []);
      setGrupos((gr.data as Grupo[]) ?? []);
      setUsarCentro(Boolean((esc.data as { usar_centro_custo?: boolean } | null)?.usar_centro_custo));
      void carregarRegrasCombinadas(empresaId, (c.data as Cat[]) ?? [], (p.data as Pessoa[]) ?? []).then((r) =>
        setRegras(r.combinadas),
      );

      // As listas acima alimentam os selects e entram sempre. O que vem abaixo é
      // preenchimento de campo — e preenchimento chega tarde demais se a pessoa
      // já começou a escrever.
      //
      // O corte é por campo, não pelo formulário: quem digitou a descrição
      // enquanto a carga vinha continua precisando de valor, categoria e conta
      // preenchidos. Pular o bloco inteiro deixaria a tela de edição vazia,
      // mentindo sobre o lançamento que ela mostra.
      if (editLanc) {
        // edição é sempre entrada|saida (o tipo real vem da prop `tipo`)
        setAba(tipo === "transferencia" ? "saida" : tipo);
        preencher(setValor, moedaParaInput(editLanc.valor), vazio);
        preencher(setDescricao, editLanc.descricao ?? "", vazio);
        preencher(setNumeroDoc, editLanc.numero_documento ?? "", vazio);
        preencher(setCategoriaId, editLanc.categoria_id ?? "", vazio);
        preencher(setContaId, editLanc.conta_id ?? "", vazio);
        preencher(setPessoaId, editLanc.cliente_fornecedor_id ?? "", vazio);
        preencher(setCentroId, editLanc.centro_custo_id ?? "", vazio);
        preencher(setDataComp, editLanc.data_competencia, eHoje);
        preencher(setDataVenc, editLanc.data_vencimento, eHoje);
        // Situação é campo como os outros: quem marcou "Pago" enquanto a carga
        // vinha não pode ver voltar para "Previsto" dois segundos depois — é o
        // campo que decide se o lançamento nasce pago.
        const intocada = (a: typeof situacao) => a === (tipo === "transferencia" ? "efetivado" : "previsto");
        if (editLanc.data_pagamento) {
          preencher<typeof situacao>(setSituacao, "efetivado", intocada);
          preencher(setDataPag, editLanc.data_pagamento, eHoje);
        } else if (editLanc.data_agendamento) {
          preencher<typeof situacao>(setSituacao, "agendado", intocada);
          preencher(setDataPag, editLanc.data_agendamento, eHoje);
        }
        const d = editLanc.pagamento_dados ?? {};
        preencher(setForma, editLanc.forma_pagamento ?? "", vazio);
        preencher(setFLinha, d.linha_digitavel ?? "", vazio);
        preencher(setFChave, d.chave_pix ?? "", vazio);
        preencher(setFCopia, d.copia_cola ?? "", vazio);
        preencher(setFBanco, d.banco ?? "", vazio);
        preencher(setFAgencia, d.agencia ?? "", vazio);
        preencher(setFConta, d.conta ?? "", vazio);
        preencher(setFFavorecido, d.favorecido ?? "", vazio);
        const encs = await supabase
          .from("lancamentos")
          .select("juros, multa, desconto")
          .eq("id", editLanc.id)
          .maybeSingle();
        const ev = (encs.data as { juros?: number; multa?: number; desconto?: number } | null) ?? null;
        preencher(setJuros, ev?.juros ? moedaParaInput(ev.juros) : "", vazio);
        preencher(setMulta, ev?.multa ? moedaParaInput(ev.multa) : "", vazio);
        preencher(setDesconto, ev?.desconto ? moedaParaInput(ev.desconto) : "", vazio);

        // rateio já existente deste lançamento
        const mapa = await carregarRateios(supabase, empresaId, [editLanc.id]);
        const partes = mapa.get(editLanc.id) ?? [];
        setTinhaRateio(partes.length > 0);
        // idem: quem abriu o rateio à mão durante a carga não pode vê-lo fechar
        preencher(setRateando, partes.length > 0, (a) => a === false);
        preencher(
          setPartesRateio,
          partes.map((p) => ({ centro_custo_id: p.centro_custo_id, valorTexto: moedaParaInput(p.valor) })),
          (a) => a.length === 0,
        );
      } else {
        // Lançamento novo: quem zera é o efeito de abertura, logo acima. O que
        // sobra aqui é escolher a conta padrão — e isso não pode pisar na conta
        // que a pessoa escolheu enquanto a lista ainda carregava.
        preencher(setContaId, contasArr[0]?.id ?? "", vazio);
        preencher(setOrigem, contasArr[0]?.id ?? "", vazio);
        preencher(setDestino, contasArr[1]?.id ?? "", vazio);
      }
      setErro(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  /* ---------------------------------------------- rateio entre centros ---- */

  const partesLimpas = partesRateio.map((p) => ({
    centro_custo_id: p.centro_custo_id,
    valor: parseMoeda(p.valorTexto),
  }));
  const validacaoRateio = validarRateio(partesLimpas, parseMoeda(valor));

  function alternarRateio() {
    if (rateando) {
      setRateando(false);
      setPartesRateio([]);
      return;
    }
    // começa com dois centros e o valor dividido igualmente — o caso mais comum
    const total = parseMoeda(valor);
    const [a, b] = dividirIgualmente(total, 2);
    const primeiro = centroId || centros[0]?.id || "";
    const segundo = centros.find((c) => c.id !== primeiro)?.id ?? "";
    setPartesRateio([
      { centro_custo_id: primeiro, valorTexto: total > 0 ? moedaParaInput(a) : "" },
      { centro_custo_id: segundo, valorTexto: total > 0 ? moedaParaInput(b) : "" },
    ]);
    setRateando(true);
  }

  function mudarParte(i: number, patch: Partial<{ centro_custo_id: string; valorTexto: string }>) {
    setPartesRateio((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  }

  function addParte() {
    setPartesRateio((ps) => {
      const usados = new Set(ps.map((p) => p.centro_custo_id));
      const livre = centros.find((c) => !usados.has(c.id))?.id ?? "";
      // sugere o que falta para fechar o valor
      const soma = ps.reduce((s, p) => s + parseMoeda(p.valorTexto), 0);
      const resta = arredonda2(parseMoeda(valor) - soma);
      return [...ps, { centro_custo_id: livre, valorTexto: resta > 0 ? moedaParaInput(resta) : "" }];
    });
  }

  function removerParte(i: number) {
    setPartesRateio((ps) => {
      const n = ps.filter((_, k) => k !== i);
      if (n.length === 0) setRateando(false);
      return n;
    });
  }

  function dividirIgual() {
    const total = parseMoeda(valor);
    const valores = dividirIgualmente(total, partesRateio.length);
    setPartesRateio((ps) => ps.map((p, i) => ({ ...p, valorTexto: moedaParaInput(valores[i] ?? 0) })));
  }

  /** Grava o rateio dos lançamentos recém-criados/editados. Erro aqui não
   *  invalida o lançamento — ele já está salvo; só avisamos. */
  async function persistirRateio(supabase: ReturnType<typeof createClient>, ids: string[]) {
    if (ids.length === 0) return null;
    // nada a fazer: não está rateando agora e também não havia rateio antes
    if (!rateando && !tinhaRateio) return null;
    const partes = rateando ? partesLimpas.filter((p) => p.centro_custo_id && p.valor > 0) : [];
    return salvarRateioEmLote(supabase, empresaId, ids, partes);
  }

  function trocarAba(a: Tipo) {
    setAba(a);
    setErro(null);
    setSituacao(a === "transferencia" ? "efetivado" : "previsto");
  }

  async function salvarLancamento(continuar: boolean) {
    setErro(null);
    const v = parseMoeda(valor);
    if (v <= 0) return setErro("Informe um valor maior que zero.");
    const jur = parseMoeda(juros);
    const mul = parseMoeda(multa);
    const des = parseMoeda(desconto);
    if (jur < 0 || mul < 0 || des < 0) return setErro("Encargos não podem ser negativos.");
    if (v - jur - mul + des < -0.005)
      return setErro("Juros + multa não podem exceder o valor (descontando o desconto).");
    if (!categoriaId) return setErro("Escolha uma categoria.");
    if (!contaId) return setErro("Escolha uma conta.");

    // competência fechada: avisa antes do banco recusar (o trigger é a trava real)
    const compChave = dataComp.slice(0, 7);
    if (compsFechadas.has(compChave)) {
      return setErro(
        `A competência ${compChave.split("-").reverse().join("/")} está fechada. Reabra o mês em Configurações → Fechamento para alterar.`,
      );
    }

    // possível duplicado: mesmo tipo + mesma pessoa (ou descrição) + mesmo valor + vencimento próximo.
    // Não bloqueia: o aviso aparece uma vez e o clique seguinte confirma.
    if (!editLanc && !ehTransfer && !avisoDup) {
      const supabase0 = createClient();
      let q = supabase0
        .from("lancamentos")
        .select("id, data_vencimento, descricao")
        .eq("empresa_id", empresaId)
        .eq("tipo", ehEntrada ? "entrada" : "saida")
        .eq("valor", v)
        .not("transferencia", "is", true)
        .gte("data_vencimento", addDias(dataVenc, -5))
        .lte("data_vencimento", addDias(dataVenc, 5))
        .limit(1);
      if (pessoaId) q = q.eq("cliente_fornecedor_id", pessoaId);
      else if (descricao.trim()) q = q.ilike("descricao", descricao.trim());
      else q = q.limit(0);
      const { data: dup } = await q.maybeSingle();
      if (dup) {
        setAvisoDup(
          `Já existe um lançamento igual (${dup.descricao || "sem descrição"}, vencimento ${dup.data_vencimento
            .slice(0, 10)
            .split("-")
            .reverse()
            .join("/")}). Clique de novo em salvar para confirmar mesmo assim.`,
        );
        return;
      }
    }

    let pagamentoDados: Record<string, string> | null = null;
    if (forma === "boleto" && fLinha.trim()) pagamentoDados = { linha_digitavel: fLinha.trim() };
    else if (forma === "pix" && (fChave.trim() || fCopia.trim()))
      pagamentoDados = { chave_pix: fChave.trim(), copia_cola: fCopia.trim() };
    else if (forma === "ted" && (fBanco.trim() || fAgencia.trim() || fConta.trim() || fFavorecido.trim()))
      pagamentoDados = {
        banco: fBanco.trim(),
        agencia: fAgencia.trim(),
        conta: fConta.trim(),
        favorecido: fFavorecido.trim(),
      };

    const payload = {
      tipo: aba,
      valor: v,
      juros: jur,
      multa: mul,
      desconto: des,
      descricao: descricao.trim() || null,
      numero_documento: numeroDoc.trim() || null,
      forma_pagamento: forma || null,
      pagamento_dados: pagamentoDados,
      categoria_id: categoriaId,
      conta_id: contaId,
      cliente_fornecedor_id: pessoaId || null,
      centro_custo_id: centroId || null,
      data_competencia: dataComp,
      data_vencimento: dataVenc,
      data_agendamento: situacao === "agendado" ? dataPag : null,
      data_pagamento: situacao === "efetivado" ? dataPag : null,
      transferencia: false,
    };

    if (rateando && !validacaoRateio.ok) return setErro(validacaoRateio.erro ?? "Confira o rateio.");

    setSalvando(true);
    const supabase = createClient();
    // ids dos lançamentos gravados nesta operação — o rateio é aplicado a eles
    let idsGravados: string[] = [];
    let resp;
    if (editLanc) {
      resp = await supabase.from("lancamentos").update(payload).eq("id", editLanc.id);
      idsGravados = [editLanc.id];
    } else if (repetir && recModo === "semfim") {
      // recorrência VIVA: cria a regra e materializa só a 1ª parcela; o cron cuida dos próximos meses
      const comp1 = dataComp.slice(0, 7) + "-01";
      const proxima = addMeses(comp1, 1);
      const { data: rec, error: errRec } = await supabase
        .from("recorrencias")
        .insert({
          empresa_id: empresaId,
          tipo: aba,
          valor: v,
          descricao: descricao.trim() || null,
          categoria_id: categoriaId,
          conta_id: contaId,
          cliente_fornecedor_id: pessoaId || null,
          centro_custo_id: centroId || null,
          dia_vencimento: Number(dataVenc.slice(8, 10)) || 1,
          ativa: true,
          ultima_competencia: comp1,
          proxima_competencia: proxima,
          fim: null,
        })
        .select("id")
        .single();
      if (errRec || !rec) {
        setSalvando(false);
        return setErro(errRec?.message ?? "Falha ao criar a recorrência (rode fs_recorrencias_vivas.sql).");
      }
      resp = await supabase
        .from("lancamentos")
        .insert({
          empresa_id: empresaId,
          ...payload,
          juros: 0,
          multa: 0,
          desconto: 0,
          recorrencia_viva_id: rec.id,
        })
        .select("id");
      idsGravados = ((resp.data as { id: string }[] | null) ?? []).map((r) => r.id);
    } else if (repetir && qtd > 1) {
      const rid =
        typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const n = Math.min(Math.max(2, Math.floor(qtd)), 60);
      const rows = Array.from({ length: n }, (_, k) => ({
        empresa_id: empresaId,
        ...payload,
        juros: 0,
        multa: 0,
        desconto: 0,
        data_competencia: addMeses(dataComp, k),
        data_vencimento: addMeses(dataVenc, k),
        // Só a 1ª parcela herda a situação escolhida; as demais nascem previstas (a pagar/receber).
        data_agendamento: k === 0 && situacao === "agendado" ? dataPag : null,
        data_pagamento: k === 0 && situacao === "efetivado" ? dataPag : null,
        recorrencia_id: rid,
      }));
      resp = await supabase.from("lancamentos").insert(rows).select("id");
      idsGravados = ((resp.data as { id: string }[] | null) ?? []).map((r) => r.id);
    } else {
      resp = await supabase.from("lancamentos").insert({ empresa_id: empresaId, ...payload }).select("id");
      idsGravados = ((resp.data as { id: string }[] | null) ?? []).map((r) => r.id);
    }
    if (resp.error) {
      setSalvando(false);
      return setErro(resp.error.message);
    }

    // rateio entre centros — o lançamento continua sendo um só; a divisão vive
    // em lancamento_rateios e é o que os relatórios por centro passam a ler.
    // Em carnê, cada parcela recebe o mesmo rateio (mesmo valor por parcela).
    if (usarCentro) {
      const erroRateio = await persistirRateio(supabase, idsGravados);
      if (erroRateio) {
        setSalvando(false);
        return setErro(`Lançamento salvo, mas o rateio falhou: ${erroRateio}`);
      }
    }
    setSalvando(false);

    // memoriza a categorização como regra (mesma tabela que a conciliação alimenta)
    if (criarRegra && !ehTransfer && categoriaId) {
      const padraoRegra = assinaturaRegra(descricao);
      if (padraoRegra) {
        await supabase.from("conciliacao_regras").upsert(
          {
            empresa_id: empresaId,
            padrao: padraoRegra,
            tipo: aba,
            categoria_id: categoriaId,
            cliente_fornecedor_id: pessoaId || null,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: "empresa_id,padrao,tipo" },
        );
      }
    }

    onSalvo();
    if (continuar && !editLanc && !repetir) {
      setValor("");
      setJuros("");
      setMulta("");
      setDesconto("");
      setDescricao("");
      setPessoaId("");
      setNumeroDoc("");
    } else {
      onFechar();
    }
  }

  async function salvarTransferencia() {
    setErro(null);
    const v = parseMoeda(valor);
    if (!origem || !destino) return setErro("Escolha as contas de origem e destino.");
    if (origem === destino) return setErro("Origem e destino devem ser contas diferentes.");
    if (v <= 0) return setErro("Informe um valor maior que zero.");

    setSalvando(true);
    const supabase = createClient();
    const par =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
    const nomeOrigem = contas.find((c) => c.id === origem)?.nome ?? "conta";
    const nomeDestino = contas.find((c) => c.id === destino)?.nome ?? "conta";
    const base = {
      empresa_id: empresaId,
      categoria_id: null,
      data_competencia: dataTransf,
      data_vencimento: dataTransf,
      data_agendamento: situacao === "agendado" ? dataTransf : null,
      data_pagamento: situacao === "efetivado" ? dataTransf : null,
      transferencia: true,
      transferencia_par_id: par,
      valor: v,
    };
    const { error } = await supabase.from("lancamentos").insert([
      { ...base, conta_id: origem, tipo: "saida", descricao: descricao.trim() || `Transferência para ${nomeDestino}` },
      { ...base, conta_id: destino, tipo: "entrada", descricao: descricao.trim() || `Transferência de ${nomeOrigem}` },
    ]);
    setSalvando(false);
    if (error) return setErro(error.message);
    onSalvo();
    onFechar();
  }

  /*
    Atalhos do modal: Esc fecha (ou cancela o sub-form aberto), ⌘/Ctrl+Enter salva.

    Escuta na fase de CAPTURA e chama `preventDefault`, e isso não é detalhe: o
    `GuardaDialogo` global escuta Esc no `document` (fase de bolha), e bolha em
    `document` roda ANTES de bolha em `window`. Ele achava o botão "Fechar"
    desta caixa e clicava — e esse botão chamava `onFechar` direto, sem a guarda
    de "alterações não salvas". Resultado: Esc fechava o maior formulário do app
    sem perguntar nada, e a pergunta aparecia depois, com a caixa já fechando e
    a resposta "Cancelar" sem efeito nenhum.

    Na captura, este tratador é o primeiro de todos; o `preventDefault` faz o
    guarda global sair sem tocar em nada.
  */
  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (criarCat) { e.preventDefault(); setCriarCat(false); return; }
        if (criarPessoa) { e.preventDefault(); setCriarPessoa(false); return; }
        // Em modo página, Esc fecharia a tela e perderia o que foi digitado —
        // fechar é ação de diálogo, não de página.
        if (comoPagina) return;
        e.preventDefault();
        tentarFechar();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (criarCat || criarPessoa || salvando) return;
        e.preventDefault();
        if (ehTransfer) salvarTransferencia();
        else salvarLancamento(false);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [aberto, comoPagina, criarCat, criarPessoa, salvando, ehTransfer, tentarFechar, salvarLancamento, salvarTransferencia]);

  // Alt + ↑/↓ passa para o lançamento anterior/próximo sem sair do modal —
  // revisar 20 itens deixa de ser abrir e fechar 20 vezes.
  useEffect(() => {
    if (!aberto || !onNavegar) return;
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onNavegar?.(-1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onNavegar?.(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onNavegar]);

  if (!aberto) return null;

  const campoCls = "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
  const labelCls = "mb-1 block text-xs font-semibold text-ink-muted";
  const titulo = editLanc
    ? "Editar lançamento"
    : ehTransfer
      ? "Transferência entre contas"
      : ehEntrada
        ? "Conta a receber"
        : "Conta a pagar";

  const abasDisponiveis: { v: Tipo; l: string; Icon: typeof ArrowDownCircle; cor: string }[] = [
    { v: "entrada", l: "Entrada", Icon: ArrowDownCircle, cor: "text-brand" },
    { v: "saida", l: "Saída", Icon: ArrowUpCircle, cor: "text-ink-muted" },
    ...(permitirTransferencia
      ? [{ v: "transferencia" as Tipo, l: "Transferência", Icon: Repeat2, cor: "text-ink-muted" }]
      : []),
  ];
  const mostrarSeletor = !editLanc && !travar;

  /**
   * Mesmo formulário, duas molduras: diálogo (criação rápida) e bloco de página
   * (edição com URL própria).
   *
   * É uma **função chamada**, não um componente em JSX. Definida aqui dentro e
   * usada como `<Moldura>`, ela ganharia uma identidade nova a cada render — e
   * o React, vendo um tipo de componente diferente, desmonta e remonta tudo o
   * que está dentro. Na prática: o campo perde o foco a cada tecla e só aceita
   * uma letra por vez. Chamada como função, o JSX devolvido é reconciliado
   * normalmente e os campos ficam onde estão.
   */
  const moldura = (children: React.ReactNode) =>
    comoPagina ? (
      <div className="w-full rounded-xl2 bg-white p-5 shadow-card" onChange={() => setMexeu(true)}>
        {children}
      </div>
    ) : (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 p-4 backdrop-blur-[1px]"
        onClick={tentarFechar}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className="flex max-h-[88vh] w-full max-w-md flex-col rounded-xl2 bg-white p-5 shadow-card"
          onClick={(e) => e.stopPropagation()}
          onChange={() => setMexeu(true)}
        >
          {children}
        </div>
      </div>
    );

  return moldura(
    <>
        <div className={`mb-3 flex items-center justify-between gap-2 ${comoPagina ? "hidden" : ""}`}>
          <h3 className={`text-base font-bold ${ehEntrada || ehTransfer ? "text-brand" : "text-ink"}`}>{titulo}</h3>
          <div className="flex items-center gap-1">
            {editLanc && linkDireto && (
              <button
                type="button"
                title="Copiar link direto deste lançamento"
                onClick={() => {
                  navigator.clipboard?.writeText(linkDireto);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-ink"
              >
                <LinkIcon size={15} />
              </button>
            )}
            {editLanc && onNavegar && (
              <>
                <button
                  type="button"
                  title="Lançamento anterior (Alt+↑)"
                  onClick={() => onNavegar(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-ink"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  title="Próximo lançamento (Alt+↓)"
                  onClick={() => onNavegar(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-ink"
                >
                  <ChevronDown size={16} />
                </button>
              </>
            )}
            {/*
              `tentarFechar`, não `onFechar`: o X é o caminho mais usado para
              sair, e chamando `onFechar` direto ele fechava o formulário
              preenchido sem perguntar. Só o clique no véu passava pela guarda.
            */}
            <button aria-label="Fechar"
              type="button"
              onClick={tentarFechar}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* seletor de tipo */}
        {mostrarSeletor && (
          <div className="mb-4 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${abasDisponiveis.length}, 1fr)` }}>
            {abasDisponiveis.map(({ v, l, Icon, cor }) => (
              <button
                key={v}
                type="button"
                onClick={() => trocarAba(v)}
                className={[
                  "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition",
                  aba === v ? "border-brand bg-brand-light text-ink" : "border-line text-ink-muted hover:bg-surface",
                ].join(" ")}
              >
                <Icon size={15} className={aba === v ? cor : "text-ink-soft"} /> {l}
              </button>
            ))}
          </div>
        )}

        {erro && (
          <p className="mb-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-danger">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {erro}
          </p>
        )}
        {avisoDup && !erro && (
          <p className="mb-3 flex items-start gap-2 rounded-lg bg-surface px-3 py-2 text-xs font-medium text-ink-muted ring-1 ring-inset ring-line">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-ink-soft" /> {avisoDup}
          </p>
        )}

        {/* corpo rolável */}
        <div className="-mr-1 flex-1 space-y-3 overflow-y-auto pr-1">
          {ehTransfer ? (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className={labelCls}>De</label>
                  <select value={origem} onChange={(e) => setOrigem(e.target.value)} className={campoCls}>
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <ArrowRight size={16} className="mb-3 shrink-0 text-ink-soft" />
                <div className="flex-1">
                  <label className={labelCls}>Para</label>
                  <select value={destino} onChange={(e) => setDestino(e.target.value)} className={campoCls}>
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Valor (R$)</label>
                  <input inputMode="decimal" value={valor} onChange={(e) => setValor(mascaraMoeda(e.target.value))} placeholder="0,00" className={`num ${campoCls}`} />
                </div>
                <div>
                  <label className={labelCls}>Data</label>
                  <input type="date" value={dataTransf} onChange={(e) => setDataTransf(e.target.value)} className={`num ${campoCls}`} />
                </div>
              </div>
              <div>
                <span className={labelCls}>Situação</span>
                <div className="flex gap-1.5">
                  {([
                    { v: "previsto", l: "Previsto" },
                    { v: "agendado", l: "Agendado" },
                    { v: "efetivado", l: "Efetivado" },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setSituacao(o.v)}
                      className={
                        situacao === o.v
                          ? "flex-1 rounded-lg bg-brand py-2 text-xs font-semibold text-white"
                          : "flex-1 rounded-lg border border-line py-2 text-xs font-medium text-ink-muted transition hover:bg-surface"
                      }
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Descrição (opcional)</label>
                <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: aporte no caixa" className={campoCls} />
              </div>
              <p className="text-[11px] text-ink-soft">
                Cria uma saída na conta de origem e uma entrada na de destino. Não entram no resultado (DRE) — só movem o
                saldo entre contas.
              </p>
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>Valor (R$)</label>
                <input
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => { setValor(mascaraMoeda(e.target.value)); setAvisoDup(null); }}
                  placeholder="0,00"
                  className={classeControle("md", false, "num font-semibold")}
                />
              </div>
              {situacao === "efetivado" && (
                <div className="rounded-lg border border-line bg-surface/40 p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                    Encargos no pagamento (opcional)
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={labelCls}>Juros</label>
                      <input inputMode="decimal" value={juros} onChange={(e) => setJuros(mascaraMoeda(e.target.value))} placeholder="0,00" className={`num ${campoCls}`} />
                    </div>
                    <div>
                      <label className={labelCls}>Multa</label>
                      <input inputMode="decimal" value={multa} onChange={(e) => setMulta(mascaraMoeda(e.target.value))} placeholder="0,00" className={`num ${campoCls}`} />
                    </div>
                    <div>
                      <label className={labelCls}>Desconto</label>
                      <input inputMode="decimal" value={desconto} onChange={(e) => setDesconto(mascaraMoeda(e.target.value))} placeholder="0,00" className={`num ${campoCls}`} />
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-ink-soft">
                    O valor acima é o total que entrou/saiu do banco. Na exportação contábil, juros, multa e desconto
                    vão para contas próprias; o principal fica na categoria.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Categoria</label>
                    <button
                      type="button"
                      onClick={() => { setCriarCat((v) => !v); setErro(null); }}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      {criarCat ? "Cancelar" : "+ nova"}
                    </button>
                  </div>
                  {criarCat ? (
                    <div className="space-y-2 rounded-lg border border-line bg-surface p-2">
                      <input
                        value={novaCatNome}
                        onChange={(e) => setNovaCatNome(e.target.value)}
                        placeholder="Nome da categoria"
                        className={campoCls}
                        autoFocus
                      />
                      <select value={novaCatGrupo} onChange={(e) => setNovaCatGrupo(e.target.value)} className={campoCls}>
                        <option value="">Grupo…</option>
                        {gruposDoTipo.map((g) => (
                          <option key={g.id} value={g.id}>{g.nome}</option>
                        ))}
                      </select>
                      {gruposDoTipo.length === 0 && (
                        <p className="text-[11px] text-ink-soft">
                          Nenhum grupo de {ehEntrada ? "receita" : "despesa"}. Crie um grupo em Categorias primeiro.
                        </p>
                      )}
                      <Botao variante="primario" tamanho="sm" largura
                        onClick={criarCategoriaInline}
                        disabled={salvandoCat || !novaCatNome.trim() || !novaCatGrupo}
                      >
                        {salvandoCat ? "Salvando…" : "Criar e selecionar"}
                      </Botao>
                    </div>
                  ) : (
                    <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={campoCls}>
                      <option value="">Selecione…</option>
                      {catsDoTipo.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Conta</label>
                  <select value={contaId} onChange={(e) => setContaId(e.target.value)} className={campoCls}>
                    <option value="">Selecione…</option>
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              {usarCentro && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Centro de custo</label>
                    {centros.length > 1 && (
                      <button
                        type="button"
                        onClick={alternarRateio}
                        className="text-xs font-semibold text-brand hover:underline"
                      >
                        {rateando ? "Usar um só centro" : "Ratear entre centros"}
                      </button>
                    )}
                  </div>

                  {!rateando ? (
                    <select value={centroId} onChange={(e) => setCentroId(e.target.value)} className={campoCls}>
                      <option value="">Nenhum</option>
                      {centros.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-line bg-surface p-2">
                      {partesRateio.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            value={p.centro_custo_id}
                            onChange={(e) => mudarParte(i, { centro_custo_id: e.target.value })}
                            className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-brand"
                          >
                            <option value="">Centro…</option>
                            {centros.map((c) => (
                              <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                          </select>
                          <input
                            value={p.valorTexto}
                            onChange={(e) => mudarParte(i, { valorTexto: mascaraMoeda(e.target.value) })}
                            placeholder="0,00"
                            className="num w-28 rounded-lg border border-line bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-brand"
                          />
                          <button
                            type="button"
                            onClick={() => removerParte(i)}
                            title="Remover"
                            className="shrink-0 rounded-lg p-1.5 text-ink-soft transition hover:bg-white hover:text-danger"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}

                      <div className="flex flex-wrap items-center gap-2">
                        <Botao variante="secundario" tamanho="sm"
                          onClick={addParte}
                        >
                          + centro
                        </Botao>
                        <Botao variante="secundario" tamanho="sm"
                          onClick={dividirIgual}
                        >
                          Dividir igualmente
                        </Botao>
                        <span className="ml-auto text-[11px] font-semibold">
                          {validacaoRateio.erro ? (
                            <span className="text-danger">{validacaoRateio.erro}</span>
                          ) : (
                            <span className="text-brand-dark">
                              Fecha com {moedaParaInput(validacaoRateio.soma)}
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug text-ink-soft">
                        A soma das partes precisa fechar o valor do lançamento. Ele continua sendo{" "}
                        <b>um</b> lançamento — só o relatório por centro enxerga a divisão.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <label className={labelCls}>{ehEntrada ? "Cliente" : "Fornecedor"}</label>
                  <button
                    type="button"
                    onClick={() => { setCriarPessoa((v) => !v); setErro(null); }}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    {criarPessoa ? "Cancelar" : "+ novo"}
                  </button>
                </div>
                {criarPessoa ? (
                  <div className="space-y-2 rounded-lg border border-line bg-surface p-2">
                    <input
                      value={novaPessoaNome}
                      onChange={(e) => setNovaPessoaNome(e.target.value)}
                      placeholder={ehEntrada ? "Nome do cliente" : "Nome do fornecedor"}
                      className={campoCls}
                      autoFocus
                    />
                    <Botao variante="primario" tamanho="sm" largura
                      onClick={criarPessoaInline}
                      disabled={salvandoPessoa || !novaPessoaNome.trim()}
                    >
                      {salvandoPessoa ? "Salvando…" : "Criar e selecionar"}
                    </Botao>
                  </div>
                ) : (
                  <select
                    value={pessoaId}
                    onChange={(e) => {
                      setPessoaId(e.target.value);
                      setAvisoDup(null);
                      void carregarHintPessoa(e.target.value);
                    }}
                    className={campoCls}
                  >
                    <option value="">Nenhum</option>
                    {pessoasDoTipo.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                )}
                {hintPessoa && !editLanc && (
                  <button
                    type="button"
                    onClick={() => {
                      setValor(moedaParaInput(hintPessoa.valor));
                      setHintPessoa(null);
                    }}
                    className="mt-1 text-[10px] font-semibold text-ink-soft underline decoration-dotted hover:text-brand"
                    title="Clique para usar este valor"
                  >
                    último lançamento: {hintPessoa.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em{" "}
                    {hintPessoa.data.slice(0, 10).split("-").reverse().join("/")}
                  </button>
                )}
                {ehEntrada && !editLanc && pessoaId && clientesComContrato?.has(pessoaId) && (
                  <p className="mt-1.5 rounded-lg bg-surface px-3 py-2 text-[11px] text-ink-muted">
                    Este cliente tem <b>contrato ativo</b> — as receitas dele são geradas em Serviços (Faturar o mês).
                    Confira antes de lançar manualmente, para não duplicar o recebimento.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Descrição</label>
                  <input
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    onBlur={() => aplicarRegraDescricao(descricao)}
                    placeholder="Breve descrição"
                    className={campoCls}
                  />
                  {regraAplicada && (
                    <p className="mt-1 text-[10px] font-semibold text-brand">
                      ✓ classificado pela regra "{regraAplicada}" — confira e ajuste se precisar
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Nº documento</label>
                  <input value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value)} placeholder="NF 1234" className={campoCls} />
                </div>
              </div>
              {!ehTransfer && categoriaId && assinaturaRegra(descricao) !== "" && (
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-brand-light/40 p-2.5">
                  <input
                    type="checkbox"
                    checked={criarRegra}
                    onChange={(e) => setCriarRegra(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-brand"
                  />
                  <span className="text-[11px] leading-snug text-ink-muted">
                    <span className="font-semibold text-ink">Criar regra de categorização.</span>{" "}
                    Lançamentos com esta descrição passam a sugerir esta categoria
                    {pessoaId ? " e este cliente/fornecedor" : ""} automaticamente — aqui, na conciliação e na importação.
                  </span>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Competência</label>
                  <input type="date" value={dataComp} onChange={(e) => setDataComp(e.target.value)} className={`num ${campoCls}`} />
                </div>
                <div>
                  <label className={labelCls}>Vencimento</label>
                  <input type="date" value={dataVenc} onChange={(e) => { setDataVenc(e.target.value); setAvisoDup(null); }} className={`num ${campoCls}`} />
                </div>
              </div>
              <div className="rounded-lg border border-line p-3">
                <span className={labelCls}>Situação</span>
                <div className="flex gap-1.5">
                  {([
                    { v: "previsto", l: "Previsto" },
                    { v: "agendado", l: "Agendado" },
                    { v: "efetivado", l: ehEntrada ? "Recebido" : "Pago" },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => {
                        setSituacao(o.v);
                        if (o.v === "agendado" || o.v === "efetivado") setDataPag(hoje());
                      }}
                      className={
                        situacao === o.v
                          ? "flex-1 rounded-lg bg-brand py-2 text-xs font-semibold text-white"
                          : "flex-1 rounded-lg border border-line py-2 text-xs font-medium text-ink-muted transition hover:bg-surface"
                      }
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
                {situacao !== "previsto" && (
                  <div className="mt-2">
                    <label className="mb-1 block text-[11px] font-semibold text-ink-soft">
                      {situacao === "agendado" ? "Data de agendamento (quando coloquei no banco)" : "Data do pagamento/recebimento"}
                    </label>
                    <input type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} className={`num ${campoCls}`} />
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>Forma de pagamento</label>
                <select value={forma} onChange={(e) => setForma(e.target.value)} className={campoCls}>
                  <option value="">Não informada</option>
                  <option value="boleto">Boleto</option>
                  <option value="pix">Pix</option>
                  <option value="ted">TED / transferência</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão</option>
                  <option value="debito_automatico">Débito automático</option>
                </select>
                {forma === "boleto" && (
                  <div className="mt-2">
                    <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Linha digitável / código de barras</label>
                    <input value={fLinha} onChange={(e) => setFLinha(e.target.value)} inputMode="numeric" placeholder="00000.00000 00000.000000 …" className={`num ${campoCls}`} />
                  </div>
                )}
                {forma === "pix" && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Chave Pix</label>
                      <input value={fChave} onChange={(e) => setFChave(e.target.value)} placeholder="CPF/CNPJ, e-mail, telefone ou aleatória" className={campoCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Copia e cola (QR)</label>
                      <input value={fCopia} onChange={(e) => setFCopia(e.target.value)} placeholder="Código Pix copia e cola (opcional)" className={campoCls} />
                    </div>
                  </div>
                )}
                {forma === "ted" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Banco</label>
                      <input value={fBanco} onChange={(e) => setFBanco(e.target.value)} className={campoCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Agência</label>
                      <input value={fAgencia} onChange={(e) => setFAgencia(e.target.value)} className={`num ${campoCls}`} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Conta</label>
                      <input value={fConta} onChange={(e) => setFConta(e.target.value)} className={`num ${campoCls}`} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-ink-soft">Favorecido</label>
                      <input value={fFavorecido} onChange={(e) => setFFavorecido(e.target.value)} className={campoCls} />
                    </div>
                  </div>
                )}
                <p className="mt-1 text-[11px] text-ink-soft">Os dados de pagamento são opcionais e aparecem no Agendamento.</p>
              </div>
              {!editLanc && (
                <div className="rounded-lg border border-line p-3">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} className="h-4 w-4 accent-brand" />
                    Repetir mensalmente
                  </label>
                  {repetir && (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRecModo("contar")}
                          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${recModo === "contar" ? "border-brand bg-brand-light text-brand-dark" : "border-line text-ink-muted hover:bg-surface"}`}
                        >
                          Por um nº de meses
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecModo("semfim")}
                          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${recModo === "semfim" ? "border-brand bg-brand-light text-brand-dark" : "border-line text-ink-muted hover:bg-surface"}`}
                        >
                          Sem fim (contínuo)
                        </button>
                      </div>
                      {recModo === "contar" ? (
                        <div className="flex items-center gap-2">
                          <input type="number" min={2} max={60} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} className={classeControle("md", false, "num w-20")} />
                          <span className="text-xs text-ink-muted">meses (cria este + os próximos)</span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-ink-soft">
                          Cria este lançamento e mantém a recorrência viva: todo mês o sistema gera a próxima
                          parcela automaticamente (no dia {Number(dataVenc.slice(8, 10)) || "do vencimento"}), até
                          você pausar. Reajustes valem para os meses futuros, sem mexer no que já foi criado.
                        </p>
                      )}
                    </div>
                  )}
                  {repetir && recModo === "contar" && (
                    <p className="mt-2 text-[11px] text-ink-soft">
                      Apenas este lançamento entra com a situação escolhida; os próximos meses são criados como
                      previstos (a pagar/receber), pra você dar baixa conforme acontecerem.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* rodapé */}
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition hover:bg-surface"
          >
            Cancelar
          </button>
          <div className="ml-auto flex gap-2">
            {ehTransfer ? (
              <button
                type="button"
                onClick={salvarTransferencia}
                disabled={salvando}
                className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 ${corBtn}`}
              >
                {salvando ? "Transferindo…" : "Transferir"}
              </button>
            ) : (
              <>
                {!editLanc && !repetir && (
                  <button
                    type="button"
                    onClick={() => salvarLancamento(true)}
                    disabled={salvando}
                    className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:bg-surface disabled:opacity-60"
                  >
                    Adicionar e continuar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => salvarLancamento(false)}
                  disabled={salvando}
                  className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 ${corBtn}`}
                >
                  {salvando ? "Salvando…" : editLanc ? "Salvar" : "Adicionar"}
                </button>
              </>
            )}
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-ink-soft">
          Atalhos: <kbd className="rounded border border-line px-1 font-semibold">Ctrl/⌘ + Enter</kbd> salva
          {!comoPagina && (
            <>
              {" "}· <kbd className="rounded border border-line px-1 font-semibold">Esc</kbd> fecha
            </>
          )}
        </p>
    </>
  );
}
