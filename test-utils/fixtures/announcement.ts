import type { Announcement } from "@/lib/api/types";

export function buildAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 3,
    title: "Cerramos el jueves",
    body: "Por la festividad local no habrá actividades.",
    audience: "members",
    sent_at: "2026-09-05T10:00:00Z",
    recipients_count: 5,
    // `Announcement.organization` (tematización, ajena a esta tarea): campo
    // nuevo en `docs/schema.yaml` desde el último `npm run gen:types`,
    // pasó de opcional a obligatorio en el esquema generado.
    organization: { id: 7, name: "Asociación Bidasoa", logo: null, primary_color: "#1FB3AE" },
    ...overrides,
  };
}
