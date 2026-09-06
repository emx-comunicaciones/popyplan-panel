import type { Program } from "@/lib/api/types";

export function buildProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: 1,
    name: "Refuerzo escolar de verano",
    description: "Apoyo educativo para menores en riesgo de exclusión durante el verano.",
    funder: "Diputación Foral de Gipuzkoa",
    starts_on: "2026-01-01",
    ends_on: "2026-06-30",
    budget_cents: 1250000,
    status: "draft",
    closing_notes: "",
    created_at: "2026-01-01T09:00:00Z",
    updated_at: "2026-01-01T09:00:00Z",
    ...overrides,
  };
}
