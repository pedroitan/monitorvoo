import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceChart, type ChartPoint } from "@/components/PriceChart";
import {
  formatBRL,
  getObservations,
  getRouteByCode,
  LEAD_TIMES,
  TRIP_TYPES,
} from "@/lib/data";

export const dynamic = "force-dynamic";

const TRIP_LABEL: Record<string, string> = {
  "one-way": "Só ida",
  "round-trip": "Ida e volta",
};

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ trip?: string; lead?: string }>;
};

export default async function RoutePage({ params, searchParams }: Props) {
  const { code } = await params;
  const { trip = "round-trip", lead = "30" } = await searchParams;

  const route = await getRouteByCode(code);
  if (!route) notFound();

  const leadDays = Number(lead) || 30;
  const observations = await getObservations(route.id, trip, leadDays);

  // Pivota: eixo X = instante da coleta; uma serie por companhia (menor preco)
  const byTime = new Map<string, ChartPoint>();
  const airlines = new Set<string>();
  for (const o of observations) {
    const t = o.collected_at.slice(0, 16).replace("T", " ");
    const point = byTime.get(t) ?? { time: t };
    const current = point[o.airline];
    if (typeof current !== "number" || o.price_brl < current) {
      point[o.airline] = o.price_brl;
    }
    byTime.set(t, point);
    airlines.add(o.airline);
  }
  const data = [...byTime.values()].sort((a, b) =>
    a.time.localeCompare(b.time)
  );

  const latestPrices = observations
    .filter((o) => o.collected_at.slice(0, 16) === data.at(-1)?.time)
    .map((o) => o.price_brl);
  const minPrice = latestPrices.length ? Math.min(...latestPrices) : null;

  const qs = (t: string, l: number) => `/rota/${code}?trip=${t}&lead=${l}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← todas as rotas
      </Link>

      <header className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-3xl font-bold">
            {route.origin}–{route.destination}
          </h1>
          <p className="text-sm text-neutral-400">
            {TRIP_LABEL[trip] ?? trip} · partida em {leadDays} dias
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-emerald-400">
            {minPrice ? formatBRL(minPrice) : "—"}
          </div>
          <div className="text-xs text-neutral-500">menor preço atual</div>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-4 text-sm">
        <div className="flex gap-1">
          {TRIP_TYPES.map((t) => (
            <Link
              key={t}
              href={qs(t, leadDays)}
              className={`rounded-lg px-3 py-1 ${
                t === trip
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {TRIP_LABEL[t]}
            </Link>
          ))}
        </div>
        <div className="flex gap-1">
          {LEAD_TIMES.map((l) => (
            <Link
              key={l}
              href={qs(trip, l)}
              className={`rounded-lg px-3 py-1 ${
                l === leadDays
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {l}d
            </Link>
          ))}
        </div>
      </nav>

      {data.length === 0 ? (
        <p className="text-neutral-500">Sem observações para esta combinação.</p>
      ) : (
        <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <PriceChart data={data} airlines={[...airlines].sort()} />
          <p className="mt-2 text-xs text-neutral-500">
            Menor preço por companhia a cada coleta · {observations.length}{" "}
            observações
          </p>
        </section>
      )}
    </main>
  );
}
