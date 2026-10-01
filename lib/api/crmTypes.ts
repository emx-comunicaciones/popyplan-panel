/**
 * Tipos del CRM comercial (`/api/crm/*`, `docs/CRM.md` del backend).
 *
 * Los de recurso salen del esquema generado. Los de las vistas de conjunto
 * (dashboard, pipeline, embudo, informes, calendario, mapa, búsqueda,
 * resumen de ficha…) se escriben a mano: el backend las documenta como
 * `OpenApiTypes.OBJECT` (devuelven un `dict` armado en `crm/reports.py` y
 * `crm/views.py`), así que el esquema no trae su forma. Comprobadas contra
 * esos dos ficheros.
 */
import type { components } from "./types.generated";

type S = components["schemas"];

export type CrmMe = S["CrmMe"];
export type CrmUserRef = S["CrmUserRef"];
export type CrmStage = S["CrmStage"];
export type CrmStageKind = S["CrmStageKindEnum"];
export type CrmCatalogItem = S["CrmCatalogItem"];
export type CrmCatalogKind = S["CrmCatalogItemKindEnum"];
export type CrmTag = S["CrmTag"];
export type CrmSettings = S["CrmSettings"];
export type CrmAccount = S["CrmAccountList"];
export type CrmAccountDetail = S["CrmAccountDetail"];
export type CrmAccountKind = S["CrmAccountKindEnum"];
export type CrmAccountRelation = S["CrmAccountRelation"];
export type CrmRelationKind = S["CrmAccountRelationKindEnum"];
export type CrmContact = S["CrmContact"];
export type CrmOpportunity = S["CrmOpportunity"];
export type CrmProposal = S["CrmProposal"];
export type CrmProposalStatus = S["CrmProposalStatusEnum"];
export type CrmContract = S["CrmContract"];
export type CrmActivity = S["CrmActivity"];
export type CrmActivityKind = S["CrmActivityKindEnum"];
export type CrmActivityResult = S["CrmActivityResultEnum"];
export type CrmInterest = S["CrmInterestEnum"];
export type CrmLostReason = S["CrmLostReasonEnum"];
export type CrmTask = S["CrmTask"];
export type CrmTaskPriority = S["CrmTaskPriorityEnum"];
export type CrmTaskStatus = S["CrmTaskStatusEnum"];
export type CrmNote = S["CrmNote"];
export type CrmDocument = S["CrmDocument"];
export type CrmDocumentVersion = S["CrmDocumentVersion"];
export type CrmDocumentCategory = S["CrmDocumentCategoryEnum"];
export type CrmNotification = S["CrmNotification"];
export type CrmNotificationKind = S["CrmNotificationKindEnum"];
export type CrmImportRow = S["CrmImportRow"];

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Entrada de historial: `payload` es una foto libre (ver `crm/services.py::record`). */
export interface CrmTimelineEvent {
  id: number;
  kind: string;
  occurred_at: string;
  created_at: string;
  opportunity: number | null;
  opportunity_name: string;
  activity: number | null;
  payload: Record<string, unknown>;
}

/** Escritura de una cuenta: `tags` por nombre (el backend crea las que falten). */
export interface CrmAccountWrite {
  name?: string;
  short_name?: string;
  kind?: CrmAccountKind;
  tax_id?: string;
  address?: string;
  postal_code?: string;
  place?: string | null;
  province_name?: string;
  region_name?: string;
  country?: string;
  population?: number | null;
  phone?: string;
  email?: string;
  website?: string;
  owner?: number | null;
  collaborators?: number[];
  stage?: number | null;
  interest?: CrmInterest;
  source?: number | null;
  tags?: string[];
  notes?: string;
  force?: boolean;
}

export interface CrmDuplicate {
  id: number;
  name: string;
  municipality?: string;
  owner_name?: string;
  account?: number;
  account_name?: string;
}

export interface CrmNextItem {
  type: "activity" | "task";
  kind: string;
  title: string;
  at: string;
  owner_name: string;
}

/** `GET accounts/{id}/summary/`. */
export interface CrmAccountSummary {
  account: CrmAccountDetail;
  last_activity: CrmActivity | null;
  next: CrmNextItem | null;
  main_contacts: CrmContact[];
  open_opportunities: CrmOpportunity[];
  open_value: string;
  proposals_sent: number;
  recent_documents: CrmDocument[];
  pending_tasks: CrmTask[];
  pinned_notes: CrmNote[];
}

export interface CrmOwnerChange {
  from: string;
  to: string;
  by: string;
  at: string;
}

/** Tarjeta de oportunidad del Kanban (`crm/views.py::_opportunity_card`). */
export interface CrmOpportunityCard {
  id: number;
  name: string;
  account: number;
  account_name: string;
  municipality: string;
  province: string;
  population: number | null;
  owner_name: string;
  amount: string;
  interest: CrmInterest;
  product_name: string;
  last_activity_at: string | null;
  days_without_contact: number | null;
  next_activity_at: string | null;
  expected_close_date: string | null;
}

export interface CrmPipelineColumn<T> {
  stage: CrmStage;
  count: number;
  amount: string;
  cards: T[];
}

export type CrmPipeline =
  | { of: "opportunities"; columns: CrmPipelineColumn<CrmOpportunityCard>[] }
  | { of: "accounts"; columns: CrmPipelineColumn<CrmAccount>[] };

export interface CrmFunnelRow {
  stage: number;
  key: string;
  name: string;
  kind: CrmStageKind;
  color: string;
  count: number;
  amount: string;
  reached: number;
  conversion: number | null;
  average_days: number | null;
}

export interface CrmPeriodBlock {
  new_accounts: number;
  contacted_accounts: number;
  contacts: number;
  visits: number;
  meetings: number;
  video_calls: number;
  calls: number;
  demos: number;
  pilots: number;
  proposals_sent: number;
  proposals_amount: string;
  pilots_started: number;
  won: number;
  won_amount: string;
  lost: number;
}

export interface CrmDashboard {
  period: { since: string; until: string; previous_since: string; previous_until: string };
  totals: {
    accounts: number;
    never_contacted: number;
    clients: number;
    open_opportunities: number;
    pending_tasks: number;
    overdue_tasks: number;
    without_follow_up: number;
  };
  current: CrmPeriodBlock;
  previous: CrmPeriodBlock;
  change: Partial<Record<keyof CrmPeriodBlock, number | null>>;
  money: {
    pipeline_value: string;
    weighted_pipeline: string;
    proposals_amount: string;
    won_amount: string;
    average_ticket: string | null;
  };
  funnel: CrmFunnelRow[];
}

export interface CrmSalespersonRow {
  user: number;
  name: string;
  accounts: number;
  contacts: number;
  visits: number;
  meetings: number;
  video_calls: number;
  calls: number;
  demos: number;
  pilots: number;
  proposals: number;
  open_opportunities: number;
  pipeline_value: string;
  contracts: number;
  won_amount: string;
  pending_tasks: number;
  overdue_tasks: number;
  win_rate: number | null;
}

export interface CrmReport {
  period: { since: string; until: string };
  activity: Omit<CrmPeriodBlock, "new_accounts" | "contacted_accounts" | "proposals_sent" |
    "proposals_amount" | "pilots_started" | "won" | "won_amount" | "lost"> & {
    by_kind: Record<string, number>;
  };
  funnel: CrmFunnelRow[];
  by_salesperson: CrmSalespersonRow[];
  lost_reasons: { reason: CrmLostReason; label: string; count: number }[];
  average_days_between_contacts: number | null;
  without_follow_up: number;
  won_amount: string;
}

export interface CrmCoverageRow {
  name: string;
  registered: number;
  contacted: number;
  negotiating: number;
  clients: number;
  coverage: number;
}

export type CrmAttentionRow = CrmAccount & {
  attention_level: number | null;
  next_task: CrmTask | null;
};

export interface CrmAttention extends Paginated<CrmAttentionRow> {
  thresholds: number[];
}

export interface CrmCalendarItem {
  type: "activity" | "task" | "renewal";
  id: number;
  kind: string;
  title: string;
  start: string;
  duration_minutes: number | null;
  account: number | null;
  account_name: string;
  owner_name: string;
  done: boolean;
  priority?: CrmTaskPriority;
}

export interface CrmMapPoint {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  municipality: string;
  province: string;
  population: number | null;
  stage: number | null;
  stage_key: string | null;
  stage_kind: CrmStageKind | null;
  stage_name: string;
  is_client: boolean;
  owner_name: string;
  interest: CrmInterest;
  last_activity_at: string | null;
  next_activity_at: string | null;
  open_value: string;
}

export interface CrmSearchResult {
  accounts: CrmDuplicate[];
  contacts: { id: number; name: string; position: string; email: string; phone: string;
    account: number; account_name: string }[];
  opportunities: { id: number; name: string; file_number: string; account: number;
    account_name: string }[];
  documents: { id: number; name: string; account: number | null; account_name: string }[];
}

export type CrmRenewal = CrmContract & {
  opportunity_name: string;
  account: number;
  account_name: string;
  owner_name: string;
  days_left: number;
};

export interface CrmTaskCounts {
  today: number;
  upcoming: number;
  overdue: number;
  done: number;
}

export type CrmExportResource = "accounts" | "contacts" | "opportunities" | "activities";
