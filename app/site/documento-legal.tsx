import Link from "next/link";
import { baseDoSite, paginaDoSite } from "@/lib/site-links";

/*
  Moldura dos documentos jurídicos (Termos, Privacidade, Segurança).

  Um documento jurídico é lido de duas formas: alguém percorre inteiro antes de
  assinar, e alguém volta meses depois procurando UM parágrafo. A segunda é a
  que costuma ser mal servida — por isso cada seção tem `id` e âncora própria, e
  o sumário no topo leva direto até ela. O link que a pessoa copia da barra do
  navegador aponta para o trecho, não para o documento inteiro.
*/

export const ATUALIZADO_EM = "12 de agosto de 2026";

export function DocumentoLegal({
  titulo,
  resumo,
  secoes,
  children,
}: {
  titulo: string;
  resumo: string;
  /** Sumário: precisa bater com os `id` usados nas seções filhas. */
  secoes: { id: string; titulo: string }[];
  children: React.ReactNode;
}) {
  const base = baseDoSite();

  return (
    <main className="bg-white">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-12">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">{titulo}</h1>
          <p className="mt-3 text-base text-ink-muted">{resumo}</p>
          <p className="mt-4 text-sm text-ink-soft">Última atualização: {ATUALIZADO_EM}</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-12">
        <nav aria-label="Sumário" className="rounded-xl2 border border-line bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Sumário</p>
          <ol className="mt-3 space-y-1.5 text-sm">
            {secoes.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-ink-muted transition hover:text-brand">
                  <span className="tabular-nums text-ink-soft">{i + 1}.</span> {s.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10">{children}</div>

        <div className="mt-12 rounded-xl2 border border-line bg-surface p-5 text-sm text-ink-muted">
          Dúvidas sobre este documento?{" "}
          <a className="font-semibold text-brand hover:underline" href="mailto:contato@financeirox.com.br">
            contato@financeirox.com.br
          </a>
          . Assuntos de dados pessoais:{" "}
          <a className="font-semibold text-brand hover:underline" href="mailto:privacidade@financeirox.com.br">
            privacidade@financeirox.com.br
          </a>
          . Veja também{" "}
          <Link className="font-semibold text-brand hover:underline" href={paginaDoSite(base, "/termos")}>
            Termos
          </Link>
          ,{" "}
          <Link className="font-semibold text-brand hover:underline" href={paginaDoSite(base, "/privacidade")}>
            Privacidade
          </Link>{" "}
          e{" "}
          <Link className="font-semibold text-brand hover:underline" href={paginaDoSite(base, "/seguranca")}>
            Segurança
          </Link>
          .
        </div>
      </div>
    </main>
  );
}

/** Uma seção numerada do documento. O `n` é passado à mão para bater com o sumário. */
export function Secao({
  id,
  n,
  titulo,
  children,
}: {
  id: string;
  n: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line py-8 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-extrabold tracking-tight text-ink">
        <span className="tabular-nums text-ink-soft">{n}.</span> {titulo}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

/** Lista de itens dentro de uma seção. */
export function Itens({ children }: { children: React.ReactNode }) {
  return <ul className="ml-5 list-disc space-y-2 marker:text-ink-soft">{children}</ul>;
}
