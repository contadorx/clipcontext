"use client";

import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { PontoFluxo } from "@/lib/painel";
import Card from "@/components/ui/card";
import Link from "next/link";
import { brl, brlCurto } from "@/lib/formato";

function ddmm(s: string): string {
  const [, m, d] = s.split("-");
  return `${d}/${m}`;
}

/**
 * A curva de caixa, com o futuro marcado como futuro.
 *
 * O cartão sempre se chamou "saldo projetado no período" e desenhava só o
 * realizado — reto a partir de hoje, porque nada mais tinha sido pago. Quem
 * olhava via tranquilidade justamente no trecho em que o caixa pode furar.
 *
 * Agora a série traz `projetado`, e o desenho diz de que lado da linha cada
 * ponto está: contínuo no que aconteceu, tracejado no que é aposta. Uma linha
 * vertical marca hoje. Projeção desenhada igual ao realizado é projeção
 * vendida como fato.
 */
export default function FluxoChart({ serie, verHref }: { serie: PontoFluxo[]; verHref?: string }) {
  const temDados = serie.some((p) => p.saldo !== 0);
  const hoje = serie.find((p) => p.projetado)?.data ?? null;
  // duas séries no mesmo eixo: a realizada para antes de hoje, a projetada para
  // depois. O ponto de hoje entra nas duas, senão a linha aparece partida.
  const dados = serie.map((p) => ({
    ...p,
    realizado: p.projetado && p.data !== hoje ? null : p.saldo,
    projecao: p.projetado ? p.saldo : null,
  }));
  const furou = serie.some((p) => p.saldo < 0);

  return (
    <Card titulo="Fluxo de caixa" sub="saldo projetado no período" acao={verHref ? "Projeção" : undefined} acaoHref={verHref}>
      <div className="h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-saldo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#12A594" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#12A594" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F4" vertical={false} />
            <XAxis
              dataKey="data"
              tickFormatter={ddmm}
              tick={{ fontSize: 10, fill: "#94A3B8" }}
              interval="preserveStartEnd"
              minTickGap={36}
              axisLine={{ stroke: "#E6EAEE" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={brlCurto}
              tick={{ fontSize: 10, fill: "#94A3B8" }}
              width={52}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v: number | string) => [brl(Number(v)), "Saldo"]}
              labelFormatter={(l) => ddmm(String(l))}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #E6EAEE",
                fontSize: 12,
              }}
            />
            {/* zero: sem esta linha, um saldo negativo some no fundo do gráfico */}
            <ReferenceLine y={0} stroke={furou ? "#E11D48" : "#CBD5E1"} strokeWidth={furou ? 1.5 : 1} />
            {hoje && (
              <ReferenceLine
                x={hoje}
                stroke="#94A3B8"
                strokeDasharray="4 4"
                label={{ value: "hoje", position: "top", fontSize: 10, fill: "#94A3B8" }}
              />
            )}
            <Area
              type="monotone"
              dataKey="realizado"
              name="Realizado"
              stroke="#12A594"
              strokeWidth={2}
              fill="url(#grad-saldo)"
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="projecao"
              name="Projeção"
              stroke="#12A594"
              strokeWidth={2}
              strokeDasharray="5 4"
              fill="url(#grad-saldo)"
              fillOpacity={0.35}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-ink-soft">
        Linha cheia é o que já foi pago; tracejada é projeção, pelo vencimento do que
        está em aberto. Vencidos não entram — eles estão em “O que fazer agora”.
      </p>
      {!temDados && (
        <p className="mt-1 text-center text-[11px] text-ink-soft">
          Sem movimentos pagos no período — a linha mostra o saldo inicial.
        </p>
      )}
    </Card>
  );
}
