"use client";

import { CalendarCell, formatBRL } from "@/lib/data";

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function endOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() + (6 - r.getDay()));
  return r;
}

export function CalendarGrid({ calendar }: { calendar: CalendarCell[] }) {
  if (!calendar.length) {
    return (
      <p className="rounded-lg bg-[#FBE3D4] p-3 text-sm text-[#B5410F]">
        Ainda não há dados suficientes para montar o calendário de datas.
      </p>
    );
  }

  const byDate = new Map(calendar.map((c) => [c.flight_date, c]));
  const prices = calendar.map((c) => c.price_brl);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(max - min, 1);

  const start = startOfWeek(new Date(calendar[0].flight_date + "T12:00:00"));
  const end = endOfWeek(
    new Date(calendar[calendar.length - 1].flight_date + "T12:00:00")
  );

  const weeks: Date[][] = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-[#0E1A2B]/70">
        <span className="inline-block h-3 w-3 rounded bg-[#4ADE80]" /> mais barato
        <span className="inline-block h-3 w-3 rounded bg-[#FDE68A]" /> médio
        <span className="inline-block h-3 w-3 rounded bg-[#FCA5A5]" /> mais caro
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              {weekdays.map((w) => (
                <th key={w} className="pb-1 font-medium text-[#0E1A2B]/60">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((day) => {
                  const iso = toYMD(day);
                  const cell = byDate.get(iso);
                  const ratio = cell ? (cell.price_brl - min) / range : null;
                  const bg =
                    ratio === null
                      ? "bg-[#0E1A2B]/5"
                      : ratio < 0.33
                        ? "bg-[#4ADE80]/80"
                        : ratio < 0.66
                          ? "bg-[#FDE68A]/80"
                          : "bg-[#FCA5A5]/80";
                  return (
                    <td key={iso} className="h-20 min-w-[60px] p-1 align-top">
                      <div
                        className={`flex h-full flex-col justify-between rounded-lg p-1.5 ${bg} ${cell ? "text-[#0E1A2B]" : "text-[#0E1A2B]/40"}`}
                      >
                        <span className="font-mono font-medium">{day.getDate()}</span>
                        {cell && (
                          <>
                            <span className="font-mono font-semibold leading-tight">
                              {formatBRL(cell.price_brl)}
                            </span>
                            <span className="truncate text-[10px] opacity-80">
                              {cell.airline}
                            </span>
                            <span className="text-[9px] opacity-70">
                              {cell.lead_days}d
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#0E1A2B]/60">
        Células vazias são datas ainda não coletadas. A grade preenche conforme o
        cron acumula histórico para diferentes datas de partida.
      </p>
    </div>
  );
}
