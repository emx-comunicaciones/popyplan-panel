"use client";

import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/Card";

import { useInsightFormat } from "./useInsightFormat";

// Flechas decorativas: el sentido siempre va también en el texto («+14 %»).
const ARROW_UP = "▲";
const ARROW_DOWN = "▼";

/**
 * Tarjeta de cifra (como `StatCard`) con, si hay, la variación respecto al
 * periodo anterior. `value` ya viene formateado. Sin valor de variación
 * (`null`/`undefined`: no hubo datos antes) no se pinta nada.
 */
export function KpiCard({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change?: number | null;
}) {
  const t = useTranslations("crm.dashboard");
  const { signed } = useInsightFormat();
  return (
    <Card>
      <dl>
        <dt className="text-xs text-text-secondary">{label}</dt>
        <dd className="text-2xl font-semibold text-text-base">{value}</dd>
        {change !== null && change !== undefined ? (
          <dd className="text-xs text-text-secondary">
            {change !== 0 ? (
              <span aria-hidden="true" className="mr-1">
                {change > 0 ? ARROW_UP : ARROW_DOWN}
              </span>
            ) : null}
            {t("change", { value: signed(change) })}
          </dd>
        ) : null}
      </dl>
    </Card>
  );
}
