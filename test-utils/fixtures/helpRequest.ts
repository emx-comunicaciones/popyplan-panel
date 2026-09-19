import type { HelpRequestRow, HelpRequestUserDisplay } from "@/lib/api/types";

/**
 * `HelpRequest.user_display` (contrato ampliado, ver CLAUDE.md
 * «Guardia»/«Ayuda»): por defecto una persona miembro de la entidad, sin
 * referente asignado — los otros dos casos (sin membresía, con
 * referente) se piden con `overrides`.
 */
export function buildHelpRequestUserDisplay(
  overrides: Partial<HelpRequestUserDisplay> = {},
): HelpRequestUserDisplay {
  return {
    id: 5,
    public_name: "Marta L.",
    photo: null,
    is_member: true,
    referent: null,
    ...overrides,
  };
}

export function buildHelpRequest(overrides: Partial<HelpRequestRow> = {}): HelpRequestRow {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    user: 5,
    community: "44444444-4444-4444-4444-444444444444",
    organization: { id: 7, name: "Asociación Vecinal Alfaville" },
    user_display: buildHelpRequestUserDisplay(),
    community_display: { id: "44444444-4444-4444-4444-444444444444", name: "Paseos al atardecer" },
    event_display: null,
    organization_display: { id: 7, name: "Asociación Vecinal Alfaville" },
    acknowledged_by: null,
    acknowledged_at: null,
    created_at: "2026-09-01T18:30:00Z",
    // `docs/PANEL.md` §14.4 (tarea 1 del plan de red de apoyo): solo los
    // apoyos que ya respondieron «me encargo»; vacío por defecto, como el
    // aviso de ayuda más común (nadie de la red respondió todavía).
    support_responses: [],
    ...overrides,
  };
}
