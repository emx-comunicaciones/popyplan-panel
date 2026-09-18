/**
 * Etiquetas en castellano de los reportes de moderación
 * (`docs/SEGURIDAD_Y_MODERACION.md` §4). Viven aquí, y no dentro de un
 * componente, porque las comparten las tres vistas de reportes
 * (`components/entidad/{ReportesQueue,ReporteDetail}.tsx` y
 * `components/plataforma/ReportesQueuePlataforma.tsx`): con una copia
 * por fichero, la cola pintaba «Acoso» y el detalle el `harassment`
 * crudo del contrato.
 *
 * Los valores son los de `ReasonBacEnum`/`StatusA0fEnum` en
 * `lib/api/types.generated.ts`; el texto es el del panel, que no siempre
 * coincide con el `verbose_name` del backend (`drugs_sale` se pinta
 * «Venta de sustancias», no «Venta de drogas»). Un valor que el panel no
 * conozca —porque el backend añada uno— se pinta tal cual en vez de
 * quedarse en blanco.
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
