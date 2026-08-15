"use client";
import { brl, brlCurto } from "@/lib/formato";

import {
  Bar,
  Line,
  ComposedChart,
  Area,
  AreaChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export type PontoEvolucao = {
  label: string;
  receitas: number;
  despesas: number;
  resultado: number;
  saldo: number;
};

export default function EvolucaoAnalise({ dados, ano }: { dados: PontoEvolucao[]; ano: number }) {
  const temDados = dados.some((d) => d.receitas !== 0 || d.despesas !== 0 || d.saldo !== 0);

  if (!temDados)
    return (
      <section className="space-y-3">
        <h2 className="text-[13px] font-bold text-ink">Evolução em {ano}</h2>
        <div className="rounded-xl2 border border-dashed border-line bg-white py-12 text-center text-sm text-ink-muted">
          Sem movimentos suficientes para montar a evolução do ano.
        </div>
      </section>
    );

  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-bold text-ink">Evolução em {ano}</h2>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Receitas x Despesas + Resultado */}
        <div className="rounded-xl2 bg-white p-4 shadow-card">
          <h3 className="mb-3 text-xs font-semibold text-ink-muted">
            Receitas × Despesas e resultado (competência)
          </h3>
          <div className="h-[240px] w-full">
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
                  formatter={(v: number | string) => brl(Number(v))}
                  contentStyle={{ borderRadius: 10, border: "1px solid #E6EAEE", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receitas" name="Receitas" fill="#12A594" radius={[3, 3, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#64748B" radius={[3, 3, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="resultado"
                  name="Resultado"
                  stroke="#1B2A4A"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Saldo de caixa */}
        <div className="rounded-xl2 bg-white p-4 shadow-card">
          <h3 className="mb-3 text-xs font-semibold text-ink-muted">Saldo de caixa no fim do mês (realizado)</h3>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-saldo-evo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#12A594" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#12A594" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  formatter={(v: number | string) => [brl(Number(v)), "Saldo"]}
                  contentStyle={{ borderRadius: 10, border: "1px solid #E6EAEE", fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  name="Saldo"
                  stroke="#12A594"
                  strokeWidth={2}
                  fill="url(#grad-saldo-evo)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-ink-soft">
        Receitas, despesas e resultado pela data de competência; saldo de caixa pela data de pagamento. O resultado
        é a linha (receitas − despesas); o saldo é acumulado ao longo do ano.
      </p>
    </section>
  );
}
