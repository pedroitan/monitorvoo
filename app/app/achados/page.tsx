import Link from "next/link";
import { Flag } from "@/components/Flag";
import {
  airlineShort,
  airportName,
  cityName,
  formatBRL,
  formatCollected,
  formatDay,
  getInsights,
  Insights,
  num,
} from "@/lib/data";

export const dynamic = "force-dynamic";

const SLOT_LABEL: Record<string, string> = {
  curto: "Novembro (~5 semanas)",
  medio: "Natal (~11 semanas)",
  alta: "Alta temporada (dez–jan)",
};
const DOW = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PERIODS = [
  ["madrugada", "Madrugada (0–6h)"],
  ["manha", "Manhã (6–12h)"],
  ["tarde", "Tarde (12–18h)"],
  ["noite", "Noite (18–24h)"],
] as const;

const pct = (v: number | null, digits = 0) =>
  v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
const rel = (v: number | null) => (v === null ? null : (v - 1) * 100);
const brl = (v: number | string | null) => (num(v) === null ? "—" : formatBRL(num(v)!));

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-5 md:p-6">
      <div>
        <h2 className="font-disp text-[22px] font-bold">{title}</h2>
        {lead && <p className="mt-1 text-sm leading-relaxed text-mut">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

function Pending({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-grade p-3 text-sm text-mut">{children}</p>;
}

/** Barra horizontal de preco relativo (1.0 = mediana). */
function RelBars({ rows }: { rows: { label: string; value: number | null; n: number }[] }) {
  const vals = rows.map((r) => r.value ?? 1);
  const lo = Math.min(...vals, 0.9);
  const hi = Math.max(...vals, 1.1);
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const v = r.value ?? 1;
        const w = ((v - lo) / (hi - lo)) * 100;
        const good = v < 0.98;
        const bad = v > 1.02;
        return (
          <div key={r.label} className="grid grid-cols-[88px_1fr_64px] items-center gap-3 text-sm">
            <span className="text-texto">{r.label}</span>
            <div className="h-5 rounded bg-grade">
              <div
                className={`h-5 rounded ${good ? "bg-[#9FD8B8]" : bad ? "bg-[#F2B8B3]" : "bg-faixa-forte"}`}
                style={{ width: `${Math.max(w, 3)}%` }}
              />
            </div>
            <span
              className={`text-right font-mono text-[13px] ${
                good ? "text-destaque-texto" : bad ? "text-alto-texto" : "text-texto"
              }`}
              title={`${r.n} observações`}
            >
              {pct(rel(r.value))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-borda p-4">
      <div
        className={`font-mono text-2xl font-semibold ${
          tone === "good" ? "text-destaque-texto" : tone === "bad" ? "text-alto-texto" : "text-tinta"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[13px] leading-snug text-mut">{label}</div>
    </div>
  );
}

function Airport({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={airportName(code)}>
      <Flag iata={code} size={14} />
      <span className="font-mono font-semibold">{code}</span>
      <span className="text-mut">{cityName(code)}</span>
    </span>
  );
}

function headlines(i: Insights) {
  const out: { title: string; body: string }[] = [];
  const rt = i.rtVsOw.filter((r) => num(r.rt_median) && num(r.two_ow_median));
  if (rt.length) {
    const diffs = rt.map((r) => (num(r.rt_median)! / num(r.two_ow_median)! - 1) * 100);
    const cheaper = rt.reduce((s, r) => s + r.rt_cheaper, 0);
    const n = rt.reduce((s, r) => s + r.n, 0);
    out.push({
      title: `Ida e volta: ${pct(diffs.reduce((a, b) => a + b, 0) / diffs.length)} vs. duas só ida`,
      body: `Para a Colômbia, a passagem de ida e volta saiu mais barata que comprar dois trechos separados em ${Math.round((100 * cheaper) / n)}% das ${n} comparações feitas na mesma hora.`,
    });
  }
  const gru = i.destinations.filter((d) => d.origin === "GRU").sort((a, b) => num(a.median_price)! - num(b.median_price)!);
  if (gru.length >= 2) {
    const bog = gru.find((d) => d.destination === "BOG");
    out.push({
      title: `${cityName(gru[0].destination)} é a porta de entrada mais barata`,
      body: `Saindo de Guarulhos, a mediana só ida é ${brl(gru[0].median_price)}${
        bog && bog !== gru[0] ? `, contra ${brl(bog.median_price)} para Bogotá` : ""
      }.`,
    });
  }
  const big = i.hourly.reduce((s, h) => s + h.big_changes, 0);
  if (big >= 10) {
    const night = i.hourly.filter((h) => h.hour < 7).reduce((s, h) => s + h.big_changes, 0);
    const top = [...i.hourly].sort((a, b) => b.big_changes - a.big_changes).slice(0, 3).map((h) => `${h.hour}h`);
    out.push({
      title: "Preço muda de dia, quase nunca de madrugada",
      body: `Das ${big} mudanças de tarifa (≥ 2%), só ${night} aconteceram entre 0h e 7h. Horários com mais mudanças: ${top.join(", ")} (Brasília).`,
    });
  }
  const dr = num(i.direct?.direct_ratio ?? null);
  if (dr && i.direct) {
    out.push({
      title: `Voo direto custa ${dr.toFixed(2).replace(".", ",")}× o mais barato com escala`,
      body: `E só existe em ${Math.round((100 * i.direct.with_direct) / i.direct.searches)}% das buscas Brasil ↔ Colômbia.`,
    });
  }
  return out;
}

export default async function AchadosPage() {
  const i = await getInsights();

  if (!i) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <h1 className="font-disp text-3xl font-bold">Achados do estudo</h1>
        <Pending>
          As views de análise ainda não existem no banco — aplique a migration{" "}
          <code>supabase/migrations/0004_insights.sql</code> no SQL Editor do Supabase.
        </Pending>
      </main>
    );
  }

  const intr = i.intraday;
  const maxHour = Math.max(1, ...i.hourly.map((h) => h.big_changes + h.small_changes));
  const hours = Array.from({ length: 24 }, (_, h) => i.hourly.find((x) => x.hour === h) ?? { hour: h, pairs: 0, big_changes: 0, small_changes: 0 });
  const sampling = [...i.sampling].sort((a, b) => a.every - b.every);
  const slots = ["curto", "medio", "alta"].filter((s) => i.rtVsOw.some((r) => r.slot === s));
  const origins = ["GRU", "SSA", "CGH"].filter((o) => i.destinations.some((d) => d.origin === o));
  const maxDest = Math.max(1, ...i.destinations.map((d) => num(d.median_price) ?? 0));
  const leadRows = [...i.lead].sort((a, b) => a.bucket - b.bucket);
  const leadDates = Math.max(0, ...leadRows.map((l) => l.dates));
  const emptyPairs = i.emptyPairs
    .filter((p) => p.calls >= 5 && p.empty / p.calls >= 0.2)
    .sort((a, b) => b.empty / b.calls - a.empty / a.calls);
  const airlines = [...i.airlines].sort((a, b) => b.cheapest - a.cheapest).slice(0, 8);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 pb-28 md:px-6">
      <div className="flex flex-col gap-2">
        <nav className="text-sm text-mut">
          <Link href="/colombia" className="text-link hover:text-link-hover">
            Estudo Colômbia
          </Link>{" "}
          / Achados
        </nav>
        <h1 className="font-disp text-3xl font-bold md:text-4xl">O que os dados já mostram</h1>
        <p className="max-w-3xl text-texto">
          Conclusões calculadas a partir das buscas que o coletor faz de hora em hora entre Brasil e Colômbia
          {intr?.since ? ` desde ${formatCollected(intr.since)}` : ""}, sempre nos últimos 30 dias. Os números se
          atualizam sozinhos conforme a coleta avança — com poucos dias, trate tendências como preliminares.
        </p>
      </div>

      {/* manchetes */}
      <div className="grid gap-3 md:grid-cols-2">
        {headlines(i).map((h) => (
          <div key={h.title} className="rounded-2xl bg-tinta p-5 text-white">
            <div className="font-disp text-lg font-semibold leading-snug">{h.title}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-[#B9BDC6]">{h.body}</p>
          </div>
        ))}
      </div>

      {/* 1. intradia */}
      <Section
        title="O preço muda durante o dia?"
        lead="O painel repete as mesmas 36 buscas toda hora. Mudanças abaixo de 2% são quase sempre conversão de câmbio nas rotas que saem da Colômbia; acima disso, é a tarifa que mudou."
      >
        {intr && intr.pairs > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                value={`${Math.round((100 * intr.changes) / intr.pairs)}%`}
                label="das horas o menor preço mudou (qualquer valor)"
              />
              <Stat value={String(intr.big_changes)} label="mudanças de tarifa (≥ 2%)" />
              <Stat
                value={String(intr.reverted)}
                label="delas voltaram ao preço anterior em até 6h (promoção-relâmpago ou assento liberado)"
              />
              <Stat
                value={num(intr.day_amp_over5_share) === null ? "—" : `${Math.round(100 * num(intr.day_amp_over5_share)!)}%`}
                label={`dos dias o preço variou mais de 5% entre a maior e a menor coleta (mediana ${pct(num(intr.day_amp_median), 1).replace("+", "")})`}
              />
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold">Mudanças por hora do dia (Brasília)</div>
              <div className="flex h-36 items-end gap-[3px]">
                {hours.map((h) => (
                  <div key={h.hour} className="flex h-full flex-1 flex-col justify-end" title={`${h.hour}h: ${h.big_changes} de tarifa, ${h.small_changes} pequenas`}>
                    <div className="rounded-t-sm bg-faixa-forte" style={{ height: `${(h.small_changes / maxHour) * 100}%` }} />
                    <div className="bg-tinta" style={{ height: `${(h.big_changes / maxHour) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-[3px] font-mono text-[10px] text-mut">
                {hours.map((h) => (
                  <span key={h.hour} className="flex-1 text-center">
                    {h.hour % 3 === 0 ? h.hour : ""}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-4 text-xs text-mut">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 bg-tinta" /> tarifa (≥ 2%)</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 bg-faixa-forte" /> pequena (&lt; 2%)</span>
              </div>
            </div>

            {sampling.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-semibold">E se coletássemos com menos frequência?</div>
                <p className="mb-3 text-sm text-mut">
                  Quanto o menor preço capturado ficaria acima do menor preço real, em média e no pior caso.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-borda text-left text-[13px] text-mut">
                        <th className="py-2 font-semibold">Coletando a cada</th>
                        <th className="py-2 text-right font-semibold">Perda média</th>
                        <th className="py-2 text-right font-semibold">Pior caso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sampling.map((s) => (
                        <tr key={s.every} className="border-b border-grade">
                          <td className="py-2">{s.every === 1 ? "1 hora (atual)" : s.every === 24 ? "24 horas" : `${s.every} horas`}</td>
                          <td className="py-2 text-right font-mono">{pct(num(s.avg_loss_pct), 1)}</td>
                          <td className="py-2 text-right font-mono text-mut">{pct(num(s.max_loss_pct), 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <Pending>Ainda sem coletas do painel nos últimos 30 dias.</Pending>
        )}
      </Section>

      {/* 2. ida e volta x 2 so ida */}
      <Section
        title="Ida e volta ou duas passagens só de ida?"
        lead="Na mesma hora, o coletor busca a ida e volta e os dois trechos só de ida nas mesmas datas. O valor é a mediana de todas as rodadas."
      >
        {slots.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-[13px] text-mut">
                  <th className="py-2 font-semibold">Viagem</th>
                  <th className="py-2 text-right font-semibold">Ida e volta</th>
                  <th className="py-2 text-right font-semibold">Só ida + só volta</th>
                  <th className="py-2 text-right font-semibold">Diferença</th>
                  <th className="py-2 text-right font-semibold">Ida e volta venceu</th>
                </tr>
              </thead>
              <tbody>
                {slots.flatMap((slot) =>
                  i.rtVsOw
                    .filter((r) => r.slot === slot)
                    .sort((a, b) => a.origin.localeCompare(b.origin) || a.destination.localeCompare(b.destination))
                    .map((r) => {
                      const d = (num(r.rt_median)! / num(r.two_ow_median)! - 1) * 100;
                      return (
                        <tr key={`${slot}-${r.origin}-${r.destination}-${r.dep}`} className="border-b border-grade">
                          <td className="py-2.5">
                            <div className="font-mono font-semibold">
                              {r.origin} ⇄ {r.destination}
                            </div>
                            <div className="text-xs text-mut">
                              {SLOT_LABEL[slot]} · {formatDay(r.dep)} → {formatDay(r.ret)}
                            </div>
                          </td>
                          <td className="py-2.5 text-right font-mono font-semibold">{brl(r.rt_median)}</td>
                          <td className="py-2.5 text-right font-mono">
                            {brl(r.two_ow_median)}
                            <div className="text-xs text-mut">
                              {brl(r.ow_out_median)} + {brl(r.ow_back_median)}
                            </div>
                          </td>
                          <td className={`py-2.5 text-right font-mono font-semibold ${d < -1 ? "text-destaque-texto" : d > 1 ? "text-alto-texto" : "text-texto"}`}>
                            {pct(d, 0)}
                          </td>
                          <td className="py-2.5 text-right font-mono text-mut">
                            {r.rt_cheaper}/{r.n}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <Pending>Ainda sem rodadas completas do painel.</Pending>
        )}

        <div>
          <div className="mb-2 text-sm font-semibold">Na grade de datas, por duração da viagem</div>
          {i.gridRt.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-borda text-left text-[13px] text-mut">
                    <th className="py-2 font-semibold">Trecho</th>
                    <th className="py-2 text-right font-semibold">Estadia</th>
                    <th className="py-2 text-right font-semibold">Ida e volta</th>
                    <th className="py-2 text-right font-semibold">2 só ida</th>
                    <th className="py-2 text-right font-semibold">Diferença</th>
                    <th className="py-2 text-right font-semibold">Datas</th>
                  </tr>
                </thead>
                <tbody>
                  {[...i.gridRt]
                    .sort((a, b) => a.origin.localeCompare(b.origin) || a.destination.localeCompare(b.destination) || a.stay - b.stay)
                    .map((r) => {
                      const d = (num(r.rt_median)! / num(r.two_ow_median)! - 1) * 100;
                      return (
                        <tr key={`${r.origin}-${r.destination}-${r.stay}`} className="border-b border-grade">
                          <td className="py-2 font-mono font-semibold">{r.origin} ⇄ {r.destination}</td>
                          <td className="py-2 text-right">{r.stay} dias</td>
                          <td className="py-2 text-right font-mono">{brl(r.rt_median)}</td>
                          <td className="py-2 text-right font-mono">{brl(r.two_ow_median)}</td>
                          <td className={`py-2 text-right font-mono font-semibold ${d < -1 ? "text-destaque-texto" : d > 1 ? "text-alto-texto" : "text-texto"}`}>{pct(d)}</td>
                          <td className="py-2 text-right font-mono text-mut">{r.n}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <Pending>
              A grade passou a coletar ida e volta de 7, 10 e 14 dias (GRU e SSA → Bogotá, Medellín e Cartagena).
              Esta tabela aparece conforme as datas forem cobertas, em cerca de 5 dias.
            </Pending>
          )}
        </div>
      </Section>

      {/* 3. open jaw */}
      <Section
        title="Entrar por uma cidade e sair por outra"
        lead="Soma do menor só ida Brasil → cidade de entrada com o menor só ida cidade de saída → Brasil, buscados na mesma hora. A diagonal é ida e volta pela mesma cidade comprada em dois trechos."
      >
        {slots.length ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {slots.map((slot) => {
              const cells = i.openJaw.filter((o) => o.slot === slot && o.origin === "GRU");
              const entries = [...new Set(cells.map((c) => c.entry))].sort();
              const exits = [...new Set(cells.map((c) => c.exit))].sort();
              const best = Math.min(...cells.map((c) => num(c.total_median) ?? Infinity));
              const rts = i.rtVsOw.filter((r) => r.slot === slot && r.origin === "GRU");
              if (!cells.length) return null;
              return (
                <div key={slot} className="rounded-xl border border-borda p-4">
                  <div className="mb-2 text-sm font-semibold">
                    {SLOT_LABEL[slot]}
                    <span className="ml-1 font-normal text-mut">
                      · {formatDay(cells[0].dep)} → {formatDay(cells[0].ret)}
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] text-mut">
                        <th className="pb-1 text-left font-medium">entra \ sai</th>
                        {exits.map((x) => (
                          <th key={x} className="pb-1 text-right font-mono font-semibold" title={cityName(x)}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => (
                        <tr key={e}>
                          <td className="py-1 font-mono font-semibold" title={cityName(e)}>{e}</td>
                          {exits.map((x) => {
                            const c = cells.find((c) => c.entry === e && c.exit === x);
                            const v = num(c?.total_median ?? null);
                            return (
                              <td
                                key={x}
                                className={`py-1 text-right font-mono text-[13px] ${v === best ? "rounded bg-[#E3F4EA] font-semibold text-destaque-texto" : ""} ${e === x ? "text-mut" : ""}`}
                              >
                                {v === null ? "—" : formatBRL(v)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rts.length > 0 && (
                    <div className="mt-3 border-t border-grade pt-2 text-xs text-mut">
                      Ida e volta comprada junto:{" "}
                      {rts.map((r) => `${r.destination} ${brl(r.rt_median)}`).join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Pending>Ainda sem rodadas completas do painel.</Pending>
        )}
      </Section>

      {/* 4. destinos */}
      <Section
        title="Qual cidade da Colômbia sai mais barato?"
        lead="Mediana do menor preço só ida em cada data de voo da grade (D+7 em diante), valor mais recente de cada data."
      >
        {origins.length ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {origins.map((o) => {
              const rows = i.destinations
                .filter((d) => d.origin === o)
                .sort((a, b) => num(a.median_price)! - num(b.median_price)!);
              return (
                <div key={o}>
                  <div className="mb-2 text-sm font-semibold">
                    Saindo de <Airport code={o} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {rows.map((d, idx) => (
                      <div key={d.destination} className="grid grid-cols-[92px_1fr_76px] items-center gap-2 text-sm" title={`${airportName(d.destination)} · ${d.dates} datas · mínimo ${brl(d.min_price)}`}>
                        <span className="truncate">
                          <span className="font-mono font-semibold">{d.destination}</span>{" "}
                          <span className="text-mut">{cityName(d.destination)}</span>
                        </span>
                        <div className="h-4 rounded bg-grade">
                          <div
                            className={`h-4 rounded ${idx === 0 ? "bg-[#9FD8B8]" : "bg-faixa-forte"}`}
                            style={{ width: `${(num(d.median_price)! / maxDest) * 100}%` }}
                          />
                        </div>
                        <span className="text-right font-mono text-[13px]">{brl(d.median_price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Pending>Ainda sem dados da grade.</Pending>
        )}
        <div className="mt-2 border-t border-grade pt-4">
          <div className="mb-2 text-sm font-semibold">Voltando da Colômbia para o Brasil</div>
          <div className="flex flex-wrap gap-2 text-sm">
            {i.destinations
              .filter((d) => !["GRU", "SSA", "CGH"].includes(d.origin))
              .sort((a, b) => num(a.median_price)! - num(b.median_price)!)
              .slice(0, 12)
              .map((d) => (
                <span key={`${d.origin}-${d.destination}`} className="rounded-lg border border-borda px-2.5 py-1.5" title={`${cityName(d.origin)} → ${cityName(d.destination)}`}>
                  <span className="font-mono font-semibold">{d.origin}→{d.destination}</span>{" "}
                  <span className="font-mono text-mut">{brl(d.median_price)}</span>
                </span>
              ))}
          </div>
        </div>
      </Section>

      {/* 5. quando voar */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Dia da semana do voo"
          lead="Preço comparado à mediana do mesmo trecho (Brasil → Colômbia). Verde = mais barato que o normal."
        >
          {i.weekday.length ? (
            <RelBars
              rows={[...i.weekday].sort((a, b) => a.dow - b.dow).map((w) => ({ label: DOW[w.dow], value: num(w.rel), n: w.n }))}
            />
          ) : (
            <Pending>Acumulando dados.</Pending>
          )}
        </Section>
        <Section title="Mês do voo" lead="Mesma comparação, por mês da viagem — mostra o efeito das férias e festas.">
          {i.month.length ? (
            <RelBars
              rows={[...i.month]
                .sort((a, b) => a.month.localeCompare(b.month))
                .map((m) => ({ label: `${MONTHS[Number(m.month.slice(5)) - 1]}/${m.month.slice(2, 4)}`, value: num(m.rel), n: m.n }))}
            />
          ) : (
            <Pending>Acumulando dados.</Pending>
          )}
        </Section>
      </div>

      {/* 6. antecedencia */}
      <Section
        title="Comprar com quanta antecedência?"
        lead="Cada data de voo é comparada com a própria média ao longo das coletas — assim a alta temporada não distorce a conta. Precisa de várias passadas da grade pela mesma data."
      >
        {leadDates >= 30 ? (
          <RelBars
            rows={leadRows.map((l) => ({ label: `${l.bucket}–${l.bucket + 14}d`, value: num(l.rel), n: l.n }))}
          />
        ) : (
          <Pending>
            Ainda poucas datas com mais de uma coleta ({leadDates}). A grade revisita cada data a cada 2–7 dias; a curva
            fica confiável depois de umas 2 semanas.
          </Pending>
        )}
      </Section>

      {/* 7. cias, direto, horario */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Companhias" lead="Em quantas buscas cada companhia aparece e em quantas tem o menor preço.">
          {airlines.length ? (
            <div className="flex flex-col gap-2">
              {airlines.map((a) => {
                const share = (100 * a.cheapest) / a.searches;
                return (
                  <div key={a.airline} className="grid grid-cols-[110px_1fr_110px] items-center gap-3 text-sm">
                    <span className="font-semibold">{airlineShort(a.airline)}</span>
                    <div className="relative h-4 rounded bg-grade">
                      <div className="absolute inset-y-0 left-0 rounded bg-faixa-forte" style={{ width: `${(100 * a.present) / a.searches}%` }} />
                      <div className="absolute inset-y-0 left-0 rounded bg-tinta" style={{ width: `${share}%` }} />
                    </div>
                    <span className="text-right font-mono text-[13px]">
                      {Math.round(share)}% <span className="text-mut">/ {Math.round((100 * a.present) / a.searches)}%</span>
                    </span>
                  </div>
                );
              })}
              <div className="mt-1 flex gap-4 text-xs text-mut">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 bg-tinta" /> mais barata</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 bg-faixa-forte" /> aparece</span>
              </div>
            </div>
          ) : (
            <Pending>Acumulando dados.</Pending>
          )}
        </Section>

        <Section title="Voo direto e horário de partida" lead="Quanto custa a opção mais barata de cada tipo, comparada à mais barata da busca.">
          {i.direct && i.direct.searches > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Stat
                value={num(i.direct.direct_ratio) ? `${num(i.direct.direct_ratio)!.toFixed(2).replace(".", ",")}×` : "—"}
                label="preço do direto mais barato vs. o mais barato com escala"
                tone="bad"
              />
              <Stat
                value={`${Math.round((100 * i.direct.with_direct) / i.direct.searches)}%`}
                label="das buscas têm algum voo direto"
              />
            </div>
          )}
          {i.departure.length > 0 && (
            <RelBars
              rows={PERIODS.map(([k, label]) => {
                const p = i.departure.find((d) => d.period === k);
                return { label: label.split(" ")[0], value: num(p?.rel ?? null), n: p?.n ?? 0 };
              }).filter((r) => r.n > 0)}
            />
          )}
        </Section>
      </div>

      {/* 8. qualidade */}
      {emptyPairs.length > 0 && (
        <Section
          title="Trechos que quase nunca têm voo"
          lead="Buscas da grade que voltaram sem nenhuma opção. Esses pares agora são consultados com 3× menos frequência, liberando espaço para ida e volta e datas mais distantes."
        >
          <div className="flex flex-wrap gap-2 text-sm">
            {emptyPairs.map((p) => (
              <span key={`${p.origin}-${p.destination}`} className="rounded-lg border border-borda px-2.5 py-1.5" title={`${cityName(p.origin)} → ${cityName(p.destination)}`}>
                <span className="font-mono font-semibold">{p.origin}→{p.destination}</span>{" "}
                <span className="font-mono text-alto-texto">{Math.round((100 * p.empty) / p.calls)}%</span>{" "}
                <span className="text-mut">de {p.calls}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      <p className="text-[13px] text-mut">
        Fonte: Google Flights, tarifa básica para 1 adulto, em reais. Atualizado a cada hora. Não vendemos passagens.
      </p>
    </main>
  );
}
