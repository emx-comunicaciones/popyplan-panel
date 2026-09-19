import type {
  FamiliesSummary,
  FamiliesSummaryCommunityRow,
  FamilyAnnouncementRow,
  FamilyResourceRow,
  FamilyUpcomingEvent,
} from "@/lib/api/types";

export function buildFamiliesSummaryCommunityRow(
  overrides: Partial<FamiliesSummaryCommunityRow> = {},
): FamiliesSummaryCommunityRow {
  return {
    id: "99999999-9999-9999-9999-999999999999",
    name: "Familias",
    members_count: 12,
    allow_cross_space: false,
    suppressed: false,
    ...overrides,
  };
}

export function buildFamilyUpcomingEvent(
  overrides: Partial<FamilyUpcomingEvent> = {},
): FamilyUpcomingEvent {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    title: "Merienda familiar",
    starts_at: "2026-09-08T18:00:00Z",
    community: { id: "99999999-9999-9999-9999-999999999999", name: "Familias" },
    ...overrides,
  };
}

export function buildFamilyAnnouncementRow(
  overrides: Partial<FamilyAnnouncementRow> = {},
): FamilyAnnouncementRow {
  return {
    id: 7,
    title: "Aviso familias",
    sent_at: "2026-09-05T10:00:00Z",
    recipients_count: 12,
    ...overrides,
  };
}

export function buildFamilyResourceRow(
  overrides: Partial<FamilyResourceRow> = {},
): FamilyResourceRow {
  return {
    id: 3,
    title: "Guía familias",
    kind: "text",
    is_featured: false,
    created_at: "2026-09-01T09:00:00Z",
    ...overrides,
  };
}

export function buildFamiliesSummary(overrides: Partial<FamiliesSummary> = {}): FamiliesSummary {
  return {
    communities: [buildFamiliesSummaryCommunityRow()],
    members_count: 12,
    suppressed: false,
    upcoming_events: [buildFamilyUpcomingEvent()],
    announcements: [buildFamilyAnnouncementRow()],
    resources: [buildFamilyResourceRow()],
    // Contadores de la red de apoyo (`docs/PANEL.md` §14.5, tarea 1 del
    // plan de red de apoyo): añadidos al esquema con esa tarea, sin
    // consumidor todavía en `FamiliasPanel.tsx` (tarea 4).
    people_with_support_network: { value: 3, suppressed: false },
    active_supporters: { value: 4, suppressed: false },
    supporters_notified_on_help: { value: 2, suppressed: false },
    missing_families_space_supporters: 0,
    ...overrides,
  };
}
