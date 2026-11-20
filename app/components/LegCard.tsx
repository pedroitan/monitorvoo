import {
  airlineShort,
  cityName,
  formatBRL,
  getRunOptions,
  getTripRuns,
  TripOption,
  TripRun,
} from "@/lib/data";
import { Sparkline } from "@/components/Sparkline";

/** minutos do dia lendo o relogio local (sem fuso) */
export const hhmm = (v: string | null) =>
  v ? Number(v.slice(11, 13)) * 60 + Number(v.slice(14, 16)) : null;
export const hstr = (v: string | null) => (v ? v.slice(11, 16) : "—");

export type LegSpec = {
  date: string;
  short: string;
  label: string;
  match: (o: TripOption) => boolean;
};

export type Leg = LegSpec & {
  origin: string;
  dest: string;
  series: TripRun[];          // rodadas so ida com preco
  options: TripOption[];      // opcoes da rodada mais recente
  filtered: TripOption[];     // as que atendem a janela de horario
  minFiltered: number | null;
  minAny: number | null;      // mais barato do dia sem filtro
  lastRunAt: string | null;
};

export async function legData(
  origin: string,
  dest: string,
  spec: LegSpec
): Promise<Leg> {
  const runs = await getTripRuns(origin, dest, spec.date);
  const series = runs.filter((r) => r.trip_type === "one-way" && r.status === "ok" && r.min_price !== null);
  const lastRun = [...series].at(-1);
  const options = lastRun ? await getRunOptions(lastRun.id) : [];
  const filtered = options.filter(spec.match);
  const prices = filtered.map((o) => o.price_brl).filter((v): v is number => v !== null);
  const any = options.map((o) => o.price_brl).filter((v): v is number => v !== null);
  return {
    ...spec, origin, dest, series, options, filtered,
    minFiltered: prices.length ? Math.min(...prices) : null,
    minAny: any.length ? Math.min(...any) : null,
    lastRunAt: lastRun?.run_at ?? null,
  };
}

/** antecedencia em dias entre a coleta e a data do voo */
export const leadOf = (runAt: string, flightDate: string) =>
  Math.round((Date.parse(`${flightDate}T12:00:00Z`) - Date.parse(runAt)) / 86400000);

export function LegCard({ leg }: { leg: Leg }) {
  const prices = leg.series.map((r) => r.min_price!);
  const lo = prices.length ? Math.min(...prices) : null;
  const last = prices.at(-1) ?? null;
  const best = leg.filtered[0];
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-borda p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">
          {leg.origin} → {leg.dest}{" "}
          <span className="font-normal text-mut">{cityName(leg.dest === "SSA" ? leg.origin : leg.dest)}</span>
        </div>
        <div className="text-xs text-mut">{leg.short}</div>
      </div>
      {leg.series.length ? (
        <>
          <div className="font-mono text-2xl font-semibold">
            {leg.minFiltered !== null ? formatBRL(leg.minFiltered) : "—"}
          </div>
          <Sparkline values={prices} height={40} />
          <div className="flex justify-between text-[11px] text-mut">
            <span>D−{leadOf(leg.series[0].run_at, leg.date)} antes</span>
            <span>{leg.series.length} coletas</span>
            <span>D−{leadOf(leg.series.at(-1)!.run_at, leg.date)}</span>
          </div>
          <div className="text-xs text-mut">
            {leg.minFiltered === null && leg.minAny !== null
              ? `sem opção nessa janela — mais barato do dia: ${formatBRL(leg.minAny)}`
              : `menor do dia visto: ${formatBRL(lo ?? 0)} · agora ${formatBRL(last ?? 0)}`}
          </div>
          {best && (
            <div className="rounded-lg bg-grade px-2.5 py-1.5 text-xs">
              melhor agora: <span className="font-mono font-semibold">{hstr(best.departure)} → {hstr(best.arrival)}</span>{" "}
              {airlineShort(best.airline ?? "")} · {formatBRL(best.price_brl ?? 0)}
            </div>
          )}
          {leg.filtered.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-link">{leg.filtered.length} voos nessa janela</summary>
              <table className="mt-1.5 w-full">
                <tbody>
                  {leg.filtered.slice(0, 8).map((o, i) => (
                    <tr key={i} className="border-b border-grade last:border-0">
                      <td className="py-1 font-mono">{hstr(o.departure)}→{hstr(o.arrival)}</td>
                      <td className="py-1">{airlineShort(o.airline ?? "")}{o.stops ? ` · ${o.stops} esc.` : ""}</td>
                      <td className="py-1 text-right font-mono font-semibold">{formatBRL(o.price_brl ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      ) : (
        <p className="text-sm text-mut">Aguardando a primeira coleta dessa perna.</p>
      )}
    </div>
  );
}
