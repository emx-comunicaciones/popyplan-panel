/**
 * `relationship` de un vínculo de la red de apoyo (`docs/PANEL.md` §14.2,
 * `SupportRelationship` en `lib/api/types.ts`). Función pura, sin acceso
 * a `useTranslations` (tarea 3 de i18n) — devuelve la **clave** de
 * traducción (`support.relationship.*`), no el texto; `null` si el
 * backend añade una relación que el panel no conoce, para que quien
 * llama (`components/entidad/PersonSheet.tsx`) pinte el valor crudo en
 * vez de intentar traducir una clave que no existe, mismo criterio que
 * `lib/reports/labels.ts`.
 */
import type { SupportRelationship } from "@/lib/api/types";

export const RELATIONSHIP_LABEL_KEYS: Record<SupportRelationship, string> = {
  parent: "support.relationship.parent",
  partner: "support.relationship.partner",
  sibling: "support.relationship.sibling",
  relative: "support.relationship.relative",
  friend: "support.relationship.friend",
  legal_guardian: "support.relationship.legalGuardian",
  trusted_other: "support.relationship.trustedOther",
  unspecified: "support.relationship.unspecified",
};

export function relationshipLabelKey(relationship: string): string | null {
  return (RELATIONSHIP_LABEL_KEYS as Record<string, string>)[relationship] ?? null;
}
