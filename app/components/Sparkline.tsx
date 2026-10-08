/** Mini-linha de tendência: pontos diários (menor preço por dia). */
export function Sparkline({
  values,
  color = "#2457C5",
  width = 200,
  height = 48,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length === 0) {
    return <div style={{ height }} aria-hidden="true" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 4;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const points = values
    .map(
      (v, i) =>
        `${(pad + i * step).toFixed(1)},${(
          pad +
          (1 - (v - min) / span) * (height - pad * 2)
        ).toFixed(1)}`
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height }}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={values.length > 1 ? width - pad : width / 2}
        cy={pad + (1 - (values.at(-1)! - min) / span) * (height - pad * 2)}
        r="3"
        fill={color}
      />
    </svg>
  );
}
