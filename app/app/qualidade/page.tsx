import { getQualityStats, getStudyHealth } from "@/lib/data";
import { QualityDashboard } from "@/components/QualityDashboard";

export const dynamic = "force-dynamic";

export default async function QualidadePage() {
  const [q, study] = await Promise.all([getQualityStats(), getStudyHealth()]);
  if (!q) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <h1 className="font-disp text-3xl font-bold">Qualidade dos dados</h1>
        <p className="mt-3 rounded-lg bg-grade p-3 text-sm text-mut">
          As estatísticas agora vêm de views agregadas — aplique{" "}
          <code>supabase/migrations/0008_quality_views.sql</code> no SQL Editor do Supabase.
        </p>
      </main>
    );
  }
  return <QualityDashboard q={q} study={study} />;
}
