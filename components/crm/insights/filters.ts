/**
 * Periodo y filtros comunes de las pantallas de análisis del CRM
 * (dashboard, informes, mapa y «Necesitan atención»): estado puro y
 * traducción a parámetros de consulta (`docs/CRM.md`, «Filtros comunes»).
 */
import { useState } from "react";

import type { QueryParams } from "@/hooks/useCrm";

export const CRM_PERIODS = ["today", "week", "month", "quarter", "year", "custom"] as const;
export type CrmPeriod = (typeof CRM_PERIODS)[number];

export interface PeriodState {
  period: CrmPeriod;
  since: string;
  until: string;
}

export interface FilterValues {
  owner: number | null;
  region: string;
  province: string;
  kind: string;
  product: string;
  stage: string;
  interest: string;
}

export const EMPTY_FILTERS: FilterValues = {
  owner: null,
  region: "",
  province: "",
  kind: "",
  product: "",
  stage: "",
  interest: "",
};

const pad = (n: number) => String(n).padStart(2, "0");

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function initialPeriod(now: Date = new Date()): PeriodState {
  return {
    period: "month",
    since: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    until: isoDate(now),
  };
}

export function isValidRange(state: PeriodState): boolean {
  return state.period !== "custom" || (!!state.since && !!state.until && state.since <= state.until);
}

export function periodParams(state: PeriodState): QueryParams {
  if (state.period !== "custom") return { period: state.period };
  return { period: "custom", since: state.since, until: state.until };
}

export function filterParams(filters: FilterValues): QueryParams {
  return {
    owner: filters.owner,
    region: filters.region,
    province: filters.province,
    kind: filters.kind,
    product: filters.product,
    stage: filters.stage,
    interest: filters.interest,
  };
}

/**
 * Periodo elegido (`draft`) y el último válido (`applied`): mientras las
 * fechas personalizadas no forman un rango válido se avisa y se sigue
 * consultando el último periodo válido, nunca uno a medias.
 */
export function useInsightPeriod() {
  const [draft, setDraft] = useState<PeriodState>(() => initialPeriod());
  const [applied, setApplied] = useState<PeriodState>(draft);
  const update = (next: PeriodState) => {
    setDraft(next);
    if (isValidRange(next)) setApplied(next);
  };
  return { draft, applied, update, invalid: !isValidRange(draft) };
}
