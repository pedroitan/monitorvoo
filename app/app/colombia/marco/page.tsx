import Link from "next/link";
import {
  cityName,
  formatBRL,
  formatCollected,
  formatDay,
  getTripRuns,
} from "@/lib/data";
import { Leg, LegCard, legData, LegSpec } from "@/components/LegCard";

export const dynamic = "force-dynamic";

const DESTS = ["BOG", "MDE", "CTG"];
const OUTS = [
  { date: "2027-03-17", short: "17/03", label: "17/03 (ter)", match: () => true },
  { date: "2027-03-18", short: "18/03", label: "18/03 (qua)", match: () => true },
  { date: "2027-03-19", short: "19/03", label: "19/03 (qui)", match: () => true },
];
const BACKS = [
  { date: "2027-03-28", short: "28/03", label: "28/03 (dom)", match: () => true },
  { date: "2027-03-29", short: "29/03", label: "29/03 (seg)", match: () => true },
  { date: "2027-03-30", short: "30/03", label: "30/03 (ter)", match: () => true },
];

/** so a serie de precos de uma perna, sem baixar as opcoes (pernas de conexao) */
async function legRuns(origin: string, dest: string, date: string) {
  const runs = await getTripRuns(origin, dest, date);
  const pts = runs.filter((r) => r.trip_type === "one-way" && r.status === "ok" && r.min_price !== null);
  return {
    n: pts.length,
    last: pts.at(-1)?.min_price ?? null,
    lo: pts.length ? Math.min(...pts.map((r) => r.min_price!)) : null,
  };
}

export default async function ColombiaMarcoPage() {
  // pernas diretas (com opcoes de voo)
  const outs = await Promise.all(
    DESTS.flatMap((d) => OUTS.map((o) => legData("SSA", d, o as LegSpec)))
  );
  const backs = await Promise.all(
    DESTS.flatMap((o) => BACKS.map((b) => legData(o, "SSA", b as LegSpec)))
  );
  // ida e volta junto: 3 cidades x 3 idas x 3 voltas
  const rts = await Promise.all(
    DESTS.flatMap((d) =>
      OUTS.flatMap((o) =>
        BACKS.map(async (b) => {
          const runs = await getTripRuns("SSA", d, o.date);
          const rt = runs.filter(
            (r) => r.trip_type === "round-trip" && r.return_date === b.date && r.status === "ok" && r.min_price !== null
          );
          return {
            d, out: o.date, back: b.date,
            price: rt.at(-1)?.min_price ?? null,
            lo: rt.length ? Math.min(...rt.map((r) => r.min_price!)) : null,
            n: rt.length,
          };
        })
      )
    )
  );
  const rtOf = (d: string, out: string, back: string) =>
    rts.find((r) => r.d === d && r.out === out && r.back === back) ?? { price: null, lo: null, n: 0 };

  // pernas de conexao via GRU (so serie)
  const conn = await Promise.all(
    [
      ...OUTS.map((o) => ({ o: "SSA", d: "GRU", date: o.date })),
      ...DESTS.flatMap((d) => OUTS.map((o) => ({ o: "GRU", d, date: o.date }))),
      ...DESTS.flatMap((o) => BACKS.map((b) => ({ o, d: "GRU", date: b.date }))),
      ...BACKS.map((b) => ({ o: "GRU", d: "SSA", date: b.date })),
    ].map(async (l) => ({ ...l, ...(await legRuns(l.o, l.d, l.date)) }))
  );
  const connOf = (o: string, d: string, date: string) =>
    conn.find((c) => c.o === o && c.d === d && c.date === date) ?? { n: 0, last: null, lo: null };

  // matriz 9x9: linhas ida (cidade x data), colunas volta (cidade x data)
  const cells = outs.map((o) =>
    backs.map((b) => {
      const sum = o.minFiltered !== null && b.minFiltered !== null ? o.minFiltered + b.minFiltered : null;
      const rt = o.dest === b.origin ? rtOf(o.dest, o.date, b.date).price : null;
      return { o, b, sum, rt, best: Math.min(...[sum, rt].filter((v): v is number => v !== null)) };
    })
  );
  const allBest = Math.min(...cells.flat().map((c) => c.best).filter((v): v is number => isFinite(v)));

  // comparativo de conexao por perna (direto vs. 2 bilhetes via GRU)
  const connRows = [
    ...outs.map((l) => {
      const c1 = connOf("SSA", "GRU", l.date).last;
      const c2 = connOf("GRU", l.dest, l.date).last;
      return { dir: "ida" as const, leg: l, via: c1 !== null && c2 !== null ? c1 + c2 : null };
    }),
    ...backs.map((l) => {
      const c1 = connOf(l.origin, "GRU", l.date).last;
      const c2 = connOf("GRU", "SSA", l.date).last;
      return { dir: "volta" as const, leg: l, via: c1 !== null && c2 !== null ? c1 + c2 : null };
    }),
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 pb-28 md:px-6">
      <div className="flex flex-col gap-2">
        <nav className="text-sm text-mut">
          <Link href="/colombia" className="text-link hover:text-link-hover">Estudo Colômbia</Link> / Março 2027
        </nav>
        <h1 className="font-disp text-3xl font-bold md:text-4xl">SSA ⇄ Colômbia: 18–29 de março (±1 dia)</h1>
        <p className="max-w-3xl text-texto">
          Ida 17, 18 ou 19 de março; volta 28, 29 ou 30 — para Bogotá, Medellín ou Cartagena, com comparação de
          bilhete único, dois trechos e conexão por conta própria via Guarulhos. Coletado de hora em hora; a
          linha de cada perna mostra o preço conforme a antecedência diminui.
        </p>
      </div>

      {/* matriz 9x9 */}
      <section className="rounded-2xl border border-borda bg-card p-5 md:p-6">
        <h2 className="font-disp text-[22px] font-bold">Matriz ida × volta</h2>
        <p className="mt-1 text-sm text-mut">
          Soma das duas só ida em qualquer combinação (open-jaw incluído: chegar por uma cidade e sair por
          outra). Nas células da mesma cidade aparece também a ida e volta comprada junto.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[12px] text-mut">
                <th className="p-1.5 font-medium">ida ↓ · volta →</th>
                {backs.map((b, i) => (
                  <th key={i} className={`p-1.5 text-center font-semibold ${(i + 1) % 3 === 0 ? "border-r border-borda" : ""}`}>
                    <div className="font-mono">{b.origin} → SSA</div>
                    <div className="font-normal">{b.short}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cells.map((row, ri) => (
                <tr key={ri} className={`border-t border-grade ${ri % 3 === 0 ? "border-t-2 border-borda" : ""}`}>
                  <th className="p-1.5 text-left">
                    <div className="font-mono font-semibold">SSA → {row[0].o.dest}</div>
                    <div className="text-xs font-normal text-mut">{row[0].o.short}</div>
                  </th>
                  {row.map((c, ci) => {
                    const isBest = c.best !== null && isFinite(c.best) && c.best === allBest;
                    const rtWins = c.rt !== null && (c.sum === null || c.rt < c.sum);
                    return (
                      <td
                        key={ci}
                        className={`p-1.5 text-center align-top ${(ci + 1) % 3 === 0 ? "border-r border-borda" : ""} ${isBest ? "bg-[#E3F4EA]" : ""}`}
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
                              {c.sum !== null ? `${formatBRL(c.o.minFiltered!)}+${formatBRL(c.b.minFiltered!)}` : "sem só ida ainda"}
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
          Verde = menor combinação do momento. Entre cidades diferentes não há ida e volta única — a soma dos
          dois trechos é a referência (no estudo, open-jaw Brasil–Colômbia já saiu mais barato que voltar pela
          mesma cidade).
        </p>
      </section>

      {/* conexao por conta propria */}
      <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-5 md:p-6">
        <div>
          <h2 className="font-disp text-[22px] font-bold">Conexão por conta própria via Guarulhos</h2>
          <p className="mt-1 text-sm text-mut">
            Cada perna direta SSA ⇄ Colômbia comparada com dois bilhetes separados (SSA ⇄ GRU + GRU ⇄ cidade).
            Atenção: em bilhetes separados, se a primeira perna atrasar, a segunda está perdida — e a mala
            precisa ser retirada e despachada de novo.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-[13px] text-mut">
                <th className="py-2 font-semibold">Perna</th>
                <th className="py-2 text-right font-semibold">Bilhete único</th>
                <th className="py-2 text-right font-semibold">Via GRU (2 bilhetes)</th>
                <th className="py-2 text-right font-semibold">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {connRows.map((r, i) => {
                const dir = r.leg.minFiltered;
                const diff = dir !== null && r.via !== null ? r.via - dir : null;
                return (
                  <tr key={i} className="border-b border-grade">
                    <td className="py-2">
                      <span className="font-mono font-semibold">{r.leg.origin} → {r.leg.dest}</span>{" "}
                      <span className="text-mut">{r.leg.short} · {r.dir}</span>
                    </td>
                    <td className="py-2 text-right font-mono">{dir !== null ? formatBRL(dir) : "—"}</td>
                    <td className="py-2 text-right font-mono">{r.via !== null ? formatBRL(r.via) : "—"}</td>
                    <td className={`py-2 text-right font-mono font-semibold ${diff !== null && diff < -50 ? "text-destaque-texto" : diff !== null && diff > 50 ? "text-alto-texto" : "text-texto"}`}>
                      {diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatBRL(Math.abs(diff))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* pernas de ida */}
      <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-5 md:p-6">
        <div>
          <h2 className="font-disp text-[22px] font-bold">Pernas de ida — SSA → Colômbia</h2>
          <p className="mt-1 text-sm text-mut">
            Linha = menor preço só ida de cada coleta; o eixo vai de mais antecedência (esquerda) para perto do
            voo (direita).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {outs.map((l, i) => <LegCard key={i} leg={l as Leg} />)}
        </div>
      </section>

      {/* pernas de volta */}
      <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-5 md:p-6">
        <div>
          <h2 className="font-disp text-[22px] font-bold">Pernas de volta — Colômbia → SSA</h2>
          <p className="mt-1 text-sm text-mut">Mesma leitura: cada ponto é uma coleta horária.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {backs.map((l, i) => <LegCard key={i} leg={l as Leg} />)}
        </div>
      </section>

      {/* pernas de conexao (compacto) */}
      <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-5 md:p-6">
        <div>
          <h2 className="font-disp text-[22px] font-bold">Pernas de conexão — séries</h2>
          <p className="mt-1 text-sm text-mut">Menor preço atual e mínimo já visto em cada trecho da conexão.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-[13px] text-mut">
                <th className="py-2 font-semibold">Trecho</th>
                <th className="py-2 font-semibold">Data</th>
                <th className="py-2 text-right font-semibold">Agora</th>
                <th className="py-2 text-right font-semibold">Mínimo visto</th>
                <th className="py-2 text-right font-semibold">Coletas</th>
              </tr>
            </thead>
            <tbody>
              {conn.map((c, i) => (
                <tr key={i} className="border-b border-grade">
                  <td className="py-1.5 font-mono font-semibold" title={cityName(c.d)}>
                    {c.o} → {c.d}
                  </td>
                  <td className="py-1.5 text-mut">{formatDay(c.date)}</td>
                  <td className="py-1.5 text-right font-mono">{c.last !== null ? formatBRL(c.last) : "—"}</td>
                  <td className="py-1.5 text-right font-mono text-mut">{c.lo !== null ? formatBRL(c.lo) : "—"}</td>
                  <td className="py-1.5 text-right font-mono text-mut">{c.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[13px] text-mut">
        Fonte: Google Flights, menor tarifa para 1 adulto, coletada de hora em hora. Última coleta
        {[...outs, ...backs].map((l) => l.lastRunAt).filter(Boolean).length
          ? ` em ${formatCollected([...outs, ...backs].map((l) => l.lastRunAt!).filter(Boolean).sort().at(-1)!)}`
          : "— ainda sem coletas"}. Não vendemos passagens.
      </p>
    </main>
  );
}
