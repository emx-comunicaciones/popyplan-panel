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
 * **i18n (tarea 4 del plan de i18n):** `reasonLabelKey`/`statusLabelKey`
 * devuelven la **clave** de traducción bajo `reports.reason.*`/
 * `reports.status.*` (o `null` para un valor que el panel no conoce —el
 * llamador pinta el valor crudo, mismo criterio que
 * `lib/support/relationshipLabel.ts::relationshipLabelKey`), en vez del
 * texto ya resuelto: este fichero es `.ts` plano y no puede llamar a
 * `t()`. `reasonLabel`/`statusLabel` (las funciones de texto a secas) se
 * quedan **tal cual** porque `ReportesQueuePlataforma.tsx` (área de
 * plataforma, tarea 5 de este mismo plan) sigue llamándolas — el día que
 * esa tarea traduzca esa pantalla, cambia a las nuevas y estas dos
 * quedan sin consumidores.
 */
export const REASON_LABELS: Record<string, string> = {
  harassment: "Acoso",
  hate: "Odio",
  spam: "Spam",
  scam: "Estafa",
  underage: "Menor de edad",
  self_harm_risk: "Riesgo de autolesión",
  drugs_sale: "Venta de sustancias",
  other: "Otro",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_review: "En revisión",
  resolved: "Resuelto",
};

export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

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
