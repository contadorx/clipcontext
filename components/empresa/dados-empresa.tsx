"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Search, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mascaraCpfCnpj, soDigitos } from "@/lib/formato";
import { Msg } from "@/components/ui/message-strip";
import FooterBar from "@/components/ui/footer-bar";
import Botao from "@/components/ui/botao";
import Campo, { CampoSelect, CampoTexto, classeControle } from "@/components/ui/campo";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR",
  "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];
const REGIMES = ["Simples Nacional", "MEI", "Lucro Presumido", "Lucro Real", "Imune/Isenta"];

type Inicial = {
  nome: string;
  cnpjCpf: string;
  razaoSocial: string;
  nomeFantasia: string;
  regimeTributario: string;
  uf: string;
  municipio: string;
};

export default function DadosEmpresa({ empresaId, inicial }: { empresaId: string; inicial: Inicial }) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial.nome);
  const [cnpjCpf, setCnpjCpf] = useState(mascaraCpfCnpj(inicial.cnpjCpf));
  const [razaoSocial, setRazaoSocial] = useState(inicial.razaoSocial);
  const [nomeFantasia, setNomeFantasia] = useState(inicial.nomeFantasia);
  const [regime, setRegime] = useState(inicial.regimeTributario);
  const [uf, setUf] = useState(inicial.uf);
  const [municipio, setMunicipio] = useState(inicial.municipio);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function buscarCnpj() {
    const digits = cnpjCpf.replace(/\D/g, "");
    if (digits.length !== 14) {
      setMsg({ tipo: "erro", texto: "Para buscar, informe um CNPJ com 14 dígitos. (CPF é preenchido manualmente.)" });
      return;
    }
    setBuscando(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/cnpj/${digits}`);
      const d = await res.json();
      if (!res.ok) {
        setMsg({ tipo: "erro", texto: d.erro || "Não encontrei esse CNPJ." });
        setBuscando(false);
        return;
      }
      if (d.razaoSocial) setRazaoSocial(d.razaoSocial);
      if (d.nomeFantasia) setNomeFantasia(d.nomeFantasia);
      if (d.uf) setUf(d.uf);
      if (d.municipio) setMunicipio(d.municipio);
      if (d.regimeSugerido) setRegime(d.regimeSugerido);
      if (!nome.trim() && (d.nomeFantasia || d.razaoSocial)) setNome(d.nomeFantasia || d.razaoSocial);
      setMsg({ tipo: "ok", texto: "Dados preenchidos pela Receita. Confira e ajuste o regime se necessário." });
    } catch {
      setMsg({ tipo: "erro", texto: "Falha na busca. Tente de novo." });
    }
    setBuscando(false);
  }

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("empresas")
      .update({
        nome: nome.trim() || null,
        cnpj_cpf: soDigitos(cnpjCpf) || null,
        razao_social: razaoSocial.trim() || null,
        nome_fantasia: nomeFantasia.trim() || null,
        regime_tributario: regime || null,
        uf: uf || null,
        municipio: municipio.trim() || null,
      })
      .eq("id", empresaId);
    setSalvando(false);
    if (error) {
      setMsg({ tipo: "erro", texto: error.message });
      return;
    }
    setMsg({ tipo: "ok", texto: "Dados salvos." });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {msg && <Msg msg={msg} />}

      <div className="space-y-4 rounded-xl2 bg-white p-4 shadow-card">
        {/*
          Aqui é a moldura `Campo` crua, e não `CampoTexto`: o input divide a
          linha com o botão Buscar, então o `<div className="flex">` tem de ficar
          entre o rótulo e o controle. O `aria-describedby` vai à mão porque o
          texto de ajuda é da moldura, e o input não passa por ela.
        */}
        <Campo
          rotulo="CNPJ / CPF"
          htmlFor="empresa-cnpj"
          ajuda="A busca por CNPJ preenche razão social, nome fantasia, UF, município e — quando Simples/MEI — o regime. CPF é preenchido manualmente."
        >
          <div className="flex gap-2">
            <input
              id="empresa-cnpj"
              aria-describedby="empresa-cnpj-ajuda"
              value={cnpjCpf}
              onChange={(e) => setCnpjCpf(mascaraCpfCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              className={classeControle("md")}
            />
            <Botao variante="primario"
              onClick={buscarCnpj}
              disabled={buscando}
            >
              {buscando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
            </Botao>
          </div>
        </Campo>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoTexto
            id="empresa-razao-social"
            rotulo="Razão social"
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
          />
          <CampoTexto
            id="empresa-nome-fantasia"
            rotulo="Nome fantasia"
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
          />
          <CampoTexto
            id="empresa-nome-sistema"
            rotulo="Nome no sistema (apelido)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <CampoSelect
            id="empresa-regime-tributario"
            rotulo="Regime tributário"
            value={regime}
            onChange={(e) => setRegime(e.target.value)}
          >
            <option value="">Selecione…</option>
            {REGIMES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </CampoSelect>
          <CampoSelect id="empresa-uf" rotulo="UF" value={uf} onChange={(e) => setUf(e.target.value)}>
            <option value="">—</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </CampoSelect>
          <CampoTexto
            id="empresa-municipio"
            rotulo="Município"
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
          />
        </div>
      </div>

      <FooterBar>
        <Botao variante="primario" onClick={salvar} disabled={salvando}>
          <Save size={15} /> {salvando ? "Salvando…" : "Salvar dados"}
        </Botao>
      </FooterBar>
    </div>
  );
}
