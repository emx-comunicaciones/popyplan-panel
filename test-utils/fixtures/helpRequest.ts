import type { HelpRequestRow } from "@/lib/api/types";

export function buildHelpRequest(overrides: Partial<HelpRequestRow> = {}): HelpRequestRow {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    user: 5,
    community: "44444444-4444-4444-4444-444444444444",
    organization: { id: 7, name: "Asociación Vecinal Alfaville" },
    user_display: { id: 5, public_name: "Marta L.", photo: null },
    community_display: { id: "44444444-4444-4444-4444-444444444444", name: "Paseos al atardecer" },
    event_display: null,
    organization_display: { id: 7, name: "Asociación Vecinal Alfaville" },
    acknowledged_by: null,
    acknowledged_at: null,
    created_at: "2026-09-01T18:30:00Z",
    ...overrides,
  };
}
