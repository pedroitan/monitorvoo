import { getQualityStats } from "@/lib/data";
import { QualityDashboard } from "@/components/QualityDashboard";

export const dynamic = "force-dynamic";

export default async function QualidadePage() {
  const q = await getQualityStats();
  return <QualityDashboard q={q} />;
}
