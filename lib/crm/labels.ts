/**
 * Etiquetas de los valores del CRM (claves de `messages/*.json::crm.enums.*`).
 * Mapas explícitos valor → clave; `crmLabel` cae al valor crudo si el
 * backend añade uno que aquí no se conoce (nunca se pinta a propósito).
 */
export const CRM_ACCOUNT_KIND_LABELS: Record<string, string> = {
  city_council: "crm.enums.accountKind.city_council",
  provincial_council: "crm.enums.accountKind.provincial_council",
  cabildo: "crm.enums.accountKind.cabildo",
  island_council: "crm.enums.accountKind.island_council",
  region: "crm.enums.accountKind.region",
  mancomunidad: "crm.enums.accountKind.mancomunidad",
  public_body: "crm.enums.accountKind.public_body",
  public_company: "crm.enums.accountKind.public_company",
  association: "crm.enums.accountKind.association",
  foundation: "crm.enums.accountKind.foundation",
  other: "crm.enums.accountKind.other",
};
export const CRM_INTEREST_LABELS: Record<string, string> = {
  unrated: "crm.enums.interest.unrated",
  very_low: "crm.enums.interest.very_low",
  low: "crm.enums.interest.low",
  medium: "crm.enums.interest.medium",
  high: "crm.enums.interest.high",
  very_high: "crm.enums.interest.very_high",
};
export const CRM_ACTIVITY_KIND_LABELS: Record<string, string> = {
  visit: "crm.enums.activityKind.visit",
  meeting: "crm.enums.activityKind.meeting",
  video_call: "crm.enums.activityKind.video_call",
  call: "crm.enums.activityKind.call",
  email: "crm.enums.activityKind.email",
  whatsapp: "crm.enums.activityKind.whatsapp",
  demo: "crm.enums.activityKind.demo",
  presentation: "crm.enums.activityKind.presentation",
  proposal_sent: "crm.enums.activityKind.proposal_sent",
  proposal_received: "crm.enums.activityKind.proposal_received",
  pilot: "crm.enums.activityKind.pilot",
  event: "crm.enums.activityKind.event",
  note: "crm.enums.activityKind.note",
  contract: "crm.enums.activityKind.contract",
  internal_meeting: "crm.enums.activityKind.internal_meeting",
  other: "crm.enums.activityKind.other",
};
export const CRM_RESULT_LABELS: Record<string, string> = {
  very_positive: "crm.enums.result.very_positive",
  positive: "crm.enums.result.positive",
  neutral: "crm.enums.result.neutral",
  negative: "crm.enums.result.negative",
  very_negative: "crm.enums.result.very_negative",
  pending: "crm.enums.result.pending",
  none: "crm.enums.result.none",
};
export const CRM_PRIORITY_LABELS: Record<string, string> = {
  low: "crm.enums.priority.low",
  normal: "crm.enums.priority.normal",
  high: "crm.enums.priority.high",
  urgent: "crm.enums.priority.urgent",
};
export const CRM_TASK_STATUS_LABELS: Record<string, string> = {
  pending: "crm.enums.taskStatus.pending",
  in_progress: "crm.enums.taskStatus.in_progress",
  done: "crm.enums.taskStatus.done",
  cancelled: "crm.enums.taskStatus.cancelled",
};
export const CRM_PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: "crm.enums.proposalStatus.draft",
  sent: "crm.enums.proposalStatus.sent",
  seen: "crm.enums.proposalStatus.seen",
  negotiating: "crm.enums.proposalStatus.negotiating",
  accepted: "crm.enums.proposalStatus.accepted",
  rejected: "crm.enums.proposalStatus.rejected",
  expired: "crm.enums.proposalStatus.expired",
};
export const CRM_LOST_REASON_LABELS: Record<string, string> = {
  price: "crm.enums.lostReason.price",
  no_budget: "crm.enums.lostReason.no_budget",
  no_interest: "crm.enums.lostReason.no_interest",
  competitor: "crm.enums.lostReason.competitor",
  not_priority: "crm.enums.lostReason.not_priority",
  technical: "crm.enums.lostReason.technical",
  procurement: "crm.enums.lostReason.procurement",
  postponed: "crm.enums.lostReason.postponed",
  no_response: "crm.enums.lostReason.no_response",
  people_changed: "crm.enums.lostReason.people_changed",
  other: "crm.enums.lostReason.other",
};
export const CRM_DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  presentation: "crm.enums.documentCategory.presentation",
  dossier: "crm.enums.documentCategory.dossier",
  proposal: "crm.enums.documentCategory.proposal",
  budget: "crm.enums.documentCategory.budget",
  contract: "crm.enums.documentCategory.contract",
  tender: "crm.enums.documentCategory.tender",
  report: "crm.enums.documentCategory.report",
  technical: "crm.enums.documentCategory.technical",
  email: "crm.enums.documentCategory.email",
  minutes: "crm.enums.documentCategory.minutes",
  administrative: "crm.enums.documentCategory.administrative",
  photo: "crm.enums.documentCategory.photo",
  other: "crm.enums.documentCategory.other",
};
export const CRM_RELATION_KIND_LABELS: Record<string, string> = {
  parent: "crm.enums.relationKind.parent",
  partner: "crm.enums.relationKind.partner",
  member: "crm.enums.relationKind.member",
  other: "crm.enums.relationKind.other",
};
export const CRM_NOTIFICATION_KIND_LABELS: Record<string, string> = {
  task_reminder: "crm.enums.notificationKind.task_reminder",
  task_overdue: "crm.enums.notificationKind.task_overdue",
  assigned: "crm.enums.notificationKind.assigned",
  opportunity_idle: "crm.enums.notificationKind.opportunity_idle",
  proposal_followup: "crm.enums.notificationKind.proposal_followup",
  meeting_no_followup: "crm.enums.notificationKind.meeting_no_followup",
  close_date: "crm.enums.notificationKind.close_date",
  renewal: "crm.enums.notificationKind.renewal",
  document: "crm.enums.notificationKind.document",
};
export const CRM_CATALOG_KIND_LABELS: Record<string, string> = {
  source: "crm.enums.catalogKind.source",
  department: "crm.enums.catalogKind.department",
  product: "crm.enums.catalogKind.product",
};
export const CRM_STAGE_KIND_LABELS: Record<string, string> = {
  open: "crm.enums.stageKind.open",
  won: "crm.enums.stageKind.won",
  lost: "crm.enums.stageKind.lost",
  paused: "crm.enums.stageKind.paused",
};

export function crmLabel(map: Record<string, string>, value: string | null | undefined, t: (key: string) => string): string {
  if (!value) return "";
  const key = map[value];
  return key ? t(key) : value;
}

export const CRM_ACCOUNT_KINDS = Object.keys(CRM_ACCOUNT_KIND_LABELS);
export const CRM_INTERESTS = Object.keys(CRM_INTEREST_LABELS);
export const CRM_ACTIVITY_KINDS = Object.keys(CRM_ACTIVITY_KIND_LABELS);
export const CRM_RESULTS = Object.keys(CRM_RESULT_LABELS);
export const CRM_PRIORITIES = Object.keys(CRM_PRIORITY_LABELS);
export const CRM_TASK_STATUSES = Object.keys(CRM_TASK_STATUS_LABELS);
export const CRM_PROPOSAL_STATUSES = Object.keys(CRM_PROPOSAL_STATUS_LABELS);
export const CRM_LOST_REASONS = Object.keys(CRM_LOST_REASON_LABELS);
export const CRM_DOCUMENT_CATEGORIES = Object.keys(CRM_DOCUMENT_CATEGORY_LABELS);
export const CRM_RELATION_KINDS = Object.keys(CRM_RELATION_KIND_LABELS);

/** Nivel de interés de 0 (sin valorar) a 5 (muy alto), para pintarlo como barra. */
export function interestLevel(value: string | null | undefined): number {
  return Math.max(0, CRM_INTERESTS.indexOf(value ?? "unrated"));
}
