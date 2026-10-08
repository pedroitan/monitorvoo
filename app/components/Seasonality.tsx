const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** 12 barras: indice de tarifa por mes (100 = media anual), fonte ANAC. */
export function Seasonality({ index }: { index: (number | null)[] }) {
  const values = index.filter((v): v is number => v !== null);
  if (!values.length) return null;
  const max = Math.max(...values);
  const cheapest = index
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v !== null)
    .sort((a, b) => a.v! - b.v!)
    .slice(0, 3)
    .map((x) => MESES[x.i]);

  return (
    <div>
      <div className="grid h-44 grid-cols-12 items-end gap-1.5">
        {index.map((v, i) => (
          <div key={i} className="flex h-full flex-col justify-end">
            {v !== null && (
              <div
                title={`${MESES[i]}: ${v > 100 ? "+" : ""}${Math.round(v - 100)}% vs média`}
                className={`rounded-t ${
                  v > 100 ? "bg-link-hover" : "bg-faixa-forte"
                }`}
                style={{ height: `${Math.round((v / max) * 160)}px` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="-mt-1.5 grid grid-cols-12 gap-1.5 text-center text-[11px] text-texto">
        {MESES.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      <p className="mt-4 text-[15px] leading-snug">
        Meses em azul-escuro ficam acima da média;{" "}
        <strong>{cheapest.join(", ")}</strong> costumam ser os mais baratos.
      </p>
    </div>
  );
}
