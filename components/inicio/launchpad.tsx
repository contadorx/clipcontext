"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  RotateCcw,
  Settings2,
  X,
} from "lucide-react";
import Tile, { type TomTile } from "@/components/inicio/tile";
import { usePreferencia } from "@/lib/preferencia-local";

/**
 * O Início como launchpad: três grupos, e a escolha de quem usa.
 *
 * Os grupos respondem três perguntas, em ordem de urgência — **decidir**,
 * **fazer**, **entender**. Agrupar por tarefa, e não por entidade, é o que
 * separa um launchpad de um menu com ícones.
 *
 * ## Tile zerado fica cinza, não some
 *
 * Some seria mais limpo, mas cobra um preço: o tile muda de lugar conforme o
 * dia, e quem procura pelo canto do olho não acha. Cinza mantém o mapa parado —
 * o mesmo tile no mesmo lugar todo dia — e "cinza" passa a ser uma informação:
 * aquilo está em dia.
 *
 * ## Quem escolhe os tiles é quem usa
 *
 * Um escritório que não emite NFS-e não precisa daquele tile ocupando espaço, e
 * ninguém de fora sabe disso melhor que ele. A escolha fica neste navegador,
 * como as colunas das listas: é preferência pessoal, muda conforme o trabalho
 * de cada um e não pertence à empresa.
 *
 * Tiles marcados como `fixo` não entram na escolha. São os que respondem "tem
 * dinheiro?" e "algo está vencido?" — esconder isso seria deixar alguém apagar
 * o próprio alarme de incêndio.
 *
 * ## Mover de lugar e de grupo
 *
 * No modo de escolha o tile pode ser arrastado — para outra posição ou para
 * outro grupo. E **as mesmas duas coisas têm botão**: `‹` e `›` movem uma casa,
 * e quem chega ao fim de um grupo entra no próximo.
 *
 * Os dois caminhos existem porque arrastar não funciona no teclado nem em leitor
 * de tela, e é ruim no celular. Uma personalização que só o mouse alcança
 * exclui parte de quem usa — e este é justamente o recurso de quem quer a tela
 * do jeito dele.
 *
 * Um só movimento faz as duas coisas de propósito: não há "reordenar" separado
 * de "trocar de grupo". A ordem é uma fila única atravessando os três grupos, e
 * a fronteira entre eles é só mais uma posição.
 */
export type TileDef = {
  id: string;
  grupo: "decisoes" | "processos" | "relatorios";
  href: string;
  titulo: string;
  sub?: string;
  valor?: string;
  unidade?: string;
  tom?: TomTile;
  rodapeEsq?: string;
  rodapeDir?: string;
  /** desenho no corpo do tile: sparkline, barras, progresso */
  corpo?: React.ReactNode;
  /** zero, nada pendente, nada a fazer — o tile continua no lugar, apagado */
  vazio?: boolean;
  /** não pode ser escondido */
  fixo?: boolean;
};

const GRUPOS: { id: TileDef["grupo"]; titulo: string; sub: string }[] = [
  { id: "decisoes", titulo: "Decisões", sub: "o que exige você hoje" },
  { id: "processos", titulo: "Processos", sub: "o trabalho que se repete" },
  {
    id: "relatorios",
    titulo: "Relatórios e visões",
    sub: "para entender, não para agir",
  },
];

/**
 * O arranjo de quem usa: em que grupo cada tile está e em que ordem.
 *
 * Guardado como `id:grupo` separado por vírgula — texto simples, porque o que
 * mora no navegador de alguém tem de sobreviver a uma versão nova do produto
 * sem migração. Tile que não estiver na lista entra no fim do grupo de origem;
 * `id` que não existe mais é ignorado. Assim, acrescentar ou remover um tile no
 * produto não quebra a personalização de ninguém.
 */
function lerArranjo(txt: string): {
  ordem: string[];
  grupo: Record<string, TileDef["grupo"]>;
} {
  const ordem: string[] = [];
  const grupo: Record<string, TileDef["grupo"]> = {};
  for (const parte of txt.split(",").filter(Boolean)) {
    const [id, g] = parte.split(":");
    if (!id) continue;
    ordem.push(id);
    if (g === "decisoes" || g === "processos" || g === "relatorios")
      grupo[id] = g;
  }
  return { ordem, grupo };
}

export default function Launchpad({ tiles }: { tiles: TileDef[] }) {
  const [editando, setEditando] = useState(false);
  // guarda os **escondidos**, não os visíveis: assim um tile novo do produto
  // nasce aparecendo para quem já personalizou, em vez de nascer invisível
  const [ocultosTxt, setOcultosTxt] = usePreferencia<string>(
    "inicio_ocultos",
    "",
  );
  const [arranjoTxt, setArranjoTxt] = usePreferencia<string>(
    "inicio_arranjo",
    "",
  );
  const [arrastando, setArrastando] = useState<string | null>(null);

  const ocultos = useMemo(
    () => new Set(ocultosTxt.split(",").filter(Boolean)),
    [ocultosTxt],
  );

  /** A fila única, já com o que a pessoa mexeu aplicado por cima do padrão. */
  const fila = useMemo(() => {
    const { ordem, grupo } = lerArranjo(arranjoTxt);
    const porId = new Map(tiles.map((t) => [t.id, t]));
    const saida: TileDef[] = [];
    for (const id of ordem) {
      const t = porId.get(id);
      if (t) {
        saida.push({ ...t, grupo: grupo[id] ?? t.grupo });
        porId.delete(id);
      }
    }
    // tiles que o produto ganhou depois: entram no fim, sem sumir
    tiles.forEach((t) => {
      if (porId.has(t.id)) saida.push(t);
    });
    return saida;
  }, [tiles, arranjoTxt]);

  function gravar(nova: TileDef[]) {
    setArranjoTxt(nova.map((t) => `${t.id}:${t.grupo}`).join(","));
  }

  function alternar(id: string) {
    const n = new Set(ocultos);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setOcultosTxt(Array.from(n).join(","));
  }

  /** Move o tile uma casa; ao chegar na ponta de um grupo, muda de grupo. */
  function mover(id: string, dir: -1 | 1) {
    const atual = fila.find((t) => t.id === id);
    if (!atual) return;
    const doGrupo = fila.filter((t) => t.grupo === atual.grupo);
    const pos = doGrupo.findIndex((t) => t.id === id);
    const naPonta = dir === -1 ? pos === 0 : pos === doGrupo.length - 1;

    if (naPonta) {
      const iGrupo = GRUPOS.findIndex((g) => g.id === atual.grupo);
      const destino = GRUPOS[iGrupo + dir];
      if (!destino) return; // primeira posição do primeiro grupo, ou última do último
      const nova = fila.filter((t) => t.id !== id);
      const doDestino = nova.filter((t) => t.grupo === destino.id);
      const vizinho =
        dir === 1 ? doDestino[0] : doDestino[doDestino.length - 1];
      const alvo = { ...atual, grupo: destino.id };
      const idx = vizinho
        ? nova.findIndex((t) => t.id === vizinho.id) + (dir === 1 ? 0 : 1)
        : nova.length;
      nova.splice(idx, 0, alvo);
      gravar(nova);
      return;
    }

    const vizinho = doGrupo[pos + dir];
    const nova = fila.filter((t) => t.id !== id);
    const idx =
      nova.findIndex((t) => t.id === vizinho.id) + (dir === 1 ? 1 : 0);
    nova.splice(idx, 0, atual);
    gravar(nova);
  }

  /** Solta o tile arrastado sobre outro, ou sobre a área vazia de um grupo. */
  function soltar(sobreId: string | null, grupoDestino: TileDef["grupo"]) {
    const id = arrastando;
    setArrastando(null);
    if (!id || id === sobreId) return;
    const atual = fila.find((t) => t.id === id);
    if (!atual) return;
    const nova = fila.filter((t) => t.id !== id);
    const alvo = { ...atual, grupo: grupoDestino };
    const idx = sobreId ? nova.findIndex((t) => t.id === sobreId) : nova.length;
    nova.splice(idx < 0 ? nova.length : idx, 0, alvo);
    gravar(nova);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-brand hover:text-brand-dark"
        >
          {editando ? <Check size={14} /> : <Settings2 size={14} />}
          {editando ? "Pronto" : "Escolher tiles"}
        </button>
      </div>

      {GRUPOS.map((g) => {
        const doGrupo = fila.filter((t) => t.grupo === g.id);
        const visiveis = editando
          ? doGrupo
          : doGrupo.filter((t) => !ocultos.has(t.id));
        if (visiveis.length === 0) return null;
        return (
          <section key={g.id}>
            <h2 className="mb-2 text-sm font-bold text-ink">
              {g.titulo}{" "}
              <span className="font-normal text-ink-soft">· {g.sub}</span>
            </h2>
            <div
              className={`flex flex-wrap gap-3 rounded-xl2 transition ${
                editando
                  ? "min-h-[80px] p-2 outline-dashed outline-1 outline-offset-2 outline-line"
                  : ""
              }`}
              onDragOver={(e) => editando && e.preventDefault()}
              onDrop={() => editando && soltar(null, g.id)}
            >
              {visiveis.map((t) => {
                const escondido = ocultos.has(t.id);
                return (
                  <div
                    key={t.id}
                    className={`relative ${arrastando === t.id ? "opacity-40" : ""}`}
                    draggable={editando}
                    onDragStart={() => setArrastando(t.id)}
                    onDragEnd={() => setArrastando(null)}
                    onDragOver={(e) => editando && e.preventDefault()}
                    onDrop={(e) => {
                      if (!editando) return;
                      e.stopPropagation();
                      soltar(t.id, g.id);
                    }}
                  >
                    {/*
                      No modo de escolha o tile deixa de navegar: clicar nele
                      liga e desliga. Um tile que às vezes leva para outra tela e
                      às vezes marca uma opção seria uma armadilha.
                    */}
                    {editando && (
                      <button
                        type="button"
                        onClick={() => !t.fixo && alternar(t.id)}
                        disabled={t.fixo}
                        title={
                          t.fixo
                            ? "Este sempre aparece"
                            : escondido
                              ? "Mostrar"
                              : "Esconder"
                        }
                        className={`absolute inset-0 z-10 flex items-start justify-end rounded-xl2 p-2 transition ${
                          t.fixo
                            ? "cursor-not-allowed bg-white/40"
                            : escondido
                              ? "bg-white/70 ring-2 ring-line"
                              : "ring-2 ring-brand"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${
                            t.fixo
                              ? "bg-ink-soft"
                              : escondido
                                ? "bg-ink-soft"
                                : "bg-brand"
                          }`}
                        >
                          {t.fixo ? (
                            <Check size={12} />
                          ) : escondido ? (
                            <X size={12} />
                          ) : (
                            <Check size={12} />
                          )}
                        </span>
                      </button>
                    )}

                    {/*
                      As setas ficam **acima** da camada que liga e desliga, com
                      z maior. Sem isso o clique nelas cairia no botão de fundo e
                      esconderia o tile em vez de movê-lo.
                    */}
                    {editando && (
                      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-1 rounded-b-xl2 bg-white/95 px-1 py-1">
                        <button
                          type="button"
                          onClick={() => mover(t.id, -1)}
                          aria-label={`Mover ${t.titulo} para trás`}
                          title="Mover para trás (muda de grupo na ponta)"
                          className="flex h-6 w-7 items-center justify-center rounded text-ink-soft transition hover:bg-surface hover:text-ink"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <GripVertical
                          size={13}
                          className="text-ink-soft"
                          aria-hidden
                        />
                        <button
                          type="button"
                          onClick={() => mover(t.id, 1)}
                          aria-label={`Mover ${t.titulo} para a frente`}
                          title="Mover para a frente (muda de grupo na ponta)"
                          className="flex h-6 w-7 items-center justify-center rounded text-ink-soft transition hover:bg-surface hover:text-ink"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                    <div
                      className={
                        !editando && t.vazio ? "opacity-55 grayscale" : ""
                      }
                    >
                      <Tile
                        href={t.href}
                        titulo={t.titulo}
                        sub={t.sub}
                        valor={t.valor}
                        unidade={t.unidade}
                        tom={t.vazio ? "neutro" : t.tom}
                        rodapeEsq={t.rodapeEsq}
                        rodapeDir={t.rodapeDir}
                      >
                        {t.corpo}
                      </Tile>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {editando && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-ink-soft">
          <span>
            Arraste para mover, ou use <b className="text-ink-muted">‹ ›</b> —
            na ponta de um grupo, o tile passa para o próximo. Clique no tile
            para escondê-lo.
          </span>
          <span>Tudo fica salvo neste navegador.</span>
          <button
            type="button"
            onClick={() => {
              setArranjoTxt("");
              setOcultosTxt("");
            }}
            className="flex items-center gap-1 font-semibold text-brand-dark underline-offset-2 hover:underline"
          >
            <RotateCcw size={12} /> voltar ao arranjo original
          </button>
        </div>
      )}
    </div>
  );
}
