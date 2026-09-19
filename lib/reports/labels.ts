/**
 * Etiquetas de los reportes de moderación
 * (`docs/SEGURIDAD_Y_MODERACION.md` §4). Viven aquí, y no dentro de un
 * componente, porque las comparten las tres vistas de reportes
 * (`components/entidad/{ReportesQueue,ReporteDetail}.tsx` y
 * `components/plataforma/ReportesQueuePlataforma.tsx`): con una copia
 * por fichero, la cola pintaba «Acoso» y el detalle el `harassment`
 * crudo del contrato.
 *
 * Los valores son los de `ReasonBacEnum`/`StatusA0fEnum` en
 * `lib/api/types.generated.ts`. Un valor que el panel no conozca —porque
 * el backend añada uno— se pinta tal cual en vez de quedarse en blanco.
 *
 * **i18n (tarea 4 del plan de i18n, puente cerrado en la tarea 5):**
 * `reasonLabelKey`/`statusLabelKey` devuelven la **clave** de traducción
 * bajo `reports.reason.*`/`reports.status.*` (o `null` para un valor que
 * el panel no conoce —el llamador pinta el valor crudo, mismo criterio
 * que `lib/support/relationshipLabel.ts::relationshipLabelKey`), en vez
 * del texto ya resuelto: este fichero es `.ts` plano y no puede llamar a
 * `t()`. Las funciones de texto a secas (`reasonLabel`/`statusLabel`,
 * con `REASON_LABELS`/`STATUS_LABELS`) existieron mientras
 * `ReportesQueuePlataforma.tsx` no estaba traducida — esa tarea (la 5)
 * ya las usa por clave, así que se han borrado al quedarse sin
 * consumidor.
 */
export const REASON_LABEL_KEYS: Record<string, string> = {
  harassment: "reports.reason.harassment",
  hate: "reports.reason.hate",
  spam: "reports.reason.spam",
  scam: "reports.reason.scam",
  underage: "reports.reason.underage",
  self_harm_risk: "reports.reason.selfHarmRisk",
  drugs_sale: "reports.reason.drugsSale",
  other: "reports.reason.other",
};

export const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: "reports.status.pending",
  in_review: "reports.status.inReview",
  resolved: "reports.status.resolved",
};

/** Clave de traducción del motivo, o `null` si el backend manda uno nuevo. */
export function reasonLabelKey(reason: string): string | null {
  return REASON_LABEL_KEYS[reason] ?? null;
}

/** Clave de traducción del estado, o `null` si el backend manda uno nuevo. */
export function statusLabelKey(status: string): string | null {
  return STATUS_LABEL_KEYS[status] ?? null;
}
