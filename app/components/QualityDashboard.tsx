"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Link from "next/link";
import { Header } from "./Header";
import { cityName, formatBRL, formatDay } from "@/lib/data";
import type { QualityStats } from "@/lib/data";

export function QualityDashboard({ q }: { q: QualityStats }) {
  const last14 = q.dailyVolume.slice(-14);
  const topAirlines = q.airlineCounts.slice(0, 12);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F2F3F0] px-4 pb-24 pt-6 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-[#0E1A2B]">
              Qualidade dos dados
            </h1>
            <p className="text-sm text-[#0E1A2B]/70">
              Visão interna das coletas: volume, cobertura, gaps e distribuição.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card label="Observações" value={q.totalObservations.toLocaleString("pt-BR")} />
            <Card label="Rotas ativas" value={q.activeRoutes.toString()} />
            <Card label="Rotas com dados" value={q.routesWithData.toString()} />
            <Card label="Dias de coleta" value={q.collectionDays.toString()} />
            <Card label="Companhias distintas" value={q.airlines.toString()} />
            <Card
              label="Rotas sem dados"
              value={q.routesWithoutData.length.toString()}
              variant={q.routesWithoutData.length > 0 ? "warn" : "ok"}
            />
            <Card
              label="Cobertura"
              value={`${Math.round((q.routesWithData / Math.max(1, q.activeRoutes)) * 100)}%`}
            />
            <Card label="Volume médio/dia" value={Math.round(q.totalObservations / Math.max(1, q.collectionDays)).toLocaleString("pt-BR")} />
          </div>

          <section className="rounded-2xl border border-[#0E1A2B]/10 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-display text-lg font-semibold text-[#0E1A2B]">
              Volume de coleta por dia
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last14}>
                  <CartesianGrid stroke="#E5E7EB" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(v) => formatDay(v)}
                    tick={{ fill: "#0E1A2B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#0E1A2B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    formatter={(v) => [Number(v).toLocaleString("pt-BR"), "observações"]}
                    labelFormatter={(l) => formatDay(String(l))}
                  />
                  <Bar dataKey="count" fill="#2457C5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl border border-[#0E1A2B]/10 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-display text-lg font-semibold text-[#0E1A2B]">
              Observações por companhia
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topAirlines} layout="vertical">
                  <CartesianGrid stroke="#E5E7EB" horizontal={true} vertical={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "#0E1A2B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="airline"
                    width={110}
                    tick={{ fill: "#0E1A2B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    formatter={(v) => [Number(v).toLocaleString("pt-BR"), "observações"]}
                  />
                  <Bar dataKey="count" fill="#0B7A6C" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl border border-[#0E1A2B]/10 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-display text-lg font-semibold text-[#0E1A2B]">
              Cobertura por rota
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#0E1A2B]/10 text-[#0E1A2B]/60">
                    <th className="pb-2 font-medium">Rota</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium text-right">Obs</th>
                    <th className="pb-2 font-medium text-right">Dias</th>
                    <th className="pb-2 font-medium">Cias</th>
                    <th className="pb-2 font-medium">Leads</th>
                    <th className="pb-2 font-medium text-right">Menor</th>
                    <th className="pb-2 font-medium text-right">Mediana</th>
                    <th className="pb-2 font-medium text-right">Maior</th>
                    <th className="pb-2 font-medium">Última coleta</th>
                  </tr>
                </thead>
                <tbody className="text-[#0E1A2B]">
                  {q.routes.map((r) => (
                    <tr key={r.routeId} className="border-b border-[#0E1A2B]/5 last:border-0">
                      <td className="py-2 font-medium">
                        <Link
                          href={`/rota/${r.code}`}
                          className="text-[#2457C5] hover:underline"
                        >
                          {r.code}
                        </Link>
                        <div className="text-xs text-[#0E1A2B]/60">
                          {cityName(r.origin)} → {cityName(r.destination)}
                        </div>
                      </td>
                      <td className="py-2 capitalize">{r.kind}</td>
                      <td className="py-2 text-right font-mono">{r.total}</td>
                      <td className="py-2 text-right font-mono">{r.days}</td>
                      <td className="py-2 text-xs">{r.airlines.join(", ")}</td>
                      <td className="py-2 text-xs">{r.leads.sort((a, b) => a - b).join(", ")}</td>
                      <td className="py-2 text-right font-mono">{formatBRL(r.min)}</td>
                      <td className="py-2 text-right font-mono">{formatBRL(r.median)}</td>
                      <td className="py-2 text-right font-mono">{formatBRL(r.max)}</td>
                      <td className="py-2 text-xs">
                        {r.last ? new Date(r.last).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {q.routesWithoutData.length > 0 && (
            <section className="rounded-2xl border border-[#D9581C]/30 bg-[#FBE3D4] p-4">
              <h2 className="mb-2 font-display text-lg font-semibold text-[#B5410F]">
                Rotas sem observações ({q.routesWithoutData.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {q.routesWithoutData.map((r) => (
                  <span
                    key={r.id}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#0E1A2B] shadow-sm"
                  >
                    {r.origin}-{r.destination}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-[#0E1A2B]/10 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-display text-lg font-semibold text-[#0E1A2B]">
              Cobertura por antecedência e tipo de viagem
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#0E1A2B]/10 text-[#0E1A2B]/60">
                    <th className="pb-2 font-medium">Antecedência</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium text-right">Observações</th>
                  </tr>
                </thead>
                <tbody className="text-[#0E1A2B]">
                  {q.leadTripCounts.map((lt) => (
                    <tr key={`${lt.lead}-${lt.trip}`} className="border-b border-[#0E1A2B]/5 last:border-0">
                      <td className="py-2 font-mono">{lt.lead} dias</td>
                      <td className="py-2 capitalize">{lt.trip === "one-way" ? "só ida" : "ida e volta"}</td>
                      <td className="py-2 text-right font-mono">{lt.count.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function Card({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "warn" | "ok";
}) {
  const tone =
    variant === "warn"
      ? "bg-[#FBE3D4] text-[#B5410F]"
      : variant === "ok"
      ? "bg-[#E8F5E9] text-[#2E7D32]"
      : "bg-white text-[#0E1A2B]";
  return (
    <div className={`rounded-2xl border border-[#0E1A2B]/10 p-4 shadow-sm ${tone}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
