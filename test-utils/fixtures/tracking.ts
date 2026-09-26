import type { EnrollmentRow, SharedTracking } from "@/lib/api/types";

/**
 * Fila real de `GET .../program/enrollments/` copiada del backend sembrado
 * (Asociación Bidasoa, «Persona 01» pendiente de aceptar). `referent.id`
 * es el id de la `OrgMembership` (190), no el de la cuenta (11).
 */
export function buildEnrollment(overrides: Partial<EnrollmentRow> = {}): EnrollmentRow {
  return {
    id: 1,
    user: { id: 13, public_name: "Persona 01" },
    status: "pending",
    tracking_type: "alcohol",
    tracking_label: "",
    referent: { id: 190, public_name: "Referente" },
    created_at: "2026-09-26T19:12:08.207516+02:00",
    accepted_at: null,
    ended_at: null,
    ...overrides,
  };
}

/** Todo compartido: una respuesta de `.../shared/` con las cinco secciones. */
export function buildSharedTracking(overrides: Partial<SharedTracking> = {}): SharedTracking {
  return {
    enrollment_id: 1,
    tracking_type: "alcohol",
    tracking_label: "",
    accepted_at: "2026-09-20T10:00:00+02:00",
    consent: { checkins: true, urges: true, goals: true, participation: true, general_state: true },
    window: { since: "2026-08-30", until: "2026-09-26" },
    checkins: [
      {
        date: "2026-09-25",
        mood: "good",
        main_goal: true,
        sport: true,
        went_out: false,
        met_someone: true,
        popyplan_plan: false,
        slept_well: true,
        routine: false,
        therapy_meeting: false,
        feel_good: true,
      },
      {
        date: "2026-09-24",
        mood: "hard",
        main_goal: false,
        sport: false,
        went_out: false,
        met_someone: false,
        popyplan_plan: false,
        slept_well: false,
        routine: false,
        therapy_meeting: true,
        feel_good: false,
      },
    ],
    urges: [{ date: "2026-09-24", urge: "quite" }],
    goals: [
      { week_start: "2026-09-21", title: "Caminar tres días", done: true, proposed: false },
      { week_start: "2026-09-21", title: "Ir a una actividad", done: false, proposed: true },
    ],
    participation: { window_days: 28, attended_activities: 3, workouts: 5 },
    general_state: {
      last_mood: "good",
      weeks: [{ week_start: "2026-09-21", good: 3, so_so: 1, hard: 1 }],
    },
    ...overrides,
  };
}

/** Aceptada pero sin compartir nada todavía (el consentimiento nace todo apagado). */
export function buildSharedNothing(): SharedTracking {
  return buildSharedTracking({
    consent: { checkins: false, urges: false, goals: false, participation: false, general_state: false },
    checkins: null,
    urges: null,
    goals: null,
    participation: null,
    general_state: null,
  });
}
