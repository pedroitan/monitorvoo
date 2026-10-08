"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AIRLINE_COLORS, formatBRL } from "@/lib/data";

const FALLBACK = [
  "#8A9BB4",
  "#C2841A",
  "#5B7AA0",
  "#7C6BAE",
  "#4E8C7B",
  "#B26E63",
];

export type ChartPoint = { time: string; [airline: string]: number | string };

export function PriceChart({
  data,
  airlines,
  band,
  promoRanges = [],
}: {
  data: ChartPoint[];
  airlines: string[];
  /** Faixa normal p25–p75 (sombreia o grafico). */
  band?: { low: number; high: number };
  /** Periodos de promocao detectados: { from, to } em "AAAA-MM-DD". */
  promoRanges?: { from: string; to: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="#EEF0F3" vertical={false} />
        {promoRanges.map((r, i) => (
          <ReferenceArea
            key={i}
            x1={r.from}
            x2={r.to}
            fill="#FBE3D4"
            fillOpacity={1}
            strokeOpacity={0}
          />
        ))}
        {band && (
          <ReferenceArea
            y1={band.low}
            y2={band.high}
            fill="#DCE5F5"
            fillOpacity={0.8}
            strokeOpacity={0}
          />
        )}
        <XAxis
          dataKey="time"
          stroke="#556274"
          fontSize={12}
          fontFamily="var(--font-plex-mono), monospace"
          tickFormatter={(v: string) => v.slice(5, 10).split("-").reverse().join("/")}
          tickLine={false}
          axisLine={{ stroke: "#C7CDD6" }}
        />
        <YAxis
          stroke="#556274"
          fontSize={12}
          fontFamily="var(--font-plex-mono), monospace"
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
          labelStyle={{ color: "#556274" }}
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
            name={airline}
            stroke={AIRLINE_COLORS[airline] ?? FALLBACK[i % FALLBACK.length]}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
