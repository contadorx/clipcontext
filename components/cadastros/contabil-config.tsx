"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Msg } from "@/components/ui/message-strip";
import EmptyState from "@/components/ui/empty-state";
import Card from "@/components/ui/card";
import FooterBar from "@/components/ui/footer-bar";
import Botao from "@/components/ui/botao";
import { CampoSelect, CampoTexto } from "@/components/ui/campo";

// ── Auto-match categoria → conta contábil por similaridade de nome ──
function normNome(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
const STOP_NOME = new Set(["de", "da", "do", "com", "e", "a", "o", "as", "os", "para", "por", "em", "outras", "outros", "conta", "contas", "receita", "despesa", "despesas", "receitas"]);
function tokensNome(s: string): string[] {
  return normNome(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP_NOME.has(t));
}
function scoreNome(a: string, b: string): number {
  const na = normNome(a), nb = normNome(b);
  if (na === nb) return 1;
  const ta = tokensNome(a), tbArr = tokensNome(b), tb = new Set(tbArr);
  if (ta.length === 0 || tb.size === 0) {
    return na.includes(nb) || nb.includes(na) ? 0.7 : 0;
  }
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const uniao = new Set([...ta, ...tbArr]).size;
  let s = uniao ? inter / uniao : 0;
  if (na.includes(nb) || nb.includes(na)) s = Math.max(s, 0.7);
  return s;
}
function melhorConta(nomeCategoria: string, plano: { codigo: string; nome: string }[], min = 0.4): string | null {
  let melhor: string | null = null;
  let melhorScore = min;
  for (const p of plano) {
    const sc = scoreNome(nomeCategoria, p.nome);
    if (sc >= melhorScore) { melhorScore = sc; melhor = p.codigo; }
  }
  return melhor;
}

type Conta = { id: string; nome: string; codigo_contabil: string | null };
type Categoria = {
  id: string;
  nome: string;
  grupo_id: string;
  codigo_contabil: string | null;
  provisionamento: string | null;
  codigo_provisao: string | null;
  visao: string | null;
};
type Grupo = { id: string; nome: string; ordem: number };
type Contato = { id: string; nome: string; tipo: string; codigo_contabil: string | null };
type EncargosCfg = { jurosPago: string; jurosReceb: string; multa: string; descObtido: string; descConcedido: string };
type PessoasModo = "analitico" | "sintetico";

const SISTEMAS = [
  "Domínio", "Alterdata", "Fortes", "Questor", "Sci", "Contmatic",
  "Prosoft", "Sage", "Calima", "Mastermaq", "Outros",
];

const PROV_OPCOES = [
  { v: "nao_provisionado", l: "Não provisionado" },
  { v: "provisao", l: "Provisão" },
  { v: "baixa_provisao", l: "Baixa da provisão" },
  { v: "provisao_e_baixa", l: "Provisão e baixa" },
];

export default function ContabilConfig({
  empresaId,
  sistemaInicial,
  versaoInicial,
  encargosInicial,
  pessoasModoInicial,
  clientesInicial,
  fornecedoresInicial,
  historicoInicial,
  contas,
  grupos,
  categorias,
  contatos,
  planoContas,
}: {
  empresaId: string;
  sistemaInicial: string;
  versaoInicial: string;
  encargosInicial: EncargosCfg;
  pessoasModoInicial: PessoasModo;
  clientesInicial: string;
  fornecedoresInicial: string;
  historicoInicial: string;
  contas: Conta[];
  grupos: Grupo[];
  categorias: Categoria[];
  contatos: Contato[];
  planoContas: { codigo: string; nome: string }[];
}) {
  const router = useRouter();
  const [sistema, setSistema] = useState(sistemaInicial);
  const [versao, setVersao] = useState(versaoInicial);
  const [historico, setHistorico] = useState(historicoInicial);
  const [enc, setEnc] = useState<EncargosCfg>(encargosInicial);
  const [pessoasModo, setPessoasModo] = useState<PessoasModo>(pessoasModoInicial);
  const [contaClientes, setContaClientes] = useState(clientesInicial);
  const [contaFornecedores, setContaFornecedores] = useState(fornecedoresInicial);
  const [codConta, setCodConta] = useState<Record<string, string>>(
    Object.fromEntries(contas.map((c) => [c.id, c.codigo_contabil ?? ""])),
  );
  const [codCat, setCodCat] = useState<Record<string, string>>(
    Object.fromEntries(categorias.map((c) => [c.id, c.codigo_contabil ?? ""])),
  );
  const [provCat, setProvCat] = useState<Record<string, string>>(
    Object.fromEntries(categorias.map((c) => [c.id, c.provisionamento ?? "nao_provisionado"])),
  );
  const [codProvCat, setCodProvCat] = useState<Record<string, string>>(
    Object.fromEntries(categorias.map((c) => [c.id, c.codigo_provisao ?? ""])),
  );
  const [codContato, setCodContato] = useState<Record<string, string>>(
    Object.fromEntries(contatos.map((c) => [c.id, c.codigo_contabil ?? ""])),
  );
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [sugInfo, setSugInfo] = useState<string | null>(null);

  // Preenche, por similaridade de nome, o código de resultado das categorias ainda vazias.
  // Não sobrescreve o que já foi definido manualmente.
  function sugerirCategorias() {
    if (planoContas.length === 0) {
      setSugInfo("Importe ou cadastre o plano de contas (contas analíticas) antes de sugerir.");
      return;
    }
    let preenchidas = 0;
    let semMatch = 0;
    const novo = { ...codCat };
    for (const c of categorias) {
      if ((novo[c.id] ?? "").trim()) continue;
      const cod = melhorConta(c.nome, planoContas);
      if (cod) { novo[c.id] = cod; preenchidas++; } else semMatch++;
    }
    setCodCat(novo);
    if (preenchidas === 0) {
      setSugInfo("Nenhuma correspondência clara encontrada para as categorias vazias — preencha manualmente.");
    } else {
      setSugInfo(
        `${preenchidas} categoria(s) preenchida(s) por similaridade. Confira e salve.` +
          (semMatch ? ` ${semMatch} ficaram sem correspondência clara.` : ""),
      );
    }
  }

  const gruposOrdenados = [...grupos].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const supabase = createClient();

    const e1 = await supabase
      .from("empresas")
      .update({
        sistema_contabil: sistema.trim() || null,
        versao_contabil: versao.trim() || null,
        cont_historico: historico.trim() || null,
        cont_juros_pago: enc.jurosPago.trim() || null,
        cont_juros_receb: enc.jurosReceb.trim() || null,
        cont_multa: enc.multa.trim() || null,
        cont_desc_obtido: enc.descObtido.trim() || null,
        cont_desc_concedido: enc.descConcedido.trim() || null,
        cont_pessoas_modo: pessoasModo,
        cont_clientes: contaClientes.trim() || null,
        cont_fornecedores: contaFornecedores.trim() || null,
      })
      .eq("id", empresaId);
    if (e1.error) {
      setSalvando(false);
      setMsg({ tipo: "erro", texto: e1.error.message });
      return;
    }

    const updates: Promise<{ error: unknown }>[] = [];
    for (const c of contas) {
      const novo = (codConta[c.id] ?? "").trim();
      if (novo !== (c.codigo_contabil ?? ""))
        updates.push(
          supabase.from("contas_bancarias").update({ codigo_contabil: novo || null }).eq("id", c.id) as unknown as Promise<{ error: unknown }>,
        );
    }
    for (const c of categorias) {
      const novoCod = (codCat[c.id] ?? "").trim();
      const novoProv = provCat[c.id] ?? "nao_provisionado";
      const novoCodProv = (codProvCat[c.id] ?? "").trim();
      const mudou =
        novoCod !== (c.codigo_contabil ?? "") ||
        novoProv !== (c.provisionamento ?? "nao_provisionado") ||
        novoCodProv !== (c.codigo_provisao ?? "");
      if (mudou)
        updates.push(
          supabase
            .from("categorias")
            .update({
              codigo_contabil: novoCod || null,
              provisionamento: novoProv,
              codigo_provisao: novoCodProv || null,
            })
            .eq("id", c.id) as unknown as Promise<{ error: unknown }>,
        );
    }
    for (const c of contatos) {
      const novo = (codContato[c.id] ?? "").trim();
      if (novo !== (c.codigo_contabil ?? ""))
        updates.push(
          supabase.from("clientes_fornecedores").update({ codigo_contabil: novo || null }).eq("id", c.id) as unknown as Promise<{ error: unknown }>,
        );
    }
    const resultados = await Promise.all(updates);
    setSalvando(false);
    const falhou = resultados.find((r) => r.error);
    if (falhou) {
      setMsg({ tipo: "erro", texto: "Algumas alterações não foram salvas. Tente de novo." });
      return;
    }
    setMsg({ tipo: "ok", texto: `Configuração salva (${updates.length} item(ns) atualizado(s)).` });
    router.refresh();
  }

  /*
    A largura fica na moldura, não no controle: o input do `Campo` já é
    `w-full`, e na folha gerada `w-full` vem depois de `w-28` — posta no
    input, a largura fixa da coluna de códigos seria ignorada.
  */
  const molduraCod = "w-28";
  const inputCod = "num disabled:bg-surface disabled:opacity-50";

  return (
    <div className="space-y-5">
      <datalist id="planoCC">
        {planoContas.map((p) => (
          <option key={p.codigo} value={p.codigo}>{`${p.codigo} — ${p.nome}`}</option>
        ))}
      </datalist>
      {msg && <Msg msg={msg} />}

      {/* sistema contábil */}
      <Card titulo="Sistema contábil" sub="Para gerar o arquivo de lançamentos no formato do seu sistema.">
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoTexto
            id="contabil-sistema"
            rotulo="Sistema"
            list="sistemas-contabeis"
            value={sistema}
            onChange={(e) => setSistema(e.target.value)}
            placeholder="Ex.: Domínio"
          />
          {/* o `datalist` não vira coluna do grid: `display:none` não gera caixa */}
          <datalist id="sistemas-contabeis">
            {SISTEMAS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <CampoTexto
            id="contabil-versao"
            rotulo="Versão (opcional)"
            value={versao}
            onChange={(e) => setVersao(e.target.value)}
            placeholder="Ex.: 1.4"
          />
          <CampoTexto
            id="contabil-historico"
            rotulo="Histórico padrão (código)"
            value={historico}
            onChange={(e) => setHistorico(e.target.value)}
            placeholder="opcional"
            ajuda="Código de histórico que vai no arquivo, se o seu sistema exigir."
          />
        </div>
      </Card>

      {/* contrapartida de clientes/fornecedores */}
      <Card titulo="Clientes e fornecedores (contrapartida)">
        <p className="text-xs text-ink-muted">
          Como a conta de <b>a receber / a pagar</b> é lançada na provisão e na baixa.
        </p>
        <div className="mt-3 flex items-center gap-0.5 rounded-lg border border-line p-0.5 text-xs">
          {[
            { v: "sintetico", l: "Sintético (conta única)" },
            { v: "analitico", l: "Analítico (conta por pessoa)" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setPessoasModo(o.v as PessoasModo)}
              className={
                pessoasModo === o.v
                  ? "rounded-md bg-brand px-3 py-1.5 font-semibold text-white"
                  : "rounded-md px-3 py-1.5 font-medium text-ink-muted transition hover:bg-surface"
              }
            >
              {o.l}
            </button>
          ))}
        </div>
        {pessoasModo === "sintetico" ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CampoTexto
              id="contabil-clientes"
              rotulo="Clientes a receber"
              list="planoCC"
              value={contaClientes}
              onChange={(e) => setContaClientes(e.target.value)}
              placeholder="ex.: 1.1.2.001"
            />
            <CampoTexto
              id="contabil-fornecedores"
              rotulo="Fornecedores a pagar"
              list="planoCC"
              value={contaFornecedores}
              onChange={(e) => setContaFornecedores(e.target.value)}
              placeholder="ex.: 2.1.1.001"
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-soft">
            No modo analítico, cada cliente/fornecedor usa o próprio código contábil — preencha-os na seção
            “Clientes/Fornecedores” abaixo.
          </p>
        )}
      </Card>

      {/* contas de encargos */}
      <Card titulo="Contas de encargos (juros, multa, desconto)">
        <p className="text-xs text-ink-muted">
          Quando um pagamento tem juros, multa ou desconto, o principal vai para a categoria e os encargos saem nestas
          contas.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          <CampoTexto
            id="contabil-cod-juros-pago"
            rotulo="Juros pagos"
            list="planoCC"
            value={enc.jurosPago}
            onChange={(e) => setEnc({ ...enc, jurosPago: e.target.value })}
            placeholder="ex.: 4.3.1.001"
          />
          <CampoTexto
            id="contabil-cod-juros-recebido"
            rotulo="Juros recebidos"
            list="planoCC"
            value={enc.jurosReceb}
            onChange={(e) => setEnc({ ...enc, jurosReceb: e.target.value })}
            placeholder="ex.: 3.3.1.001"
          />
          <CampoTexto
            id="contabil-cod-multa"
            rotulo="Multa"
            list="planoCC"
            value={enc.multa}
            onChange={(e) => setEnc({ ...enc, multa: e.target.value })}
            placeholder="ex.: 4.3.1.002"
          />
          <CampoTexto
            id="contabil-cod-desc-obtido"
            rotulo="Desconto obtido"
            list="planoCC"
            value={enc.descObtido}
            onChange={(e) => setEnc({ ...enc, descObtido: e.target.value })}
            placeholder="ex.: 3.3.1.002"
          />
          <CampoTexto
            id="contabil-cod-desc-concedido"
            rotulo="Desconto concedido"
            list="planoCC"
            value={enc.descConcedido}
            onChange={(e) => setEnc({ ...enc, descConcedido: e.target.value })}
            placeholder="ex.: 4.3.1.003"
          />
        </div>
      </Card>

      {/* contas bancárias */}
      <div className="rounded-xl2 bg-white shadow-card">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-bold text-ink">Plano de contas — Contas bancárias</h2>
          <p className="text-xs text-ink-muted">Código contábil de cada conta (a contrapartida no movimento).</p>
        </div>
        {contas.length === 0 ? (
          <EmptyState compacto titulo="Nenhuma conta bancária cadastrada" />
        ) : (
          <div className="px-5 py-2">
            {contas.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0"
              >
                {/* o nome da linha é o rótulo do campo — por isso `label`, e não `span` */}
                <label htmlFor={`contabil-conta-${c.id}`} className="text-sm font-medium text-ink">
                  {c.nome}
                </label>
                <CampoTexto
                  id={`contabil-conta-${c.id}`}
                  className={molduraCod}
                  inputClassName={inputCod}
                  value={codConta[c.id] ?? ""}
                  onChange={(e) => setCodConta((s) => ({ ...s, [c.id]: e.target.value }))}
                  placeholder="código"
                  list="planoCC"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* categorias com provisionamento */}
      <div className="rounded-xl2 bg-white shadow-card">
        <div className="border-b border-line px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-bold text-ink">Plano de contas — Categorias</h2>
              <p className="text-xs text-ink-muted">
                Código de <b>resultado</b> (receita/despesa) e, quando provisionada, o código de <b>provisão</b> (conta
                de balanço: a receber/a pagar/passivo/PL).
              </p>
            </div>
            <button
              type="button"
              onClick={sugerirCategorias}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand/40 bg-brand-light px-3 py-2 text-xs font-semibold text-brand-dark transition hover:bg-brand hover:text-white"
            >
              <Wand2 size={15} /> Sugerir automaticamente
            </button>
          </div>
          {sugInfo && (
            <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-[11px] text-ink-muted">{sugInfo}</p>
          )}
        </div>
        {categorias.length === 0 ? (
          <EmptyState compacto titulo="Nenhuma categoria cadastrada" />
        ) : (
          gruposOrdenados.map((g) => {
            const filhos = categorias.filter((c) => c.grupo_id === g.id);
            if (filhos.length === 0) return null;
            return (
              <div key={g.id} className="border-b border-line last:border-0">
                <div className="bg-surface/70 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                  {g.nome}
                </div>
                <div className="px-5 py-1">
                  {filhos.map((c) => {
                    const prov = provCat[c.id] ?? "nao_provisionado";
                    const usaProvisao = prov !== "nao_provisionado";
                    const usaResultado = prov !== "baixa_provisao";
                    return (
                      <div key={c.id} className="border-b border-line/60 py-2.5 last:border-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {/*
                            São três controles para um nome só. O nome vira o
                            rótulo do código de resultado (o campo principal da
                            linha) e os outros dois se nomeiam por `aria-label`
                            — senão a linha teria três campos anunciados com o
                            mesmo nome da categoria.
                          */}
                          <label htmlFor={`contabil-cat-${c.id}`} className="min-w-[130px] flex-1 text-sm text-ink">
                            {c.nome}
                          </label>
                          {/*
                            `sm`: é um controle de linha de lista, não de
                            formulário. No tamanho `md` ele cresce 5px em altura
                            e 21px em largura, e numa tela que desenha uma linha
                            por categoria isso empurra o `flex-wrap` para duas
                            linhas em telas estreitas.
                          */}
                          <CampoSelect
                            id={`contabil-cat-prov-${c.id}`}
                            tamanho="sm"
                            inputClassName="bg-white"
                            aria-label={`Provisionamento de ${c.nome}`}
                            value={prov}
                            onChange={(e) => setProvCat((s) => ({ ...s, [c.id]: e.target.value }))}
                          >
                            {PROV_OPCOES.map((o) => (
                              <option key={o.v} value={o.v}>
                                {o.l}
                              </option>
                            ))}
                          </CampoSelect>
                          <CampoTexto
                            id={`contabil-cat-${c.id}`}
                            className={molduraCod}
                            inputClassName={inputCod}
                            value={codCat[c.id] ?? ""}
                            onChange={(e) => setCodCat((s) => ({ ...s, [c.id]: e.target.value }))}
                            placeholder="cód. resultado"
                            disabled={!usaResultado}
                            list="planoCC"
                          />
                          <CampoTexto
                            id={`contabil-cat-provisao-${c.id}`}
                            aria-label={`Código de provisão de ${c.nome}`}
                            className={molduraCod}
                            inputClassName={inputCod}
                            value={codProvCat[c.id] ?? ""}
                            onChange={(e) => setCodProvCat((s) => ({ ...s, [c.id]: e.target.value }))}
                            placeholder="cód. provisão"
                            disabled={!usaProvisao}
                            list="planoCC"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* contatos — modo analítico */}
      {pessoasModo === "analitico" && (
      <div className="rounded-xl2 bg-white shadow-card">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-bold text-ink">Plano de contas — Clientes/Fornecedores (analítico)</h2>
          <p className="text-xs text-ink-muted">
            Código contábil de cada cliente/fornecedor. No modo analítico, a contrapartida (a receber/a pagar) usa o
            código do contato vinculado ao lançamento.
          </p>
        </div>
        {contatos.length === 0 ? (
          <EmptyState compacto titulo="Nenhum cliente ou fornecedor cadastrado" />
        ) : (
          <div className="px-5 py-2">
            {contatos.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 border-b border-line/60 py-2.5 last:border-0"
              >
                <label htmlFor={`contabil-contato-${c.id}`} className="flex items-center gap-2 text-sm text-ink">
                  {c.nome}
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                    {c.tipo === "cliente" ? "Cliente" : c.tipo === "fornecedor" ? "Fornecedor" : "Ambos"}
                  </span>
                </label>
                <CampoTexto
                  id={`contabil-contato-${c.id}`}
                  className={molduraCod}
                  inputClassName={inputCod}
                  value={codContato[c.id] ?? ""}
                  onChange={(e) => setCodContato((s) => ({ ...s, [c.id]: e.target.value }))}
                  placeholder="código"
                  list="planoCC"
                />
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      <FooterBar>
        <Botao variante="primario" onClick={salvar} disabled={salvando}>
          <Save size={15} /> {salvando ? "Salvando…" : "Salvar configuração"}
        </Botao>
      </FooterBar>
    </div>
  );
}
