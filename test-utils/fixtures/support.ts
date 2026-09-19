import type { PersonSupportRow } from "@/lib/api/types";

/**
 * Filas de `GET /api/panel/entidad/{org_id}/people/{user_id}/support/`
 * (`docs/PANEL.md` §14.5): lo único que ve el referente asignado de la
 * red de apoyo de una persona — solo vínculos efectivos, nunca fechas ni
 * contacto.
 */
export function buildPersonSupportRow(overrides: Partial<PersonSupportRow> = {}): PersonSupportRow {
  return {
    supporter: { id: 9, public_name: "Miren" },
    relationship: "parent",
    notify_on_help: true,
    ...overrides,
  };
}

export const PERSON_SUPPORT_ROWS: PersonSupportRow[] = [
  buildPersonSupportRow(),
  buildPersonSupportRow({
    supporter: { id: 12, public_name: "Jon" },
    relationship: "friend",
    notify_on_help: false,
  }),
];
