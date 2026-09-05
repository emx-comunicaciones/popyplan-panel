import type { Announcement } from "@/lib/api/types";

export function buildAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 3,
    title: "Cerramos el jueves",
    body: "Por la festividad local no habrá actividades.",
    audience: "members",
    sent_at: "2026-09-05T10:00:00Z",
    recipients_count: 5,
    ...overrides,
  };
}
