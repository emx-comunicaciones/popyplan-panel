/**
 * Etiquetas en castellano de `relationship` en un vínculo de la red de
 * apoyo (`docs/PANEL.md` §14.2, `SupportRelationship` en
 * `lib/api/types.ts`). Viven aquí, no dentro de un componente, mismo
 * patrón que `lib/reports/labels.ts`: un valor que el panel no conozca
 * (porque el backend añada una relación nueva) se pinta tal cual en vez
 * de quedarse en blanco.
 */
import type { SupportRelationship } from "@/lib/api/types";

export const RELATIONSHIP_LABELS: Record<SupportRelationship, string> = {
  parent: "Madre o padre",
  partner: "Pareja",
  sibling: "Hermano o hermana",
  relative: "Otro familiar",
  friend: "Amistad",
  legal_guardian: "Tutor o tutora legal",
  trusted_other: "Otra persona de confianza",
  unspecified: "Sin indicar",
};

export function relationshipLabel(relationship: string): string {
  return (RELATIONSHIP_LABELS as Record<string, string>)[relationship] ?? relationship;
}
