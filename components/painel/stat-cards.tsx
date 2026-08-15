"use client";

import { useEffect, useState } from "react";
import { brl } from "@/lib/mock";

/**
 * KPIs do painel — agora presos no topo.
 *
 * Antes eles rolavam para fora da tela e você perdia a referência justo na hora
 * de conferir a lista. Agora ficam fixos abaixo da topbar e, ao rolar, colapsam
 * numa faixa fina com os números essenciais.
 *
 * Cor = significado: entrada em teal, saída em tinta neutra, vermelho só para
 * o que está vencido.
 */
export default function StatCards({
  saldoAtual,
  previsto,
  ate,
  recebidos,
  despesas,
  aPagar,
  aReceber,
  vencidoPagar,
  vencidoReceber,
}: {
  saldoAtual: number;
  previsto: number;
  ate: string;
  recebidos: number;
  despesas: number;
  aPagar: number;
  aReceber: number;
  vencidoPagar: number;
  vencidoReceber: number;
}) {
  const [compacto, setCompacto] = useState(false);

  useEffect(() => {
    function onScroll() {
      setCompacto(window.scrollY > 96);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const d = ate.split("-");
  const ateLabel = d.length === 3 ? `${d[2]}/${d[1]}` : "";
  const vencidoTotal = vencidoPagar + vencidoReceber;

  const cards: {
    label: string;
    valor: number;
    sub: string;
    subTom?: "soft" | "danger";
    tom: "ink" | "brand";
    destaque?: boolean;
  }[] = [
    { label: "Saldo atual", valor: saldoAtual, sub: `Previsto até ${ateLabel}: ${brl(previsto)}`, tom: "ink", destaque: true },
    // "no período" fazia o cartão de Despesas mostrar R$ 0,00 ao lado de
    // "A pagar (mês) R$ 40.801,90" e parecer que a empresa não tem despesa. Os
    // dois números são verdadeiros e falam de coisas diferentes: um é o que
    // **saiu**, o outro é o que **vai sair**.
    { label: "Recebidos", valor: recebidos, sub: "recebidas no período", tom: "brand" },
    { label: "Despesas", valor: despesas, sub: "pagas no período", tom: "ink" },
    {
      label: "A pagar (mês)",
      valor: aPagar,
      sub: vencidoPagar > 0 ? `Vencido: ${brl(vencidoPagar)}` : "nada vencido",
      subTom: vencidoPagar > 0 ? "danger" : "soft",
      tom: "ink",
    },
    {
      label: "A receber (mês)",
      valor: aReceber,
      sub: vencidoReceber > 0 ? `Vencido: ${brl(vencidoReceber)}` : "nada vencido",
      subTom: vencidoReceber > 0 ? "danger" : "soft",
      tom: "brand",
    },
  ];

  /*
    Faixa, não cartões.

    Eram cinco cartões de 90px em cima da tela. Depois que o cartão de "o que
    fazer agora" entrou, o painel passou de 1439px para 2036px de altura, e a
    primeira coisa que alguém vê de manhã deixou de caber na primeira dobra.

    Os cinco números continuam todos aqui — nenhum saiu. O que mudou é que eles
    ocupam uma linha em vez de uma faixa de cartões, e o **Saldo atual** fica num
    corpo maior que os outros quatro, porque ele não vale o mesmo que eles: é o
    número que responde "tenho dinheiro?". Uma faixa plana, com os cinco do mesmo
    tamanho, seria trocar um problema por outro.

    A versão condensada da rolagem continua existindo — só ficou menor a
    distância entre as duas.
  */
  return (
    <div className="sticky top-[52px] z-10 -mx-5 bg-surface/95 px-5 pb-2 pt-1 backdrop-blur">
      <div
        className={`num flex flex-wrap items-center gap-x-5 gap-y-1 overflow-hidden text-[13px] text-ink-muted transition-all ${
          compacto ? "max-h-10 py-1.5 opacity-100" : "max-h-0 py-0 opacity-0"
        }`}
      >
        <span>
          Saldo <b className="font-extrabold text-ink">{brl(saldoAtual)}</b>
        </span>
        <span>
          A pagar <b className="font-extrabold text-ink">{brl(aPagar)}</b>
        </span>
        <span>
          A receber <b className="font-extrabold text-brand-dark">{brl(aReceber)}</b>
        </span>
        {vencidoTotal > 0 && (
          <span className="text-danger">
            Vencido <b className="font-extrabold">{brl(vencidoTotal)}</b>
          </span>
        )}
      </div>

      <div
        className={`overflow-hidden transition-all ${compacto ? "max-h-0 opacity-0" : "max-h-32 opacity-100"}`}
      >
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-xl2 bg-white px-5 py-3.5 shadow-card">
          {cards.map((c) => (
            <div key={c.label} className={c.destaque ? "min-w-[190px]" : "min-w-[150px]"}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{c.label}</p>
              <p
                className={[
                  "num font-extrabold leading-tight",
                  c.destaque ? "text-[26px]" : "text-lg",
                  c.tom === "brand" ? "text-brand-dark" : "text-ink",
                ].join(" ")}
              >
                {brl(c.valor)}
              </p>
              <p
                className={`num text-[11px] leading-tight ${
                  c.subTom === "danger" ? "font-semibold text-danger" : "text-ink-soft"
                }`}
              >
                {c.sub}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
