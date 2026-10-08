import Link from "next/link";
import { getPromoEvents } from "@/lib/data";

export const dynamic = "force-dynamic";

function fmt(d: string) {
  const [, m, day] = d.split("-");
  const meses = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  return `${day} ${meses[Number(m) - 1]}`;
}

export default async function Promocoes() {
  const events = await getPromoEvents();
  const byAirline = new Map<string, typeof events>();
  for (const e of events) {
    const rows = byAirline.get(e.airline) ?? [];
    rows.push(e);
    byAirline.set(e.airline, rows);
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-8 md:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-disp text-4xl font-bold md:text-[44px]">
          Calendário de promoções
        </h1>
        <p className="max-w-3xl leading-relaxed text-texto md:text-[17px]">
          Marcamos uma promoção quando várias rotas de uma mesma companhia caem
          bem abaixo do normal no mesmo dia.
        </p>
      </div>

      <section
        aria-labelledby="linha-h"
        className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="linha-h" className="font-disp text-[22px] font-bold">
            Linha do tempo
          </h2>
          <div className="flex gap-4 text-[13px] text-texto">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-[18px] rounded-sm bg-destaque" />
              Encerrada
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-[18px] rounded-sm border-2 border-destaque bg-white" />
              Em andamento
            </span>
          </div>
        </div>
        {byAirline.size ? (
          <div className="flex flex-col divide-y divide-grade">
            {[...byAirline.entries()].map(([airline, rows]) => (
              <div key={airline} className="flex flex-col gap-2 py-4">
                <div className="font-semibold">{airline}</div>
                <div className="flex flex-wrap gap-2">
                  {rows.map((e) => (
                    <span
                      key={e.id}
                      title={`${e.affected_routes?.length ?? 0} rotas afetadas`}
                      className={`rounded-md px-3 py-2 font-mono text-xs font-semibold ${
                        e.ended_at
                          ? "bg-destaque text-white"
                          : "border-2 border-destaque bg-white text-promo-texto"
                      }`}
                    >
                      {e.avg_discount_pct
                        ? `−${Math.round(e.avg_discount_pct)}%`
                        : "promo"}{" "}
                      · {fmt(e.started_at)}
                      {e.ended_at ? `–${fmt(e.ended_at)}` : " →"}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-mut">
            Nenhuma promoção detectada ainda — começamos a coletar há poucos
            dias. O detector precisa de algumas semanas de histórico para
            distinguir queda real de variação normal. Os primeiros eventos
            aparecem aqui automaticamente.
          </p>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-tinta p-6 text-white">
        <div>
          <h2 className="font-disp text-[22px] font-bold">
            Quer saber assim que começar uma promoção?
          </h2>
          <p className="mt-1.5 text-[#C3CDDB]">
            Escolha as rotas e avisamos por e-mail ou Telegram.
          </p>
        </div>
        <Link
          href="/alertas"
          className="flex h-12 items-center rounded-lg bg-destaque px-5.5 font-semibold text-white"
        >
          Criar alerta de promoção
        </Link>
      </section>
    </main>
  );
}
