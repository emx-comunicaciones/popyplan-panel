import { Card } from "@/components/ui/Card";

export interface StatCardProps {
  label: string;
  /**
   * Ya formateado por `lib/metrics/format.ts` (`formatCount`/`formatPct`):
   * este componente nunca decide por sí mismo si algo está suprimido, solo
   * pinta la cadena resultante («<5», «1.284», «75,0 %»…).
   */
  value: string;
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <Card>
      <dl>
        <dt className="text-sm text-text-secondary">{label}</dt>
        <dd className="text-2xl font-semibold text-text-base">{value}</dd>
      </dl>
    </Card>
  );
}
