"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldAlert, Trash2, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/ui/empty-state";
import Botao from "@/components/ui/botao";

type Config = {
  inscricao_municipal: string | null;
  codigo_municipio_ibge: string | null;
  op_simples: string;
  serie_dps: string;
  proximo_numero_dps: number;
  ambiente: string;
  cert_path: string | null;
  cert_validade: string | null;
  cert_cn: string | null;
} | null;

type Empresa = {
  nome: string;
  cnpj_cpf: string | null;
  razao_social: string | null;
  regime_tributario: string | null;
  municipio: string | null;
  uf: string | null;
} | null;

const OP_SIMPLES: { v: string; l: string }[] = [
  { v: "optante", l: "Optante do Simples (ME/EPP)" },
  { v: "mei", l: "MEI" },
  { v: "nao_optante", l: "Não optante do Simples" },
];

export default function NfseConfigClient({
  empresaId,
  config,
  empresa,
}: {
  empresaId: string;
  config: Config;
  empresa: Empresa;
}) {
  const router = useRouter();
  const [im, setIm] = useState(config?.inscricao_municipal ?? "");
  const [ibge, setIbge] = useState(config?.codigo_municipio_ibge ?? "");
  const [opSimples, setOpSimples] = useState(config?.op_simples ?? "optante");
  const [serie, setSerie] = useState(config?.serie_dps ?? "1");
  const [proximo, setProximo] = useState(String(config?.proximo_numero_dps ?? 1));
  const [ambiente, setAmbiente] = useState(config?.ambiente ?? "homologacao");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [cepBusca, setCepBusca] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);

  async function buscarIbgePorCep() {
    if (cepBusca.length !== 8) return;
    setBuscandoCep(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/cep/${cepBusca}`);
      const j = await r.json();
      if (r.ok && j.codigoIbge) {
        setIbge(j.codigoIbge);
        setMsg({ tipo: "ok", texto: `Município: ${j.municipio}/${j.uf} — código ${j.codigoIbge}. Salve para confirmar.` });
      } else {
        setMsg({ tipo: "erro", texto: j.erro ?? "CEP não encontrado." });
      }
    } catch {
      setMsg({ tipo: "erro", texto: "Não foi possível consultar o CEP agora." });
    } finally {
      setBuscandoCep(false);
    }
  }

  const [detectando, setDetectando] = useState(false);
  // detecta SP capital: por código IBGE salvo (3550308) ou por município+UF
  const ehSaoPaulo =
    ibge.replace(/\D/g, "") === "3550308" ||
    ((empresa?.municipio ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() === "sao paulo" &&
      (empresa?.uf ?? "").toUpperCase() === "SP");
  async function detectarPorMunicipio() {
    if (!empresa?.municipio || !empresa?.uf) {
      setMsg({ tipo: "erro", texto: "O cadastro da empresa está sem município ou UF. Preencha em Configurações → Empresa." });
      return;
    }
    setDetectando(true);
    setMsg(null);
    try {
      const r = await fetch(
        `/api/nfse/ibge-municipio?municipio=${encodeURIComponent(empresa.municipio)}&uf=${encodeURIComponent(empresa.uf)}`,
      );
      const j = await r.json();
      if (r.ok && j.codigoIbge) {
        setIbge(j.codigoIbge);
        setMsg({ tipo: "ok", texto: `${empresa.municipio}/${empresa.uf} — código ${j.codigoIbge}. Salve para confirmar.` });
      } else {
        setMsg({ tipo: "erro", texto: j.erro ?? "Não foi possível identificar o código do município." });
      }
    } catch {
      setMsg({ tipo: "erro", texto: "Não foi possível consultar agora." });
    } finally {
      setDetectando(false);
    }
  }

  // certificado
  const [certCn, setCertCn] = useState(config?.cert_cn ?? null);
  const [certValidade, setCertValidade] = useState(config?.cert_validade ?? null);
  const [temCert, setTemCert] = useState(!!config?.cert_path);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msgCert, setMsgCert] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const diasRestantes = certValidade
    ? Math.floor((new Date(certValidade).getTime() - Date.now()) / (24 * 3600 * 1000))
    : null;

  async function salvar() {
    if (ibge && !/^\d{7}$/.test(ibge.trim())) {
      setMsg({ tipo: "erro", texto: "O código IBGE do município tem 7 dígitos (ex.: 3547809 para Santo André/SP)." });
      return;
    }
    setSalvando(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.from("nfse_config").upsert(
      {
        empresa_id: empresaId,
        inscricao_municipal: im.trim() || null,
        codigo_municipio_ibge: ibge.trim() || null,
        op_simples: opSimples,
        serie_dps: serie.trim() || "1",
        proximo_numero_dps: Math.max(1, Number(proximo) || 1),
        ambiente,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "empresa_id" },
    );
    setSalvando(false);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return;
    }
    setMsg({ tipo: "ok", texto: "Dados do emitente salvos." });
    router.refresh();
  }

  async function enviarCertificado() {
    if (!arquivo) {
      setMsgCert({ tipo: "erro", texto: "Escolha o arquivo .pfx do certificado A1." });
      return;
    }
    if (!senha) {
      setMsgCert({ tipo: "erro", texto: "Informe a senha do certificado." });
      return;
    }
    setEnviando(true);
    setMsgCert(null);
    const fd = new FormData();
    fd.set("empresaId", empresaId);
    fd.set("senha", senha);
    fd.set("arquivo", arquivo);
    const resp = await fetch("/api/nfse/certificado", { method: "POST", body: fd });
    const json = (await resp.json().catch(() => ({}))) as { ok?: boolean; cn?: string; validade?: string | null; error?: string };
    setEnviando(false);
    if (!resp.ok || !json.ok) {
      setMsgCert({ tipo: "erro", texto: json.error ?? "Falha ao enviar o certificado." });
      return;
    }
    setTemCert(true);
    setCertCn(json.cn ?? null);
    setCertValidade(json.validade ?? null);
    setArquivo(null);
    setSenha("");
    setMsgCert({ tipo: "ok", texto: "Certificado validado e armazenado com segurança." });
    router.refresh();
  }

  async function removerCertificado() {
    if (!confirm("Remover o certificado A1 desta empresa? A emissão de NFS-e ficará indisponível até enviar outro.")) return;
    const resp = await fetch("/api/nfse/certificado", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId }),
    });
    const json = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!resp.ok || !json.ok) {
      setMsgCert({ tipo: "erro", texto: json.error ?? "Falha ao remover." });
      return;
    }
    setTemCert(false);
    setCertCn(null);
    setCertValidade(null);
    setMsgCert({ tipo: "ok", texto: "Certificado removido." });
    router.refresh();
  }

  const inputCls = "w-full rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
  const labelCls = "mb-1 block text-xs font-semibold text-ink-muted";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {ehSaoPaulo && (
        <div className="lg:col-span-2 rounded-xl2 border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">Esta empresa emite pela Prefeitura de São Paulo</p>
          <p className="mt-1 text-xs text-amber-800">
            São Paulo capital tem sistema próprio de NFS-e (não usa o sistema nacional). A emissão usa a sua Inscrição
            Municipal (CCM) e o <b>código de serviço municipal de SP</b> — que você informa no cadastro de cada serviço,
            no campo &ldquo;Código de tributação municipal&rdquo; (não é o item da LC 116). Em homologação, o RPS é
            validado sem gerar nota fiscal real.
          </p>
        </div>
      )}
      {/* dados do emitente */}
      <section className="space-y-3 rounded-xl2 bg-white p-4 shadow-card">
        <div>
          <h2 className="text-[13px] font-bold text-ink">Dados do emitente</h2>
          <p className="text-xs text-ink-muted">
            {empresa?.razao_social ?? empresa?.nome} · {empresa?.cnpj_cpf ?? "CNPJ não informado"}
            {empresa?.municipio ? ` · ${empresa.municipio}/${empresa.uf ?? ""}` : ""}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Inscrição municipal</label>
            <input value={im} onChange={(e) => setIm(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Código IBGE do município (7 dígitos)</label>
            <div className="flex gap-2">
              <input
                value={ibge}
                onChange={(e) => setIbge(e.target.value.replace(/\D/g, "").slice(0, 7))}
                placeholder="ex.: 3547809"
                className={`num ${inputCls}`}
              />
              <input
                value={cepBusca}
                onChange={(e) => setCepBusca(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="CEP"
                className={`num w-28 rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15`}
                title="Não sabe o código? Digite o CEP da empresa e busque."
              />
              <button
                type="button"
                onClick={buscarIbgePorCep}
                disabled={buscandoCep || cepBusca.length !== 8}
                className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-muted transition hover:bg-surface disabled:opacity-50"
              >
                {buscandoCep ? "Buscando…" : "Buscar"}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={detectarPorMunicipio}
                disabled={detectando || !empresa?.municipio || !empresa?.uf}
                className="rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand-dark transition hover:bg-brand/20 disabled:opacity-50"
              >
                {detectando ? "Detectando…" : "Detectar pelo município da empresa"}
              </button>
              {empresa?.municipio && empresa?.uf && (
                <span className="text-[11px] text-ink-soft">
                  {empresa.municipio}/{empresa.uf}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-ink-soft">
              O código é detectado automaticamente na emissão pelo município da empresa. Você pode confirmá-lo aqui antes,
              clicando no botão acima ou informando o CEP.
            </p>
          </div>
        </div>

        <div>
          <label className={labelCls}>Enquadramento no Simples Nacional</label>
          <select value={opSimples} onChange={(e) => setOpSimples(e.target.value)} className={inputCls}>
            {OP_SIMPLES.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Série da DPS</label>
            <input value={serie} onChange={(e) => setSerie(e.target.value)} className={`num ${inputCls}`} />
          </div>
          <div>
            <label className={labelCls}>Próximo número</label>
            <input
              type="number"
              min={1}
              value={proximo}
              onChange={(e) => setProximo(e.target.value)}
              className={`num ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>Ambiente</label>
            <select value={ambiente} onChange={(e) => setAmbiente(e.target.value)} className={inputCls}>
              <option value="homologacao">Homologação (teste)</option>
              <option value="producao">Produção (vale de verdade)</option>
            </select>
          </div>
        </div>
        {ambiente === "producao" && (
          <p className="rounded-lg bg-surface px-3 py-2 text-[11px] text-ink-muted">
            Em produção as notas têm validade fiscal. Use homologação até validar o fluxo completo.
          </p>
        )}

        {msg && <p className={`text-xs font-semibold ${msg.tipo === "erro" ? "text-danger" : "text-brand"}`}>{msg.texto}</p>}

        <Botao variante="primario"
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? "Salvando…" : "Salvar dados do emitente"}
        </Botao>
      </section>

      {/* certificado A1 */}
      <section className="space-y-3 rounded-xl2 bg-white p-4 shadow-card">
        <div>
          <h2 className="text-[13px] font-bold text-ink">Certificado digital A1</h2>
          <p className="text-xs text-ink-muted">
            Necessário para assinar e transmitir a NFS-e. O arquivo fica em armazenamento privado e a senha é guardada
            cifrada — nunca em texto puro.
          </p>
        </div>

        {temCert ? (
          <div
            className={`flex items-start gap-3 rounded-lg border p-3 ${
              diasRestantes !== null && diasRestantes < 30 ? "border-danger/40 bg-rose-50" : "border-line bg-surface/50"
            }`}
          >
            {diasRestantes !== null && diasRestantes < 30 ? (
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-danger" />
            ) : (
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{certCn ?? "Certificado instalado"}</p>
              {certValidade && (
                <p className="text-xs text-ink-muted">
                  Válido até {new Date(certValidade).toLocaleDateString("pt-BR")}
                  {diasRestantes !== null && (
                    <span className={diasRestantes < 30 ? "font-semibold text-danger" : ""}> · {diasRestantes} dia(s) restantes</span>
                  )}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={removerCertificado}
              className="shrink-0 rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-danger"
              aria-label="Remover certificado"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ) : (
          <EmptyState compacto titulo="Nenhum certificado enviado ainda" />
        )}

        <div className="space-y-2">
          <div>
            <label className={labelCls}>{temCert ? "Substituir certificado (.pfx)" : "Arquivo do certificado (.pfx)"}</label>
            <input
              type="file"
              accept=".pfx,.p12"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-light file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-dark hover:file:bg-brand-light/70"
            />
          </div>
          <div>
            <label className={labelCls}>Senha do certificado</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className={inputCls} autoComplete="new-password" />
          </div>
          {msgCert && (
            <p className={`text-xs font-semibold ${msgCert.tipo === "erro" ? "text-danger" : "text-brand"}`}>{msgCert.texto}</p>
          )}
          <Botao variante="primario"
            onClick={enviarCertificado}
            disabled={enviando}
          >
            <UploadCloud size={15} /> {enviando ? "Validando…" : "Enviar e validar"}
          </Botao>
        </div>
      </section>
    </div>
  );
}
