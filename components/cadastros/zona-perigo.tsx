"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { zerarEmpresa } from "@/app/actions";
import MessageStrip from "@/components/ui/message-strip";
import Modal from "@/components/ui/modal";
import Botao from "@/components/ui/botao";
import { classeControle } from "@/components/ui/campo";

export default function ZonaPerigo({
  empresaId,
  empresaNome,
}: {
  empresaId: string;
  empresaNome: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  /** o zeramento deu certo, mas sobrou arquivo no armazenamento */
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const confere = texto.trim() === empresaNome.trim();
  // Vermelho só quando o que foi digitado já não pode virar o nome — e pela
  // mesma comparação que habilita o botão, senão a tela diz "está errado" e
  // "pode apagar" ao mesmo tempo. Antes era `true` fixo: nascia vermelho.
  const desviou = texto.trim().length > 0 && !empresaNome.trim().startsWith(texto.trim());

  function confirmar() {
    if (!confere) return;
    setErro(null);
    start(async () => {
      const r = await zerarEmpresa(empresaId);
      if (!r.ok) {
        setErro(r.error || "Não foi possível apagar os dados.");
        return;
      }
      /*
        O zeramento DEU CERTO. O aviso é sobre arquivos que sobraram no
        armazenamento — cobrados, sem linha na tabela e sem tela que os alcance.

        A primeira versão mostrava isso em vermelho dentro do diálogo, sem
        fechar e sem recarregar: a pessoa lia "erro", concluía que falhara,
        redigitava o nome e apagava de novo. Laço. Agora o diálogo fecha, a
        página recarrega, e o recado fica fora, em tom de aviso.
      */
      setAberto(false);
      setTexto("");
      setAviso(r.aviso ?? null);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-danger">Zona de perigo</h2>
        <p className="text-xs text-ink-muted">Ações irreversíveis sobre a empresa selecionada no topo.</p>
      </div>

      {aviso && (
        <MessageStrip tipo="alerta" fechavel onFechar={() => setAviso(null)}>
          {aviso}
        </MessageStrip>
      )}

      <div className="rounded-xl2 border border-line bg-rose-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <AlertTriangle size={16} className="text-danger" /> Apagar dados desta empresa
            </h3>
            <p className="mt-1 max-w-xl text-xs text-ink-muted">
              Remove lançamentos, extratos, conciliação, documentos, remessas CNAB e análises de IA de{" "}
              <b className="text-ink">{empresaNome}</b>. Mantém a empresa e os cadastros (contas — <b>com o saldo
              inicial</b> —, categorias, centros de custo, plano de contas, orçamentos, clientes/fornecedores e acesso
              do portal). Não tem como desfazer.
            </p>
            {/*
              O que a lista acima NÃO cobria, e que a pessoa descobria depois.

              Recorrências continuam ativas e voltam a gerar lançamento no mês
              seguinte; os meses fechados continuam travados, numa empresa que
              agora não tem nenhum lançamento; e vendas, contratos, boletos e
              notas ficam como estavam. Dizer "apaga todos os movimentos" e
              deixar isso de fora é a diferença entre uma empresa zerada e uma
              empresa que volta a se mexer sozinha.
            */}
            <p className="mt-2 max-w-xl rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <b>Continuam de pé:</b> as recorrências (voltam a gerar lançamento no mês seguinte), os meses fechados
              (seguem travados), e vendas, contratos, boletos e notas emitidas. Se a ideia é recomeçar do zero, revise
              esses quatro antes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setTexto("");
              setErro(null);
              setAberto(true);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-danger px-3 py-2 text-xs font-semibold text-danger transition hover:bg-danger hover:text-white"
          >
            <Trash2 size={13} /> Apagar dados
          </button>
        </div>
      </div>

      {/*
        Sem `sujo`: o único campo é a digitação do nome para confirmar. Redigitá-lo
        não é trabalho perdido, e perguntar "descartar alterações?" aqui seria ruído.
      */}
      <Modal
        rotulo="Apagar dados da empresa"
        aberto={aberto}
        onFechar={() => !pending && setAberto(false)}
        largura="max-w-md"
      >
        <div className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-bold text-ink">
              <AlertTriangle size={16} className="text-danger" /> Apagar dados da empresa
            </h3>
            <button aria-label="Fechar"
              type="button"
              onClick={() => !pending && setAberto(false)}
              className="text-ink-soft transition hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>

          <p className="mt-3 text-sm text-ink-muted">
            Isso apaga <b className="text-ink">todos os movimentos</b> de{" "}
            <span className="font-semibold text-ink">{empresaNome}</span> (lançamentos, extratos, conciliação,
            documentos, remessas e análises). Os cadastros ficam — e também ficam as{" "}
            <b className="text-ink">recorrências</b>, os <b className="text-ink">meses fechados</b> e as{" "}
            <b className="text-ink">vendas, contratos, boletos e notas</b>.{" "}
            <b className="text-danger">Não dá pra desfazer.</b>
          </p>

          <label htmlFor="zona-perigo-confirmar" className="mt-4 block text-xs font-semibold text-ink-muted">
            Para confirmar, digite o nome da empresa: <span className="font-bold text-ink">{empresaNome}</span>
          </label>
          <input
            id="zona-perigo-confirmar"
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={empresaNome}
            className={classeControle("md", desviou, "mt-1.5")}
          />

          {erro && (
            <MessageStrip tipo="erro">{erro}</MessageStrip>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAberto(false)}
              disabled={pending}
              className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-muted transition hover:text-ink disabled:opacity-60"
            >
              Cancelar
            </button>
            <Botao variante="perigo" tamanho="sm" className="disabled:cursor-not-allowed"
              onClick={confirmar}
              disabled={!confere || pending}
            >
              <Trash2 size={13} /> {pending ? "Apagando…" : "Apagar dados"}
            </Botao>
          </div>
        </div>
      </Modal>
    </section>
  );
}
