import { airportCountry } from "@/lib/data";

/** Bandeirinha do pais do aeroporto (flagcdn — emoji de bandeira nao
 * renderiza no Windows). */
export function Flag({
  iata,
  iso,
  size = 16,
}: {
  iata?: string;
  iso?: string;
  size?: number;
}) {
  const code = iso ?? (iata ? airportCountry(iata) : null);
  if (!code) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${size * 2}x${Math.round(size * 1.5)}/${code}.png`}
      srcSet={`https://flagcdn.com/${size * 4}x${size * 3}/${code}.png 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt=""
      loading="lazy"
      className="inline-block shrink-0 rounded-[2px] border border-borda/60 object-cover"
    />
  );
}
