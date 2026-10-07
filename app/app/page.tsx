import Link from "next/link";
import {
  formatBRL,
  getLatestMinPrices,
  getRoutes,
  routeCode,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [routes, minPrices] = await Promise.all([
    getRoutes(),
    getLatestMinPrices(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Monitor de passagens</h1>
        <p className="text-sm text-neutral-400">
          Histórico de tarifas por rota — menor preço da coleta mais recente
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {routes.map((r) => {
          const code = routeCode(r);
          const price = minPrices[r.id];
          return (
            <Link
              key={r.id}
              href={`/rota/${code}`}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-600"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-semibold">{code}</span>
                <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                  {r.kind}
                </span>
              </div>
              <div className="mt-3 text-2xl font-bold text-emerald-400">
                {price ? formatBRL(price) : "—"}
              </div>
              <div className="text-xs text-neutral-500">menor preço recente</div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
