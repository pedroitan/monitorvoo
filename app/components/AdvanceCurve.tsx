import { formatBRL } from "@/lib/data";

/** Barras: preco medio por antecedencia de compra. Melhor janela em destaque. */
export function AdvanceCurve({
  bars,
}: {
  bars: { lead: number; avg: number }[];
}) {
  if (!bars.length) return null;
  const max = Math.max(...bars.map((b) => b.avg));
  const best = bars.reduce((a, b) => (b.avg < a.avg ? b : a)).lead;

  const label = (d: number) =>
    d >= 30 ? `${Math.round(d / 30) * 30} dias` : `${d} dias`;

  return (
    <div>
      <div className="grid h-48 grid-cols-6 items-end gap-2.5">
        {bars.map((b) => {
          const isBest = b.lead === best;
          return (
            <div
              key={b.lead}
              className="flex h-full flex-col items-center justify-end gap-1.5"
            >
              <span
                className={`font-mono text-xs font-semibold ${
                  isBest ? "text-destaque-texto" : "text-texto"
                }`}
              >
                {formatBRL(b.avg)}
              </span>
              <div
                className={`w-full max-w-14 rounded-t-md ${
                  isBest ? "bg-destaque" : "bg-faixa-forte"
                }`}
                style={{ height: `${Math.round((b.avg / max) * 150)}px` }}
              />
            </div>
          );
        })}
      </div>
      <div className="-mt-2 grid grid-cols-6 gap-2.5 text-center text-[13px] text-texto">
        {bars.map((b) => (
          <span key={b.lead}>{b.lead}d</span>
        ))}
      </div>
      <p className="mt-4 text-[15px] leading-snug">
        Nesta rota, comprar com <strong>{label(best)}</strong> de antecedência
        costuma sair mais barato.
      </p>
    </div>
  );
}
