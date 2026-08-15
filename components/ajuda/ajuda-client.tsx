"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  ArrowLeft,
  LifeBuoy,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  PlayCircle,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/ui/page-header";
import { SkeletonLinhas } from "@/components/ui/skeleton";

type Faq = {
  id: string;
  categoria: string;
  pergunta: string;
  resposta: string;
  imagem_url: string | null;
  destaque: boolean;
  ordem: number;
};

type Video = {
  id: string;
  titulo: string;
  descricao: string | null;
  url: string | null;
  em_breve: boolean;
};

export default function AjudaClient() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [catSel, setCatSel] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [votos, setVotos] = useState<Record<string, "sim" | "nao">>({});

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [fq, vd] = await Promise.all([
        supabase
          .from("faq")
          .select("id, categoria, pergunta, resposta, imagem_url, destaque, ordem")
          .eq("publicado", true)
          .order("ordem"),
        supabase
          .from("ajuda_videos")
          .select("id, titulo, descricao, url, em_breve")
          .eq("publicado", true)
          .order("ordem"),
      ]);
      setFaqs((fq.data as Faq[]) ?? []);
      setVideos((vd.data as Video[]) ?? []);
      setCarregando(false);
    })();
  }, []);

  const categorias = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of faqs) m.set(f.categoria, (m.get(f.categoria) ?? 0) + 1);
    return Array.from(m.entries()).map(([nome, n]) => ({ nome, n }));
  }, [faqs]);

  const termo = busca.trim().toLowerCase();
  const filtradas = faqs.filter((f) => {
    if (termo)
      return (
        f.pergunta.toLowerCase().includes(termo) ||
        f.resposta.toLowerCase().includes(termo) ||
        f.categoria.toLowerCase().includes(termo)
      );
    if (catSel) return f.categoria === catSel;
    return false;
  });

  const frequentes = (faqs.filter((f) => f.destaque).length
    ? faqs.filter((f) => f.destaque)
    : faqs
  ).slice(0, 6);

  async function votar(f: Faq, util: boolean) {
    setVotos((v) => ({ ...v, [f.id]: util ? "sim" : "nao" }));
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("faq_feedback").insert({ faq_id: f.id, util, user_id: user?.id ?? null });
    } catch {
      /* feedback é best-effort */
    }
  }

  /**
   * Função chamada, não componente. Definida aqui dentro e usada como `<Item>`,
   * ela ganharia identidade nova a cada render — e o React, vendo outro tipo de
   * componente, desmontaria e remontaria tudo o que está dentro. Foi assim que o
   * campo do diálogo de lançamento passou a aceitar só uma letra. Chamada como
   * função, o JSX volta para a reconciliação normal. A `key` vai no elemento de
   * raiz, que é onde ela sempre pertenceu.
   */
  const item = (f: Faq) => {
    const open = aberto === f.id;
    const voto = votos[f.id];
    return (
      <div key={f.id} className="border-b border-line/70 last:border-0">
        <button
          type="button"
          onClick={() => setAberto(open ? null : f.id)}
          className="flex w-full items-center justify-between gap-3 py-3 text-left"
        >
          <span className="text-sm font-medium text-ink">{f.pergunta}</span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-ink-soft transition ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="pb-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{f.resposta}</p>
            {f.imagem_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.imagem_url} alt="" className="mt-3 max-h-80 w-auto rounded-lg border border-line" />
            )}
            <div className="mt-3 flex items-center gap-3">
              {voto ? (
                <span className="text-xs font-semibold text-brand">Obrigado pelo feedback 💚</span>
              ) : (
                <>
                  <span className="text-xs text-ink-soft">Isso ajudou?</span>
                  <button aria-label="Isto ajudou"
                    type="button"
                    onClick={() => votar(f, true)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-soft transition hover:border-brand hover:text-brand"
                  >
                    <ThumbsUp size={14} />
                  </button>
                  <button aria-label="Isto não ajudou"
                    type="button"
                    onClick={() => votar(f, false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-soft transition hover:border-danger hover:text-danger"
                  >
                    <ThumbsDown size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Central de Ajuda"
        sub="Busque por uma palavra ou navegue pelos temas. Respostas rápidas para as dúvidas mais comuns."
      />

      <div className="mx-auto max-w-3xl space-y-6">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setCatSel(null);
            setAberto(null);
          }}
          placeholder="Buscar na ajuda…"
          className="w-full rounded-xl border border-line bg-white py-3 pl-9 pr-3 text-sm outline-none focus:border-brand"
        />
      </div>

      {carregando ? (
        <SkeletonLinhas linhas={6} colunas={1} />
      ) : termo ? (
        <div className="rounded-xl2 bg-white px-5 shadow-card">
          {filtradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">
              Nada encontrado para “{busca}”. Tente outra palavra.
            </p>
          ) : (
            filtradas.map(item)
          )}
        </div>
      ) : catSel ? (
        <div>
          <button
            type="button"
            onClick={() => {
              setCatSel(null);
              setAberto(null);
            }}
            className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-brand"
          >
            <ArrowLeft size={14} /> Todos os temas
          </button>
          <h2 className="mb-2 text-sm font-bold text-ink">{catSel}</h2>
          <div className="rounded-xl2 bg-white px-5 shadow-card">
            {filtradas.map(item)}
          </div>
        </div>
      ) : (
        <>
          {/* Perguntas frequentes */}
          <div>
            <h2 className="mb-2 text-sm font-bold text-ink">Perguntas frequentes</h2>
            <div className="rounded-xl2 bg-white px-5 shadow-card">
              {frequentes.map(item)}
            </div>
          </div>

          {/* Vídeos */}
          {videos.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-bold text-ink">Vídeos</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {videos.map((v) => {
                  const conteudo = (
                    <span className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand">
                        {v.em_breve ? <Clock size={18} /> : <PlayCircle size={18} />}
                      </span>
                      <span>
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                          {v.titulo}
                          {v.em_breve && (
                            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-ink-soft">
                              Em breve
                            </span>
                          )}
                        </span>
                        {v.descricao && <span className="block text-xs text-ink-soft">{v.descricao}</span>}
                      </span>
                    </span>
                  );
                  return v.url && !v.em_breve ? (
                    <a
                      key={v.id}
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl2 bg-white px-4 py-3 shadow-card transition hover:border-brand"
                    >
                      {conteudo}
                    </a>
                  ) : (
                    <div
                      key={v.id}
                      className="rounded-xl2 bg-white px-4 py-3 shadow-card opacity-80"
                    >
                      {conteudo}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Temas */}
          <div>
            <h2 className="mb-2 text-sm font-bold text-ink">Temas</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {categorias.map((c) => (
                <button
                  key={c.nome}
                  type="button"
                  onClick={() => {
                    setCatSel(c.nome);
                    setAberto(null);
                  }}
                  className="flex items-center justify-between rounded-xl2 bg-white px-4 py-3 text-left shadow-card transition hover:border-brand"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light text-brand">
                      <HelpCircle size={16} />
                    </span>
                    <span className="text-sm font-semibold text-ink">{c.nome}</span>
                  </span>
                  <span className="text-xs text-ink-soft">{c.n}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Não achou */}
          <div className="flex items-start gap-3 rounded-xl2 border border-line bg-surface px-5 py-4">
            <LifeBuoy size={18} className="mt-0.5 shrink-0 text-brand" />
            <p className="text-sm text-ink-muted">
              Não achou o que procurava? Busque por outra palavra acima — estamos sempre adicionando novos temas à
              ajuda.
            </p>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
