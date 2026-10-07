"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/data";

const AIRLINE_COLORS: Record<string, string> = {
  Gol: "#FF7020",
  LATAM: "#E8114B",
  Azul: "#00A0E4",
  "Tap Air Portugal": "#046A38",
  "Air France": "#002157",
  "Air Europa": "#0074D9",
  Iberia: "#D71920",
  American: "#0078D2",
  United: "#002244",
  Avianca: "#DA291C",
  COPA: "#0060A9",
  Aeromexico: "#00263A",
  "Aerolineas Argentinas": "#75AADB",
  KLM: "#00A1DE",
  SWISS: "#D81920",
  "Turkish Airlines": "#E81932",
  ITA: "#0066CC",
  "Air Canada": "#F01428",
};

const FALLBACK = [
  "#8B5CF6",
  "#14B8A6",
  "#F59E0B",
  "#EF4444",
  "#6366F1",
  "#84CC16",
  "#EC4899",
];

export type ChartPoint = { time: string; [airline: string]: number | string };

export function PriceChart({
  data,
  airlines,
}: {
  data: ChartPoint[];
  airlines: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={380}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
        <XAxis
          dataKey="time"
          stroke="#888"
          fontSize={12}
          tickFormatter={(v: string) => v.slice(5, 10)}
        />
        <YAxis
          stroke="#888"
          fontSize={12}
          tickFormatter={(v: number) => `R$${(v / 1000).toFixed(1)}k`}
          domain={["dataMin", "dataMax"]}
        />
        <Tooltip
          contentStyle={{ background: "#111", border: "1px solid #333" }}
          labelStyle={{ color: "#aaa" }}
          formatter={(value) =>
            typeof value === "number" ? formatBRL(value) : value
          }
        />
        <Legend />
        {airlines.map((airline, i) => (
          <Line
            key={airline}
            type="monotone"
            dataKey={airline}
            stroke={AIRLINE_COLORS[airline] ?? FALLBACK[i % FALLBACK.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
