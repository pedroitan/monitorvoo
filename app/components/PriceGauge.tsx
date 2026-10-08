import { formatBRL } from "@/lib/data";

/** Regua min → faixa normal (p25–p75) → max, com marcador do preco de hoje. */
export function PriceGauge({
  min,
  p25,
  p75,
  max,
  today,
}: {
  min: number;
  p25: number;
  p75: number;
  max: number;
  today: number | null;
}) {
  const span = max - min || 1;
  const pos = (v: number) =>
    Math.min(98, Math.max(2, ((v - min) / span) * 100));
  const todayPos = today !== null ? pos(today) : null;

  return (
    <div>
      <div className="relative h-16">
        {/* trilha */}
        <div className="absolute inset-x-0 top-[30px] h-2.5 rounded-full bg-[#E3E7EC]" />
        {/* faixa normal */}
        <div
          className="absolute top-[30px] h-2.5 rounded-full bg-faixa-forte"
          style={{ left: `${pos(p25)}%`, width: `${pos(p75) - pos(p25)}%` }}
        />
        {/* marcador hoje */}
        {todayPos !== null && (
          <>
            <div
              className="absolute top-[20px] h-8 w-1 rounded-sm bg-destaque"
              style={{ left: `calc(${todayPos}% - 2px)` }}
            />
            <div
              className="font-mono absolute -top-1 text-[13px] font-semibold text-destaque-texto"
              style={{ left: `${todayPos}%`, transform: "translateX(-50%)" }}
            >
              hoje
            </div>
          </>
        )}
        {/* rotulos */}
        <span className="font-mono absolute left-0 top-[48px] text-xs text-mut">
          {formatBRL(min)}
        </span>
        <span
          className="font-mono absolute top-[48px] text-xs text-mut"
          style={{ left: `${pos(p25)}%`, transform: "translateX(-50%)" }}
        >
          {formatBRL(p25)}
        </span>
        <span
          className="font-mono absolute top-[48px] text-xs text-mut"
          style={{ left: `${pos(p75)}%`, transform: "translateX(-50%)" }}
        >
          {formatBRL(p75)}
        </span>
        <span className="font-mono absolute right-0 top-[48px] text-xs text-mut">
          {formatBRL(max)}
        </span>
      </div>
      <p className="mt-1 text-sm text-texto">
        Faixa azul = faixa normal (metade central dos preços dos últimos 28
        dias).
      </p>
    </div>
  );
}
