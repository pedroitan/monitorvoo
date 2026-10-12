"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/data";

export type IntradayPoint = {
  /** Rotulo do eixo X: "dd/mm HH:mm" em horario de Brasilia. */
  label: string;
  preco: number;
  opcoes: number;
};

/** Menor preco por momento de coleta — mostra a variacao hora a hora. */
export function IntradayChart({ data }: { data: IntradayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="#EDECE7" vertical={false} />
        <XAxis
          dataKey="label"
          stroke="#5B616E"
          fontSize={11}
          fontFamily="var(--font-geist-mono), monospace"
          minTickGap={48}
          tickLine={false}
          axisLine={{ stroke: "#D5D5CF" }}
        />
        <YAxis
          stroke="#5B616E"
          fontSize={12}
          fontFamily="var(--font-geist-mono), monospace"
          tickFormatter={(v: number) =>
            v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`
          }
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid #E1E4E8",
            borderRadius: 10,
            fontSize: 14,
          }}
          labelStyle={{ color: "#5B616E" }}
          formatter={(value, name) =>
            name === "preco" ? [formatBRL(value as number), "Menor preço"] : [value, "Opções"]
          }
        />
        <Line
          type="monotone"
          dataKey="preco"
          name="preco"
          stroke="#2B4BF2"
          strokeWidth={2.5}
          dot={{ r: 2.5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
