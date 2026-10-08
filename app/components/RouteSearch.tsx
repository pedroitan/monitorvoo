"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type RouteOption = {
  origin: string;
  destination: string;
  originName: string;
  destinationName: string;
};

/** Busca de rota entre as monitoradas: origem → destinos disponíveis. */
export function RouteSearch({ routes }: { routes: RouteOption[] }) {
  const router = useRouter();
  const origins = useMemo(
    () => [...new Set(routes.map((r) => r.origin))].sort(),
    [routes]
  );
  const [origin, setOrigin] = useState(origins[0] ?? "");
  const destinations = useMemo(
    () =>
      routes
        .filter((r) => r.origin === origin)
        .map((r) => ({ code: r.destination, name: r.destinationName })),
    [routes, origin]
  );
  const [destination, setDestination] = useState("");
  const dest = destinations.some((d) => d.code === destination)
    ? destination
    : (destinations[0]?.code ?? "");
  const [trip, setTrip] = useState("round-trip");

  const originName =
    routes.find((r) => r.origin === origin)?.originName ?? origin;

  const inputCls =
    "h-12 w-full rounded-lg border border-borda-forte bg-white px-3.5 text-base text-tinta";

  return (
    <form
      className="flex max-w-4xl flex-wrap items-end gap-3 rounded-xl bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (origin && dest) router.push(`/rota/${origin}-${dest}?trip=${trip}`);
      }}
    >
      <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        <label htmlFor="origem" className="text-[13px] font-semibold text-texto">
          Origem
        </label>
        <select
          id="origem"
          className={inputCls}
          value={origin}
          onChange={(e) => {
            setOrigin(e.target.value);
            setDestination("");
          }}
        >
          {origins.map((o) => (
            <option key={o} value={o}>
              {originNameFor(routes, o)} ({o})
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        <label htmlFor="destino" className="text-[13px] font-semibold text-texto">
          Destino
        </label>
        <select
          id="destino"
          className={inputCls}
          value={dest}
          onChange={(e) => setDestination(e.target.value)}
        >
          {destinations.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[160px] flex-col gap-1.5">
        <label htmlFor="tipo" className="text-[13px] font-semibold text-texto">
          Viagem
        </label>
        <select
          id="tipo"
          className={inputCls}
          value={trip}
          onChange={(e) => setTrip(e.target.value)}
        >
          <option value="round-trip">Ida e volta (7 dias)</option>
          <option value="one-way">Só ida</option>
        </select>
      </div>
      <button
        type="submit"
        className="flex h-12 items-center rounded-lg bg-destaque px-6 font-semibold text-white"
      >
        Ver histórico
      </button>
      <span className="sr-only">
        De {originName} para {dest}
      </span>
    </form>
  );
}

function originNameFor(routes: RouteOption[], code: string) {
  return routes.find((r) => r.origin === code)?.originName ?? code;
}
