"use client";

import {
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import Card from "@/components/ui/card";
import type { ResultadoMes } from "@/lib/painel";
import { brl, brlCurto } from "@/lib/formato";

/**
 * Entradas, saídas e o resultado, num gráfico só.
 *
 * Eram dois lado a lado, e o segundo era a subtração do primeiro: 300px para
 * dizer o que já estava dito. Agora o resultado é uma linha sobre as barras —
 * fica onde se pode compará-lo com o que o produziu, em vez de num gráfico
 * separado que exige olhar duas vezes.
 *
 * A linha muda de cor quando o mês fecha no vermelho, porque aí é problema.
 */
export default function ResultadoMensal({ dados }: { dados: ResultadoMes[] }) {
  const temDados = dados.some((d) => d.entradas !== 0 || d.saidas !== 0);
  const pior = dados.reduce<ResultadoMes | null>(
    (m, d) => (d.resultado < 0 && (!m || d.resultado < m.resultado) ? d : m),
    null,
  );

  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-bold text-ink">Resultado mensal</h2>

      <Card
        titulo="Entradas, saídas e resultado"
        sub="últimos 6 meses"
        rodape={
          pior ? (
            <span className="text-[12px] text-ink-muted">
              Pior mês do período: <b className="text-danger">{pior.label}</b>, com{" "}
              <span className="num font-semibold text-danger">{brl(pior.resultado)}</span>.
            </span>
          ) : temDados ? (
            <span className="text-[12px] text-ink-muted">Nenhum mês fechou negativo no período.</span>
          ) : undefined
        }
      >
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
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
                formatter={(v: number | string, nome) => [brl(Number(v)), String(nome)]}
                contentStyle={{ borderRadius: 10, border: "1px solid #E6EAEE", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#CBD5E1" />
              <Bar dataKey="entradas" name="Entradas" fill="#12A594" radius={[3, 3, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#64748B" radius={[3, 3, 0, 0]} />
              <Line
                type="monotone"
                dataKey="resultado"
                name="Resultado"
                stroke="#1F2A33"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, index, payload } = props as unknown as {
                    cx: number; cy: number; index: number; payload: ResultadoMes;
                  };
                  const negativo = payload.resultado < 0;
                  return (
                    <circle
                      key={index}
                      cx={cx}
                      cy={cy}
                      r={negativo ? 4.5 : 3}
                      fill={negativo ? "#E11D48" : "#1F2A33"}
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {!temDados && (
        <p className="text-center text-[11px] text-ink-soft">
          Ainda sem movimentos pagos para montar o histórico mensal.
        </p>
      )}
    </section>
  );
}
