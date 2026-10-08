import type { PromoEvent } from "@/lib/data";

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  const meses = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  return `${day} ${meses[Number(m) - 1]}${d.slice(0, 4) !== new Date().getFullYear().toString() ? ` ${y}` : ""}`;
}

export function PromoCard({ event }: { event: PromoEvent }) {
  const active = !event.ended_at;
  const days = event.ended_at
    ? Math.max(
        1,
        Math.round(
          (Date.parse(event.ended_at) - Date.parse(event.started_at)) / 86400000
        ) + 1
      )
    : null;
  return (
    <article className="flex flex-col gap-3.5 rounded-xl border border-borda bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{event.airline}</span>
        <span
          className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${
            active
              ? "bg-promo-selo text-promo-texto"
              : "bg-neutro-selo text-texto"
          }`}
        >
          {active ? "Em andamento" : "Encerrada"}
        </span>
      </div>
      <div className="flex gap-6">
        <div>
          <div
            className={`font-mono text-3xl font-semibold ${
              active ? "text-destaque-texto" : "text-tinta"
            }`}
          >
            {event.avg_discount_pct
              ? `−${Math.round(event.avg_discount_pct)}%`
              : "—"}
          </div>
          <div className="text-[13px] text-mut">desconto médio</div>
        </div>
        <div>
          <div className="font-mono text-3xl font-semibold">
            {active ? (event.affected_routes?.length ?? 0) : (days ?? 0)}
          </div>
          <div className="text-[13px] text-mut">
            {active ? "rotas afetadas" : "dias de duração"}
          </div>
        </div>
      </div>
      <div className="text-sm text-texto">
        {active
          ? `Desde ${fmtDate(event.started_at)}`
          : `${fmtDate(event.started_at)} a ${fmtDate(event.ended_at!)}`}
      </div>
    </article>
  );
}
