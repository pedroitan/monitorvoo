import Link from "next/link";
import {
  airlineShort,
  cityName,
  formatBRL,
  formatCollected,
  formatDay,
  getRunOptions,
  getTripRuns,
  TripOption,
  TripRun,
} from "@/lib/data";
import { hstr } from "@/components/LegCard";
import { Sparkline } from "@/components/Sparkline";

export const dynamic = "force-dynamic";

async function latestOk(
  origin: string,
  dest: string,
  flightDate: string,
  trip: string,
  ret?: string
): Promise<{ run: TripRun | null; options: TripOption[]; series: TripRun[] }> {
  const runs = await getTripRuns(origin, dest, flightDate);
  const series = runs.filter(
    (r) =>
      r.trip_type === trip &&
      r.status === "ok" &&
      r.min_price !== null &&
      (trip === "one-way" || r.return_date === ret)
  );
  const run = series.at(-1) ?? null;
  const options = run ? await getRunOptions(run.id) : [];
  return { run, options, series };
}

function OptionsTable({ options, rt }: { options: TripOption[]; rt?: boolean }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[12px] text-mut">
          <th className="py-1 font-medium">{rt ? "Ida (a volta se escolhe no site da cia)" : "Horários"}</th>
          <th className="py-1 font-medium">Cia</th>
          <th className="py-1 text-right font-medium">Escalas</th>
          <th className="py-1 text-right font-medium">Duração</th>
          <th className="py-1 text-right font-medium">Preço{rt ? " total" : ""}</th>
        </tr>
      </thead>
      <tbody>
        {options.slice(0, 10).map((o, i) => {
          const dd = o.departure?.slice(8, 10);
          const ad = o.arrival?.slice(8, 10);
          return (
            <tr key={i} className={`border-b border-grade last:border-0 ${i === 0 ? "font-semibold" : ""}`}>
              <td className="py-1.5 font-mono">
                {hstr(o.departure)} → {hstr(o.arrival)}
                {dd && ad && dd !== ad && <span className="ml-1 text-[11px] text-mut">+1d</span>}
                <span className="ml-1.5 text-[11px] font-normal text-mut">{o.flight_number ?? ""}</span>
              </td>
              <td className="py-1.5">{airlineShort(o.airline ?? "")}</td>
              <td className="py-1.5 text-right">{o.stops === 0 ? "direto" : o.stops}</td>
              <td className="py-1.5 text-right text-mut">
                {o.duration_min ? `${Math.floor(o.duration_min / 60)}h${String(o.duration_min % 60).padStart(2, "0")}` : "—"}
              </td>
              <td className={`py-1.5 text-right font-mono ${i === 0 ? "font-semibold text-destaque-texto" : ""}`}>
                {formatBRL(o.price_brl ?? 0)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MiniSeries({ series }: { series: TripRun[] }) {
  const prices = series.map((r) => r.min_price!);
  if (!prices.length) return null;
  return (
    <div className="mt-2 flex items-center gap-3 text-xs text-mut">
      <Sparkline values={prices} width={140} height={32} />
      <span>
        {series.length} coletas · mín {formatBRL(Math.min(...prices))} · máx {formatBRL(Math.max(...prices))}
      </span>
    </div>
  );
}

export default async function CelulaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  const o = (p.o ?? "SSA").toUpperCase();
  const d = (p.d ?? "").toUpperCase();
  const out = p.out ?? "";
  const back = p.back ?? "";
  const ro = (p.ro ?? d).toUpperCase(); // cidade de saida da volta (open-jaw se diferente)
  const sameCity = d === ro;

  const [rt, owOut, owBack] = await Promise.all([
    sameCity ? latestOk(o, d, out, "round-trip", back) : Promise.resolve({ run: null, options: [], series: [] }),
    latestOk(o, d, out, "one-way"),
    latestOk(ro, o, back, "one-way"),
  ]);

  const sum =
    owOut.options.length && owBack.options.length
      ? (owOut.options[0].price_brl ?? 0) + (owBack.options[0].price_brl ?? 0)
      : null;
  const rtPrice = rt.options[0]?.price_brl ?? null;
  const best = Math.min(...[sum, rtPrice].filter((v): v is number => v !== null && v > 0));

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 pb-28 md:px-6">
      <div className="flex flex-col gap-2">
        <nav className="text-sm text-mut">
          <Link href="/matriz" className="text-link hover:text-link-hover">Matriz</Link> / Detalhe
        </nav>
        <h1 className="font-disp text-3xl font-bold">
          {o} → {d} {formatDay(out)} · {ro} → {o} {formatDay(back)}
        </h1>
        <p className="text-texto">
          {cityName(d)}
          {sameCity ? "" : ` (volta saindo de ${cityName(ro)} — open-jaw)`} · melhor combinação agora:{" "}
          <span className="font-mono font-semibold text-destaque-texto">
            {isFinite(best) ? formatBRL(best) : "—"}
          </span>
          {rtPrice !== null && sum !== null && rtPrice < sum
            ? ` — ida e volta junto vence a soma dos trechos por ${formatBRL(sum - rtPrice)}`
            : sum !== null
              ? " — somando duas passagens só de ida"
              : ""}
        </p>
      </div>

      {rt.options.length > 0 && (
        <section className="rounded-2xl border border-borda bg-card p-5">
          <h2 className="font-disp text-lg font-bold">
            Ida e volta junto — {formatBRL(rtPrice ?? 0)}
            {rt.run && <span className="ml-2 text-xs font-normal text-mut">coletado {formatCollected(rt.run.run_at)}</span>}
          </h2>
          <OptionsTable options={rt.options} rt />
          <MiniSeries series={rt.series} />
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-borda bg-card p-5">
          <h2 className="font-disp text-lg font-bold">
            Só ida {o} → {d} · {owOut.options[0] ? formatBRL(owOut.options[0].price_brl ?? 0) : "—"}
          </h2>
          {owOut.options.length ? (
            <>
              <OptionsTable options={owOut.options} />
              <MiniSeries series={owOut.series} />
            </>
          ) : (
            <p className="mt-2 text-sm text-mut">Ainda sem coleta dessa perna.</p>
          )}
        </section>
        <section className="rounded-2xl border border-borda bg-card p-5">
          <h2 className="font-disp text-lg font-bold">
            Só volta {ro} → {o} · {owBack.options[0] ? formatBRL(owBack.options[0].price_brl ?? 0) : "—"}
          </h2>
          {owBack.options.length ? (
            <>
              <OptionsTable options={owBack.options} />
              <MiniSeries series={owBack.series} />
            </>
          ) : (
            <p className="mt-2 text-sm text-mut">Ainda sem coleta dessa perna.</p>
          )}
        </section>
      </div>

      <p className="text-[13px] text-mut">
        Horários no fuso local do aeroporto. Nas buscas de ida e volta, o Google detalha principalmente o voo de
        ida — a volta é escolhida na página da companhia. Não vendemos passagens.
      </p>
    </main>
  );
}
