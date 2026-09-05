import type { CommunityMember, EntityCommunityRow } from "@/lib/api/types";

export function buildEntityCommunityRow(
  overrides: Partial<EntityCommunityRow> = {},
): EntityCommunityRow {
  return {
    id: "55555555-5555-5555-5555-555555555555",
    name: "Paseos al atardecer",
    description: "Quedadas semanales para pasear por el barrio.",
    banner_image: null,
    category: {
      id: "66666666-6666-6666-6666-666666666666",
      name: "Ocio y tiempo libre",
      emoji: "🌳",
      image: null,
      is_active: true,
      communities_count: 3,
      subcategories: [],
    },
    owner: { type: "organization", id: 7, name: "Asociación Vecinal Alfaville", verified: true },
    space: "members",
    allow_cross_space: false,
    visibility: "open",
    orientation: "",
    place: { ine_code: "30001", name: "Alfaville", prov_name: "Murcia" },
    radius_km: 5,
    latitude: null,
    longitude: null,
    members_count: 12,
    rating: null,
    is_member: false,
    membership_status: null,
    distance_km: null,
    recent_posts_count: 4,
    active_members_count: 6,
    upcoming_events_count: 2,
    created_at: "2026-01-15T09:00:00Z",
    ...overrides,
  };
}

export function buildCommunityMember(overrides: Partial<CommunityMember> = {}): CommunityMember {
  return {
    id: "77777777-7777-7777-7777-777777777777",
    user_id: "88888888-8888-8888-8888-888888888888",
    username: "marta_l",
    full_name: "Marta López",
    profile_picture: null,
    role: "member",
    status: "active",
    accepted_conduct_at: "2026-01-16T09:00:00Z",
    is_online: false,
    joined_at: "2026-01-16T09:00:00Z",
    ...overrides,
  };
}
