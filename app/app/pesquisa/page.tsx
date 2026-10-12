import Link from "next/link";
import { Header } from "@/components/Header";
import { IntradayChart, IntradayPoint } from "@/components/IntradayChart";
import {
  cityName,
  formatBRL,
  formatCollected,
  formatLocalTime,
  getObservations,
  getRoutes,
  Observation,
  routeCode,
} from "@/lib/data";

export const dynamic = "force-dynamic";

const TRIP_LABEL: Record<string, string> = {
  "one-way": "só ida",
  "round-trip": "ida e volta",
};

function formatDuration(min: number | null | undefined) {
  if (min === null || min === undefined) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}m`;
}

function brtLabel(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  searchParams: Promise<{ rota?: string; data?: string; trip?: string }>;
};

export default async function PesquisaPage({ searchParams }: Props) {
  const params = await searchParams;
  const routes = await getRoutes();

  const route =
    routes.find((r) => routeCode(r) === params.rota) ??
    routes.find((r) => routeCode(r) === "GRU-BOG") ??
    routes[0];

  const trip = params.trip === "round-trip" ? "round-trip" : "one-way";

  const obs = route
    ? (await getObservations(route.id)).filter((o) => o.trip_type === trip)
    : [];

  // ---- datas de voo observadas (uma linha por flight_date) ----
  const byDate = new Map<string, Observation[]>();
  for (const o of obs) {
    const list = byDate.get(o.flight_date) ?? [];
    list.push(o);
    byDate.set(o.flight_date, list);
  }
  const dates = [...byDate.entries()]
    .map(([flight_date, list]) => {
      const runs = new Map<string, Observation[]>();
      for (const o of list) {
        const rs = runs.get(o.collected_at) ?? [];
        rs.push(o);
        runs.set(o.collected_at, rs);
      }
      const runMin = [...runs.entries()]
        .map(([at, rs]) => ({ at, min: Math.min(...rs.map((r) => r.price_brl)) }))
        .sort((a, b) => a.at.localeCompare(b.at));
      const prices = runMin.map((r) => r.min);
      return {
        flight_date,
        runs: runMin.length,
        min: Math.min(...prices),
        max: Math.max(...prices),
        last: runMin.at(-1)!.min,
        lastAt: runMin.at(-1)!.at,
        nOptions: list.length,
      };
    })
    .sort((a, b) => a.flight_date.localeCompare(b.flight_date));

  const selectedDate =
    params.data && byDate.has(params.data)
      ? params.data
      : dates.reduce((a, b) => (b.runs > a.runs ? b : a), dates[0] ?? { runs: -1, flight_date: "" })
          .flight_date || null;

  // ---- serie hora a hora da data selecionada ----
  const dayObs = selectedDate
    ? obs.filter((o) => o.flight_date === selectedDate)
    : [];
  const runGroups = new Map<string, Observation[]>();
  for (const o of dayObs) {
    const rs = runGroups.get(o.collected_at) ?? [];
    rs.push(o);
    runGroups.set(o.collected_at, rs);
  }
  const series = [...runGroups.entries()]
    .map(([at, rs]) => ({
      at,
      label: brtLabel(at),
      preco: Math.min(...rs.map((r) => r.price_brl)),
      opcoes: rs.length,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
  const chartData: IntradayPoint[] = series.map((s) => ({
    label: s.label,
    preco: s.preco,
    opcoes: s.opcoes,
  }));

  // ---- todos os voos do trecho na data (dedup por voo+partida) ----
  const byFlight = new Map<string, Observation[]>();
  for (const o of dayObs) {
    const key = `${o.flight_number ?? o.airline}|${o.departure ?? ""}|${o.stops ?? 0}`;
    const rs = byFlight.get(key) ?? [];
    rs.push(o);
    byFlight.set(key, rs);
  }
  const flights = [...byFlight.values()]
    .map((rs) => {
      const sorted = rs.sort((a, b) => a.collected_at.localeCompare(b.collected_at));
      const latest = sorted.at(-1)!;
      const prices = sorted.map((r) => r.price_brl);
      return {
        latest,
        n: sorted.length,
        min: Math.min(...prices),
        max: Math.max(...prices),
        first: sorted[0].price_brl,
      };
    })
    .sort((a, b) => {
      const da = a.latest.departure ?? "9999";
      const db = b.latest.departure ?? "9999";
      return da.localeCompare(db);
    });

  const collectTimes = new Set(obs.map((o) => o.collected_at));
  const airlines = new Set(obs.map((o) => o.airline));
  const code = route ? routeCode(route) : "";

  const input =
    "h-11 rounded-lg border border-borda-forte bg-card px-3 text-sm text-tinta";

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F4F4F1] px-4 pb-24 pt-6 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="space-y-1">
            <h1 className="font-disp text-2xl font-bold text-[#111318]">
              Pesquisa — o que está guardado no banco
            </h1>
            <p className="text-sm text-[#111318]/70">
              Cada busca do coletor grava todas as opções retornadas. Aqui dá para
              ver o preço praticado em cada coleta — hora a hora e dia a dia — e
              todos os voos que atendem o trecho.
            </p>
          </div>

          {/* filtros */}
          <form
            method="get"
            className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#111318]/10 bg-white p-4 shadow-sm"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-[#111318]/80">Trecho</span>
              <select name="rota" defaultValue={code} className={input}>
                {routes.map((r) => (
                  <option key={r.id} value={routeCode(r)}>
                    {routeCode(r)} — {cityName(r.origin)} → {cityName(r.destination)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-[#111318]/80">Viagem</span>
              <select name="trip" defaultValue={trip} className={input}>
                <option value="one-way">só ida</option>
                <option value="round-trip">ida e volta</option>
              </select>
            </label>
            {selectedDate && (
              <input type="hidden" name="data" value={selectedDate} />
            )}
            <button
              type="submit"
              className="h-11 rounded-lg bg-tinta px-5 text-sm font-semibold text-white"
            >
              Aplicar
            </button>
          </form>

          {route ? (
            <>
              {/* resumo do que esta guardado */}
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { k: "Opções registradas", v: String(obs.length) },
                  { k: "Coletas (momentos)", v: String(collectTimes.size) },
                  {
                    k: "Datas de voo observadas",
                    v: String(dates.length),
                  },
                  { k: "Companhias", v: String(airlines.size) },
                ].map((c) => (
                  <div
                    key={c.k}
                    className="rounded-2xl border border-[#111318]/10 bg-white p-4 shadow-sm"
                  >
                    <div className="font-mono text-2xl font-semibold text-[#111318]">
                      {c.v}
                    </div>
                    <div className="mt-1 text-xs text-[#111318]/60">{c.k}</div>
                  </div>
                ))}
              </section>

              {/* variacao hora a hora */}
              {selectedDate && (
                <section className="rounded-2xl border border-[#111318]/10 bg-white p-4 shadow-sm md:p-6">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-disp text-lg font-semibold text-[#111318]">
                      Menor preço em cada coleta · voo de {selectedDate}
                    </h2>
                    <span className="text-xs text-[#111318]/60">
                      {TRIP_LABEL[trip]} · horário de Brasília
                    </span>
                  </div>
                  <p className="mb-4 text-sm text-[#111318]/70">
                    Mostra se o preço mexe durante o dia ou se mantém estável
                    entre coletas.
                  </p>
                  {chartData.length > 1 ? (
                    <IntradayChart data={chartData} />
                  ) : (
                    <p className="text-sm text-[#111318]/60">
                      Só há {chartData.length} coleta para esta data — a variação
                      aparece conforme o coletor roda.
                    </p>
                  )}

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#111318]/10 text-[#111318]/60">
                          <th className="pb-2 font-medium">Coletado</th>
                          <th className="pb-2 text-right font-medium">Opções</th>
                          <th className="pb-2 text-right font-medium">Menor preço</th>
                          <th className="pb-2 text-right font-medium">Δ anterior</th>
                          <th className="pb-2 text-right font-medium">Δ 1ª coleta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {series
                          .slice()
                          .reverse()
                          .map((s, i, arr) => {
                            const prev = arr[i + 1];
                            const dPrev = prev ? s.preco - prev.preco : null;
                            const dFirst = s.preco - series[0].preco;
                            return (
                              <tr
                                key={s.at}
                                className="border-b border-[#111318]/5 last:border-0"
                              >
                                <td className="py-2 font-mono text-xs">
                                  {formatCollected(s.at)}
                                </td>
                                <td className="py-2 text-right font-mono">{s.opcoes}</td>
                                <td className="py-2 text-right font-mono font-medium text-[#111318]">
                                  {formatBRL(s.preco)}
                                </td>
                                <td className="py-2 text-right font-mono text-xs">
                                  {dPrev === null
                                    ? "—"
                                    : dPrev === 0
                                      ? "0"
                                      : `${dPrev > 0 ? "+" : "−"}${formatBRL(Math.abs(dPrev)).replace("R$", "R$ ")}`}
                                </td>
                                <td className="py-2 text-right font-mono text-xs">
                                  {dFirst === 0
                                    ? "—"
                                    : `${dFirst > 0 ? "+" : "−"}${formatBRL(Math.abs(dFirst)).replace("R$", "R$ ")}`}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* todos os voos do trecho na data */}
              {selectedDate && (
                <section className="rounded-2xl border border-[#111318]/10 bg-white p-4 shadow-sm md:p-6">
                  <h2 className="font-disp text-lg font-semibold text-[#111318]">
                    Todos os voos · {code} em {selectedDate}
                  </h2>
                  <p className="mb-4 mt-1 text-sm text-[#111318]/70">
                    Uma linha por voo. “Preço atual” é o da coleta mais recente;
                    mín/máx é a amplitude já observada para aquele voo.
                  </p>
                  {flights.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#111318]/10 text-[#111318]/60">
                            <th className="pb-2 font-medium">Voo</th>
                            <th className="pb-2 font-medium">Companhia</th>
                            <th className="pb-2 font-medium">Partida → Chegada</th>
                            <th className="pb-2 text-right font-medium">Duração</th>
                            <th className="pb-2 text-right font-medium">Escalas</th>
                            <th className="pb-2 text-right font-medium">Preço atual</th>
                            <th className="pb-2 text-right font-medium">Mín–máx visto</th>
                            <th className="pb-2 text-right font-medium">Obs.</th>
                            <th className="pb-2 font-medium">Última coleta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {flights.map((f, i) => (
                            <tr
                              key={i}
                              className="border-b border-[#111318]/5 last:border-0"
                            >
                              <td className="py-2 font-mono text-xs">
                                {f.latest.flight_number ?? "—"}
                                {f.latest.plane_type && (
                                  <div className="text-[10px] text-[#111318]/50">
                                    {f.latest.plane_type}
                                  </div>
                                )}
                              </td>
                              <td className="py-2">{f.latest.airline}</td>
                              <td className="py-2 font-mono">
                                {formatLocalTime(f.latest.departure)} →{" "}
                                {formatLocalTime(f.latest.arrival)}
                              </td>
                              <td className="py-2 text-right font-mono">
                                {formatDuration(f.latest.duration_min)}
                              </td>
                              <td className="py-2 text-right font-mono">
                                {f.latest.stops ?? 0}
                              </td>
                              <td className="py-2 text-right font-mono font-medium text-[#111318]">
                                {formatBRL(f.latest.price_brl)}
                              </td>
                              <td className="py-2 text-right font-mono text-xs">
                                {f.min === f.max
                                  ? formatBRL(f.min)
                                  : `${formatBRL(f.min)} – ${formatBRL(f.max)}`}
                              </td>
                              <td className="py-2 text-right font-mono">{f.n}</td>
                              <td className="py-2 font-mono text-xs text-[#111318]/70">
                                {formatCollected(f.latest.collected_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-[#111318]/60">
                      Nenhuma opção registrada para esta data.
                    </p>
                  )}
                </section>
              )}

              {/* datas de voo observadas */}
              <section className="rounded-2xl border border-[#111318]/10 bg-white p-4 shadow-sm md:p-6">
                <h2 className="font-disp text-lg font-semibold text-[#111318]">
                  Datas de voo observadas ({dates.length})
                </h2>
                <p className="mb-4 mt-1 text-sm text-[#111318]/70">
                  Clique numa data para ver a variação hora a hora e os voos
                  daquele dia.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#111318]/10 text-[#111318]/60">
                        <th className="pb-2 font-medium">Data do voo</th>
                        <th className="pb-2 text-right font-medium">Coletas</th>
                        <th className="pb-2 text-right font-medium">Menor</th>
                        <th className="pb-2 text-right font-medium">Maior</th>
                        <th className="pb-2 text-right font-medium">Último</th>
                        <th className="pb-2 font-medium">Última coleta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dates.map((d) => (
                        <tr
                          key={d.flight_date}
                          className={`border-b border-[#111318]/5 last:border-0 ${
                            d.flight_date === selectedDate ? "bg-grade" : ""
                          }`}
                        >
                          <td className="py-2 font-mono">
                            <Link
                              href={`/pesquisa?rota=${code}&trip=${trip}&data=${d.flight_date}`}
                              className="font-semibold text-link hover:text-link-hover"
                            >
                              {d.flight_date}
                            </Link>
                          </td>
                          <td className="py-2 text-right font-mono">{d.runs}</td>
                          <td className="py-2 text-right font-mono text-destaque-texto">
                            {formatBRL(d.min)}
                          </td>
                          <td className="py-2 text-right font-mono">
                            {formatBRL(d.max)}
                          </td>
                          <td className="py-2 text-right font-mono font-medium text-[#111318]">
                            {formatBRL(d.last)}
                          </td>
                          <td className="py-2 font-mono text-xs text-[#111318]/70">
                            {formatCollected(d.lastAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <p className="rounded-2xl border border-[#111318]/10 bg-white p-6 text-sm text-[#111318]/70 shadow-sm">
              Nenhuma rota cadastrada.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
