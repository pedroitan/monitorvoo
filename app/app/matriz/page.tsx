import Link from "next/link";
import {
  formatBRL,
  formatCollected,
  getTripRuns,
  TripOption,
} from "@/lib/data";
import { hhmm, LegCard, legData } from "@/components/LegCard";

export const dynamic = "force-dynamic";

const DESTS = ["CGH", "VCP", "GRU"];

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

export default async function MatrizPage() {
  // pernas de ida e volta (6 + 6), em paralelo
  const outs = await Promise.all(
    DESTS.flatMap((d) =>
      OUTS.map((o) => legData("SSA", d, o))
    )
  );
  const backs = await Promise.all(
    DESTS.flatMap((o) =>
      BACKS.map((b) => legData(o, "SSA", b))
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
                          <Link
                            href={`/celula?o=SSA&d=${c.o.dest}&out=${c.o.date}&back=${c.b.date}&ro=${c.b.origin}`}
                            className="block rounded-md transition-colors hover:bg-grade"
                            title="ver os voos dessa combinacao"
                          >
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
                          </Link>
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
