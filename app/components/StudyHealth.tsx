import { STUDY_PANEL_PER_HOUR, formatCollected, formatDay } from "@/lib/data";
import type { StudyHealth as Health } from "@/lib/data";

const STATUS_LABEL: Record<string, string> = {
  ok: "ok",
  empty: "sem voos",
  error: "erro",
  blocked: "bloqueado",
};

const LAYER_LABEL: Record<string, string> = {
  A: "A · painel horário",
  B: "B · grade de datas",
  C: "C · sob demanda",
};

function cellTone(ok: number, total: number, future: boolean) {
  if (future) return "bg-[#0E1A2B]/5";
  if (total === 0) return "bg-[#B5410F]";
  const pct = ok / STUDY_PANEL_PER_HOUR;
  if (pct >= 0.95) return "bg-[#0B7A6C]";
  if (pct >= 0.5) return "bg-[#E8B931]";
  return "bg-[#D9581C]";
}

export function StudyHealth({ h }: { h: Health | null }) {
  if (!h) {
    return (
      <section className="rounded-2xl border border-[#D9581C]/30 bg-[#FBE3D4] p-4 text-sm text-[#B5410F]">
        <strong>Estudo Colômbia:</strong> aplique a migration{" "}
        <code>0003_collection_quality.sql</code> no Supabase para ver a saúde da coleta.
      </section>
    );
  }

  const past = h.hours.filter((c) => !c.future);
  const covered = past.filter((c) => c.ok >= STUDY_PANEL_PER_HOUR * 0.95).length;
  const missed = past.filter((c) => c.total === 0).length;

  return (
    <section className="space-y-4 rounded-2xl border border-[#0E1A2B]/10 bg-white p-4 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-semibold text-[#0E1A2B]">
          Estudo Colômbia — saúde da coleta (7 dias)
        </h2>
        <p className="text-xs text-[#0E1A2B]/60">
          Última chamada: {formatCollected(h.lastRun)} · {h.runs7d.toLocaleString("pt-BR")} chamadas
          registradas · horários de Brasília
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Horas do painel completas" value={`${covered}/${past.length}`} warn={covered < past.length * 0.95} />
        <Kpi label="Horas sem coleta" value={String(missed)} warn={missed > 0} />
        <Kpi label="Grade atualizada (≤ 96h)" value={`${h.gridFreshPct}%`} warn={h.gridFreshPct < 90} />
        <Kpi
          label="Bloqueios"
          value={String(h.status.filter((s) => s.status === "blocked").reduce((a, s) => a + s.count, 0))}
          warn={h.status.some((s) => s.status === "blocked")}
        />
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-[#0E1A2B]/70">
          Painel horário: buscas concluídas por hora (meta {STUDY_PANEL_PER_HOUR}/h)
        </div>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-[2px] text-[10px] text-[#0E1A2B]/60">
            <thead>
              <tr>
                <th />
                {Array.from({ length: 24 }, (_, i) => (
                  <th key={i} className="w-5 font-mono font-normal">
                    {i % 3 === 0 ? String(i).padStart(2, "0") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {h.days.map((day) => (
                <tr key={day}>
                  <td className="pr-2 font-mono">{formatDay(day)}</td>
                  {h.hours
                    .filter((c) => c.day === day)
                    .map((c) => (
                      <td
                        key={c.hour}
                        title={`${formatDay(day)} ${String(c.hour).padStart(2, "0")}h: ${c.ok}/${STUDY_PANEL_PER_HOUR}`}
                        className={`h-5 w-5 rounded-sm ${cellTone(c.ok, c.total, c.future)}`}
                      />
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#0E1A2B]/70">
          <Legend tone="bg-[#0B7A6C]" label="≥ 95%" />
          <Legend tone="bg-[#E8B931]" label="50–95%" />
          <Legend tone="bg-[#D9581C]" label="< 50%" />
          <Legend tone="bg-[#B5410F]" label="sem coleta" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#0E1A2B]/10 text-[#0E1A2B]/60">
              <th className="pb-2 font-medium">Camada</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 text-right font-medium">Chamadas</th>
            </tr>
          </thead>
          <tbody className="text-[#0E1A2B]">
            {h.status.map((s) => (
              <tr key={`${s.layer}-${s.status}`} className="border-b border-[#0E1A2B]/5 last:border-0">
                <td className="py-1.5">{LAYER_LABEL[s.layer] ?? s.layer}</td>
                <td className={`py-1.5 ${s.status === "ok" ? "" : "text-[#B5410F]"}`}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </td>
                <td className="py-1.5 text-right font-mono">{s.count.toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${warn ? "bg-[#FBE3D4] text-[#B5410F]" : "bg-[#F2F3F0] text-[#0E1A2B]"}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="font-display text-xl font-bold">{value}</div>
    </div>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded-sm ${tone}`} /> {label}
    </span>
  );
}
