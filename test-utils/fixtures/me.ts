import type { MeForArea, OrgMembershipForArea } from "@/lib/api/types";

export function buildOrgMembership(
  overrides: Partial<OrgMembershipForArea> = {},
): OrgMembershipForArea {
  return {
    organization_id: 7,
    organization_name: "Asociación Vecinal Alfaville",
    organization_slug: "asociacion-alfaville",
    organization_type: "ong",
    parent_id: null,
    is_verified: true,
    admin_level: "",
    logo: null,
    role: "titular",
    ...overrides,
  };
}

export function buildMe(overrides: Partial<MeForArea> = {}): MeForArea {
  return {
    id: 42,
    email: "titular@alfaville.test",
    username: "titular_alfaville",
    first_name: "Ana",
    last_name: "Gómez",
    phone: null,
    birth_date: "1985-04-12",
    age: 41,
    is_verified: true,
    phone_verified: true,
    two_fa_enabled: false,
    push_notifications: true,
    email_notifications: true,
    verification_level: "1",
    verification_pending_review: "false",
    created_at: "2026-01-10T09:00:00Z",
    preferred_language: "",
    profile: {
      display_name: "Ana",
      public_name: "Ana G.",
      photo: "",
      bio: "",
      interests: [],
      languages: [],
      place: { ine_code: "30001", name: "Alfaville", prov_name: "Murcia" },
      latitude: null,
      longitude: null,
    },
    org_memberships: [buildOrgMembership()],
    ...overrides,
  };
}
