import { brl } from "@/lib/mock";
import type { ContaSaldo } from "@/lib/painel";
import CriarContaBotao from "@/components/painel/criar-conta-botao";
import Card from "@/components/ui/card";
import ObjectStatus from "@/components/ui/object-status";

export default function ContasPanel({ contas, empresaId }: { contas: ContaSaldo[]; empresaId: string }) {
  const total = contas.reduce((s, c) => s + c.saldo, 0);

  return (
    <Card titulo="Contas e saldos" sub="saldo atual de cada conta" acoes={<CriarContaBotao empresaId={empresaId} />}>

      <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-line pb-2 text-xs font-semibold text-ink-soft">
        <span>Nome da conta</span>
        <span className="text-right">Saldo atual</span>
      </div>

      {contas.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-soft">
          Nenhuma conta ainda.{" "}
          <CriarContaBotao empresaId={empresaId} variante="link">
            Criar a primeira
          </CriarContaBotao>
        </p>
      ) : (
        contas.map((c) => (
          <div key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-2 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{c.nome}</span>
              <span className="flex items-center gap-1.5">
                {c.banco && <span className="truncate text-[11px] text-ink-soft">{c.banco}</span>}
                {/*
                  Um saldo não conciliado é um saldo com ressalva, e o cartão não
                  distinguia os dois. "Sem extrato" também não é "conciliada": a
                  conta que nunca recebeu extrato não tem o que casar, e dizer
                  que ela está em dia seria dar garantia que ninguém deu.
                */}
                {c.aConciliar === null ? (
                  <span className="text-[11px] text-ink-soft">· sem extrato</span>
                ) : c.aConciliar === 0 ? (
                  <ObjectStatus tom="positivo">conciliada</ObjectStatus>
                ) : (
                  <ObjectStatus tom="critico">{c.aConciliar} a conciliar</ObjectStatus>
                )}
              </span>
            </span>
            {/* Mesma regra de Movimentações: conta no vermelho é a única linha
                deste cartão que exige ação. Antes o negativo era desenhado igual
                ao positivo, e a mesma informação tinha duas cores em duas telas. */}
            <span className={`num text-right ${c.saldo < 0 ? "font-semibold text-danger" : "text-ink"}`}>
              {brl(c.saldo)}
            </span>
          </div>
        ))
      )}

      <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
        <span className="text-sm font-semibold text-ink-muted">Saldo</span>
        <span className={`num text-sm font-bold ${total < 0 ? "text-danger" : "text-ink"}`}>{brl(total)}</span>
      </div>
    </Card>
  );
}
