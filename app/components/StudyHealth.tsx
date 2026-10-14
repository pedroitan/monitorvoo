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
  D: "D · malha Brasil",
};

const LOAD_BUCKETS = [
  [0, 50],
  [50, 100],
  [100, 150],
  [150, 200],
  [200, Infinity],
] as const;

function loadTone(calls: number, failed: number, future: boolean) {
  if (future) return "bg-[#111318]/5";
  if (calls === 0) return "bg-white border border-[#111318]/10";
  if (failed > 0) return "bg-[#B3261E]";
  if (calls >= 150) return "bg-[#111318]";
  if (calls >= 100) return "bg-[#111318]/70";
  if (calls >= 50) return "bg-[#111318]/45";
  return "bg-[#111318]/20";
}

function cellTone(ok: number, total: number, future: boolean) {
  if (future) return "bg-[#111318]/5";
  if (total === 0) return "bg-[#111318]";
  const pct = ok / STUDY_PANEL_PER_HOUR;
  if (pct >= 0.95) return "bg-[#0B7A6C]";
  if (pct >= 0.5) return "bg-[#E8B931]";
  return "bg-[#0B7A48]";
}

export function StudyHealth({ h }: { h: Health | null }) {
  if (!h) {
    return (
      <section className="rounded-2xl border border-[#0B7A48]/30 bg-[#FBE7E5] p-4 text-sm text-[#111318]">
        <strong>Estudo Colômbia:</strong> aplique a migration{" "}
        <code>0003_collection_quality.sql</code> no Supabase para ver a saúde da coleta.
      </section>
    );
  }

  const past = h.hours.filter((c) => !c.future);
  const covered = past.filter((c) => c.ok >= STUDY_PANEL_PER_HOUR * 0.95).length;
  const missed = past.filter((c) => c.total === 0).length;

  return (
    <section className="space-y-4 rounded-2xl border border-[#111318]/10 bg-white p-4 shadow-sm">
      <div>
        <h2 className="font-disp text-lg font-semibold text-[#111318]">
          Estudo Colômbia — saúde da coleta (7 dias)
        </h2>
        <p className="text-xs text-[#111318]/60">
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
        <div className="mb-1 text-xs font-medium text-[#111318]/70">
          Painel horário: buscas concluídas por hora (meta {STUDY_PANEL_PER_HOUR}/h)
        </div>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-[2px] text-[10px] text-[#111318]/60">
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
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#111318]/70">
          <Legend tone="bg-[#0B7A6C]" label="≥ 95%" />
          <Legend tone="bg-[#E8B931]" label="50–95%" />
          <Legend tone="bg-[#0B7A48]" label="< 50%" />
          <Legend tone="bg-[#111318]" label="sem coleta" />
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-[#111318]/70">
          Capacidade × bloqueios: buscas por hora (todas as camadas) e horas com bloqueio/erro do Google
        </div>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-[2px] text-[10px] text-[#111318]/60">
            <tbody>
              {h.days.map((day) => (
                <tr key={day}>
                  <td className="pr-2 font-mono">{formatDay(day)}</td>
                  {h.hours
                    .filter((c) => c.day === day)
                    .map((c) => (
                      <td
                        key={c.hour}
                        title={`${formatDay(day)} ${String(c.hour).padStart(2, "0")}h: ${c.calls} buscas (${c.mesh} da malha), ${c.failed} bloqueio/erro`}
                        className={`h-5 w-5 rounded-sm ${loadTone(c.calls, c.failed, c.future)}`}
                      />
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#111318]/70">
          <Legend tone="bg-[#111318]/20" label="< 50/h" />
          <Legend tone="bg-[#111318]/45" label="50–100" />
          <Legend tone="bg-[#111318]/70" label="100–150" />
          <Legend tone="bg-[#111318]" label="≥ 150" />
          <Legend tone="bg-[#B3261E]" label="teve bloqueio/erro" />
        </div>

        <table className="mt-3 w-full max-w-xl text-left text-sm">
          <thead>
            <tr className="border-b border-[#111318]/10 text-[#111318]/60">
              <th className="pb-2 font-medium">Buscas na hora</th>
              <th className="pb-2 text-right font-medium">Horas</th>
              <th className="pb-2 text-right font-medium">Horas com falha</th>
              <th className="pb-2 text-right font-medium">Falhas / buscas</th>
            </tr>
          </thead>
          <tbody className="text-[#111318]">
            {LOAD_BUCKETS.map(([lo, hi]) => {
              const hrs = past.filter((c) => c.calls > 0 && c.calls >= lo && c.calls < hi);
              if (!hrs.length) return null;
              const calls = hrs.reduce((a, c) => a + c.calls, 0);
              const failed = hrs.reduce((a, c) => a + c.failed, 0);
              const bad = hrs.filter((c) => c.failed > 0).length;
              return (
                <tr key={lo} className="border-b border-[#111318]/5 last:border-0">
                  <td className="py-1.5">{hi === Infinity ? `${lo}+` : `${lo}–${hi}`}</td>
                  <td className="py-1.5 text-right font-mono">{hrs.length}</td>
                  <td className={`py-1.5 text-right font-mono ${bad ? "text-[#B3261E]" : ""}`}>{bad}</td>
                  <td className="py-1.5 text-right font-mono">{((100 * failed) / calls).toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1 text-[11px] text-[#111318]/60">
          A malha Brasil começa em 10 buscas/h, sobe 2/h a cada hora sem falhas e cai pela metade a cada bloqueio —
          a faixa em que as falhas começam é o limite prático desta conexão.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#111318]/10 text-[#111318]/60">
              <th className="pb-2 font-medium">Camada</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 text-right font-medium">Chamadas</th>
            </tr>
          </thead>
          <tbody className="text-[#111318]">
            {h.status.map((s) => (
              <tr key={`${s.layer}-${s.status}`} className="border-b border-[#111318]/5 last:border-0">
                <td className="py-1.5">{LAYER_LABEL[s.layer] ?? s.layer}</td>
                <td className={`py-1.5 ${s.status === "ok" ? "" : "text-[#111318]"}`}>
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
    <div className={`rounded-xl p-3 ${warn ? "bg-[#FBE7E5] text-[#111318]" : "bg-[#F4F4F1] text-[#111318]"}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="font-disp text-xl font-bold">{value}</div>
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
