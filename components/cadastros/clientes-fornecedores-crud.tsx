"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, X, Search, MapPin, UploadCloud } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { contarUso, descreverUso, ondeResolver, VINCULOS } from "@/lib/uso-cadastro";
import { mascaraCpfCnpj, mascaraTelefone, mascaraCep } from "@/lib/formato";
import { useAtalhosModal } from "@/lib/atalhos";
import { BANCOS } from "@/lib/cnab/bancos";
import Modal, { useSujo } from "@/components/ui/modal";
import FilterBar from "@/components/ui/filter-bar";
import BarraVisoes from "@/components/ui/barra-visoes";
import { useVisoes } from "@/components/ui/use-visoes";
import ConfigColunasBotao, { useConfigColunas, type ColunaDef } from "@/components/ui/config-colunas";
import { queryParaFiltros, type Filtros } from "@/lib/visoes";
import ObjectStatus, { type Tom } from "@/components/ui/object-status";
import EmptyState from "@/components/ui/empty-state";
import MessageStrip from "@/components/ui/message-strip";
import FooterBar from "@/components/ui/footer-bar";
import Botao, { BotaoIcone, BotaoLink } from "@/components/ui/botao";
import Campo, { CampoArea, CampoSelect, CampoTexto, classeControle } from "@/components/ui/campo";
import { useListaNavegavel } from "@/components/ui/use-lista-navegavel";

const SELECT_COLS =
  "id, nome, tipo, pessoa_tipo, email, telefone, cpf_cnpj, razao_social, nome_fantasia, inscricao_estadual, inscricao_municipal, codigo_contabil, cep, logradouro, endereco_numero, complemento, bairro, municipio, uf, codigo_ibge, fav_banco_codigo, fav_agencia, fav_conta, fav_conta_dv, fav_conta_tipo, fav_chave_pix, fav_tipo_chave_pix, tags, ativo, observacoes";

type Pessoa = {
  id: string;
  nome: string;
  tipo: string; // cliente | fornecedor | ambos
  pessoa_tipo: string | null; // pf | pj
  email: string | null;
  telefone: string | null;
  cpf_cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  codigo_contabil: string | null;
  cep: string | null;
  logradouro: string | null;
  endereco_numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  codigo_ibge: string | null;
  fav_banco_codigo: string | null;
  fav_agencia: string | null;
  fav_conta: string | null;
  fav_conta_dv: string | null;
  fav_conta_tipo: string | null;
  fav_chave_pix: string | null;
  fav_tipo_chave_pix: string | null;
  tags: string[] | null;
  ativo: boolean | null;
  observacoes: string | null;
};

const TIPOS = [
  { v: "cliente", l: "Cliente" },
  { v: "fornecedor", l: "Fornecedor" },
  { v: "ambos", l: "Ambos" },
];

// Cliente é receita (positivo); fornecedor é só outro tipo de cadastro, não um
// problema — o vermelho que estava aqui era "uma cor diferente", não um sentido.
function badge(tipo: string): { l: string; tom: Tom } {
  if (tipo === "cliente") return { l: "Cliente", tom: "positivo" };
  if (tipo === "fornecedor") return { l: "Fornecedor", tom: "info" };
  return { l: "Ambos", tom: "neutro" };
}

const soDig = (s: string) => (s || "").replace(/\D/g, "");

// Colunas configuráveis. Nenhuma nasce oculta: as tags e a cidade/UF já
// apareciam em toda linha antes de a tabela virar configurável, e escondê-las
// por padrão tiraria informação de quem não sabe que o botão "Colunas" existe.
const COLUNAS_CF: ColunaDef[] = [
  { id: "nome", label: "Nome", largura: "1fr", fixa: true },
  { id: "contato", label: "Contato", largura: "1fr" },
  { id: "local", label: "Cidade / UF", largura: "140px" },
  { id: "documento", label: "CPF/CNPJ", largura: "140px" },
  { id: "tags", label: "Tags", largura: "1fr" },
  { id: "tipo", label: "Tipo", largura: "104px" },
  { id: "acoes", label: "Ações", largura: "64px", fixa: true },
];
const OCULTAS_CF: string[] = [];

// Detecta o tipo da chave Pix para guardar junto (telefone | email | cpfcnpj | aleatoria).
function tipoChavePix(chave: string): string {
  const c = (chave || "").trim();
  if (!c) return "";
  if (c.includes("@")) return "email";
  const dig = soDig(c);
  if (c.startsWith("+") || (dig.length >= 12 && dig.startsWith("55"))) return "telefone";
  if (dig.length === 11 || dig.length === 14) return "cpfcnpj";
  return "aleatoria";
}
const ROTULO_CHAVE: Record<string, string> = {
  email: "e-mail",
  telefone: "telefone",
  cpfcnpj: "CPF/CNPJ",
  aleatoria: "chave aleatória",
};

export default function ClientesFornecedoresCrud({
  empresaId,
  initial,
  /**
   * Modo página: em vez da lista com um diálogo por cima, mostra só o
   * formulário deste cadastro, na própria URL.
   *
   * O formulário é o mesmo objeto nos dois modos — o que muda é a moldura. Ter
   * duas cópias do formulário (uma para diálogo, outra para página) é como elas
   * começam a divergir: um campo novo entra numa e esquece a outra.
   */
  soId,
}: {
  empresaId: string;
  initial: Pessoa[];
  soId?: string;
}) {
  const [lista, setLista] = useState<Pessoa[]>(initial);
  const router = useRouter();
  const { toast } = useToast();
  // Filtros desta tela na URL + visões salvas (mesmas chaves que aparecem no link)
  const padraoFiltros = useMemo<Filtros>(
    () => ({ tipo: "todos", q: "", tag: "", inativos: "" }),
    [],
  );
  // useSearchParams e não window.location: o servidor também precisa enxergar a
  // URL, senão ele renderiza os filtros vazios, o cliente renderiza os da URL e
  // o React acusa divergência de hidratação ao abrir um link com ?q=…
  const searchParams = useSearchParams();
  const iniciais = useMemo(
    () => queryParaFiltros(new URLSearchParams(searchParams?.toString() ?? ""), padraoFiltros),
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [filtro, setFiltro] = useState(iniciais.tipo as string);
  const [busca, setBusca] = useState(iniciais.q as string);
  const buscaRef = useRef<HTMLInputElement>(null);
  const [tagFiltro, setTagFiltro] = useState<string | null>((iniciais.tag as string) || null);
  const [incluirInativos, setIncluirInativos] = useState(iniciais.inativos === "1");

  const [aberto, setAberto] = useState(false);
  // guarda contra perder o que foi digitado ao fechar sem salvar
  const form = useSujo(aberto);
  const [editId, setEditId] = useState<string | null>(null);
  const comoPagina = Boolean(soId);

  // Identificação
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("cliente");
  const [pessoaTipo, setPessoaTipo] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [codigoContabil, setCodigoContabil] = useState("");
  // Contato
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  // Endereço
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [enderecoNumero, setEnderecoNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("");
  const [codigoIbge, setCodigoIbge] = useState("");
  // Pagamento
  const [favBanco, setFavBanco] = useState("");
  const [favAgencia, setFavAgencia] = useState("");
  const [favConta, setFavConta] = useState("");
  const [favContaDv, setFavContaDv] = useState("");
  const [favContaTipo, setFavContaTipo] = useState("cc");
  const [favChavePix, setFavChavePix] = useState("");
  // Organização
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [observacoes, setObservacoes] = useState("");

  const [erro, setErro] = useState<string | null>(null);
  /*
    Erro da LISTA, separado do erro do formulário.

    O erro do diálogo só é desenhado dentro dele; excluir é acionado da lista,
    com o diálogo fechado. Sem um lugar próprio, a exclusão barrada escrevia
    numa mensagem invisível — clicar, confirmar e nada acontecer, sem
    explicação.
  */
  const [erroLista, setErroLista] = useState<string | null>(null);
  /*
    Qual linha está sendo conferida antes de excluir.

    A contagem de uso é uma ida ao banco por vínculo. Sem indicação, o clique na
    lixeira passava segundos sem nada acontecer, e o segundo clique disparava um
    lote concorrente que terminava em dois `confirm()` seguidos.
  */
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // só o ⌘/Ctrl+Enter: o Esc é do Modal, que já confirma o descarte
  useAtalhosModal(aberto, { onConfirmar: () => salvar() });

  function abrirNovo() {
    setEditId(null);
    setNome(""); setTipo("cliente"); setPessoaTipo(""); setCpfCnpj("");
    setRazaoSocial(""); setNomeFantasia(""); setInscricaoEstadual(""); setInscricaoMunicipal(""); setCodigoContabil("");
    setEmail(""); setTelefone("");
    setCep(""); setLogradouro(""); setEnderecoNumero(""); setComplemento(""); setBairro(""); setMunicipio(""); setUf(""); setCodigoIbge("");
    setFavBanco(""); setFavAgencia(""); setFavConta(""); setFavContaDv(""); setFavContaTipo("cc"); setFavChavePix("");
    setTags([]); setTagInput(""); setAtivo(true); setObservacoes("");
    setErro(null);
    setAberto(true);
  }
  function abrirEdicao(p: Pessoa) {
    setEditId(p.id);
    setNome(p.nome); setTipo(p.tipo); setPessoaTipo(p.pessoa_tipo ?? ""); setCpfCnpj(mascaraCpfCnpj(p.cpf_cnpj ?? ""));
    setRazaoSocial(p.razao_social ?? ""); setNomeFantasia(p.nome_fantasia ?? "");
    setInscricaoEstadual(p.inscricao_estadual ?? ""); setInscricaoMunicipal(p.inscricao_municipal ?? ""); setCodigoContabil(p.codigo_contabil ?? "");
    setEmail(p.email ?? ""); setTelefone(mascaraTelefone(p.telefone ?? ""));
    setCep(mascaraCep(p.cep ?? "")); setLogradouro(p.logradouro ?? ""); setEnderecoNumero(p.endereco_numero ?? "");
    setComplemento(p.complemento ?? ""); setBairro(p.bairro ?? ""); setMunicipio(p.municipio ?? ""); setUf(p.uf ?? ""); setCodigoIbge(p.codigo_ibge ?? "");
    setFavBanco(p.fav_banco_codigo ?? ""); setFavAgencia(p.fav_agencia ?? ""); setFavConta(p.fav_conta ?? "");
    setFavContaDv(p.fav_conta_dv ?? ""); setFavContaTipo(p.fav_conta_tipo ?? "cc"); setFavChavePix(p.fav_chave_pix ?? "");
    setTags(p.tags ?? []); setTagInput(""); setAtivo(p.ativo !== false); setObservacoes(p.observacoes ?? "");
    setErro(null);
    setAberto(true);
  }

  // Modo página: abre o cadastro assim que a lista de um item chega.
  useEffect(() => {
    if (!soId) return;
    const p = lista.find((x) => x.id === soId);
    if (p) abrirEdicao(p);
    // só na montagem: reabrir a cada render jogaria fora o que foi digitado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soId]);

  async function buscarCnpj() {
    const d = soDig(cpfCnpj);
    if (d.length !== 14) { setErro("Para buscar, informe um CNPJ com 14 dígitos."); return; }
    setBuscandoCnpj(true); setErro(null);
    try {
      const res = await fetch(`/api/cnpj/${d}`);
      const j = await res.json();
      if (!res.ok) { setErro(j.erro || "Falha ao consultar a Receita."); return; }
      setPessoaTipo("pj");
      setRazaoSocial(j.razaoSocial || "");
      setNomeFantasia(j.nomeFantasia || "");
      if (!nome.trim()) setNome(j.nomeFantasia || j.razaoSocial || "");
      if (j.cep) setCep(mascaraCep(j.cep));
      if (j.logradouro) setLogradouro(j.logradouro);
      if (j.numero) setEnderecoNumero(j.numero);
      if (j.complemento) setComplemento(j.complemento);
      if (j.bairro) setBairro(j.bairro);
      if (j.municipio) setMunicipio(j.municipio);
      if (j.uf) setUf(j.uf);
      // a Receita não devolve o código IBGE — completa pelo CEP (necessário p/ NFS-e)
      if (j.cep) {
        const dCep = soDig(j.cep);
        if (dCep.length === 8) {
          try {
            const r2 = await fetch(`/api/cep/${dCep}`);
            const j2 = await r2.json();
            if (r2.ok && j2.codigoIbge) setCodigoIbge(j2.codigoIbge);
          } catch {
            /* sem IBGE agora; a busca manual de CEP completa depois */
          }
        }
      }
    } catch {
      setErro("Não foi possível consultar agora. Tente de novo.");
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function buscarCep() {
    const d = soDig(cep);
    if (d.length !== 8) { setErro("Informe um CEP com 8 dígitos."); return; }
    setBuscandoCep(true); setErro(null);
    try {
      const res = await fetch(`/api/cep/${d}`);
      const j = await res.json();
      if (!res.ok) { setErro(j.erro || "CEP não encontrado."); return; }
      if (j.logradouro) setLogradouro(j.logradouro);
      if (j.bairro) setBairro(j.bairro);
      if (j.municipio) setMunicipio(j.municipio);
      if (j.uf) setUf(j.uf);
      if (j.codigoIbge) setCodigoIbge(j.codigoIbge);
    } catch {
      setErro("Não foi possível consultar o CEP agora.");
    } finally {
      setBuscandoCep(false);
    }
  }

  function addTag(t: string) {
    const v = t.trim();
    if (!v) return;
    if (tags.some((x) => x.toLowerCase() === v.toLowerCase())) { setTagInput(""); return; }
    setTags([...tags, v]);
    setTagInput("");
  }
  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  async function recarregar() {
    const supabase = createClient();
    const { data } = await supabase
      .from("clientes_fornecedores")
      .select(SELECT_COLS)
      .eq("empresa_id", empresaId)
      .order("nome");
    setLista((data as Pessoa[]) ?? []);
    router.refresh();
  }

  async function salvar() {
    /*
      Trava de duplo envio dentro da função, não só no botão.

      O botão checava `salvando`; o ⌘/Ctrl+Enter do modal chamava `salvar()`
      direto. Dois atalhos seguidos criavam dois cadastros do mesmo cliente — e
      cliente duplicado divide vendas, boletos e NFS-e entre duas pessoas que
      são a mesma.
    */
    if (salvando) return;
    setErro(null);
    if (!nome.trim()) { setErro("Informe o nome."); return; }
    const pTipo = pessoaTipo || (soDig(cpfCnpj).length === 11 ? "pf" : soDig(cpfCnpj).length === 14 ? "pj" : null);
    const payload = {
      nome: nome.trim(),
      tipo,
      pessoa_tipo: pTipo,
      email: email.trim() || null,
      telefone: soDig(telefone) || null,
      cpf_cnpj: soDig(cpfCnpj) || null,
      razao_social: razaoSocial.trim() || null,
      nome_fantasia: nomeFantasia.trim() || null,
      inscricao_estadual: inscricaoEstadual.trim() || null,
      inscricao_municipal: inscricaoMunicipal.trim() || null,
      codigo_contabil: codigoContabil.trim() || null,
      cep: soDig(cep) || null,
      logradouro: logradouro.trim() || null,
      endereco_numero: enderecoNumero.trim() || null,
      complemento: complemento.trim() || null,
      bairro: bairro.trim() || null,
      municipio: municipio.trim() || null,
      uf: uf.trim().toUpperCase().slice(0, 2) || null,
      codigo_ibge: codigoIbge.trim() || null,
      fav_banco_codigo: favBanco.trim() || null,
      fav_agencia: favAgencia.trim() || null,
      fav_conta: favConta.trim() || null,
      fav_conta_dv: favContaDv.trim() || null,
      fav_conta_tipo: favBanco.trim() ? favContaTipo : null,
      fav_chave_pix: favChavePix.trim() || null,
      fav_tipo_chave_pix: favChavePix.trim() ? tipoChavePix(favChavePix) : null,
      tags,
      ativo,
      observacoes: observacoes.trim() || null,
    };
    setSalvando(true);
    const supabase = createClient();
    /*
      `.select("id")` no update: `update().eq()` que casa zero linhas devolve
      `{ data: null, error: null }` no supabase-js. Sem pedir a linha de volta,
      a RLS barrando (ou a linha tendo sumido em outra aba) resultava em "salvo"
      na tela e nada no banco.
    */
    const resp = editId
      ? await supabase.from("clientes_fornecedores").update(payload).eq("id", editId).select("id")
      : await supabase.from("clientes_fornecedores").insert({ empresa_id: empresaId, ...payload });
    setSalvando(false);
    if (resp.error) { setErro(resp.error.message); return; }
    if (editId && (resp.data ?? []).length === 0) {
      setErro("O cadastro não foi encontrado para salvar. Recarregue a página — ele pode ter sido excluído em outra aba.");
      return;
    }
    // Modo página: não há diálogo para fechar. Recarrega os dados do servidor
    // para o cabeçalho (nome, tipo, cidade) acompanhar o que acabou de mudar, e
    // limpa a marca de "mexeu" para o Esc não pedir confirmação à toa.
    if (comoPagina) {
      form.limpar();
      router.refresh();
      return;
    }
    setAberto(false);
    await recarregar();
  }

  async function excluir(p: Pessoa) {
    if (excluindoId) return;
    setExcluindoId(p.id);
    try {
      const supabase = createClient();
      /*
        Excluir cliente é a exclusão mais cara desta área: o cadastro aparece em
        lançamentos, vendas, contratos, boletos e notas emitidas. Sem FK, ele
        some de baixo de tudo isso; com FK, a pessoa recebia a mensagem do
        Postgres em inglês dentro de um `alert()`. Contar antes resolve os dois.
      */
      const uso = await contarUso(supabase, p.id, VINCULOS.pessoa);
      if (!uso.ok) {
        setErroLista(`Não foi possível conferir se "${p.nome}" está em uso (${uso.erro}). Nada foi excluído — tente de novo.`);
        return;
      }
      if (uso.total > 0) {
        setErroLista(
          `"${p.nome}" está em ${descreverUso(uso.usos)} e não pode ser excluído.${ondeResolver(uso.usos)} Ou desmarque "Cadastro ativo" para tirá-lo das listas de escolha sem perder o histórico.`,
        );
        return;
      }
      /*
        Sem `confirm()`: exclusão imediata com Desfazer.

        O cadastro só chega aqui depois de a contagem confirmar que ele não está
        em uso — ou seja, a pergunta do navegador cobrava um clique para
        proteger de um estrago que a trava acima já impediu. O padrão do resto do
        app (Movimentações, Conciliação) é agir e oferecer volta; `confirm()`
        fica só onde não há volta.

        O retrato completo da linha vai junto: é ele que o Desfazer reinsere.
      */
      const back = await supabase.from("clientes_fornecedores").select("*").eq("id", p.id).maybeSingle();
      const r = await supabase.from("clientes_fornecedores").delete().eq("id", p.id);
      if (r.error) { setErroLista(r.error.message); return; }
      setErroLista(null);
      await recarregar();
      const linha = back.error ? null : back.data;
      toast(linha ? `Excluído: ${p.nome}.` : `Excluído: ${p.nome}. Não foi possível preparar o Desfazer.`, {
        desfazer: linha
          ? async () => {
              const volta = await createClient().from("clientes_fornecedores").insert(linha as Record<string, unknown>);
              if (volta.error) {
                toast(`Não foi possível restaurar (${volta.error.message}).`, { tom: "erro" });
                return;
              }
              await recarregar();
            }
          : undefined,
      });
    } finally {
      setExcluindoId(null);
    }
  }

  const tagsExistentes = Array.from(new Set(lista.flatMap((p) => p.tags ?? []))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  const filtrada = lista.filter((p) => {
    const okTipo =
      filtro === "todos" ||
      (filtro === "cliente" && (p.tipo === "cliente" || p.tipo === "ambos")) ||
      (filtro === "fornecedor" && (p.tipo === "fornecedor" || p.tipo === "ambos"));
    const q = busca.trim().toLowerCase();
    const okBusca =
      !q ||
      p.nome.toLowerCase().includes(q) ||
      (p.razao_social ?? "").toLowerCase().includes(q) ||
      (p.nome_fantasia ?? "").toLowerCase().includes(q) ||
      soDig(p.cpf_cnpj ?? "").includes(soDig(q));
    const okTag = !tagFiltro || (p.tags ?? []).includes(tagFiltro);
    const okAtivo = incluirInativos || p.ativo !== false;
    return okTipo && okBusca && okTag && okAtivo;
  });

  /*
    Linha clicável e teclado, como em Movimentações.

    `abrir` leva à PÁGINA do cadastro, o mesmo destino do lápis — e não ao
    diálogo de edição rápida que esta tela também tem. Abrir o mesmo objeto de
    dois jeitos diferentes conforme o gesto usado é a confusão que o comentário
    de Liquidações já apontava.

    O teclado é desligado enquanto o diálogo está aberto: lá dentro as setas
    pertencem aos campos.
  */
  const nav = useListaNavegavel({
    itens: filtrada,
    abrir: (p) => router.push(`/clientes-fornecedores/${p.id}`),
    aoNovo: () => abrirNovo(),
    buscaRef,
    desligado: aberto,
  });

  const filtros = useMemo<Filtros>(
    () => ({ tipo: filtro, q: busca, tag: tagFiltro ?? "", inativos: incluirInativos ? "1" : "" }),
    [filtro, busca, tagFiltro, incluirInativos],
  );
  const aplicarFiltros = useCallback((f: Filtros) => {
    setFiltro((f.tipo as string) || "todos");
    setBusca((f.q as string) ?? "");
    setTagFiltro((f.tag as string) || null);
    setIncluirInativos(f.inativos === "1");
  }, []);
  const vis = useVisoes({
    empresaId,
    tela: "clientes-fornecedores",
    padrao: padraoFiltros,
    filtros,
    aplicar: aplicarFiltros,
  });
  const colunas = useConfigColunas("clientes-fornecedores", COLUNAS_CF, OCULTAS_CF);

  const secao = "rounded-lg border border-line bg-surface/40 p-3";
  const secaoTitulo = "mb-2 text-xs font-semibold text-ink-muted";

  // O corpo do formulário fica numa variável para as duas molduras (diálogo e
  // página) renderizarem exatamente o mesmo conteúdo.
  const corpoFormulario = (
    <>
              {/* IDENTIFICAÇÃO */}
              <div className={secao}>
                <p className={secaoTitulo}>Identificação</p>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <CampoSelect
                      id="cf-tipo"
                      rotulo="Tipo"
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      inputClassName="bg-white"
                    >
                      {TIPOS.map((t) => (
                        <option key={t.v} value={t.v}>{t.l}</option>
                      ))}
                    </CampoSelect>
                    <CampoSelect
                      id="cf-pessoa-tipo"
                      rotulo="Pessoa"
                      value={pessoaTipo}
                      onChange={(e) => setPessoaTipo(e.target.value)}
                      inputClassName="bg-white"
                    >
                      <option value="">— a definir —</option>
                      <option value="pj">Jurídica (CNPJ)</option>
                      <option value="pf">Física (CPF)</option>
                    </CampoSelect>
                  </div>
                  {/* Campo (e não CampoTexto): o botão de buscar na Receita divide a linha com o input. */}
                  <Campo
                    rotulo="CPF / CNPJ"
                    htmlFor="cf-cpf-cnpj"
                    ajuda="Com CNPJ, o botão preenche razão social, fantasia e endereço."
                  >
                    <div className="flex gap-2">
                      <input
                        id="cf-cpf-cnpj"
                        aria-describedby="cf-cpf-cnpj-ajuda"
                        value={cpfCnpj}
                        onChange={(e) => setCpfCnpj(mascaraCpfCnpj(e.target.value))}
                        placeholder={pessoaTipo === "pf" ? "000.000.000-00" : "00.000.000/0000-00"}
                        className={classeControle("md", false, "num")}
                      />
                      <button
                        type="button"
                        onClick={buscarCnpj}
                        disabled={buscandoCnpj || soDig(cpfCnpj).length !== 14}
                        title="Buscar dados do CNPJ"
                        className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-brand transition hover:bg-surface disabled:opacity-40"
                      >
                        {buscandoCnpj ? "…" : "Buscar"}
                      </button>
                    </div>
                  </Campo>
                  <CampoTexto
                    id="cf-nome"
                    rotulo="Nome (como aparece nas listas)"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome ou apelido do cadastro"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <CampoTexto
                      id="cf-razao-social"
                      rotulo="Razão social"
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                    />
                    <CampoTexto
                      id="cf-nome-fantasia"
                      rotulo="Nome fantasia"
                      value={nomeFantasia}
                      onChange={(e) => setNomeFantasia(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <CampoTexto
                      id="cf-inscricao-estadual"
                      rotulo="Inscrição estadual"
                      value={inscricaoEstadual}
                      onChange={(e) => setInscricaoEstadual(e.target.value)}
                      placeholder="Isento, se não tiver"
                    />
                    <CampoTexto
                      id="cf-inscricao-municipal"
                      rotulo="Inscrição municipal"
                      value={inscricaoMunicipal}
                      onChange={(e) => setInscricaoMunicipal(e.target.value)}
                    />
                  </div>
                  <CampoTexto
                    id="cf-codigo-contabil"
                    rotulo="Código contábil"
                    value={codigoContabil}
                    onChange={(e) => setCodigoContabil(e.target.value)}
                    placeholder="Código no sistema contábil (opcional)"
                  />
                </div>
              </div>

              {/* CONTATO */}
              <div className={secao}>
                <p className={secaoTitulo}>Contato</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <CampoTexto
                    id="cf-email"
                    rotulo="E-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                  <CampoTexto
                    id="cf-telefone"
                    rotulo="Telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    inputClassName="num"
                  />
                </div>
              </div>

              {/* ENDEREÇO */}
              <div className={secao}>
                <p className={`${secaoTitulo} flex items-center gap-1.5`}><MapPin size={13} /> Endereço (usado na emissão de boletos)</p>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-[190px_1fr] gap-2.5">
                    <Campo rotulo="CEP" htmlFor="cf-cep">
                      <div className="flex gap-2">
                        <input
                          id="cf-cep"
                          value={cep}
                          onChange={(e) => setCep(mascaraCep(e.target.value))}
                          placeholder="00000-000"
                          className={classeControle("md")}
                        />
                        <button
                          type="button"
                          onClick={buscarCep}
                          disabled={buscandoCep || soDig(cep).length !== 8}
                          title="Buscar endereço pelo CEP"
                          className="shrink-0 rounded-lg border border-line px-2.5 py-2 text-xs font-semibold text-brand transition hover:bg-surface disabled:opacity-40"
                        >
                          {buscandoCep ? "…" : "Buscar"}
                        </button>
                      </div>
                    </Campo>
                    <CampoTexto
                      id="cf-codigo-ibge"
                      rotulo="Código IBGE"
                      value={codigoIbge}
                      onChange={(e) => setCodigoIbge(e.target.value)}
                      placeholder="preenchido pelo CEP"
                      inputClassName="num"
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_110px] gap-2.5">
                    <CampoTexto
                      id="cf-logradouro"
                      rotulo="Logradouro"
                      value={logradouro}
                      onChange={(e) => setLogradouro(e.target.value)}
                    />
                    <CampoTexto
                      id="cf-numero"
                      rotulo="Número"
                      value={enderecoNumero}
                      onChange={(e) => setEnderecoNumero(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <CampoTexto
                      id="cf-complemento"
                      rotulo="Complemento"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                    />
                    <CampoTexto
                      id="cf-bairro"
                      rotulo="Bairro"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-[1fr_80px] gap-2.5">
                    <CampoTexto
                      id="cf-municipio"
                      rotulo="Município"
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                    />
                    <CampoTexto
                      id="cf-uf"
                      rotulo="UF"
                      value={uf}
                      onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                      maxLength={2}
                      placeholder="SP"
                    />
                  </div>
                </div>
              </div>

              {/* PAGAMENTO */}
              <div className={secao}>
                <p className={secaoTitulo}>Dados para pagamento</p>
                <p className="mb-2 -mt-1 text-[11px] text-ink-soft">
                  Usados ao gerar a remessa. O documento do favorecido é o CPF/CNPJ acima.
                </p>
                <div className="space-y-2.5">
                  <CampoTexto
                    id="cf-chave-pix"
                    rotulo="Chave Pix (forma preferida)"
                    value={favChavePix}
                    onChange={(e) => setFavChavePix(e.target.value)}
                    placeholder="CPF/CNPJ, e-mail, telefone ou chave aleatória"
                    ajuda={
                      favChavePix.trim()
                        ? `Detectado: ${ROTULO_CHAVE[tipoChavePix(favChavePix)] || "—"}`
                        : undefined
                    }
                  />
                  <div className="my-1 border-t border-line/70" />
                  <p className="-mb-0.5 text-[11px] font-semibold text-ink-muted">Conta bancária (TED / crédito em conta)</p>
                  <CampoSelect
                    id="cf-banco"
                    rotulo="Banco"
                    value={favBanco}
                    onChange={(e) => setFavBanco(e.target.value)}
                    inputClassName="bg-white"
                  >
                    <option value="">— não informado —</option>
                    {BANCOS.map((b) => (
                      <option key={b.codigo} value={b.codigo}>{b.codigo} · {b.nome}</option>
                    ))}
                  </CampoSelect>
                  <div className="grid grid-cols-[1fr_1fr_70px] gap-2">
                    <CampoTexto
                      id="cf-agencia"
                      rotulo="Agência"
                      value={favAgencia}
                      onChange={(e) => setFavAgencia(e.target.value)}
                      placeholder="0000"
                      inputClassName="num"
                    />
                    <CampoTexto
                      id="cf-conta"
                      rotulo="Conta"
                      value={favConta}
                      onChange={(e) => setFavConta(e.target.value)}
                      placeholder="00000"
                      inputClassName="num"
                    />
                    <CampoTexto
                      id="cf-conta-dv"
                      rotulo="Dígito"
                      value={favContaDv}
                      onChange={(e) => setFavContaDv(e.target.value)}
                      placeholder="0"
                      inputClassName="num"
                    />
                  </div>
                  <CampoSelect
                    id="cf-conta-tipo"
                    rotulo="Tipo de conta"
                    value={favContaTipo}
                    onChange={(e) => setFavContaTipo(e.target.value)}
                    inputClassName="bg-white"
                  >
                    <option value="cc">Conta corrente</option>
                    <option value="poupanca">Poupança</option>
                  </CampoSelect>
                </div>
              </div>

              {/* TAGS / ORGANIZAÇÃO */}
              <div className={secao}>
                <p className={secaoTitulo}>Tags e organização</p>
                {/* A moldura do campo é a caixa inteira (chips + input); o `htmlFor` aponta para o input de digitar. */}
                <Campo rotulo="Tags (grupos)" htmlFor="cf-tags">
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-2">
                    {tags.map((t) => (
                      <span key={t} className="flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-medium text-brand-dark">
                        {t}
                        <button aria-label={`Remover a tag ${t}`} type="button" onClick={() => removeTag(t)} className="text-brand-dark/70 hover:text-brand-dark">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    <input
                      id="cf-tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
                        else if (e.key === "Backspace" && !tagInput && tags.length) removeTag(tags[tags.length - 1]);
                      }}
                      placeholder={tags.length ? "" : "Digite e tecle Enter (ex.: Matriz, VIP, Mensalista)"}
                      className="min-w-[120px] flex-1 px-1 py-0.5 text-sm outline-none"
                    />
                  </div>
                </Campo>
                {tagsExistentes.filter((t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase())).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-ink-soft">Já usadas:</span>
                    {tagsExistentes
                      .filter((t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase()))
                      .map((t) => (
                        <button key={t} type="button" onClick={() => addTag(t)} className="rounded-full border border-line px-2 py-0.5 text-[10px] font-medium text-ink-muted transition hover:bg-surface">
                          + {t}
                        </button>
                      ))}
                  </div>
                )}

                <CampoArea
                  id="cf-observacoes"
                  rotulo="Observações"
                  className="mt-3"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                />

                <label className="mt-3 flex items-center gap-2 text-sm font-medium text-ink">
                  <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 rounded border-line" />
                  Cadastro ativo
                </label>
              </div>

              {erro && (
                <MessageStrip tipo="erro">{erro}</MessageStrip>
              )}
                </>
  );

  if (comoPagina) {
    // Mesmo formulário, outra moldura: sem véu, sem caixa com rolagem própria,
    // e o salvar volta para a lista em vez de fechar um diálogo.
    return (
      <div className="rounded-xl2 bg-white shadow-card" {...form.campos}>
        <div className="space-y-4 px-5 py-4">{corpoFormulario}</div>
        <FooterBar
          info={
            <BotaoLink href="/clientes-fornecedores" variante="secundario">
              Voltar à lista
            </BotaoLink>
          }
        >
          <Botao variante="primario" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </FooterBar>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {erroLista && (
        <MessageStrip tipo="erro" fechavel onFechar={() => setErroLista(null)}>
          {erroLista}
        </MessageStrip>
      )}
      <FilterBar
        tela="clientes-fornecedores"
        onLimpar={vis.limpar}
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
            id: "tipo",
            label: "Tipo",
            fixo: true,
            ativo: filtro !== "todos",
            min: "230px",
            node: (
              <div className="flex items-center gap-0.5 rounded-lg border border-line p-0.5 text-xs">
                {[
                  { v: "todos", l: "Todos" },
                  { v: "cliente", l: "Clientes" },
                  { v: "fornecedor", l: "Fornecedores" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setFiltro(o.v)}
                    className={
                      filtro === o.v
                        ? "rounded-md bg-brand px-2.5 py-1 font-semibold text-white"
                        : "rounded-md px-2.5 py-1 font-medium text-ink-muted transition hover:bg-surface"
                    }
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            ),
          },
          {
            id: "q",
            label: "Buscar",
            fixo: true,
            ativo: busca.trim() !== "",
            min: "220px",
            node: (
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
                {/*
                  `aria-label` aqui porque a FilterBar só liga o rótulo dela ao
                  campo quando o nó do filtro é um `<input>`/`<select>` na raiz —
                  e este está dentro da `<div>` que posiciona a lupa. Sem isto o
                  campo é anunciado sem nome.
                */}
                <input
                  ref={buscaRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  aria-label="Buscar"
                  placeholder="Nome, razão social ou CNPJ"
                  className={classeControle("sm", false, "pl-8 pr-2")}
                />
              </div>
            ),
          },
          ...(tagsExistentes.length > 0
            ? [
                {
                  id: "tag",
                  label: "Tag",
                  ativo: Boolean(tagFiltro),
                  min: "170px",
                  node: (
                    <select
                      value={tagFiltro ?? ""}
                      onChange={(e) => setTagFiltro(e.target.value || null)}
                      className={classeControle("sm")}
                    >
                      <option value="">Todas as tags</option>
                      {tagsExistentes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  ),
                },
              ]
            : []),
          {
            id: "inativos",
            label: "Inativos",
            ativo: incluirInativos,
            min: "150px",
            node: (
              <label className="flex h-8 cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-ink-muted">
                <input
                  type="checkbox"
                  checked={incluirInativos}
                  onChange={(e) => setIncluirInativos(e.target.checked)}
                  className="h-3.5 w-3.5 accent-brand"
                />
                Incluir inativos
              </label>
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
            />
            <Link
              href="/importar?tipo=clientes"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-ink transition hover:bg-surface"
            >
              <UploadCloud size={14} /> Importar
            </Link>
            <Botao variante="primario" tamanho="sm" className="h-8"
              onClick={abrirNovo}
            >
              <Plus size={14} /> Adicionar
            </Botao>
          </>
        }
      />

    <div className="rounded-xl2 bg-white shadow-card">
      {filtrada.length === 0 ? (
        <EmptyState
          filtrado
          icone={Search}
          titulo={lista.length === 0 ? "Nenhum cadastro ainda" : "Nenhum cadastro encontrado"}
          descricao={
            lista.length === 0
              ? "Cadastre clientes e fornecedores para usá-los nos lançamentos e nas cobranças."
              : "Ajuste o tipo, a busca ou a tag para ver mais."
          }
          acao={
            lista.length === 0 ? (
              <Botao variante="primario" tamanho="sm"
                onClick={abrirNovo}
              >
                <Plus size={14} /> Adicionar o primeiro
              </Botao>
            ) : undefined
          }
        />
      ) : (
        <div className="px-5 pb-2">
          <div
            className="sticky top-[calc(52px_+_var(--fs-cab,0px))] z-10 grid gap-3 border-b border-line bg-white py-2 text-[11px] font-semibold text-ink-soft"
            style={{ gridTemplateColumns: colunas.gridTemplate }}
          >
            {colunas.visiveis.map((c) => (
              <span key={c.id} className={c.id === "acoes" ? "text-right" : ""}>
                {c.id === "acoes" ? "Ações" : c.label}
              </span>
            ))}
          </div>
          {filtrada.map((p) => {
            const b = badge(p.tipo);
            const inativo = p.ativo === false;
            const local = [p.municipio, p.uf].filter(Boolean).join(" · ");
            return (
              <div
                key={p.id}
                {...(() => {
                  const { onClick, emFoco, ...resto } = nav.propsLinha(p);
                  return {
                    ...resto,
                    onClick,
                    className: `grid cursor-pointer items-center gap-3 border-b border-line py-2.5 text-sm last:border-0 ${
                      emFoco ? "ring-2 ring-inset ring-brand/40 hover:bg-surface/60" : "hover:bg-surface/60"
                    }`,
                  };
                })()}
                style={{ gridTemplateColumns: colunas.gridTemplate }}
              >
                {colunas.visiveis.map((c) => {
                  if (c.id === "nome")
                    return (
                      <div key={c.id} className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`truncate font-medium ${inativo ? "text-ink-soft line-through" : "text-ink"}`}>
                            {p.nome}
                          </span>
                          {inativo && <ObjectStatus pilula tom="neutro" semMarcador>Inativo</ObjectStatus>}
                        </div>
                      </div>
                    );
                  if (c.id === "contato")
                    return (
                      <span key={c.id} className="min-w-0 truncate text-ink-muted">
                        {p.email || p.telefone || "—"}
                      </span>
                    );
                  if (c.id === "local")
                    return (
                      <span key={c.id} className="truncate text-[12px] text-ink-soft">
                        {local || "—"}
                      </span>
                    );
                  if (c.id === "documento")
                    return (
                      <span key={c.id} className="num truncate text-ink-muted">
                        {mascaraCpfCnpj(p.cpf_cnpj ?? "") || "—"}
                      </span>
                    );
                  if (c.id === "tags")
                    return (
                      <span key={c.id} className="flex flex-wrap gap-1">
                        {(p.tags ?? []).length === 0 ? (
                          <span className="text-ink-soft">—</span>
                        ) : (
                          (p.tags ?? []).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTagFiltro(t === tagFiltro ? null : t)}
                              title="Filtrar por esta tag"
                              className="rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-medium text-brand-dark"
                            >
                              {t}
                            </button>
                          ))
                        )}
                      </span>
                    );
                  if (c.id === "tipo")
                    return (
                      <span key={c.id}>
                        <ObjectStatus pilula tom={b.tom}>{b.l}</ObjectStatus>
                      </span>
                    );
                  return (
                    <span key={c.id} className="flex justify-end gap-1">
                      <Link
                        href={`/clientes-fornecedores/${p.id}`}
                        title="Abrir cadastro"
                        aria-label={`Abrir o cadastro de ${p.nome}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-ink"
                      >
                        <Pencil size={15} />
                      </Link>
                      <BotaoIcone rotulo={`Excluir ${p.nome}`} variante="perigo" onClick={() => excluir(p)}>
                        <Trash2 size={15} />
                      </BotaoIcone>
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>

      <Modal
        rotulo={editId ? `Editar cadastro de ${nome || "cliente/fornecedor"}` : "Novo cliente ou fornecedor"}
        aberto={aberto}
        onFechar={() => setAberto(false)}
        sujo={form.sujo}
        largura="max-w-2xl"
      >
        {/* `rounded-xl2` aqui também: o conteúdo que rola pinta por cima dos cantos
            arredondados da moldura, que agora é o elemento de fora */}
        <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-xl2" {...form.campos}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 className="text-base font-bold text-ink">
              {editId ? "Editar cadastro" : "Novo cliente/fornecedor"}
            </h3>
            <button aria-label="Fechar"
              type="button"
              onClick={() => form.confirmar() && setAberto(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {corpoFormulario}
          </div>

          <div className="border-t border-line px-5 py-4">
            <Botao variante="primario" largura
              onClick={salvar}
              disabled={salvando}
            >
              {salvando ? "Salvando…" : editId ? "Salvar" : "Adicionar"}
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}
