import { getQualityStats, getStudyHealth } from "@/lib/data";
import { QualityDashboard } from "@/components/QualityDashboard";

export const dynamic = "force-dynamic";

export default async function QualidadePage() {
  const [q, study] = await Promise.all([getQualityStats(), getStudyHealth()]);
  return <QualityDashboard q={q} study={study} />;
}
