"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X, HelpCircle, Video, Image as ImageIcon } from "lucide-react";
import PageHeader from "@/components/ui/page-header";
import MessageStrip from "@/components/ui/message-strip";
import Botao from "@/components/ui/botao";

export type FaqRow = {
  id: string;
  categoria: string;
  pergunta: string;
  resposta: string;
  imagem_url: string | null;
  destaque: boolean | null;
  publicado: boolean | null;
  ordem: number | null;
};
export type VideoRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  url: string | null;
  em_breve: boolean | null;
  publicado: boolean | null;
  ordem: number | null;
};

const inp = "w-full rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const rotulo = "mb-1 block text-[11px] font-semibold text-ink-soft";

async function chamar(tipo: "faq" | "video", acao: "salvar" | "excluir", registro: Record<string, unknown>) {
  const res = await fetch("/api/admin/ajuda", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo, acao, registro }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.erro || "Falha ao salvar.");
  return j.registro;
}

export default function AdminAjuda({ faqsIni, videosIni }: { faqsIni: FaqRow[]; videosIni: VideoRow[] }) {
  const [faqs, setFaqs] = useState<FaqRow[]>(faqsIni);
  const [videos, setVideos] = useState<VideoRow[]>(videosIni);
  const [editFaq, setEditFaq] = useState<FaqRow | null>(null);
  const [editVideo, setEditVideo] = useState<VideoRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const faqVazio = (): FaqRow => ({ id: "", categoria: "Geral", pergunta: "", resposta: "", imagem_url: "", destaque: false, publicado: true, ordem: 0 });
  const videoVazio = (): VideoRow => ({ id: "", titulo: "", descricao: "", url: "", em_breve: false, publicado: true, ordem: 0 });

  async function salvarFaq() {
    if (!editFaq) return;
    setBusy(true); setErro(null);
    try {
      const salvo = (await chamar("faq", "salvar", editFaq as unknown as Record<string, unknown>)) as FaqRow;
      setFaqs((l) => (editFaq.id ? l.map((x) => (x.id === salvo.id ? salvo : x)) : [...l, salvo]).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)));
      setEditFaq(null);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro."); }
    setBusy(false);
  }
  async function excluirFaq(f: FaqRow) {
    if (!confirm(`Excluir "${f.pergunta}"?`)) return;
    try { await chamar("faq", "excluir", { id: f.id }); setFaqs((l) => l.filter((x) => x.id !== f.id)); }
    catch (e) { setErro(e instanceof Error ? e.message : "Erro."); }
  }
  async function salvarVideo() {
    if (!editVideo) return;
    setBusy(true); setErro(null);
    try {
      const salvo = (await chamar("video", "salvar", editVideo as unknown as Record<string, unknown>)) as VideoRow;
      setVideos((l) => (editVideo.id ? l.map((x) => (x.id === salvo.id ? salvo : x)) : [...l, salvo]).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)));
      setEditVideo(null);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro."); }
    setBusy(false);
  }
  async function excluirVideo(v: VideoRow) {
    if (!confirm(`Excluir "${v.titulo}"?`)) return;
    try { await chamar("video", "excluir", { id: v.id }); setVideos((l) => l.filter((x) => x.id !== v.id)); }
    catch (e) { setErro(e instanceof Error ? e.message : "Erro."); }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="Central de Ajuda"
        sub="Edite os artigos e vídeos que aparecem para todos os usuários."
      />
      {erro && <MessageStrip tipo="erro">{erro}</MessageStrip>}

      {/* ARTIGOS */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink"><HelpCircle size={16} /> Artigos ({faqs.length})</h2>
          <button onClick={() => setEditFaq(faqVazio())} className="flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark">
            <Plus size={14} /> Novo artigo
          </button>
        </div>
        <div className="space-y-2">
          {faqs.map((f) => (
            <div key={f.id} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-white p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {f.pergunta}
                  {f.destaque && <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand">destaque</span>}
                  {f.publicado === false && <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft">oculto</span>}
                  {f.imagem_url && <ImageIcon size={12} className="text-ink-soft" />}
                </p>
                <p className="truncate text-[11px] text-ink-soft">{f.categoria} · {f.resposta.slice(0, 80)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setEditFaq({ ...f, imagem_url: f.imagem_url ?? "" })} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface" title="Editar"><Pencil size={14} /></button>
                <button onClick={() => excluirFaq(f)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-rose-50 hover:text-danger" title="Excluir"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* VÍDEOS */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink"><Video size={16} /> Vídeos ({videos.length})</h2>
          <button onClick={() => setEditVideo(videoVazio())} className="flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark">
            <Plus size={14} /> Novo vídeo
          </button>
        </div>
        <div className="space-y-2">
          {videos.map((v) => (
            <div key={v.id} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-white p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {v.titulo}
                  {v.em_breve && <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft">em breve</span>}
                  {v.publicado === false && <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-soft">oculto</span>}
                </p>
                <p className="truncate text-[11px] text-ink-soft">{v.descricao || v.url || "—"}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setEditVideo({ ...v, descricao: v.descricao ?? "", url: v.url ?? "" })} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface" title="Editar"><Pencil size={14} /></button>
                <button onClick={() => excluirVideo(v)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-rose-50 hover:text-danger" title="Excluir"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODAL ARTIGO */}
      {editFaq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl2 bg-white shadow-card" role="dialog" aria-modal="true" aria-labelledby="dlg-artigo-faq-titulo">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h3 id="dlg-artigo-faq-titulo" className="text-[13px] font-bold text-ink">{editFaq.id ? "Editar artigo" : "Novo artigo"}</h3>
              <button aria-label="Fechar" onClick={() => setEditFaq(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-4">
              <div className="grid grid-cols-[1fr_90px] gap-3">
                <div><label className={rotulo}>Categoria</label><input value={editFaq.categoria} onChange={(e) => setEditFaq({ ...editFaq, categoria: e.target.value })} className={inp} /></div>
                <div><label className={rotulo}>Ordem</label><input type="number" value={editFaq.ordem ?? 0} onChange={(e) => setEditFaq({ ...editFaq, ordem: Number(e.target.value) })} className={inp} /></div>
              </div>
              <div><label className={rotulo}>Pergunta</label><input value={editFaq.pergunta} onChange={(e) => setEditFaq({ ...editFaq, pergunta: e.target.value })} className={inp} /></div>
              <div><label className={rotulo}>Resposta</label><textarea value={editFaq.resposta} onChange={(e) => setEditFaq({ ...editFaq, resposta: e.target.value })} rows={6} className={inp} /></div>
              <div><label className={rotulo}>Figura (URL da imagem, opcional)</label><input value={editFaq.imagem_url ?? ""} onChange={(e) => setEditFaq({ ...editFaq, imagem_url: e.target.value })} placeholder="https://…/imagem.png" className={inp} /></div>
              <div className="flex gap-5 pt-1">
                <label className="flex items-center gap-2 text-sm text-ink-muted"><input type="checkbox" checked={!!editFaq.destaque} onChange={(e) => setEditFaq({ ...editFaq, destaque: e.target.checked })} /> Destaque</label>
                <label className="flex items-center gap-2 text-sm text-ink-muted"><input type="checkbox" checked={editFaq.publicado !== false} onChange={(e) => setEditFaq({ ...editFaq, publicado: e.target.checked })} /> Publicado</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
              <button onClick={() => setEditFaq(null)} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted hover:bg-surface">Cancelar</button>
              <Botao variante="primario" onClick={salvarFaq} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Botao>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VÍDEO */}
      {editVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rail/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl2 bg-white shadow-card" role="dialog" aria-modal="true" aria-labelledby="dlg-video-ajuda-titulo">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h3 id="dlg-video-ajuda-titulo" className="text-[13px] font-bold text-ink">{editVideo.id ? "Editar vídeo" : "Novo vídeo"}</h3>
              <button aria-label="Fechar" onClick={() => setEditVideo(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-4">
              <div className="grid grid-cols-[1fr_90px] gap-3">
                <div><label className={rotulo}>Título</label><input value={editVideo.titulo} onChange={(e) => setEditVideo({ ...editVideo, titulo: e.target.value })} className={inp} /></div>
                <div><label className={rotulo}>Ordem</label><input type="number" value={editVideo.ordem ?? 0} onChange={(e) => setEditVideo({ ...editVideo, ordem: Number(e.target.value) })} className={inp} /></div>
              </div>
              <div><label className={rotulo}>Descrição</label><textarea value={editVideo.descricao ?? ""} onChange={(e) => setEditVideo({ ...editVideo, descricao: e.target.value })} rows={3} className={inp} /></div>
              <div><label className={rotulo}>URL do vídeo (YouTube, Vimeo…)</label><input value={editVideo.url ?? ""} onChange={(e) => setEditVideo({ ...editVideo, url: e.target.value })} placeholder="https://youtu.be/…" className={inp} /></div>
              <div className="flex gap-5 pt-1">
                <label className="flex items-center gap-2 text-sm text-ink-muted"><input type="checkbox" checked={!!editVideo.em_breve} onChange={(e) => setEditVideo({ ...editVideo, em_breve: e.target.checked })} /> Em breve</label>
                <label className="flex items-center gap-2 text-sm text-ink-muted"><input type="checkbox" checked={editVideo.publicado !== false} onChange={(e) => setEditVideo({ ...editVideo, publicado: e.target.checked })} /> Publicado</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
              <button onClick={() => setEditVideo(null)} className="rounded-md border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted hover:bg-surface">Cancelar</button>
              <Botao variante="primario" onClick={salvarVideo} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
