import type { OrgMembershipFull } from "@/lib/api/types";

export function buildOrgMembershipFull(
  overrides: Partial<OrgMembershipFull> = {},
): OrgMembershipFull {
  return {
    id: 1,
    user: 42,
    organization: 7,
    role: "titular",
    created_at: "2026-01-05T09:00:00Z",
    public_name: "Ana",
    photo: "",
    ...overrides,
  };
}
