/**
 * Fixtures del pipeline y de las oportunidades del CRM (forma real de
 * `crm/views.py::PipelineView`, `RenewalsView` y `catalog/`).
 */
import type {
  CrmAccount,
  CrmCatalogItem,
  CrmContract,
  CrmOpportunityCard,
  CrmPipeline,
  CrmRenewal,
} from "@/lib/api/crmTypes";

import { buildCrmAccount, buildCrmOpportunityCard, stageByKey } from "./crm";

export const KANBAN_STAGE_KEYS = ["interesado", "propuesta_enviada", "ganado", "perdido"] as const;

export function buildCrmPipelineOpportunities(): CrmPipeline {
  const card = (overrides: Partial<CrmOpportunityCard>) => buildCrmOpportunityCard(overrides);
  const cardsByStage: Record<string, CrmOpportunityCard[]> = {
    interesado: [
      card({ id: 31, name: "Popyplan Cultura", account: 2, account_name: "Ayuntamiento de Irun", amount: "3000.00" }),
    ],
    propuesta_enviada: [card({ id: 30, name: "Popyplan Asociaciones", amount: "8000.00" })],
    ganado: [],
    perdido: [],
  };
  return {
    of: "opportunities",
    columns: KANBAN_STAGE_KEYS.map((key) => ({
      stage: stageByKey(key),
      count: cardsByStage[key].length,
      amount: cardsByStage[key].reduce((sum, c) => sum + Number(c.amount), 0).toFixed(2),
      cards: cardsByStage[key],
    })),
  };
}

export function buildCrmPipelineAccounts(): CrmPipeline {
  const accounts: Record<string, CrmAccount[]> = {
    interesado: [buildCrmAccount({ id: 1, name: "Ayuntamiento de Donostia", open_value: "8000.00" })],
    propuesta_enviada: [],
    ganado: [],
    perdido: [],
  };
  return {
    of: "accounts",
    columns: KANBAN_STAGE_KEYS.map((key) => ({
      stage: stageByKey(key),
      count: accounts[key].length,
      amount: accounts[key].reduce((sum, a) => sum + Number(a.open_value ?? 0), 0).toFixed(2),
      cards: accounts[key],
    })),
  };
}

export const CRM_PRODUCTS: CrmCatalogItem[] = [
  { id: 40, kind: "product", name: "Popyplan Asociaciones", is_active: true, order: 0 },
] as CrmCatalogItem[];

export function buildCrmContract(overrides: Partial<CrmContract> = {}): CrmContract {
  return {
    id: 900,
    opportunity: 30,
    final_amount: "7200.00",
    awarded_at: "2026-09-25",
    start_date: "2026-10-01",
    end_date: "2027-09-30",
    duration_months: 12,
    product: 40,
    users_count: 300,
    associations_count: 5,
    file_number: "EXP-2026/123",
    document: null,
    renewal_date: "2027-07-01",
    notes: "",
    created_at: "2026-09-25T10:00:00Z",
    ...overrides,
  } as CrmContract;
}

export function buildCrmRenewal(overrides: Partial<CrmRenewal> = {}): CrmRenewal {
  return {
    ...buildCrmContract(),
    opportunity_name: "Popyplan Asociaciones",
    account: 1,
    account_name: "Ayuntamiento de Donostia",
    owner_name: "Mikel Errasti",
    days_left: 40,
    ...overrides,
  } as CrmRenewal;
}
