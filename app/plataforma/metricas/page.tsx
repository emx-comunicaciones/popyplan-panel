import { PlataformaMetricsDashboard } from "@/components/metrics/PlataformaMetricsDashboard";

export default function PlataformaMetricasPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text-base">Métricas</h1>
      <PlataformaMetricsDashboard />
    </div>
  );
}
