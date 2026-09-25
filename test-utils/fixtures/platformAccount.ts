import type { BlockAdmin, PlatformAccount, PlatformPublicProfile } from "@/lib/api/types";

/** Una fila de `GET /api/users/users/` con la forma real (`MeSerializer`, ver `lib/api/types.ts::PlatformAccount`). */
export function buildPlatformAccount(overrides: Partial<PlatformAccount> = {}): PlatformAccount {
  return {
    id: 13,
    email: "panel-demo-asociacion-bidasoa-p01@test.com",
    username: "panel_demo_asociacion_bidasoa_p01",
    first_name: "Persona 01",
    last_name: "",
    is_verified: false,
    verification_level: 0,
    created_at: "2026-09-04T10:00:00+02:00",
    profile: { public_name: "Persona 01", photo: null, place: null },
    org_memberships: [],
    ...overrides,
  };
}

export function buildPlatformPublicProfile(overrides: Partial<PlatformPublicProfile> = {}): PlatformPublicProfile {
  return {
    id: 13,
    public_name: "Persona 01",
    photo: null,
    place: { ine_code: "20045", name: "Irun", prov_name: "Gipuzkoa" },
    verification_level: 1,
    ...overrides,
  };
}

export function buildBlockAdmin(overrides: Partial<BlockAdmin> = {}): BlockAdmin {
  return {
    id: "6f1c2e8a-0000-4000-8000-000000000001",
    blocker: 13,
    blocker_username: "panel_demo_asociacion_bidasoa_p01",
    blocked: 14,
    blocked_username: "panel_demo_asociacion_bidasoa_p02",
    phone_blocked: false,
    created_at: "2026-09-20T12:00:00+02:00",
    ...overrides,
  };
}
