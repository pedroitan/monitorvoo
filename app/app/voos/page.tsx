import { Header } from "@/components/Header";
import { getLatestFlightOptions, getRoutes, cityName, formatBRL, routeCode } from "@/lib/data";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(min: number | null | undefined) {
  if (min === null || min === undefined) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}m`;
}

export default async function VoosPage() {
  const [routes, flights] = await Promise.all([getRoutes(), getLatestFlightOptions(1)]);
  const routeById = new Map(routes.map((r) => [r.id, r]));

  const sourceLabel = (s?: string | null) =>
    s === "google_flights" ? "Google Flights" : s ?? "—";

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F2F3F0] px-4 pb-24 pt-6 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-[#0E1A2B]">
              Voos coletados hoje
            </h1>
            <p className="text-sm text-[#0E1A2B]/70">
              Todos os resultados da última coleta. Cada linha é uma opção de voo
              retornada pela fonte para uma rota × antecedência × tipo de viagem.
            </p>
          </div>

          <section className="rounded-2xl border border-[#0E1A2B]/10 bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-display text-lg font-semibold text-[#0E1A2B]">
              Fonte de dados
            </h2>
            <div className="space-y-2 text-sm text-[#0E1A2B]/80">
              <p>
                <strong>Google Flights</strong> via biblioteca <code>fast-flights</code> v3.1.0.
                A coleta roda 3× ao dia via GitHub Actions e guarda a resposta bruta no
                Supabase Storage.
              </p>
              <p>Dados extraídos de cada opção:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Número do voo (ex.: LA3548), companhia(s) e aeronave</li>
                <li>Preço da tarifa básica (1 adulto, economy)</li>
                <li>Data/horário de partida e chegada de cada trecho</li>
                <li>Duração e número de escalas</li>
              </ul>
              <p className="rounded-lg bg-[#FBE3D4] p-3 text-[#B5410F]">
                <strong>Atenção:</strong> o número do voo e os horários só aparecem na tabela
                depois que a migration <code>0002_flight_details.sql</code> for aplicada no
                Supabase. Enquanto isso, os dados são coletados e guardados no JSON bruto.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#0E1A2B]/10 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[#0E1A2B]">
                Resultados ({flights.length})
              </h2>
              <span className="text-xs text-[#0E1A2B]/60">
                Última coleta: {flights[0]?.collected_at
                  ? new Date(flights[0].collected_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#0E1A2B]/10 text-[#0E1A2B]/60">
                    <th className="pb-2 font-medium">Rota</th>
                    <th className="pb-2 font-medium">Voo</th>
                    <th className="pb-2 font-medium">Partida</th>
                    <th className="pb-2 font-medium">Chegada</th>
                    <th className="pb-2 font-medium text-right">Duração</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium text-right">Antec.</th>
                    <th className="pb-2 font-medium text-right">Escalas</th>
                    <th className="pb-2 font-medium text-right">Preço</th>
                    <th className="pb-2 font-medium">Fonte</th>
                  </tr>
                </thead>
                <tbody className="text-[#0E1A2B]">
                  {flights.map((f, idx) => {
                    const route = routeById.get(f.route_id);
                    const code = route ? routeCode(route) : f.route_id;
                    return (
                      <tr key={idx} className="border-b border-[#0E1A2B]/5 last:border-0">
                        <td className="py-2 font-medium">
                          {code}
                          {route && (
                            <div className="text-xs text-[#0E1A2B]/60">
                              {cityName(route.origin)} → {cityName(route.destination)}
                            </div>
                          )}
                        </td>
                        <td className="py-2 font-mono text-xs">
                          {f.flight_number ?? "—"}
                          {f.plane_type && (
                            <div className="text-[10px] text-[#0E1A2B]/60">{f.plane_type}</div>
                          )}
                        </td>
                        <td className="py-2 font-mono">{formatDateTime(f.departure)}</td>
                        <td className="py-2 font-mono">{formatDateTime(f.arrival)}</td>
                        <td className="py-2 text-right font-mono">{formatDuration(f.duration_min)}</td>
                        <td className="py-2 capitalize">
                          {f.trip_type === "one-way" ? "só ida" : "ida e volta"}
                        </td>
                        <td className="py-2 text-right font-mono">{f.lead_days}d</td>
                        <td className="py-2 text-right font-mono">{f.stops ?? 0}</td>
                        <td className="py-2 text-right font-mono font-medium text-[#B5410F]">
                          {formatBRL(f.price_brl)}
                        </td>
                        <td className="py-2 text-xs">{sourceLabel(f.source)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
