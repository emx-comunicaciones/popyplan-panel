import type { ReportDetail, ReportRow } from "@/lib/api/types";

export function buildReportRow(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    target_type: "user",
    target_id: "22222222-2222-2222-2222-222222222222",
    reporter: 3,
    reported_user: 4,
    community: null,
    organization: 7,
    reason: "harassment",
    description: "Comportamiento agresivo en el chat de la comunidad.",
    status: "pending",
    resolution: "none",
    resolution_note: "",
    assigned_to: null,
    resolved_by: null,
    resolved_at: null,
    escalated_at: null,
    created_at: "2026-09-01T10:00:00Z",
    organization_display: { id: 7, name: "Asociación Demo" },
    community_display: null,
    ...overrides,
  };
}

export function buildReportDetail(overrides: Partial<ReportDetail> = {}): ReportDetail {
  return {
    ...buildReportRow(),
    target: { type: "user", id: "4", name: "Persona reportada" },
    // El esquema lo declara obligatorio desde que se regeneró con la
    // cuarta visibilidad: el backend ya lo servía.
    target_display: { id: 4, public_name: "Persona reportada" },
    ...overrides,
  };
}
