"use client";
import { brlCurto, brlRedondo } from "@/lib/formato";

import {
  Bar,
  Line,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export type PontoPortal = {
  label: string;
  entradas: number;
  saidas: number;
  acumulado: number | null;
  previsto: number | null;
};


export default function PortalGrafico({
  dados,
  rotuloAcumulado,
  temPrevisto,
}: {
  dados: PontoPortal[];
  rotuloAcumulado: string;
  temPrevisto: boolean;
}) {
  return (
    <div className="rounded-xl2 bg-white p-3 shadow-card sm:p-4">
      <div className="h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 8, right: 6, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#94A3B8" }}
              axisLine={{ stroke: "#E6EAEE" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={brlCurto}
              tick={{ fontSize: 9, fill: "#94A3B8" }}
              width={46}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v: number | string, n: string) => [brlRedondo(Number(v)), n]}
              contentStyle={{ borderRadius: 10, border: "1px solid #E6EAEE", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="entradas" name="Entradas" fill="#12A594" radius={[3, 3, 0, 0]} />
            <Bar dataKey="saidas" name="Saídas" fill="#64748B" radius={[3, 3, 0, 0]} />
            <Line
              type="monotone"
              dataKey="acumulado"
              name={rotuloAcumulado}
              stroke="#1B2A4A"
              strokeWidth={2}
              dot={{ r: 2 }}
              connectNulls={false}
            />
            {temPrevisto && (
              <Line
                type="monotone"
                dataKey="previsto"
                name="Previsto"
                stroke="#94A3B8"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={{ r: 2 }}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
