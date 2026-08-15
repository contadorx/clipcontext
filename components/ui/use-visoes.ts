"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import {
  apagarVisao,
  filtrosParaQuery,
  listarVisoes,
  mesmosFiltros,
  queryParaFiltros,
  salvarVisao,
  type Filtros,
  type Visao,
} from "@/lib/visoes";

/**
 * Tudo que uma tela precisa para ter filtro na URL + visões salvas.
 *
 * A tela declara o padrão dos seus filtros, o recorte atual e como aplicar um
 * recorte de volta no seu estado. O resto — URL, carregar, salvar, apagar,
 * marcar a visão ativa e detectar "alterada" — vem de graça.
 *
 *   const v = useVisoes({
 *     empresaId, tela: "liquidacoes",
 *     padrao: PADRAO, filtros, aplicar: (f) => { ... setState ... },
 *   });
 *
 * Sempre devolve `filtrosIniciais`: o recorte lido da URL na montagem, para a
 * tela inicializar seu estado com ele.
 */
export function useVisoes({
  empresaId,
  tela,
  padrao,
  filtros,
  aplicar,
}: {
  empresaId: string;
  tela: string;
  padrao: Filtros;
  filtros: Filtros;
  aplicar: (f: Filtros) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [visoes, setVisoes] = useState<Visao[]>([]);
  const [ativaId, setAtivaId] = useState<string | null>(null);

  // recorte que veio na URL — a tela usa isso para nascer já filtrada
  const filtrosIniciais = useMemo(
    () => queryParaFiltros(new URLSearchParams(searchParams?.toString() ?? ""), padrao),
    // só na montagem: depois quem manda no estado é o usuário
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* --------------------------------------------------------------- URL --- */
  // Todo filtro vive na URL: recarregar, voltar pelo navegador ou mandar o link
  // devolve exatamente o mesmo recorte. Parâmetros que não são filtro desta tela
  // (ex.: ?lanc=id) são preservados.
  const chavesRef = useRef(Object.keys(padrao));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const alvo = filtrosParaQuery(filtros, padrao);
    const atual = new URLSearchParams(window.location.search);
    chavesRef.current.forEach((k) => atual.delete(k));
    alvo.forEach((v, k) => atual.set(k, v));
    const nova = atual.toString();
    if (nova === window.location.search.replace(/^\?/, "")) return;
    const t = window.setTimeout(() => {
      router.replace(nova ? `${pathname}?${nova}` : pathname, { scroll: false });
    }, 250); // debounce: digitar na busca não empilha histórico
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros, pathname]);

  /* ------------------------------------------------------------ visões --- */
  const carregar = useCallback(async () => {
    if (!empresaId) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setVisoes(await listarVisoes(supabase, empresaId, user?.id ?? "", tela));
  }, [empresaId, tela]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const aplicarVisao = useCallback(
    (v: Visao) => {
      aplicar({ ...padrao, ...v.filtros });
      setAtivaId(v.id);
    },
    // aplicar/padrao vêm da tela e são estáveis o bastante para o uso aqui
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aplicar, padrao],
  );

  const limpar = useCallback(() => {
    aplicar({ ...padrao });
    setAtivaId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicar, padrao]);

  const salvar = useCallback(
    async (nome: string, compartilhada: boolean): Promise<string | null> => {
      const r = await salvarVisao(createClient(), empresaId, tela, nome, filtros, compartilhada);
      if (r.erro) return r.erro;
      await carregar();
      if (r.id) setAtivaId(r.id);
      return null;
    },
    [empresaId, tela, filtros, carregar],
  );

  const apagar = useCallback(
    async (v: Visao) => {
      const erro = await apagarVisao(createClient(), v.id);
      if (erro) {
        toast(erro, { tom: "erro" });
        return;
      }
      if (ativaId === v.id) setAtivaId(null);
      await carregar();
      toast(`Visão "${v.nome}" apagada.`, {
        // apagar visão não pede confirmação: recria igual se foi sem querer
        desfazer: async () => {
          const r = await salvarVisao(createClient(), empresaId, tela, v.nome, v.filtros, v.compartilhada);
          if (r.erro) {
            toast(r.erro, { tom: "erro" });
            return;
          }
          await carregar();
        },
      });
    },
    [ativaId, carregar, empresaId, tela, toast],
  );

  // filtros mexidos depois de aplicar a visão -> mostra o ponto de "alterada"
  const sujo = useMemo(() => {
    const v = visoes.find((x) => x.id === ativaId);
    return v ? !mesmosFiltros({ ...padrao, ...v.filtros }, filtros) : false;
  }, [visoes, ativaId, filtros, padrao]);

  return { visoes, ativaId, sujo, filtrosIniciais, aplicarVisao, limpar, salvar, apagar };
}
