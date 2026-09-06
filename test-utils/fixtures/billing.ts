import type { BillingSummary, Contract, Invoice, PricingTier } from "@/lib/api/types";

export function buildPricingTier(overrides: Partial<PricingTier> = {}): PricingTier {
  return {
    id: 1,
    name: "Municipio pequeño",
    min_population: 0,
    max_population: 5000,
    annual_price_cents: 120000,
    is_active: true,
    ...overrides,
  };
}

export function buildContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 1,
    organization: { id: 7, name: "Ayuntamiento de Irun", slug: "ayuntamiento-de-irun", org_type: "administracion" },
    tier: { id: 1, name: "Municipio pequeño", annual_price_cents: 120000 },
    starts_on: "2026-01-01",
    ends_on: "2026-12-31",
    status: "active",
    notes: "",
    invoices_count: 2,
    pending_amount_cents: 30000,
    ...overrides,
  };
}

export function buildInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    contract: 1,
    number: "2026-0001",
    amount_cents: 60000,
    issued_on: "2026-01-05",
    due_on: "2026-02-05",
    paid_on: null,
    status: "pending",
    ...overrides,
  };
}

export function buildBillingSummary(overrides: Partial<BillingSummary> = {}): BillingSummary {
  return {
    active_contracts: 2,
    annual_value_cents: 240000,
    overdue_invoices: 1,
    pending_amount_cents: 30000,
    ...overrides,
  };
}
