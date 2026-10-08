import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Alertas({
  searchParams,
}: {
  searchParams: Promise<{ rota?: string }>;
}) {
  const { rota } = await searchParams;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12 md:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-disp text-4xl font-bold">Meus alertas</h1>
        <p className="leading-relaxed text-texto">
          {rota
            ? `Alerta para ${rota}: `
            : ""}
          Em breve você poderá definir um preço-alvo ou pedir para ser avisado
          quando começar uma promoção — por e-mail ou Telegram, no máximo um
          aviso por rota por dia.
        </p>
      </div>
      <div className="flex flex-col gap-4 rounded-2xl border border-borda bg-card p-6">
        <h2 className="font-disp text-[22px] font-bold">
          O que você vai poder fazer
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-texto">
          <li>
            <strong>Preço-alvo</strong> — avise quando a rota cair abaixo de um
            valor que você define
          </li>
          <li>
            <strong>Promoção na rota</strong> — avise quando o preço ficar bem
            abaixo do normal
          </li>
          <li>
            Entrega por <strong>e-mail</strong> ou <strong>Telegram</strong>,
            com link direto para o painel da rota
          </li>
        </ul>
        <Link
          href={rota ? `/rota/${rota}` : "/"}
          className="mt-2 flex h-12 w-fit items-center rounded-lg bg-tinta px-5 font-semibold text-white"
        >
          {rota ? `Voltar para ${rota}` : "Explorar rotas"}
        </Link>
      </div>
    </main>
  );
}
