"use client";

import { useFormatter, useTranslations } from "next-intl";

/** Formatos numéricos de las pantallas de análisis (por idioma activo). */
export function useInsightFormat() {
  const format = useFormatter();
  const t = useTranslations("crm.common");
  const none = t("none");
  return {
    none,
    int: (value: number | null | undefined) =>
      value === null || value === undefined ? none : format.number(value, { maximumFractionDigits: 0 }),
    /** `38,6 %` (hasta un decimal). */
    pct: (value: number | null | undefined) =>
      value === null || value === undefined
        ? none
        : `${format.number(value, { maximumFractionDigits: 1 })} %`,
    decimal: (value: number | null | undefined) =>
      value === null || value === undefined ? none : format.number(value, { maximumFractionDigits: 1 }),
    signed: (value: number) =>
      format.number(value, { maximumFractionDigits: 1, signDisplay: "exceptZero" }),
  };
}
