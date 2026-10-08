import Link from "next/link";
import { notFound } from "next/navigation";
import { AdvanceCurve } from "@/components/AdvanceCurve";
import { DecisionSeal } from "@/components/Seal";
import { PriceChart } from "@/components/PriceChart";
import { PriceGauge } from "@/components/PriceGauge";
import { Seasonality } from "@/components/Seasonality";
import {
  advanceCurve,
  AIRLINE_COLORS,
  airlineShort,
  airlineSite,
  airlineTable,
  cityName,
  dailyMinByAirline,
  dailyRouteMin,
  formatBRL,
  formatDay,
  getObservations,
  getPromoEvents,
  getRouteByCode,
  getSeasonality,
  LEAD_TIMES,
  MIN_POINTS,
  routeStats,
  TRIP_TYPES,
} from "@/lib/data";

export const dynamic = "force-dynamic";

const TRIP_LABEL: Record<string, string> = {
  "one-way": "só ida",
  "round-trip": "ida e volta, 7 dias",
};

const PERIODS = [
  { key: "30", label: "30 dias", days: 30 },
  { key: "90", label: "90 dias", days: 90 },
  { key: "365", label: "1 ano", days: 365 },
];

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ trip?: string; lead?: string; periodo?: string }>;
};

export default async function RoutePage({ params, searchParams }: Props) {
  const { code } = await params;
  const { trip = "round-trip", lead = "30", periodo = "90" } = await searchParams;

  const route = await getRouteByCode(code);
  if (!route) notFound();

  const leadDays = Number(lead) || 30;
  const [obs, promos, seasonality] = await Promise.all([
    getObservations(route.id),
    getPromoEvents(),
    getSeasonality(route.origin, route.destination),
  ]);

  const seriesObs = obs.filter(
    (o) => o.trip_type === trip && o.lead_days === leadDays
  );
  const { points, airlines } = dailyMinByAirline(seriesObs);
  const stats = routeStats(dailyRouteMin(seriesObs));
  const curve = advanceCurve(obs.filter((o) => o.trip_type === trip));
  const table = airlineTable(seriesObs);

  const periodDays = PERIODS.find((p) => p.key === periodo)?.days ?? 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const chartData = points.filter((p) => p.time >= cutoffStr);

  const routePromos = promos.filter((p) => p.affected_routes?.includes(route.id));
  const activePromo = routePromos.find((p) => !p.ended_at);
  const today = new Date().toISOString().slice(0, 10);
  const promoRanges = routePromos.map((p) => ({
    from: p.started_at,
    to: p.ended_at ?? today,
  }));

  const qs = (t: string, l: number, p: string = periodo) =>
    `/rota/${code}?trip=${t}&lead=${l}&periodo=${p}`;

  const chip = (active: boolean) =>
    `flex h-11 min-w-[52px] items-center justify-center rounded-lg border px-3 text-sm ${
      active
        ? "border-tinta bg-tinta font-semibold text-white"
        : "border-borda-forte bg-card text-tinta hover:bg-grade"
    }`;

  const cheapest = table[0];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-8 md:px-6">
      {/* cabecalho */}
      <div className="flex flex-col gap-2.5">
        <nav aria-label="Caminho" className="text-sm text-mut">
          <Link href="/" className="text-link hover:text-link-hover">
            Rotas
          </Link>{" "}
          / {route.kind === "nacional" ? "Nacionais" : "Internacionais"} /{" "}
          {cityName(route.origin)} – {cityName(route.destination)}
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="font-disp flex flex-wrap items-center gap-3.5 text-4xl font-bold md:text-[44px]">
              <span className="font-mono">{route.origin}</span>
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 12h16" />
                <path d="M14 6l6 6-6 6" />
              </svg>
              <span className="font-mono">{route.destination}</span>
            </h1>
            <p className="mt-1.5 text-texto">
              {cityName(route.origin)} → {cityName(route.destination)} ·{" "}
              {TRIP_LABEL[trip] ?? trip} · tarifa básica, 1 adulto
            </p>
          </div>
          <Link
            href={`/alertas?rota=${code}`}
            className="flex h-12 items-center gap-2 rounded-lg bg-tinta px-5 font-semibold text-white"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            Criar alerta para esta rota
          </Link>
        </div>
      </div>

      {/* seletores */}
      <div className="flex flex-wrap items-center gap-5">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Comprando com antecedência de"
        >
          <span className="mr-1 text-sm font-semibold text-texto">
            Antecedência
          </span>
          {LEAD_TIMES.map((l) => (
            <Link key={l} href={qs(trip, l)} className={chip(l === leadDays)}>
              {l}d
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Tipo de viagem">
          <span className="mr-1 text-sm font-semibold text-texto">Viagem</span>
          {TRIP_TYPES.map((t) => (
            <Link
              key={t}
              href={qs(t, leadDays)}
              className={chip(t === trip)}
            >
              {t === "round-trip" ? "Ida e volta" : "Só ida"}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Período do gráfico">
          <span className="mr-1 text-sm font-semibold text-texto">Período</span>
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={qs(trip, leadDays, p.key)}
              className={chip(p.key === periodo)}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* faixa de situacao */}
      <section
        aria-label="Situação do preço hoje"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        <div className="flex flex-col gap-2.5 rounded-2xl bg-tinta p-6 text-white">
          <DecisionSeal status={stats?.status ?? "coletando"} />
          <div className="font-mono text-[44px] font-semibold leading-none">
            {stats?.todayMin ? formatBRL(stats.todayMin) : "—"}
          </div>
          <p className="leading-snug text-[#C3CDDB]">
            {stats?.status === "coletando" ? (
              <>
                Menor preço na última coleta
                {cheapest ? `, na ${airlineShort(cheapest.airline)}` : ""}. Estamos
                acumulando histórico desde {formatDay(stats.firstDay)} — o selo
                aparece com ~{MIN_POINTS} dias de dados.
              </>
            ) : stats?.diffPct !== null && stats?.diffPct !== undefined ? (
              <>
                Menor preço hoje
                {cheapest ? `, na ${airlineShort(cheapest.airline)}` : ""}. Está{" "}
                <strong className="text-white">
                  {Math.abs(Math.round(stats.diffPct))}%{" "}
                  {stats.diffPct < 0 ? "abaixo" : "acima"}
                </strong>{" "}
                da mediana dos últimos 28 dias.
              </>
            ) : (
              "Menor preço na última coleta."
            )}
          </p>
        </div>

        <div className="flex flex-col gap-3.5 rounded-2xl border border-borda bg-card p-6">
          <div className="font-semibold">Onde o preço de hoje está</div>
          {stats && stats.n >= 2 ? (
            <PriceGauge
              min={stats.min}
              p25={stats.p25}
              p75={stats.p75}
              max={stats.max}
              today={stats.todayMin}
            />
          ) : (
            <p className="text-sm text-mut">
              Ainda não há histórico suficiente para medir a faixa normal desta
              combinação.
            </p>
          )}
        </div>

        {activePromo ? (
          <div className="flex flex-col gap-2.5 rounded-2xl border border-borda bg-card p-6">
            <div className="font-semibold">Promoção detectada</div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-3xl font-semibold text-destaque-texto">
                {activePromo.avg_discount_pct
                  ? `−${Math.round(activePromo.avg_discount_pct)}%`
                  : "—"}
              </span>
              <span className="text-texto">
                {activePromo.airline}, desde {formatDay(activePromo.started_at)}
              </span>
            </div>
            <p className="text-sm leading-snug text-texto">
              Queda simultânea em {activePromo.affected_routes?.length ?? 0}{" "}
              rotas da companhia.
            </p>
            <Link
              href="/promocoes"
              className="text-[15px] font-semibold text-link hover:text-link-hover"
            >
              Ver no calendário
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 rounded-2xl border border-borda bg-card p-6">
            <div className="font-semibold">Promoções nesta rota</div>
            <p className="text-sm leading-snug text-texto">
              Nenhuma promoção ativa agora. Quando várias rotas da mesma
              companhia caem bem abaixo do normal no mesmo dia, marcamos aqui e
              no calendário.
            </p>
            <Link
              href="/promocoes"
              className="text-[15px] font-semibold text-link hover:text-link-hover"
            >
              Ver calendário de promoções
            </Link>
          </div>
        )}
      </section>

      {/* grafico principal */}
      <section
        aria-labelledby="hist-h"
        className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-disp text-2xl font-bold">
              Menor preço por dia de coleta
            </h2>
            <p className="mt-1 text-sm text-mut">
              {TRIP_LABEL[trip] === "só ida" ? "Só ida" : "Ida e volta"},
              partindo {leadDays} dias depois de cada coleta
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {airlines.map((a, i) => (
              <span key={a} className="flex items-center gap-2">
                <span
                  className="h-[3px] w-[18px] rounded-sm"
                  style={{ background: airlineColor(a, i) }}
                />
                {airlineShort(a)}
              </span>
            ))}
            <span className="flex items-center gap-2">
              <span className="h-3 w-4 rounded-sm bg-faixa" />
              Faixa normal
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-4 rounded-sm bg-promo" />
              Promoção
            </span>
          </div>
        </div>
        {chartData.length ? (
          <PriceChart
            data={chartData}
            airlines={airlines}
            band={
              stats && stats.n >= 2
                ? { low: stats.p25, high: stats.p75 }
                : undefined
            }
            promoRanges={promoRanges}
          />
        ) : (
          <p className="text-mut">
            Sem observações para esta combinação ainda.
          </p>
        )}
      </section>

      {/* antecedencia + sazonalidade */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="ant-h"
          className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-6"
        >
          <div>
            <h2 id="ant-h" className="font-disp text-[22px] font-bold">
              Quando comprar
            </h2>
            <p className="mt-1 text-sm text-mut">
              Preço médio por antecedência da compra,{" "}
              {TRIP_LABEL[trip] === "só ida" ? "só ida" : "ida e volta"}
            </p>
          </div>
          {curve.length ? (
            <AdvanceCurve bars={curve} />
          ) : (
            <p className="text-sm text-mut">Acumulando dados.</p>
          )}
        </section>

        <section
          aria-labelledby="saz-h"
          className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-6"
        >
          <div>
            <h2 id="saz-h" className="font-disp text-[22px] font-bold">
              Época do ano
            </h2>
            <p className="mt-1 text-sm text-mut">
              Tarifa média vendida por mês de viagem, comparada à média anual
              (ANAC)
            </p>
          </div>
          {seasonality.some((v) => v !== null) ? (
            <Seasonality index={seasonality} />
          ) : (
            <p className="text-sm text-mut">
              A ANAC ainda não publicou tarifas para este par de aeroportos.
            </p>
          )}
        </section>
      </div>

      {/* por companhia */}
      <section
        aria-labelledby="cia-h"
        className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-6"
      >
        <h2 id="cia-h" className="font-disp text-[22px] font-bold">
          Por companhia hoje
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-mut">
                <th className="border-b border-borda-forte/60 px-3 py-2.5 font-semibold">
                  Companhia
                </th>
                <th className="border-b border-borda-forte/60 px-3 py-2.5 text-right font-semibold">
                  Menor hoje
                </th>
                <th className="border-b border-borda-forte/60 px-3 py-2.5 text-right font-semibold">
                  Mediana 28 dias
                </th>
                <th className="border-b border-borda-forte/60 px-3 py-2.5 text-right font-semibold">
                  Diferença
                </th>
                <th className="border-b border-borda-forte/60 px-3 py-2.5 font-semibold">
                  Voo
                </th>
                <th className="border-b border-borda-forte/60 px-3 py-2.5">
                  <span className="sr-only">Ação</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {table.map((c) => (
                <tr key={c.airline}>
                  <td className="border-b border-grade px-3 py-3.5">
                    <span className="inline-flex items-center gap-2.5 font-semibold">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: airlineColor(c.airline) }}
                      />
                      {airlineShort(c.airline)}
                    </span>
                  </td>
                  <td className="font-mono border-b border-grade px-3 py-3.5 text-right font-semibold">
                    {formatBRL(c.today)}
                  </td>
                  <td className="font-mono border-b border-grade px-3 py-3.5 text-right text-texto">
                    {c.median ? formatBRL(c.median) : "—"}
                  </td>
                  <td
                    className={`font-mono border-b border-grade px-3 py-3.5 text-right font-semibold ${
                      c.diffPct !== null && c.diffPct < 0
                        ? "text-destaque-texto"
                        : "text-texto"
                    }`}
                  >
                    {c.diffPct !== null
                      ? `${c.diffPct > 0 ? "+" : "−"}${Math.abs(Math.round(c.diffPct))}%`
                      : "—"}
                  </td>
                  <td className="border-b border-grade px-3 py-3.5 text-texto">
                    {c.stops === 0 ? "Direto" : c.stops === 1 ? "1 escala" : c.stops ? `${c.stops} escalas` : "—"}
                  </td>
                  <td className="border-b border-grade px-3 py-3.5 text-right">
                    <a
                      href={airlineSite(c.airline, route.origin, route.destination)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-borda-forte px-3.5 text-sm font-semibold text-tinta hover:bg-grade"
                    >
                      Ver no site
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M7 17L17 7" />
                        <path d="M8 7h9v9" />
                      </svg>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-mut">
          Preços da última coleta
          {stats ? ` (${formatDay(stats.lastDay)})` : ""}. O valor final pode
          mudar no site da companhia. Não vendemos passagens.
        </p>
      </section>
    </main>
  );
}

function airlineColor(airline: string, i = 0) {
  const FALLBACK = ["#8A9BB4", "#C2841A", "#5B7AA0", "#7C6BAE"];
  return AIRLINE_COLORS[airline] ?? FALLBACK[i % FALLBACK.length];
}
