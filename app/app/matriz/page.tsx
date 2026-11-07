import Link from "next/link";
import {
  airlineShort,
  cityName,
  formatBRL,
  formatCollected,
  getRunOptions,
  getTripRuns,
  TripOption,
  TripRun,
} from "@/lib/data";
import { Sparkline } from "@/components/Sparkline";

export const dynamic = "force-dynamic";

const DESTS = ["CGH", "VCP", "GRU"];

/** minutos do dia lendo o relogio local (sem fuso) */
const hhmm = (v: string | null) =>
  v ? Number(v.slice(11, 13)) * 60 + Number(v.slice(14, 16)) : null;
const hstr = (v: string | null) => (v ? v.slice(11, 16) : "—");

const OUTS = [
  {
    date: "2026-11-22",
    short: "22/11",
    label: "22/11 · qualquer horário",
    match: () => true,
  },
  {
    date: "2026-11-23",
    short: "23/11 ≤9h",
    label: "23/11 · chegando até as 9h",
    match: (o: TripOption) =>
      !!o.arrival && o.arrival.slice(0, 10) === "2026-11-23" && (hhmm(o.arrival) ?? 9999) <= 9 * 60,
  },
];
const BACKS = [
  {
    date: "2026-11-24",
    short: "24/11 ≥19h",
    label: "24/11 · saindo a partir das 19h",
    match: (o: TripOption) => (hhmm(o.departure) ?? 0) >= 19 * 60,
  },
  {
    date: "2026-11-25",
    short: "25/11",
    label: "25/11 · qualquer horário",
    match: () => true,
  },
];

type Leg = {
  origin: string;
  dest: string;
  date: string;
  short: string;
  label: string;
  series: TripRun[];          // rodadas so ida com preco
  options: TripOption[];      // opcoes da rodada mais recente
  filtered: TripOption[];     // as que atendem a janela de horario
  minFiltered: number | null;
  minAny: number | null;      // mais barato do dia sem filtro
  lastRunAt: string | null;
};

async function legData(
  origin: string,
  dest: string,
  date: string,
  short: string,
  label: string,
  match: (o: TripOption) => boolean
): Promise<Leg> {
  const runs = await getTripRuns(origin, dest, date);
  const series = runs.filter((r) => r.trip_type === "one-way" && r.status === "ok" && r.min_price !== null);
  const lastRun = [...series].at(-1);
  const options = lastRun ? await getRunOptions(lastRun.id) : [];
  const filtered = options.filter(match);
  const prices = filtered.map((o) => o.price_brl).filter((v): v is number => v !== null);
  const any = options.map((o) => o.price_brl).filter((v): v is number => v !== null);
  return {
    origin, dest, date, short, label, series, options, filtered,
    minFiltered: prices.length ? Math.min(...prices) : null,
    minAny: any.length ? Math.min(...any) : null,
    lastRunAt: lastRun?.run_at ?? null,
  };
}

/** antecedencia em dias entre a coleta e a data do voo */
const leadOf = (runAt: string, flightDate: string) =>
  Math.round((Date.parse(`${flightDate}T12:00:00Z`) - Date.parse(runAt)) / 86400000);

function LegCard({ leg }: { leg: Leg }) {
  const prices = leg.series.map((r) => r.min_price!);
  const lo = prices.length ? Math.min(...prices) : null;
  const last = prices.at(-1) ?? null;
  const best = leg.filtered[0];
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-borda p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">
          {leg.origin} → {leg.dest} <span className="font-normal text-mut">{cityName(leg.dest === "SSA" ? leg.origin : leg.dest)}</span>
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

export default async function MatrizPage() {
  // pernas de ida e volta (6 + 6), em paralelo
  const outs = await Promise.all(
    DESTS.flatMap((d) =>
      OUTS.map((o) => legData("SSA", d, o.date, o.short, o.label, o.match))
    )
  );
  const backs = await Promise.all(
    DESTS.flatMap((o) =>
      BACKS.map((b) => legData(o, "SSA", b.date, b.short, b.label, b.match))
    )
  );
  // ida e volta junto: so existe dentro do mesmo aeroporto (6 combos x 2 voltas)
  const rts = await Promise.all(
    DESTS.flatMap((d) =>
      OUTS.flatMap((o) =>
        BACKS.map(async (b) => {
          const runs = await getTripRuns("SSA", d, o.date);
          const rt = runs.filter(
            (r) => r.trip_type === "round-trip" && r.return_date === b.date && r.status === "ok" && r.min_price !== null
          );
          return { d, out: o.date, back: b.date, price: rt.at(-1)?.min_price ?? null, series: rt.length };
        })
      )
    )
  );
  const rtOf = (d: string, out: string, back: string) =>
    rts.find((r) => r.d === d && r.out === out && r.back === back)?.price ?? null;

  // matriz: linha = ida, coluna = volta; diagonal (mesmo aeroporto) mostra RT junto
  const cells = outs.map((o) =>
    backs.map((b) => {
      const sum = o.minFiltered !== null && b.minFiltered !== null ? o.minFiltered + b.minFiltered : null;
      const rt = o.dest === b.origin ? rtOf(o.dest, o.date, b.date) : null;
      return { o, b, sum, rt, best: Math.min(...[sum, rt].filter((v): v is number => v !== null)) };
    })
  );
  const allBest = Math.min(...cells.flat().map((c) => c.best).filter((v): v is number => isFinite(v)));
  const allSum = Math.min(...cells.flat().map((c) => c.sum ?? Infinity));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 pb-28 md:px-6">
      <div className="flex flex-col gap-2">
        <nav className="text-sm text-mut">
          <Link href="/viagem" className="text-link hover:text-link-hover">Viagem</Link> / Matriz SSA ⇄ SP
        </nav>
        <h1 className="font-disp text-3xl font-bold md:text-4xl">SSA ⇄ São Paulo: todas as combinações</h1>
        <p className="max-w-3xl text-texto">
          Ida 22/11 em qualquer horário ou 23/11 chegando até as 9h; volta 24/11 depois das 19h ou 25/11 o dia
          todo — saindo de Congonhas, Viracopos ou Guarulhos. Cada perna é coletada de hora em hora; o gráfico
          mostra o preço conforme a antecedência diminui. Atualizado junto com o coletor.
        </p>
      </div>

      {/* matriz ida x volta */}
      <section className="rounded-2xl border border-borda bg-card p-5 md:p-6">
        <h2 className="font-disp text-[22px] font-bold">Matriz ida × volta</h2>
        <p className="mt-1 text-sm text-mut">
          Soma das duas pernas respeitando as janelas de horário. Na diagonal (mesmo aeroporto) também dá para
          comprar ida e volta junto — aparece abaixo do total.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[12px] text-mut">
                <th className="p-2 font-medium">ida ↓ · volta →</th>
                {backs.map((b, i) => (
                  <th key={i} className={`p-2 text-center font-semibold ${i % 2 === 1 ? "border-r border-borda" : ""}`}>
                    <div className="font-mono">{b.origin} → SSA</div>
                    <div className="font-normal">{b.short}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cells.map((row, ri) => (
                <tr key={ri} className="border-t border-grade">
                  <th className="p-2 text-left">
                    <div className="font-mono font-semibold">SSA → {row[0].o.dest}</div>
                    <div className="text-xs font-normal text-mut">{row[0].o.short}</div>
                  </th>
                  {row.map((c, ci) => {
                    const isBest = c.best !== null && c.best === allBest;
                    const rtWins = c.rt !== null && (c.sum === null || c.rt < c.sum);
                    return (
                      <td
                        key={ci}
                        className={`p-2 text-center align-top ${ci % 2 === 1 ? "border-r border-borda" : ""} ${
                          isBest ? "bg-[#E3F4EA]" : c.sum !== null && c.sum === allSum && !rtWins ? "bg-[#F0F6F2]" : ""
                        }`}
                      >
                        {c.sum !== null || c.rt !== null ? (
                          <>
                            <div className={`font-mono text-[15px] font-semibold ${isBest ? "text-destaque-texto" : ""}`}>
                              {formatBRL(c.best ?? 0)}
                            </div>
                            <div className="text-[11px] text-mut">
                              {c.sum !== null ? `${formatBRL(c.o.minFiltered!)} + ${formatBRL(c.b.minFiltered!)}` : "sem só ida nessa janela"}
                            </div>
                            {c.rt !== null && (
                              <div className={`text-[11px] font-medium ${rtWins ? "text-destaque-texto" : "text-mut"}`}>
                                junto: {formatBRL(c.rt ?? 0)}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-mut">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-mut">
          Verde = menor combinação do momento. Entre aeroportos diferentes não existe bilhete único de ida e
          volta — só a soma dos dois trechos.
        </p>
      </section>

      {/* pernas de ida */}
      <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-5 md:p-6">
        <div>
          <h2 className="font-disp text-[22px] font-bold">Pernas de ida — SSA → São Paulo</h2>
          <p className="mt-1 text-sm text-mut">
            Linha = menor preço só ida de cada coleta; o eixo vai de mais antecedência (esquerda) para perto do
            voo (direita).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {outs.map((l, i) => <LegCard key={i} leg={l} />)}
        </div>
      </section>

      {/* pernas de volta */}
      <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-5 md:p-6">
        <div>
          <h2 className="font-disp text-[22px] font-bold">Pernas de volta — São Paulo → SSA</h2>
          <p className="mt-1 text-sm text-mut">Mesma leitura: cada ponto é uma coleta horária.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {backs.map((l, i) => <LegCard key={i} leg={l} />)}
        </div>
      </section>

      <p className="text-[13px] text-mut">
        Fonte: Google Flights, menor tarifa para 1 adulto, coletada de hora em hora. Última perna atualizada
        {[outs, backs].flat().map((l) => l.lastRunAt).filter(Boolean).length
          ? ` em ${formatCollected(
              [outs, backs].flat().map((l) => l.lastRunAt!).filter(Boolean).sort().at(-1)!
            )}`
          : "— ainda sem coletas"}. Não vendemos passagens.
      </p>
    </main>
  );
}
