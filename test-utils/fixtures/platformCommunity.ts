import type { PlatformCommunityDetail, PlatformCommunityPost, PlatformReview } from "@/lib/api/types";

export const COMMUNITY_ID = "a55c1986-b198-4f9a-91a8-1329e84f33bc";

export function buildPlatformCommunityDetail(
  overrides: Partial<PlatformCommunityDetail> = {},
): PlatformCommunityDetail {
  return {
    id: COMMUNITY_ID,
    name: "Durangaldeko Elkartea: talde itxia",
    description: "Taldea",
    visibility: "private",
    space: "members",
    owner: { type: "organization", id: 101, name: "Durangaldeko Elkartea", verified: true },
    members_count: 7,
    is_active: true,
    creator_name: "Titular",
    place: { ine_code: "48027", name: "Durango", prov_name: "Bizkaia" },
    category: null,
    created_at: "2026-09-10T10:00:00Z",
    ...overrides,
  };
}

export function buildPlatformCommunityPost(
  overrides: Partial<PlatformCommunityPost> = {},
): PlatformCommunityPost {
  return {
    id: "d55b30dc-a549-4ee5-9f6c-8adafe06e266",
    community: COMMUNITY_ID,
    author: { id: "214", public_name: "Mikel" },
    author_name: "Mikel",
    content: "Mañana quedamos a las diez en la plaza.",
    image: null,
    images: [],
    video_url: null,
    surface: "wall",
    likes_count: 3,
    comments_count: 1,
    is_active: true,
    created_at: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

export function buildPlatformReview(overrides: Partial<PlatformReview> = {}): PlatformReview {
  return {
    id: "7ef76c9d-58df-425e-8b99-ea5ffbb3db0e",
    reviewer: { id: 187, public_name: "Diego", first_name: "Diego", last_name: "", photo: null, verification_level: 0 },
    review_type: "event",
    event: "f0ff50eb-ed1d-4476-ac4d-09dcf3e87ff7",
    team: null,
    rating: 5,
    comment: "Muy buena actividad, repetiré.",
    created_at: "2026-09-19T21:16:17Z",
    ...overrides,
  };
}
