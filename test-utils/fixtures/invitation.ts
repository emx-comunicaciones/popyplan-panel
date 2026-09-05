import type { EntityInvitation, InvitedPersonRow } from "@/lib/api/types";

export function buildEntityInvitation(overrides: Partial<EntityInvitation> = {}): EntityInvitation {
  return {
    id: 3,
    organization: 7,
    email: "ana@example.com",
    display_name: "Ana",
    community: null,
    referent: null,
    status: "pending",
    sent_at: "2026-09-05T10:00:00Z",
    accepted_at: null,
    invited_by: 1,
    created_at: "2026-09-05T10:00:00Z",
    ...overrides,
  };
}

export function buildInvitedPersonRow(overrides: Partial<InvitedPersonRow> = {}): InvitedPersonRow {
  return {
    invitation_id: 3,
    display_name: "Bea",
    status: "invited",
    invited_at: "2026-09-04T09:00:00Z",
    ...overrides,
  };
}
