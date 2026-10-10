import { Observation, formatBRL } from "@/lib/data";

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

export function DailyFlights({ flights }: { flights: Observation[] }) {
  if (!flights.length) {
    return (
      <p className="rounded-lg bg-[#FBE3D4] p-3 text-sm text-[#B5410F]">
        Nenhum voo encontrado para esta data. A coleta do calendário ainda não
        preencheu essa data ou ela ainda não foi coletada.
      </p>
    );
  }

  // Deduplica: mantem a observacao mais recente de cada (numero de voo, partida).
  const latest = new Map<string, Observation>();
  for (const f of flights) {
    const key = `${f.flight_number ?? f.airline}-${f.departure ?? ""}`;
    const cur = latest.get(key);
    if (!cur || new Date(f.collected_at).getTime() > new Date(cur.collected_at).getTime()) {
      latest.set(key, f);
    }
  }

  const sorted = [...latest.values()].sort((a, b) => {
    const da = a.departure ? new Date(a.departure).getTime() : Infinity;
    const db = b.departure ? new Date(b.departure).getTime() : Infinity;
    return da - db;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#0E1A2B]/10 text-[#0E1A2B]/60">
            <th className="pb-2 font-medium">Voo</th>
            <th className="pb-2 font-medium">Companhia</th>
            <th className="pb-2 font-medium">Partida</th>
            <th className="pb-2 font-medium">Chegada</th>
            <th className="pb-2 font-medium text-right">Duração</th>
            <th className="pb-2 font-medium text-right">Escalas</th>
            <th className="pb-2 font-medium text-right">Preço</th>
          </tr>
        </thead>
        <tbody className="text-[#0E1A2B]">
          {sorted.map((f, idx) => (
            <tr key={idx} className="border-b border-[#0E1A2B]/5 last:border-0">
              <td className="py-2 font-mono text-xs">{f.flight_number ?? "—"}</td>
              <td className="py-2">{f.airline}</td>
              <td className="py-2 font-mono">{formatDateTime(f.departure)}</td>
              <td className="py-2 font-mono">{formatDateTime(f.arrival)}</td>
              <td className="py-2 text-right font-mono">{formatDuration(f.duration_min)}</td>
              <td className="py-2 text-right font-mono">{f.stops ?? 0}</td>
              <td className="py-2 text-right font-mono font-medium text-[#B5410F]">
                {formatBRL(f.price_brl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
