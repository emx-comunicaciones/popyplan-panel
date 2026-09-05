import type { EntityResource } from "@/lib/api/types";

export function buildEntityResource(overrides: Partial<EntityResource> = {}): EntityResource {
  return {
    id: 1,
    title: "Guía de acogida",
    category: "help",
    kind: "text",
    body: "Bienvenida a la asociación.",
    file: null,
    url: undefined,
    is_featured: false,
    audience: "members",
    created_by: 42,
    created_at: "2026-09-01T09:00:00Z",
    ...overrides,
  };
}
