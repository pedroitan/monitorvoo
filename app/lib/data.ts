import { supabase } from "./supabase";

export type Route = {
  id: string;
  origin: string;
  destination: string;
  kind: "nacional" | "internacional";
  priority?: number;
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
  MDE: "Medellín",
  CTG: "Cartagena",
  CLO: "Cali",
  BAQ: "Barranquilla",
  SMR: "Santa Marta",
  PEI: "Pereira",
  SID: "Sal (Cabo Verde)",
};

export const AIRPORTS: Record<
  string,
  { city: string; airport: string; country: string }
> = {
  GRU: { city: "São Paulo", airport: "Aeroporto Internacional de Guarulhos", country: "br" },
  CGH: { city: "São Paulo", airport: "Aeroporto de Congonhas", country: "br" },
  VCP: { city: "Campinas", airport: "Aeroporto Internacional de Viracopos", country: "br" },
  GIG: { city: "Rio de Janeiro", airport: "Aeroporto Internacional do Galeão", country: "br" },
  SDU: { city: "Rio de Janeiro", airport: "Aeroporto Santos Dumont", country: "br" },
  SSA: { city: "Salvador", airport: "Aeroporto Internacional de Salvador", country: "br" },
  REC: { city: "Recife", airport: "Aeroporto Internacional de Guararapes", country: "br" },
  FOR: { city: "Fortaleza", airport: "Aeroporto Internacional Pinto Martins", country: "br" },
  BSB: { city: "Brasília", airport: "Aeroporto Internacional Juscelino Kubitschek", country: "br" },
  POA: { city: "Porto Alegre", airport: "Aeroporto Internacional Salgado Filho", country: "br" },
  CNF: { city: "Belo Horizonte", airport: "Aeroporto Internacional de Confins", country: "br" },
  MAO: { city: "Manaus", airport: "Aeroporto Internacional Eduardo Gomes", country: "br" },
  BEL: { city: "Belém", airport: "Aeroporto Internacional Val-de-Cans", country: "br" },
  FLN: { city: "Florianópolis", airport: "Aeroporto Internacional Hercílio Luz", country: "br" },
  LIS: { city: "Lisboa", airport: "Aeroporto Humberto Delgado", country: "pt" },
  MAD: { city: "Madri", airport: "Aeroporto Adolfo Suárez Madrid–Barajas", country: "es" },
  CDG: { city: "Paris", airport: "Aeroporto Charles de Gaulle", country: "fr" },
  MIA: { city: "Miami", airport: "Miami International Airport", country: "us" },
  MCO: { city: "Orlando", airport: "Orlando International Airport", country: "us" },
  JFK: { city: "Nova York", airport: "Aeroporto John F. Kennedy", country: "us" },
  EZE: { city: "Buenos Aires", airport: "Aeroporto Internacional de Ezeiza", country: "ar" },
  SCL: { city: "Santiago", airport: "Aeroporto Arturo Merino Benítez", country: "cl" },
  SID: { city: "Sal (Cabo Verde)", airport: "Aeroporto Internacional Amílcar Cabral", country: "cv" },
  BOG: { city: "Bogotá", airport: "Aeroporto Internacional El Dorado", country: "co" },
  MDE: { city: "Medellín", airport: "Aeroporto Internacional José María Córdova", country: "co" },
  CTG: { city: "Cartagena", airport: "Aeroporto Internacional Rafael Núñez", country: "co" },
  CLO: { city: "Cali", airport: "Aeroporto Internacional Alfonso Bonilla Aragón", country: "co" },
  BAQ: { city: "Barranquilla", airport: "Aeroporto Internacional Ernesto Cortissoz", country: "co" },
  SMR: { city: "Santa Marta", airport: "Aeroporto Internacional Simón Bolívar", country: "co" },
  PEI: { city: "Pereira", airport: "Aeroporto Internacional Matecaña", country: "co" },
};

export function cityName(iata: string) {
  return CITIES[iata] ?? iata;
}

/** "GRU" -> "São Paulo — Aeroporto Internacional de Guarulhos" */
export function airportName(iata: string) {
  const a = AIRPORTS[iata];
  return a ? `${a.city} — ${a.airport}` : iata;
}

/** ISO-3166 minusculo do pais do aeroporto ("GRU" -> "br"), para flagcdn. */
export function airportCountry(iata: string) {
  return AIRPORTS[iata]?.country ?? null;
}

export const COUNTRIES: Record<string, string> = {
  br: "Brasil",
  co: "Colômbia",
  pt: "Portugal",
  es: "Espanha",
  fr: "França",
  us: "Estados Unidos",
  ar: "Argentina",
  cl: "Chile",
  cv: "Cabo Verde",
};

/** "br" -> "Brasil" */
export function countryName(iso: string | null | undefined) {
  return (iso && COUNTRIES[iso]) ?? iso ?? "?";
}

/** Cores de serie no grafico — paleta dos tokens de design. */
export const AIRLINE_COLORS: Record<string, string> = {
  LATAM: "#B0305C",
  "Tap Air Portugal": "#0B7A6C",
  Azul: "#2F6FDE",
  Gol: "#D9730D",
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
  `${OBS_SELECT}, flight_number, departure, arrival, duration_min, plane_type`;

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
    .select("id, origin, destination, kind, priority")
    .eq("active", true)
    .order("origin");
  if (error) throw error;
  return data ?? [];
}

/** priority 3 = trecho da malha Brasil (camada D do estudo), fora da home. */
export const BRAZIL_MESH_PRIORITY = 3;

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
  try {
    return await fetchAll(() =>
      supabase
        .from("fare_observations")
        .select(OBS_SELECT_EXTENDED)
        .eq("route_id", routeId)
        .order("collected_at")
    );
  } catch {
    return fetchAll(() =>
      supabase
        .from("fare_observations")
        .select(OBS_SELECT)
        .eq("route_id", routeId)
        .order("collected_at")
    );
  }
}

/** Todas as observacoes (para a home: selos e sparklines por rota). */
export async function getAllObservations(): Promise<Observation[]> {
  try {
    return await fetchAll(() =>
      supabase.from("fare_observations").select(OBS_SELECT_EXTENDED).order("collected_at")
    );
  } catch {
    return fetchAll(() =>
      supabase.from("fare_observations").select(OBS_SELECT).order("collected_at")
    );
  }
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

/** Menor preco por data de voo — base para o calendario flexivel.
 * Usa apenas o ciclo de coleta mais recente para cada data. */
export function routeCalendar(obs: Observation[], trip: string): CalendarCell[] {
  const byDate = new Map<string, Observation[]>();
  for (const o of obs) {
    if (o.trip_type !== trip) continue;
    (byDate.get(o.flight_date) ?? byDate.set(o.flight_date, []).get(o.flight_date)!).push(o);
  }
  const cells: CalendarCell[] = [];
  for (const [flight_date, list] of byDate.entries()) {
    const latestDay = list
      .map((o) => o.collected_at.slice(0, 10))
      .sort()
      .at(-1)!;
    const latest = list.filter((o) => o.collected_at.slice(0, 10) === latestDay);
    const cheapest = latest.reduce((a, b) => (a.price_brl <= b.price_brl ? a : b));
    cells.push({
      flight_date,
      price_brl: cheapest.price_brl,
      airline: cheapest.airline,
      lead_days: cheapest.lead_days,
    });
  }
  return cells.sort((a, b) => a.flight_date.localeCompare(b.flight_date));
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

/** Horario local do aeroporto (partida/chegada): le o relogio direto da
 * string, sem conversao de fuso. "2026-11-10T08:05:00" -> "10/11, 08:05". */
export function formatLocalTime(value: string | null | undefined) {
  const m = value?.match(/^\d{4}-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? `${m[2]}/${m[1]}, ${m[3]}:${m[4]}` : "—";
}

/** Momento da coleta, sempre no horario de Brasilia. */
export function formatCollected(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------- saude da coleta do estudo Colombia (collection_runs) ----------

export const STUDY_PANEL_PER_HOUR = 36; // 3 pares de datas x 4 rotas x 3 buscas
const STUDY_GRID_TOTAL = 3 * 7 * 2 * 114; // origens x destinos x sentidos x datas D+7..D+120
const BRT_OFFSET_MS = 3 * 3600 * 1000;

export type StudyHealth = {
  /** ok/total = painel A; calls/failed/mesh = todas as camadas (capacidade x bloqueios). */
  hours: {
    day: string;
    hour: number;
    ok: number;
    total: number;
    calls: number;
    failed: number;
    mesh: number;
    future: boolean;
  }[];
  days: string[];
  status: { layer: string; status: string; count: number }[];
  gridFreshPct: number;
  lastRun: string | null;
  runs7d: number;
};

type RunRow = {
  run_at: string;
  layer: string;
  status: string;
  origin: string;
  destination: string;
  flight_date: string;
  trip_type: string;
};

/** null = migration 0003 ainda nao aplicada. */
export async function getStudyHealth(): Promise<StudyHealth | null> {
  const since = new Date(Date.now() - 7 * 86400 * 1000);
  let runs: RunRow[];
  try {
    runs = await fetchAll<RunRow>(() =>
      supabase
        .from("collection_runs")
        .select("run_at, layer, status, origin, destination, flight_date, trip_type")
        .gte("run_at", since.toISOString())
        .order("run_at")
    );
  } catch {
    return null;
  }

  const brt = (iso: string) => new Date(new Date(iso).getTime() - BRT_OFFSET_MS).toISOString();
  const nowBrt = brt(new Date().toISOString());
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.parse(nowBrt) - (6 - i) * 86400 * 1000).toISOString().slice(0, 10)
  );

  const panel = new Map<string, { ok: number; total: number }>();
  const status = new Map<string, number>();
  const fresh = new Set<string>();
  const freshSince = Date.now() - 96 * 3600 * 1000;
  const gridEnd = new Date(Date.now() + 120 * 86400 * 1000).toISOString().slice(0, 10);
  const load = new Map<string, { calls: number; failed: number; mesh: number }>();
  for (const r of runs) {
    const local = brt(r.run_at);
    const l = load.get(local.slice(0, 13)) ?? { calls: 0, failed: 0, mesh: 0 };
    l.calls += 1;
    if (r.status === "blocked" || r.status === "error") l.failed += 1;
    if (r.layer === "D") l.mesh += 1;
    load.set(local.slice(0, 13), l);
    if (r.layer === "A") {
      const key = local.slice(0, 13);
      const cell = panel.get(key) ?? { ok: 0, total: 0 };
      cell.total += 1;
      if (r.status === "ok" || r.status === "empty") cell.ok += 1;
      panel.set(key, cell);
    }
    status.set(`${r.layer}|${r.status}`, (status.get(`${r.layer}|${r.status}`) ?? 0) + 1);
    if (
      r.layer === "B" &&
      r.trip_type === "one-way" &&
      r.flight_date <= gridEnd &&
      r.status !== "error" &&
      r.status !== "blocked" &&
      Date.parse(r.run_at) >= freshSince
    ) {
      fresh.add(`${r.origin}-${r.destination}-${r.flight_date}`);
    }
  }

  const hours = days.flatMap((day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const key = `${day}T${String(hour).padStart(2, "0")}`;
      const cell = panel.get(key) ?? { ok: 0, total: 0 };
      const l = load.get(key) ?? { calls: 0, failed: 0, mesh: 0 };
      return { day, hour, ...cell, ...l, future: key > nowBrt.slice(0, 13) };
    })
  );

  return {
    hours,
    days,
    status: [...status.entries()]
      .map(([k, count]) => {
        const [layer, s] = k.split("|");
        return { layer, status: s, count };
      })
      .sort((a, b) => a.layer.localeCompare(b.layer) || b.count - a.count),
    gridFreshPct: Math.round((fresh.size / STUDY_GRID_TOTAL) * 100),
    lastRun: runs.at(-1)?.run_at ?? null,
    runs7d: runs.length,
  };
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

// ---------- achados do estudo (views da migration 0004) ----------

type Num = number | string | null;

export type Insights = {
  intraday: {
    series: number;
    since: string | null;
    pairs: number;
    changes: number;
    big_changes: number;
    reverted: number;
    days: number;
    day_amp_median: Num;
    day_amp_over5_share: Num;
    inter_day_median: Num;
  } | null;
  hourly: { hour: number; pairs: number; big_changes: number; small_changes: number }[];
  sampling: { every: number; avg_loss_pct: Num; max_loss_pct: Num; series: number }[];
  rtVsOw: {
    slot: string;
    origin: string;
    destination: string;
    dep: string;
    ret: string;
    n: number;
    rt_median: Num;
    two_ow_median: Num;
    ow_out_median: Num;
    ow_back_median: Num;
    rt_cheaper: number;
  }[];
  openJaw: {
    slot: string;
    origin: string;
    entry: string;
    exit: string;
    dep: string;
    ret: string;
    n: number;
    total_median: Num;
  }[];
  destinations: { origin: string; destination: string; dates: number; median_price: Num; min_price: Num }[];
  weekday: { dow: number; rel: Num; n: number }[];
  month: { month: string; rel: Num; n: number }[];
  lead: { bucket: number; rel: Num; n: number; dates: number }[];
  gridRt: {
    origin: string;
    destination: string;
    stay: number;
    n: number;
    rt_median: Num;
    two_ow_median: Num;
    rt_cheaper: number;
  }[];
  emptyPairs: { origin: string; destination: string; calls: number; empty: number }[];
  airlines: { airline: string; cheapest: number; present: number; searches: number }[];
  direct: { searches: number; with_direct: number; direct_ratio: Num } | null;
  departure: { period: string; rel: Num; cheapest: number; n: number }[];
  routeRt: {
    origin: string;
    destination: string;
    kind: string | null;
    days: number;
    rt_ow_ratio: Num;
    rt_median: Num;
    ow_median: Num;
  }[] | null; // null = migration 0006 ainda nao aplicada
  kindIntraday: {
    kind: string | null;
    series: number;
    pairs: number;
    changes: number;
    big_changes: number;
    big_night: number;
    change_median_pct: Num;
    reverted: number;
    day_amp_median: Num;
    day_amp_over5_share: Num;
  }[] | null; // null = migration 0007 ainda nao aplicada
};

/** Numeric do Postgres chega como string pelo PostgREST. */
export const num = (v: Num | undefined) => (v === null || v === undefined ? null : Number(v));

/** null = migration 0004 ainda nao aplicada. */
export async function getInsights(): Promise<Insights | null> {
  const views = [
    "insight_intraday",
    "insight_hourly",
    "insight_sampling",
    "insight_rt_vs_ow",
    "insight_open_jaw",
    "insight_destinations",
    "insight_weekday",
    "insight_month",
    "insight_lead",
    "insight_grid_rt",
    "insight_empty_pairs",
    "insight_airlines",
    "insight_direct",
    "insight_departure",
  ] as const;
  const res = await Promise.all(views.map((v) => supabase.from(v).select("*")));
  // 0006: opcional — a pagina funciona sem ela, so some a tabela por rota.
  const routeRtRes = await supabase.from("insight_route_rt").select("*");
  const kindRes = await supabase.from("insight_kind_intraday").select("*");
  if (res.some((r) => r.error)) return null;
  const [
    intraday, hourly, sampling, rtVsOw, openJaw, destinations, weekday,
    month, lead, gridRt, emptyPairs, airlines, direct, departure,
  ] = res.map((r) => r.data ?? []);
  return {
    intraday: (intraday[0] as Insights["intraday"]) ?? null,
    hourly: hourly as Insights["hourly"],
    sampling: sampling as Insights["sampling"],
    rtVsOw: rtVsOw as Insights["rtVsOw"],
    openJaw: openJaw as Insights["openJaw"],
    destinations: destinations as Insights["destinations"],
    weekday: weekday as Insights["weekday"],
    month: month as Insights["month"],
    lead: lead as Insights["lead"],
    gridRt: gridRt as Insights["gridRt"],
    emptyPairs: emptyPairs as Insights["emptyPairs"],
    airlines: airlines as Insights["airlines"],
    direct: (direct[0] as Insights["direct"]) ?? null,
    departure: departure as Insights["departure"],
    routeRt: routeRtRes.error ? null : (routeRtRes.data as Insights["routeRt"]),
    kindIntraday: kindRes.error ? null : (kindRes.data as Insights["kindIntraday"]),
  };
}
