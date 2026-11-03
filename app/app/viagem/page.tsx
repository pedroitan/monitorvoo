import {
  airlineShort,
  cityName,
  formatBRL,
  formatCollected,
  formatDay,
  formatLocalTime,
  getRunOptions,
  getTripRequests,
  getTripRuns,
  TripRun,
} from "@/lib/data";
import { Sparkline } from "@/components/Sparkline";

export const dynamic = "force-dynamic";

function seriesStats(runs: TripRun[]) {
  const pts = runs.filter((r) => r.status === "ok" && r.min_price !== null);
  if (!pts.length) return null;
  const prices = pts.map((p) => p.min_price!);
  const lo = Math.min(...prices);
  const loAt = pts[prices.indexOf(lo)].run_at;
  const first = pts[0].min_price!;
  const last = pts.at(-1)!.min_price!;
  const days = Math.max(
    0.5,
    (new Date(pts.at(-1)!.run_at).getTime() - new Date(pts[0].run_at).getTime()) / 86400000
  );
  return { pts, prices, lo, loAt, first, last, slopePerDay: (last - first) / days, aboveLo: last / lo - 1 };
}

function Verdict({ s, label }: { s: NonNullable<ReturnType<typeof seriesStats>>; label: string }) {
  const rising = s.slopePerDay > 5; // > R$5/dia de alta
  const falling = s.slopePerDay < -5;
  const cls = s.aboveLo <= 0.01 ? "border-[#9FD8B8] bg-[#E3F4EA] text-destaque-texto" : rising ? "border-[#F2B8B3] bg-[#FBE7E5] text-alto-texto" : "border-borda bg-grade text-texto";
  const txt =
    s.aboveLo <= 0.01
      ? `${label}: menor preço visto até agora.`
      : rising
        ? `${label}: subindo ~${formatBRL(Math.round(s.slopePerDay))}/dia — ${formatBRL(s.last)} está ${Math.round(s.aboveLo * 100)}% acima do mínimo (${formatBRL(s.lo)}).`
        : falling
          ? `${label}: caindo ~${formatBRL(Math.round(-s.slopePerDay))}/dia; ainda ${Math.round(s.aboveLo * 100)}% acima do mínimo visto.`
          : `${label}: estável, ${Math.round(s.aboveLo * 100)}% acima do mínimo visto.`;
  return <p className={`rounded-lg border px-3 py-2 text-sm font-medium ${cls}`}>{txt}</p>;
}

function SeriesCard({ s, title, sub }: { s: ReturnType<typeof seriesStats>; title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-borda p-4">
      <div className="text-[13px] font-semibold text-mut">
        {title} <span className="font-normal">{sub}</span>
      </div>
      {s ? (
        <>
          <div className="font-mono text-2xl font-semibold">{formatBRL(s.last)}</div>
          <Sparkline values={s.prices} height={44} />
          <div className="flex justify-between text-xs text-mut">
            <span>mín {formatBRL(s.lo)} · {formatCollected(s.loAt)}</span>
            <span>{s.pts.length} coletas</span>
          </div>
          <Verdict s={s} label={title} />
        </>
      ) : (
        <p className="text-sm text-mut">Ainda sem coleta dessa perna.</p>
      )}
    </div>
  );
}

const depHour = (d: string | null) => (d ? Number(d.slice(11, 13)) : null);

export default async function ViagemPage() {
  const reqs = await getTripRequests();
  const trips = await Promise.all(
    reqs.map(async (r) => {
      const outRuns = await getTripRuns(r.origin, r.destination, r.out_date);
      const backRuns = r.ret_date ? await getTripRuns(r.destination, r.origin, r.ret_date) : [];
      const rt = seriesStats(outRuns.filter((x) => x.trip_type === "round-trip"));
      const owOut = seriesStats(outRuns.filter((x) => x.trip_type === "one-way"));
      const owBack = seriesStats(backRuns.filter((x) => x.trip_type === "one-way"));
      const lastOutRun = [...outRuns].reverse().find((x) => x.trip_type === "one-way" && x.status === "ok");
      const outOptions = lastOutRun ? await getRunOptions(lastOutRun.id) : [];
      return { r, rt, owOut, owBack, outOptions };
    })
  );

  // cenarios: menor custo total por opcao de viagem
  const scenarios = trips.map(({ r, rt, owOut, owBack, outOptions }) => {
    const owOutMorning = outOptions.filter((o) => (depHour(o.departure) ?? 99) < 12);
    const outMorningMin = owOutMorning.length ? Math.min(...owOutMorning.map((o) => o.price_brl!)) : null;
    const twoOw = owOut && owBack ? owOut.last + owBack.last : null;
    const twoOwMorning = outMorningMin !== null && owBack ? outMorningMin + owBack.last : null;
    const best = Math.min(...[rt?.last, twoOw, twoOwMorning].filter((v): v is number => v !== null && v !== undefined));
    return { r, rtLast: rt?.last ?? null, twoOw, twoOwMorning, best };
  });
  const globalBest = Math.min(...scenarios.map((s) => s.best).filter((v) => v !== Infinity));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 pb-28 md:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-disp text-3xl font-bold md:text-4xl">Melhor momento de compra</h1>
        <p className="max-w-3xl text-texto">
          Acompanhamento de hora em hora das viagens pedidas. Nacional quase não tem desconto de ida e
          volta (≈2× a só ida), então comparamos os dois formatos — e, na ida, o preço saindo de manhã.
        </p>
      </div>

      {trips.length === 0 && (
        <p className="rounded-lg bg-grade p-3 text-sm text-mut">
          Nenhuma viagem em acompanhamento. Pedidos entram pela tabela <code>search_requests</code>.
        </p>
      )}

      {/* comparativo de cenarios */}
      {scenarios.length > 1 && (
        <section className="rounded-2xl border border-borda bg-card p-5 md:p-6">
          <h2 className="font-disp text-[22px] font-bold">Cenários</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-[13px] text-mut">
                  <th className="py-2 font-semibold">Viagem</th>
                  <th className="py-2 text-right font-semibold">Ida e volta</th>
                  <th className="py-2 text-right font-semibold">2 só ida</th>
                  <th className="py-2 text-right font-semibold">2 só ida (ida de manhã)</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr key={s.r.id} className="border-b border-grade">
                    <td className="py-2.5 font-semibold">
                      {s.r.origin} ⇄ {s.r.destination} · {formatDay(s.r.out_date)}
                      {s.r.ret_date ? ` → ${formatDay(s.r.ret_date)}` : ""}
                    </td>
                    <td className={`py-2.5 text-right font-mono ${s.rtLast === globalBest ? "font-semibold text-destaque-texto" : ""}`}>
                      {s.rtLast === null ? "—" : formatBRL(s.rtLast)}
                    </td>
                    <td className={`py-2.5 text-right font-mono ${s.twoOw === globalBest ? "font-semibold text-destaque-texto" : ""}`}>
                      {s.twoOw === null ? "—" : formatBRL(s.twoOw)}
                    </td>
                    <td className={`py-2.5 text-right font-mono ${s.twoOwMorning === globalBest ? "font-semibold text-destaque-texto" : ""}`}>
                      {s.twoOwMorning === null ? "—" : formatBRL(s.twoOwMorning)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* um card por viagem */}
      {trips.map(({ r, rt, owOut, owBack, outOptions }) => {
        const daysTo = Math.ceil((new Date(r.out_date + "T12:00:00Z").getTime() - Date.now()) / 86400000);
        const morning = outOptions.filter((o) => (depHour(o.departure) ?? 99) < 12);
        const morningMin = morning.length ? Math.min(...morning.map((o) => o.price_brl!)) : null;
        const dayMin = outOptions.length ? Math.min(...outOptions.map((o) => o.price_brl!)) : null;
        return (
          <section key={r.id} className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-5 md:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-disp text-[22px] font-bold">
                {cityName(r.origin)} ⇄ {cityName(r.destination)}{" "}
                <span className="font-mono text-lg font-semibold text-mut">
                  {r.origin}-{r.destination}
                </span>
              </h2>
              <div className="text-sm text-mut">
                ida {formatDay(r.out_date)}{r.ret_date ? ` · volta ${formatDay(r.ret_date)}` : ""} ·{" "}
                <span className="font-semibold text-tinta">em {daysTo} dias</span> ·{" "}
                {r.status === "pending" ? "coletando a cada hora" : r.status}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <SeriesCard s={rt} title="Ida e volta" sub={r.ret_date ? `${formatDay(r.out_date)} → ${formatDay(r.ret_date)}` : ""} />
              <SeriesCard s={owOut} title="Só ida" sub={`${r.origin}→${r.destination} ${formatDay(r.out_date)}`} />
              <SeriesCard s={owBack} title="Só volta" sub={`${r.destination}→${r.origin} ${r.ret_date ? formatDay(r.ret_date) : ""}`} />
            </div>

            {/* voos da ida, com destaque para saidas de manha */}
            <div>
              <div className="mb-2 flex flex-wrap items-baseline gap-3">
                <span className="text-sm font-semibold">Voos da ida {formatDay(r.out_date)} (última coleta)</span>
                {morningMin !== null && dayMin !== null && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${morningMin <= dayMin * 1.02 ? "bg-[#E3F4EA] text-destaque-texto" : "bg-[#FBE7E5] text-alto-texto"}`}>
                    de manhã (até 12h): {formatBRL(morningMin)}
                    {morningMin > dayMin * 1.02 ? ` — ${Math.round((morningMin / dayMin - 1) * 100)}% acima do mais barato do dia` : " — melhor opção do dia"}
                  </span>
                )}
              </div>
              {outOptions.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-borda text-left text-[13px] text-mut">
                        <th className="py-2 font-semibold">Voo</th>
                        <th className="py-2 font-semibold">Partida</th>
                        <th className="py-2 font-semibold">Chegada</th>
                        <th className="py-2 text-right font-semibold">Duração</th>
                        <th className="py-2 text-right font-semibold">Escalas</th>
                        <th className="py-2 text-right font-semibold">Preço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outOptions.map((o, i) => {
                        const isMorning = (depHour(o.departure) ?? 99) < 12;
                        const cheapest = o.price_brl === dayMin;
                        return (
                          <tr key={i} className={`border-b border-grade ${isMorning ? "bg-[#FDF9E8]" : ""}`}>
                            <td className="py-2">
                              <span className="font-semibold">{o.airline ? airlineShort(o.airline) : "—"}</span>{" "}
                              <span className="font-mono text-xs text-mut">{o.flight_number}</span>
                              {isMorning && <span className="ml-2 text-[11px] font-semibold text-[#8A6D00]">manhã</span>}
                            </td>
                            <td className="py-2 font-mono">{formatLocalTime(o.departure)}</td>
                            <td className="py-2 font-mono">{formatLocalTime(o.arrival)}</td>
                            <td className="py-2 text-right font-mono">{o.duration_min ? `${Math.floor(o.duration_min / 60)}h${String(o.duration_min % 60).padStart(2, "0")}` : "—"}</td>
                            <td className="py-2 text-right font-mono">{o.stops === 0 ? "direto" : o.stops ?? "—"}</td>
                            <td className={`py-2 text-right font-mono font-semibold ${cheapest ? "text-destaque-texto" : ""}`}>
                              {o.price_brl === null ? "—" : formatBRL(o.price_brl)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-mut">Ainda sem opções — a primeira coleta dessa perna entra na próxima hora.</p>
              )}
            </div>
          </section>
        );
      })}

      <p className="text-[13px] text-mut">
        Fonte: Google Flights, tarifa básica para 1 adulto, em reais, coletada de hora em hora. Horários
        no fuso local do aeroporto. Não vendemos passagens.
      </p>
    </main>
  );
}
