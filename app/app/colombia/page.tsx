import { Header } from "@/components/Header";
import { getRoutes, getObservations, formatBRL, cityName, routeCode } from "@/lib/data";

export const dynamic = "force-dynamic";

const COLOMBIA_DESTINATIONS = ["BOG", "MDE", "CTG", "BAQ", "CLO", "SMR", "PEI"];
const LEADS = [7, 14, 30, 60, 90, 180];

export default async function ColombiaPage() {
  const routes = (await getRoutes()).filter(
    (r) => r.origin === "GRU" && COLOMBIA_DESTINATIONS.includes(r.destination)
  );

  const observations = await Promise.all(routes.map((r) => getObservations(r.id)));

  const byRoute = new Map(
    routes.map((route, idx) => {
      const list = observations[idx].filter((o) => o.trip_type === "one-way");
      const byLead = new Map<number, { price_brl: number; flight_date: string; airline: string }>();

      for (const lead of LEADS) {
        const items = list.filter((o) => o.lead_days === lead);
        if (!items.length) continue;
        const latestDay = items
          .map((o) => o.collected_at.slice(0, 10))
          .sort()
          .at(-1)!;
        const latest = items.filter((o) => o.collected_at.slice(0, 10) === latestDay);
        const cheapest = latest.reduce((a, b) => (a.price_brl <= b.price_brl ? a : b));
        byLead.set(lead, {
          price_brl: cheapest.price_brl,
          flight_date: cheapest.flight_date,
          airline: cheapest.airline,
        });
      }

      const overall = [...byLead.values()].sort((a, b) => a.price_brl - b.price_brl)[0];

      return [
        route,
        {
          byLead,
          overall,
        },
      ] as const;
    })
  );

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F2F3F0] px-4 pb-24 pt-6 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-[#0E1A2B]">
              Voos para a Colômbia
            </h1>
            <p className="text-sm text-[#0E1A2B]/70">
              Comparativo de preços saindo de São Paulo (GRU) para os principais aeroportos colombianos.
            </p>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...byRoute.entries()].map(([route, data]) => (
              <a
                key={route.id}
                href={`/rota/${routeCode(route)}`}
                className="rounded-2xl border border-[#0E1A2B]/10 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-lg font-bold text-[#0E1A2B]">
                      {cityName(route.destination)}
                    </div>
                    <div className="text-xs font-mono text-[#0E1A2B]/60">{routeCode(route)}</div>
                  </div>
                  {data.overall && (
                    <div className="text-right">
                      <div className="font-display text-xl font-bold text-[#B5410F]">
                        {formatBRL(data.overall.price_brl)}
                      </div>
                      <div className="text-xs text-[#0E1A2B]/60">
                        {data.overall.flight_date}
                      </div>
                    </div>
                  )}
                </div>
                {data.overall && (
                  <div className="mt-2 text-xs text-[#0E1A2B]/70">
                    {data.overall.airline}
                  </div>
                )}
              </a>
            ))}
          </section>

          <section className="rounded-2xl border border-[#0E1A2B]/10 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-display text-lg font-semibold text-[#0E1A2B]">
              Comparativo por antecedência
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#0E1A2B]/10 text-[#0E1A2B]/60">
                    <th className="pb-2 font-medium">Destino</th>
                    {LEADS.map((l) => (
                      <th key={l} className="pb-2 font-medium text-right">{l}d</th>
                    ))}
                    <th className="pb-2 font-medium text-right">Melhor</th>
                  </tr>
                </thead>
                <tbody className="text-[#0E1A2B]">
                  {[...byRoute.entries()].map(([route, data]) => (
                    <tr key={route.id} className="border-b border-[#0E1A2B]/5 last:border-0">
                      <td className="py-2 font-medium">
                        {cityName(route.destination)}
                        <div className="text-xs font-mono text-[#0E1A2B]/60">{routeCode(route)}</div>
                      </td>
                      {LEADS.map((l) => {
                        const item = data.byLead.get(l);
                        return (
                          <td key={l} className="py-2 text-right font-mono text-xs">
                            {item ? formatBRL(item.price_brl) : "—"}
                          </td>
                        );
                      })}
                      <td className="py-2 text-right font-mono font-medium text-[#B5410F]">
                        {data.overall ? formatBRL(data.overall.price_brl) : "—"}
                      </td>
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
