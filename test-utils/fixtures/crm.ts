/**
 * Fixtures del CRM comercial, con la forma real de `/api/crm/*`
 * (`crm/serializers.py` y `crm/views.py` del backend).
 */
import type {
  CrmAccount,
  CrmAccountDetail,
  CrmAccountSummary,
  CrmActivity,
  CrmCalendarItem,
  CrmContact,
  CrmCoverageRow,
  CrmDashboard,
  CrmDocument,
  CrmFunnelRow,
  CrmMapPoint,
  CrmNote,
  CrmNotification,
  CrmOpportunity,
  CrmOpportunityCard,
  CrmProposal,
  CrmReport,
  CrmSalespersonRow,
  CrmStage,
  CrmTask,
  CrmTimelineEvent,
  Paginated,
} from "@/lib/api/crmTypes";

export const CRM_STAGES: CrmStage[] = [
  { id: 1, key: "sin_contactar", name: "Sin contactar", order: 0, kind: "open", probability: 0, color: "#9AA5B1", is_active: true },
  { id: 2, key: "contactado", name: "Contactado", order: 1, kind: "open", probability: 5, color: "#72C9EE", is_active: true },
  { id: 5, key: "interesado", name: "Interesado", order: 4, kind: "open", probability: 30, color: "#1FB3AE", is_active: true },
  { id: 6, key: "propuesta_enviada", name: "Propuesta enviada", order: 5, kind: "open", probability: 45, color: "#12908B", is_active: true },
  { id: 8, key: "negociacion", name: "Negociación", order: 7, kind: "open", probability: 70, color: "#E0A100", is_active: true },
  { id: 10, key: "ganado", name: "Ganado", order: 9, kind: "won", probability: 100, color: "#2E7D32", is_active: true },
  { id: 11, key: "perdido", name: "Perdido", order: 10, kind: "lost", probability: 0, color: "#B3261E", is_active: true },
  { id: 12, key: "pausado", name: "Pausado", order: 11, kind: "paused", probability: 0, color: "#6B7280", is_active: true },
];

export const stageByKey = (key: string): CrmStage => CRM_STAGES.find((s) => s.key === key) ?? CRM_STAGES[0];

export const CRM_USER = { id: 42, name: "Mikel Errasti", email: "mikel@popyplan.test" };
export const CRM_USER_2 = { id: 43, name: "Carlos Pérez", email: "carlos@popyplan.test" };

export function paginated<T>(results: T[]): Paginated<T> {
  return { count: results.length, next: null, previous: null, results };
}

export function buildCrmAccount(overrides: Partial<CrmAccount> = {}): CrmAccount {
  return {
    id: 1,
    name: "Ayuntamiento de Donostia",
    short_name: "Donostia",
    kind: "city_council",
    place: { ine_code: "20069", name: "Donostia/San Sebastián", prov_name: "Gipuzkoa", ccaa_name: "País Vasco" },
    province: "Gipuzkoa",
    region: "País Vasco",
    population: 187000,
    owner: CRM_USER,
    stage: stageByKey("interesado"),
    interest: "high",
    is_client: false,
    tags: [{ id: 1, name: "Adicciones", color: "" }],
    last_activity_at: "2026-09-26T10:00:00Z",
    next_activity_at: "2026-10-04T09:00:00Z",
    days_without_contact: 5,
    open_value: "8000.00",
    phone: "943000000",
    email: "info@donostia.eus",
    created_at: "2026-09-01T09:00:00Z",
    ...overrides,
  };
}

export function buildCrmAccountDetail(overrides: Partial<CrmAccountDetail> = {}): CrmAccountDetail {
  return {
    ...buildCrmAccount(),
    tax_id: "P2006900A",
    address: "Ijentea kalea 1",
    postal_code: "20003",
    province_name: "",
    region_name: "",
    country: "España",
    website: "https://www.donostia.eus",
    latitude: "43.318334",
    longitude: "-1.981231",
    collaborators: [],
    source: { id: 3, kind: "source", name: "Prospección comercial", order: 0, is_active: true },
    notes: "",
    first_contact_at: "2026-09-10T10:00:00Z",
    organization: null,
    updated_at: "2026-09-30T10:00:00Z",
    ...overrides,
  } as CrmAccountDetail;
}

export function buildCrmContact(overrides: Partial<CrmContact> = {}): CrmContact {
  return {
    id: 7,
    account: 1,
    account_name: "Ayuntamiento de Donostia",
    first_name: "María",
    last_name: "Etxeberria",
    position: "Responsable de Servicios Sociales",
    department: 20,
    department_name: "Servicios Sociales",
    email: "maria@donostia.eus",
    phone: "943111111",
    mobile: "600111111",
    linkedin: "",
    notes: "",
    is_primary: true,
    last_contact_at: "2026-09-28T10:00:00Z",
    next_action_at: null,
    activities_count: 3,
    created_at: "2026-09-10T10:00:00Z",
    ...overrides,
  } as CrmContact;
}

export function buildCrmOpportunity(overrides: Partial<CrmOpportunity> = {}): CrmOpportunity {
  return {
    id: 30,
    account: 1,
    account_name: "Ayuntamiento de Donostia",
    name: "Popyplan Asociaciones",
    product: 40,
    product_name: "Popyplan Asociaciones",
    description: "",
    owner: 42,
    owner_detail: CRM_USER,
    stage: 6,
    stage_detail: stageByKey("propuesta_enviada"),
    stage_entered_at: "2026-09-30T12:30:00Z",
    days_in_stage: 1,
    interest: "high",
    estimated_amount: "8000.00",
    proposal_amount: "7500.00",
    final_amount: null,
    expected_close_date: "2026-12-15",
    contract_duration_months: 12,
    associations_count: 5,
    users_count: 300,
    professionals_count: 10,
    notes: "",
    available_budget: null,
    budget_line: "",
    funding: "",
    has_subsidy: false,
    eu_funds: true,
    regional_funds: false,
    state_funds: false,
    file_number: "EXP-2026/123",
    file_url: "",
    procedure_notes: "",
    tender_date: null,
    deadline: null,
    procurement_manager: "",
    technical_contact: null,
    administrative_contact: null,
    required_documents: "",
    procurement_notes: "",
    lost_reason: "",
    lost_detail: "",
    closed_at: null,
    last_activity_at: "2026-09-30T12:30:00Z",
    contract: null,
    created_at: "2026-09-20T09:00:00Z",
    updated_at: "2026-09-30T12:30:00Z",
    ...overrides,
  } as CrmOpportunity;
}

export function buildCrmActivity(overrides: Partial<CrmActivity> = {}): CrmActivity {
  return {
    id: 100,
    account: 1,
    account_name: "Ayuntamiento de Donostia",
    opportunity: null,
    opportunity_name: "",
    kind: "visit",
    occurred_at: "2026-09-28T10:00:00Z",
    duration_minutes: 55,
    owner: 42,
    owner_detail: CRM_USER,
    team: [],
    team_detail: [],
    contacts: [7],
    contacts_detail: [{ id: 7, name: "María Etxeberria", position: "Responsable de Servicios Sociales" }],
    title: "Reunión con Servicios Sociales",
    description: "",
    summary: "Interesados en la parte de asociaciones.",
    result: "positive",
    result_text: "",
    interest_after: "high",
    internal_comments: "",
    has_follow_up: true,
    created_at: "2026-09-28T11:00:00Z",
    updated_at: "2026-09-28T11:00:00Z",
    ...overrides,
  } as CrmActivity;
}

export function buildCrmTask(overrides: Partial<CrmTask> = {}): CrmTask {
  return {
    id: 200,
    account: 1,
    account_name: "Ayuntamiento de Donostia",
    contact: 7,
    contact_name: "María Etxeberria",
    opportunity: null,
    opportunity_name: "",
    origin_activity: 100,
    kind: "email",
    title: "Enviar dossier y propuesta",
    description: "",
    assignee: 42,
    assignee_detail: CRM_USER,
    due_at: "2026-10-03T09:00:00Z",
    priority: "high",
    status: "pending",
    reminder_minutes: 60,
    is_overdue: false,
    completed_at: null,
    created_at: "2026-09-28T11:00:00Z",
    ...overrides,
  } as CrmTask;
}

export function buildCrmNote(overrides: Partial<CrmNote> = {}): CrmNote {
  return {
    id: 300,
    account: 1,
    opportunity: null,
    body: "IMPORTANTE: el responsable quiere presentarlo al concejal en noviembre.",
    important: true,
    pinned: true,
    author_name: "Mikel Errasti",
    created_at: "2026-09-29T10:00:00Z",
    ...overrides,
  } as CrmNote;
}

export function buildCrmDocument(overrides: Partial<CrmDocument> = {}): CrmDocument {
  const version = {
    id: 501,
    version: 1,
    filename: "Propuesta_Popyplan.pdf",
    content_type: "application/pdf",
    size: 120000,
    uploaded_by_name: "Mikel Errasti",
    created_at: "2026-09-30T12:30:00Z",
    download_url: "/api/crm/documents/500/versions/501/download/",
  };
  return {
    id: 500,
    account: 1,
    account_name: "Ayuntamiento de Donostia",
    opportunity: 30,
    opportunity_name: "Popyplan Asociaciones",
    activity: null,
    name: "Propuesta Popyplan",
    category: "proposal",
    description: "",
    received: false,
    created_by_name: "Mikel Errasti",
    latest: version,
    versions: [version],
    created_at: "2026-09-30T12:30:00Z",
    updated_at: "2026-09-30T12:30:00Z",
    ...overrides,
  } as CrmDocument;
}

export function buildCrmProposal(overrides: Partial<CrmProposal> = {}): CrmProposal {
  return {
    id: 600,
    opportunity: 30,
    number: "P-001",
    version: 1,
    date: "2026-09-30",
    amount: "8000.00",
    duration_months: 12,
    product: 40,
    document: null,
    document_name: "",
    status: "sent",
    sent_at: "2026-09-30T12:30:00Z",
    notes: "",
    created_at: "2026-09-30T12:30:00Z",
    ...overrides,
  } as CrmProposal;
}

export function buildCrmTimelineEvent(overrides: Partial<CrmTimelineEvent> = {}): CrmTimelineEvent {
  return {
    id: 900,
    kind: "activity",
    occurred_at: "2026-09-28T10:00:00Z",
    created_at: "2026-09-28T11:00:00Z",
    opportunity: null,
    opportunity_name: "",
    activity: 100,
    payload: {
      actor_name: "Mikel Errasti",
      activity_kind: "visit",
      title: "Reunión con Servicios Sociales",
      summary: "Interesados en la parte de asociaciones.",
      result: "positive",
      interest_after: "high",
      duration_minutes: 55,
      contacts: [{ id: 7, name: "María Etxeberria", position: "Responsable de Servicios Sociales" }],
      next_action: { title: "Enviar dossier y propuesta", due_at: "2026-10-03T09:00:00Z", assignee_name: "Mikel Errasti" },
    },
    ...overrides,
  };
}

export function buildCrmSummary(overrides: Partial<CrmAccountSummary> = {}): CrmAccountSummary {
  return {
    account: buildCrmAccountDetail(),
    last_activity: buildCrmActivity(),
    next: { type: "task", kind: "email", title: "Enviar dossier y propuesta", at: "2026-10-03T09:00:00Z", owner_name: "Mikel Errasti" },
    main_contacts: [buildCrmContact()],
    open_opportunities: [buildCrmOpportunity()],
    open_value: "8000.00",
    proposals_sent: 1,
    recent_documents: [buildCrmDocument()],
    pending_tasks: [buildCrmTask()],
    pinned_notes: [buildCrmNote()],
    ...overrides,
  };
}

export function buildCrmOpportunityCard(overrides: Partial<CrmOpportunityCard> = {}): CrmOpportunityCard {
  return {
    id: 30,
    name: "Popyplan Asociaciones",
    account: 1,
    account_name: "Ayuntamiento de Donostia",
    municipality: "Donostia/San Sebastián",
    province: "Gipuzkoa",
    population: 187000,
    owner_name: "Mikel Errasti",
    amount: "8000.00",
    interest: "high",
    product_name: "Popyplan Asociaciones",
    last_activity_at: "2026-09-30T12:30:00Z",
    days_without_contact: 1,
    next_activity_at: "2026-10-03T09:00:00Z",
    expected_close_date: "2026-12-15",
    ...overrides,
  };
}

export function buildCrmFunnel(): CrmFunnelRow[] {
  return CRM_STAGES.map((s, i) => ({
    stage: s.id, key: s.key, name: s.name, kind: s.kind ?? "open", color: s.color ?? "",
    count: [10, 6, 4, 3, 2, 1, 1, 0][i], amount: ["0.00", "0.00", "16000.00", "8000.00", "12000.00", "7200.00", "4000.00", "0.00"][i],
    reached: [20, 12, 7, 4, 2, 1, 1, 0][i], conversion: i === 0 ? null : [null, 60, 58.3, 57.1, 50, 50, null, null][i],
    average_days: [3, 5, 9, 12, 20, null, null, null][i],
  }));
}

export function buildCrmDashboard(overrides: Partial<CrmDashboard> = {}): CrmDashboard {
  const block = {
    new_accounts: 4, contacted_accounts: 9, contacts: 30, visits: 32, meetings: 6, video_calls: 4, calls: 15,
    demos: 3, pilots: 1, proposals_sent: 2, proposals_amount: "15500.00", pilots_started: 1, won: 1,
    won_amount: "7200.00", lost: 1,
  };
  return {
    period: { since: "2026-10-01", until: "2026-10-31", previous_since: "2026-09-01", previous_until: "2026-09-30" },
    totals: { accounts: 88, never_contacted: 54, clients: 4, open_opportunities: 12, pending_tasks: 9, overdue_tasks: 2, without_follow_up: 7 },
    current: block,
    previous: { ...block, visits: 28, calls: 15, won: 0, won_amount: "0.00" },
    change: { visits: 14.3, calls: 0, won: null },
    money: { pipeline_value: "96000.00", weighted_pipeline: "31000.00", proposals_amount: "15500.00", won_amount: "7200.00", average_ticket: "7200.00" },
    funnel: buildCrmFunnel(),
    ...overrides,
  };
}

export function buildCrmSalespersonRow(overrides: Partial<CrmSalespersonRow> = {}): CrmSalespersonRow {
  return {
    user: 42, name: "Mikel Errasti", accounts: 30, contacts: 25, visits: 12, meetings: 4, video_calls: 2,
    calls: 7, demos: 2, pilots: 0, proposals: 2, open_opportunities: 6, pipeline_value: "48000.00",
    contracts: 1, won_amount: "7200.00", pending_tasks: 5, overdue_tasks: 1, win_rate: 50,
    ...overrides,
  };
}

export function buildCrmReport(overrides: Partial<CrmReport> = {}): CrmReport {
  return {
    period: { since: "2026-01-01", until: "2026-12-31" },
    activity: { contacts: 30, visits: 32, meetings: 6, video_calls: 4, calls: 15, demos: 3, pilots: 1, by_kind: { visit: 32, call: 15 } },
    funnel: buildCrmFunnel(),
    by_salesperson: [buildCrmSalespersonRow(), buildCrmSalespersonRow({ user: 43, name: "Carlos Pérez", visits: 20 })],
    lost_reasons: [{ reason: "no_budget", label: "Sin presupuesto", count: 2 }],
    average_days_between_contacts: 9.5,
    without_follow_up: 7,
    won_amount: "7200.00",
    ...overrides,
  };
}

export function buildCrmCoverageRow(overrides: Partial<CrmCoverageRow> = {}): CrmCoverageRow {
  return { name: "Gipuzkoa", registered: 88, contacted: 34, negotiating: 7, clients: 4, coverage: 38.6, ...overrides };
}

export function buildCrmMapPoint(overrides: Partial<CrmMapPoint> = {}): CrmMapPoint {
  return {
    id: 1, name: "Ayuntamiento de Donostia", latitude: "43.318334", longitude: "-1.981231",
    municipality: "Donostia/San Sebastián", province: "Gipuzkoa", population: 187000, stage: 5,
    stage_key: "interesado", stage_kind: "open", stage_name: "Interesado", is_client: false,
    owner_name: "Mikel Errasti", interest: "high", last_activity_at: "2026-09-26T10:00:00Z",
    next_activity_at: "2026-10-04T09:00:00Z", open_value: "8000.00",
    ...overrides,
  };
}

export function buildCrmCalendarItem(overrides: Partial<CrmCalendarItem> = {}): CrmCalendarItem {
  return {
    type: "activity", id: 100, kind: "visit", title: "Visita a Servicios Sociales", start: "2026-10-02T10:00:00Z",
    duration_minutes: 60, account: 1, account_name: "Ayuntamiento de Donostia", owner_name: "Mikel Errasti",
    done: false, ...overrides,
  };
}

export function buildCrmNotification(overrides: Partial<CrmNotification> = {}): CrmNotification {
  return {
    id: 700, kind: "task_reminder", title: "Recordatorio: Enviar dossier y propuesta",
    body: "Ayuntamiento de Donostia", account: 1, account_name: "Ayuntamiento de Donostia",
    opportunity: null, task: 200, read_at: null, created_at: "2026-10-03T08:00:00Z",
    ...overrides,
  } as CrmNotification;
}
