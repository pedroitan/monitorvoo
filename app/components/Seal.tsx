export type RouteStatus = "abaixo" | "normal" | "acima" | "coletando";

const STATUS_STYLE: Record<RouteStatus, { label: string; className: string }> = {
  abaixo: {
    label: "Abaixo do normal",
    className: "bg-promo-selo text-promo-texto",
  },
  normal: { label: "Normal", className: "bg-neutro-selo text-texto" },
  acima: {
    label: "Acima do normal",
    className: "bg-alto-selo text-link-hover",
  },
  coletando: {
    label: "Coletando dados",
    className: "bg-neutro-selo text-mut",
  },
};

export function StatusSeal({ status }: { status: RouteStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${s.className}`}
    >
      {s.label}
    </span>
  );
}

const DECISION_STYLE: Record<RouteStatus, { label: string; className: string }> = {
  abaixo: { label: "Bom momento para comprar", className: "bg-destaque text-white" },
  normal: { label: "Preço normal", className: "bg-[#22314D] text-white" },
  acima: { label: "Vale esperar", className: "bg-[#22314D] text-[#C3CDDB]" },
  coletando: {
    label: "Ainda coletando histórico",
    className: "bg-[#22314D] text-[#C3CDDB]",
  },
};

/** Selo grande, para o card escuro do painel da rota. */
export function DecisionSeal({ status }: { status: RouteStatus }) {
  const s = DECISION_STYLE[status];
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-[13px] font-semibold ${s.className}`}
    >
      {s.label}
    </span>
  );
}
