import { describe, expect, it } from "vitest";

import type { InvitedPersonRow, PersonRow } from "@/lib/api/types";

import { isInvitedPersonRow } from "./invitedRow";

const PERSON_ROW: PersonRow = {
  user_id: 42,
  public_name: "Ana",
  photo: null,
  is_blocked: false,
  joined_at: "2025-01-01T09:00:00Z",
  communities_count: 1,
  events_period: 3,
  attended_period: 3,
  referent: null,
  next_event: null,
};

const INVITED_ROW: InvitedPersonRow = {
  invitation_id: 3,
  display_name: "Bea",
  status: "invited",
  invited_at: "2026-09-05T10:00:00Z",
};

describe("isInvitedPersonRow", () => {
  it("una PersonRow normal no es una fila invitada", () => {
    expect(isInvitedPersonRow(PERSON_ROW)).toBe(false);
  });

  it("una InvitedPersonRow sí lo es", () => {
    expect(isInvitedPersonRow(INVITED_ROW)).toBe(true);
  });
});
