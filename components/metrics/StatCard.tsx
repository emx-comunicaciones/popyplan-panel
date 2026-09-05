import { Card } from "@/components/ui/Card";

/**
 * Cada `StatCard` es su propia lista de definición (`<dl><dt/><dd/></dl>`,
 * un único par etiqueta/valor). Fix de accesibilidad (tarea W6, hallazgo de
 * `axe-core`): el contenedor en rejilla que agrupa varias `StatCard`
 * (`EntityHomeDashboard.tsx`, `{Paraguas,Plataforma}MetricsDashboard.tsx`)
 * usa un `<div>`, nunca un `<dl>` — anidar un `<dl>` dentro de otro `<dl>`
 * (aunque sea a través de `Card`, que renderiza un `<div>`) incumple la
 * regla `definition-list` de axe: los hijos directos de `<dl>` solo
 * pueden ser `<dt>`/`<dd>`/`<script>`/`<template>` o `<div>` que a su vez
 * solo contenga `<dt>`/`<dd>`.
 */
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
