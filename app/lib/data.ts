import { supabase } from "./supabase";

export type Route = {
  id: string;
  origin: string;
  destination: string;
  kind: "nacional" | "internacional";
};

export type Observation = {
  airline: string;
  collected_at: string;
  flight_date: string;
  return_date: string | null;
  lead_days: number;
  trip_type: "one-way" | "round-trip";
  price_brl: number;
  stops: number | null;
  source: string;
};

export const LEAD_TIMES = [7, 14, 30, 60, 90, 180];
export const TRIP_TYPES = ["one-way", "round-trip"] as const;

export function routeCode(r: Pick<Route, "origin" | "destination">) {
  return `${r.origin}-${r.destination}`;
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

export async function getObservations(
  routeId: string,
  trip: string,
  lead: number
): Promise<Observation[]> {
  const { data, error } = await supabase
    .from("fare_observations")
    .select(
      "airline, collected_at, flight_date, return_date, lead_days, trip_type, price_brl, stops, source"
    )
    .eq("route_id", routeId)
    .eq("trip_type", trip)
    .eq("lead_days", lead)
    .order("collected_at");
  if (error) throw error;
  return data ?? [];
}

/** Menor preco por rota na coleta mais recente (para os cards da home). */
export async function getLatestMinPrices(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("fare_observations")
    .select("route_id, collected_at, price_brl")
    .order("collected_at", { ascending: false });
  if (error) throw error;

  const latest: Record<string, string> = {};
  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!(row.route_id in latest)) latest[row.route_id] = row.collected_at;
    if (row.collected_at !== latest[row.route_id]) continue;
    if (!(row.route_id in result) || row.price_brl < result[row.route_id]) {
      result[row.route_id] = row.price_brl;
    }
  }
  return result;
}

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
