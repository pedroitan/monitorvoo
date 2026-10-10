import { supabase } from "./supabase";

export type Route = {
  id: string;
  origin: string;
  destination: string;
  kind: "nacional" | "internacional";
};

export type Observation = {
  route_id: string;
  airline: string;
  collected_at: string;
  flight_date: string;
  return_date: string | null;
  lead_days: number;
  trip_type: "one-way" | "round-trip";
  price_brl: number;
  stops: number | null;
  source: string;
  // campos da migration 0002 (podem estar ausentes ate aplicada)
  flight_number?: string | null;
  departure?: string | null;
  arrival?: string | null;
  duration_min?: number | null;
  plane_type?: string | null;
  legs?: unknown[] | null;
};

export type PromoEvent = {
  id: string;
  airline: string;
  started_at: string;
  ended_at: string | null;
  affected_routes: string[];
  avg_discount_pct: number | null;
};

export type RouteStatus = "abaixo" | "normal" | "acima" | "coletando";

export type RouteStats = {
  n: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  todayMin: number | null;
  diffPct: number | null;
  status: RouteStatus;
  firstDay: string;
  lastDay: string;
};

export const LEAD_TIMES = [7, 14, 30, 60, 90, 180];
export const TRIP_TYPES = ["one-way", "round-trip"] as const;
export const MIN_POINTS = 10; // minimo de dias de coleta para julgar (mesmo do detect.py)
export const STATS_WINDOW_DAYS = 28;

export const CITIES: Record<string, string> = {
  GRU: "São Paulo–Guarulhos",
  CGH: "São Paulo–Congonhas",
  SDU: "Rio–Santos Dumont",
  GIG: "Rio–Galeão",
  SSA: "Salvador",
  REC: "Recife",
  FOR: "Fortaleza",
  BSB: "Brasília",
  POA: "Porto Alegre",
  CNF: "Belo Horizonte",
  MAO: "Manaus",
  BEL: "Belém",
  FLN: "Florianópolis",
  VCP: "Campinas",
  LIS: "Lisboa",
  MIA: "Miami",
  MCO: "Orlando",
  EZE: "Buenos Aires",
  SCL: "Santiago",
  CDG: "Paris",
  MAD: "Madri",
  JFK: "Nova York",
  BOG: "Bogotá",
  SID: "Sal (Cabo Verde)",
};

export function cityName(iata: string) {
  return CITIES[iata] ?? iata;
}

/** Cores de serie no grafico — paleta dos tokens de design. */
export const AIRLINE_COLORS: Record<string, string> = {
  LATAM: "#2457C5",
  "Tap Air Portugal": "#0B7A6C",
  Azul: "#7B3FB0",
  Gol: "#B3862E",
  American: "#8A9BB4",
  United: "#5B7AA0",
  "Air France": "#7C6BAE",
  Iberia: "#B26E63",
  "Air Europa": "#4E8C7B",
  "Aerolineas Argentinas": "#6FA8DC",
  COPA: "#3D7EAA",
  Avianca: "#A05050",
  Emirates: "#8C6A3F",
};

export const AIRLINE_SITES: Record<string, string> = {
  Gol: "https://www.voegol.com.br",
  LATAM: "https://www.latamairlines.com/br/pt",
  Azul: "https://www.voeazul.com.br",
  "Tap Air Portugal": "https://www.flytap.com/pt-br",
  American: "https://www.aa.com",
  United: "https://www.united.com",
  "Aerolineas Argentinas": "https://www.aerolineas.com",
  "Air France": "https://wwws.airfrance.com.br",
  Iberia: "https://www.iberia.com/br/pt",
  "Air Europa": "https://www.aireuropa.com",
  COPA: "https://www.copaair.com",
  Avianca: "https://www.avianca.com/br",
  Emirates: "https://www.emirates.com/br/portuguese",
};

export function airlineSite(airline: string, origin: string, destination: string) {
  return (
    AIRLINE_SITES[airline] ??
    `https://www.google.com/travel/flights?q=${origin}%20${destination}`
  );
}

/** Nome curto da cia para UI. */
export function airlineShort(airline: string) {
  const map: Record<string, string> = {
    "Tap Air Portugal": "TAP",
    "Aerolineas Argentinas": "Aerolíneas",
  };
  return map[airline] ?? airline;
}

export function routeCode(r: Pick<Route, "origin" | "destination">) {
  return `${r.origin}-${r.destination}`;
}

// ---------- queries ----------

const OBS_SELECT =
  "route_id, airline, collected_at, flight_date, return_date, lead_days, trip_type, price_brl, stops, source";

const OBS_SELECT_EXTENDED =
  `${OBS_SELECT}, flight_number, departure, arrival, duration_min, plane_type, legs`;

/** Busca paginada — Supabase devolve no max 1000 linhas por chamada. */
interface Pageable<T> {
  range(
    from: number,
    to: number
  ): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}

async function fetchAll<T>(makeQuery: () => Pageable<T>): Promise<T[]> {
  const out: T[] = [];
  let page = 0;
  for (;;) {
    const res = await makeQuery().range(page * 1000, (page + 1) * 1000 - 1);
    if (res.error) throw new Error(res.error.message);
    out.push(...(res.data ?? []));
    if ((res.data?.length ?? 0) < 1000) return out;
    page += 1;
  }
}

export async function getRoutes(): Promise<Route[]> {
  const { data, error } = await supabase
    .from("routes")
    .select("id, origin, destination, kind")
    .eq("active", true)
    .order("origin");
  if (error) throw error;
  return data ?? [];
}

export async function getRouteByCode(code: string): Promise<Route | null> {
  const [origin, destination] = code.toUpperCase().split("-");
  if (!origin || !destination) return null;
  const { data, error } = await supabase
    .from("routes")
    .select("id, origin, destination, kind")
    .eq("origin", origin)
    .eq("destination", destination)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Todas as observacoes de uma rota (todas as combinacoes). */
export async function getObservations(routeId: string): Promise<Observation[]> {
  return fetchAll(() =>
    supabase
      .from("fare_observations")
      .select(OBS_SELECT)
      .eq("route_id", routeId)
      .order("collected_at")
  );
}

/** Todas as observacoes (para a home: selos e sparklines por rota). */
export async function getAllObservations(): Promise<Observation[]> {
  return fetchAll(() =>
    supabase.from("fare_observations").select(OBS_SELECT).order("collected_at")
  );
}

/** Observacoes dos ultimos N dias (padrao 1 dia = ciclo de coleta mais recente). */
export async function getLatestFlightOptions(days: number = 1): Promise<Observation[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  // Tenta selecionar os novos campos da migration 0002; se ainda nao foi
  // aplicada, cai no OBS_SELECT legado sem quebrar a pagina.
  try {
    return await fetchAll(() =>
      supabase
        .from("fare_observations")
        .select(OBS_SELECT_EXTENDED)
        .gte("collected_at", since.toISOString())
        .order("collected_at", { ascending: false })
    );
  } catch {
    return fetchAll(() =>
      supabase
        .from("fare_observations")
        .select(OBS_SELECT)
        .gte("collected_at", since.toISOString())
        .order("collected_at", { ascending: false })
    );
  }
}

export async function getPromoEvents(): Promise<PromoEvent[]> {
  const { data, error } = await supabase
    .from("promo_events")
    .select("id, airline, started_at, ended_at, affected_routes, avg_discount_pct")
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

/** Sazonalidade ANAC: indice mensal (100 = media anual) para o par de aeroportos. */
export async function getSeasonality(
  origin: string,
  destination: string
): Promise<(number | null)[]> {
  const { data, error } = await supabase
    .from("anac_fares")
    .select("month, fare, seats")
    .eq("origin", origin)
    .eq("destination", destination);
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return Array(12).fill(null);

  const byMonth: { fare: number; seats: number }[][] = Array.from(
    { length: 12 },
    () => []
  );
  for (const r of rows) byMonth[r.month - 1].push({ fare: r.fare, seats: r.seats ?? 1 });

  const wavg = (xs: { fare: number; seats: number }[]) =>
    xs.reduce((a, x) => a + x.fare * x.seats, 0) /
    (xs.reduce((a, x) => a + x.seats, 0) || 1);
  const annual = wavg(rows);
  return byMonth.map((m) => (m.length ? (wavg(m) / annual) * 100 : null));
}

// ---------- derivados ----------

/** Pivota observacoes: menor preco por cia por dia de coleta. */
export function dailyMinByAirline(obs: Observation[]) {
  const byDay = new Map<string, Record<string, number>>();
  const airlines = new Set<string>();
  for (const o of obs) {
    const day = o.collected_at.slice(0, 10);
    const point = byDay.get(day) ?? {};
    if (!(o.airline in point) || o.price_brl < point[o.airline]) {
      point[o.airline] = o.price_brl;
    }
    byDay.set(day, point);
    airlines.add(o.airline);
  }
  const points = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, v]) => ({ time, ...v }));
  return { points, airlines: [...airlines].sort() };
}

/** Menor preco do dia considerando todas as cias (serie da rota). */
export function dailyRouteMin(obs: Observation[]): { day: string; price: number }[] {
  const byDay = new Map<string, number>();
  for (const o of obs) {
    const day = o.collected_at.slice(0, 10);
    const cur = byDay.get(day);
    if (cur === undefined || o.price_brl < cur) byDay.set(day, o.price_brl);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, price]) => ({ day, price }));
}

export type CalendarCell = {
  flight_date: string;
  price_brl: number;
  airline: string;
  lead_days: number;
};

/** Menor preco por data de voo — base para o calendario flexivel. */
export function routeCalendar(obs: Observation[], trip: string): CalendarCell[] {
  const byDate = new Map<string, Observation>();
  for (const o of obs) {
    if (o.trip_type !== trip) continue;
    const cur = byDate.get(o.flight_date);
    if (!cur || o.price_brl < cur.price_brl) byDate.set(o.flight_date, o);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([flight_date, o]) => ({
      flight_date,
      price_brl: o.price_brl,
      airline: o.airline,
      lead_days: o.lead_days,
    }));
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Distribuicao dos ultimos 28 dias + status do preco de hoje. */
export function routeStats(daily: { day: string; price: number }[]): RouteStats | null {
  if (!daily.length) return null;
  const cutoff = daily.at(-1)!.day;
  const cutoffDate = new Date(`${cutoff}T00:00:00`);
  cutoffDate.setDate(cutoffDate.getDate() - STATS_WINDOW_DAYS);
  const window = daily.filter((d) => d.day >= cutoffDate.toISOString().slice(0, 10));
  const values = window.map((d) => d.price).sort((a, b) => a - b);
  const todayMin = daily.at(-1)!.price;
  const median = percentile(values, 0.5);
  const p25 = percentile(values, 0.25);
  const p75 = percentile(values, 0.75);
  const diffPct = median ? ((todayMin - median) / median) * 100 : null;

  let status: RouteStatus = "coletando";
  if (daily.length >= MIN_POINTS) {
    status = todayMin < p25 ? "abaixo" : todayMin > p75 ? "acima" : "normal";
  }

  return {
    n: daily.length,
    min: values[0],
    p25,
    median,
    p75,
    max: values.at(-1)!,
    todayMin,
    diffPct,
    status,
    firstDay: daily[0].day,
    lastDay: daily.at(-1)!.day,
  };
}

/** Curva de antecedencia: media do menor preco diario por lead. */
export function advanceCurve(obs: Observation[]): { lead: number; avg: number }[] {
  return LEAD_TIMES.map((lead) => {
    const daily = dailyRouteMin(obs.filter((o) => o.lead_days === lead));
    if (!daily.length) return { lead, avg: 0 };
    return {
      lead,
      avg: daily.reduce((a, d) => a + d.price, 0) / daily.length,
    };
  }).filter((b) => b.avg > 0);
}

/** Tabela por cia: menor preco na coleta mais recente vs mediana 28d. */
export function airlineTable(obs: Observation[]) {
  const byAirline = new Map<string, { day: string; price: number; stops: number | null }[]>();
  for (const o of obs) {
    const day = o.collected_at.slice(0, 10);
    const rows = byAirline.get(o.airline) ?? [];
    const existing = rows.find((r) => r.day === day);
    if (existing) {
      if (o.price_brl < existing.price) {
        existing.price = o.price_brl;
        existing.stops = o.stops;
      }
    } else {
      rows.push({ day, price: o.price_brl, stops: o.stops });
    }
    byAirline.set(o.airline, rows);
  }
  return [...byAirline.entries()]
    .map(([airline, rows]) => {
      rows.sort((a, b) => a.day.localeCompare(b.day));
      const cutoff = new Date(`${rows.at(-1)!.day}T00:00:00`);
      cutoff.setDate(cutoff.getDate() - STATS_WINDOW_DAYS);
      const window = rows
        .filter((r) => r.day >= cutoff.toISOString().slice(0, 10))
        .map((r) => r.price)
        .sort((a, b) => a - b);
      const median = percentile(window, 0.5);
      const today = rows.at(-1)!;
      return {
        airline,
        today: today.price,
        stops: today.stops,
        median,
        diffPct: median ? ((today.price - median) / median) * 100 : null,
      };
    })
    .sort((a, b) => a.today - b.today);
}

/** Resumo por rota para a home: stats + sparkline de uma serie padrao. */
export function summarizeRoutes(
  routes: Route[],
  obs: Observation[],
  trip: string = "round-trip",
  lead: number = 30
) {
  const byRoute = new Map<string, Observation[]>();
  for (const o of obs) {
    if (o.trip_type !== trip || o.lead_days !== lead) continue;
    const rows = byRoute.get(o.route_id) ?? [];
    rows.push(o);
    byRoute.set(o.route_id, rows);
  }
  return routes.map((r) => {
    const routeObs = byRoute.get(r.id) ?? [];
    const daily = dailyRouteMin(routeObs);
    return {
      route: r,
      stats: routeStats(daily),
      spark: daily.map((d) => d.price),
    };
  });
}

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function formatDay(d: string) {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

// ---------- qualidade / QA ----------

export type QualityRouteStats = {
  routeId: string;
  code: string;
  origin: string;
  destination: string;
  kind: "nacional" | "internacional";
  total: number;
  first: string | null;
  last: string | null;
  days: number;
  airlines: string[];
  trips: { type: string; count: number }[];
  leads: number[];
  min: number;
  max: number;
  median: number;
};

export type QualityStats = {
  totalObservations: number;
  activeRoutes: number;
  routesWithData: number;
  collectionDays: number;
  airlines: number;
  dailyVolume: { day: string; count: number }[];
  airlineCounts: { airline: string; count: number }[];
  leadTripCounts: { lead: number; trip: string; count: number }[];
  routes: QualityRouteStats[];
  routesWithoutData: Route[];
};

export async function getQualityStats(): Promise<QualityStats> {
  const [routes, obs] = await Promise.all([getRoutes(), getAllObservations()]);

  const routesWithData = new Set<string>();
  const byRoute = new Map<string, Observation[]>();
  const byDay = new Map<string, number>();
  const byAirline = new Map<string, number>();
  const byLeadTrip = new Map<string, number>();
  const airlineSet = new Set<string>();

  for (const o of obs) {
    routesWithData.add(o.route_id);
    const list = byRoute.get(o.route_id) ?? [];
    list.push(o);
    byRoute.set(o.route_id, list);

    const day = o.collected_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);

    byAirline.set(o.airline, (byAirline.get(o.airline) ?? 0) + 1);
    airlineSet.add(o.airline);

    const lt = `${o.lead_days}|${o.trip_type}`;
    byLeadTrip.set(lt, (byLeadTrip.get(lt) ?? 0) + 1);
  }

  const routeStats: QualityRouteStats[] = routes
    .map((r) => {
      const list = byRoute.get(r.id) ?? [];
      const days = new Set(list.map((o) => o.collected_at.slice(0, 10)));
      const prices = list.map((o) => o.price_brl).sort((a, b) => a - b);
      const tripsMap = new Map<string, number>();
      const leadsSet = new Set<number>();
      const airlinesSet = new Set<string>();
      for (const o of list) {
        tripsMap.set(o.trip_type, (tripsMap.get(o.trip_type) ?? 0) + 1);
        leadsSet.add(o.lead_days);
        airlinesSet.add(o.airline);
      }
      const sortedDates = list
        .map((o) => o.collected_at)
        .sort((a, b) => a.localeCompare(b));
      return {
        routeId: r.id,
        code: routeCode(r),
        origin: r.origin,
        destination: r.destination,
        kind: r.kind,
        total: list.length,
        first: sortedDates[0] ?? null,
        last: sortedDates.at(-1) ?? null,
        days: days.size,
        airlines: [...airlinesSet].sort(),
        trips: [...tripsMap.entries()].map(([type, count]) => ({ type, count })),
        leads: [...leadsSet].sort((a, b) => a - b),
        min: prices[0] ?? 0,
        max: prices.at(-1) ?? 0,
        median: percentile(prices, 0.5),
      };
    })
    .sort((a, b) => b.total - a.total);

  const dailyVolume = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));

  const airlineCounts = [...byAirline.entries()]
    .map(([airline, count]) => ({ airline, count }))
    .sort((a, b) => b.count - a.count);

  const leadTripCounts = [...byLeadTrip.entries()]
    .map(([key, count]) => {
      const [lead, trip] = key.split("|");
      return { lead: Number(lead), trip, count };
    })
    .sort((a, b) => a.lead - b.lead || a.trip.localeCompare(b.trip));

  return {
    totalObservations: obs.length,
    activeRoutes: routes.length,
    routesWithData: routesWithData.size,
    collectionDays: byDay.size,
    airlines: airlineSet.size,
    dailyVolume,
    airlineCounts,
    leadTripCounts,
    routes: routeStats,
    routesWithoutData: routes.filter((r) => !routesWithData.has(r.id)),
  };
}
