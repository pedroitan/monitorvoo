import Link from "next/link";
import { PromoCard } from "@/components/PromoCard";
import { RouteSearch } from "@/components/RouteSearch";
import { StatusSeal } from "@/components/Seal";
import { Sparkline } from "@/components/Sparkline";
import {
  cityName,
  formatBRL,
  getAllObservations,
  getPromoEvents,
  getRoutes,
  routeCode,
  summarizeRoutes,
} from "@/lib/data";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "nacional", label: "Nacionais" },
  { key: "internacional", label: "Internacionais" },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro = "todas" } = await searchParams;
  const [routes, obs, promos] = await Promise.all([
    getRoutes(),
    getAllObservations(),
    getPromoEvents(),
  ]);
  const summaries = summarizeRoutes(routes, obs);
  const filtered =
    filtro === "todas"
      ? summaries
      : summaries.filter((s) => s.route.kind === filtro);

  const searchRoutes = routes.map((r) => ({
    origin: r.origin,
    destination: r.destination,
    originName: cityName(r.origin),
    destinationName: cityName(r.destination),
  }));

  const activePromos = promos.filter((p) => !p.ended_at);
  const recentPromos = promos.filter((p) => p.ended_at).slice(0, 3);

  return (
    <>
      {/* hero */}
      <section className="bg-tinta px-4 pb-16 pt-12 text-white md:px-6 md:pb-[72px] md:pt-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-7">
          <h1 className="font-disp max-w-3xl text-4xl font-bold leading-[1.05] md:text-[56px]">
            Saiba se o preço da passagem está bom antes de comprar.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[#C3CDDB] md:text-lg">
            Acompanhamos diariamente as principais rotas saindo do Brasil e
            mostramos o histórico, a faixa normal de preço e quando cada
            companhia entra em promoção.
          </p>
          <RouteSearch routes={searchRoutes} />
        </div>
      </section>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 md:px-6 md:py-12">
        {/* promocoes */}
        <section aria-labelledby="promo-h" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="promo-h" className="font-disp text-2xl font-bold md:text-3xl">
              Promoções em andamento
            </h2>
            <Link
              href="/promocoes"
              className="font-semibold text-link hover:text-link-hover"
            >
              Ver calendário completo
            </Link>
          </div>
          {activePromos.length || recentPromos.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...activePromos, ...recentPromos].slice(0, 6).map((e) => (
                <PromoCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-borda bg-card p-5 text-texto">
              Nenhuma promoção ativa agora. Quando várias rotas de uma companhia
              caem bem abaixo do normal no mesmo dia, elas aparecem aqui — e no{" "}
              <Link href="/promocoes" className="font-semibold text-link">
                calendário
              </Link>
              .
            </p>
          )}
        </section>

        {/* rotas */}
        <section aria-labelledby="rotas-h" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="rotas-h" className="font-disp text-2xl font-bold md:text-3xl">
              Rotas monitoradas
            </h2>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filtrar rotas"
            >
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={f.key === "todas" ? "/" : `/?filtro=${f.key}`}
                  className={`flex h-11 items-center rounded-full border px-4 text-sm ${
                    filtro === f.key
                      ? "border-tinta bg-tinta font-semibold text-white"
                      : "border-borda-forte bg-card font-medium text-tinta hover:bg-grade"
                  }`}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(({ route, stats, spark }) => {
              const code = routeCode(route);
              return (
                <Link
                  key={route.id}
                  href={`/rota/${code}`}
                  className="flex flex-col gap-3 rounded-xl border border-borda bg-card p-4.5 text-tinta transition hover:border-borda-forte"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-lg font-semibold">
                      {route.origin} → {route.destination}
                    </span>
                    {stats && <StatusSeal status={stats.status} />}
                  </div>
                  <div className="text-sm text-mut">
                    {cityName(route.origin)} – {cityName(route.destination)}
                  </div>
                  <Sparkline
                    values={spark}
                    color={
                      stats?.status === "abaixo" ? "#D9581C" : "#2457C5"
                    }
                  />
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[22px] font-semibold">
                      {stats?.todayMin ? formatBRL(stats.todayMin) : "—"}
                    </span>
                    <span className="text-[13px] text-mut">
                      {stats ? `menor hoje · ${stats.n}d de dados` : "sem dados"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* confianca */}
        <section className="grid gap-6 border-t border-borda-forte/60 pt-8 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <h3 className="text-[17px] font-semibold">Não vendemos passagens</h3>
            <p className="leading-relaxed text-texto">
              Monitoramos e avisamos. Na hora de comprar, você é levado ao site
              da companhia ou do buscador.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-[17px] font-semibold">De onde vêm os dados</h3>
            <p className="leading-relaxed text-texto">
              Coletas diárias em buscadores públicos e histórico oficial de
              tarifas da ANAC desde 2002.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-[17px] font-semibold">Preço de referência</h3>
            <p className="leading-relaxed text-texto">
              Tarifa básica, 1 adulto, sem bagagem despachada, em reais.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
