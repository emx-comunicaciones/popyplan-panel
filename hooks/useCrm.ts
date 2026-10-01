"use client";

/**
 * Datos del CRM comercial (`/api/crm/*`, `docs/CRM.md` del backend).
 *
 * Un solo módulo para todo el CRM, montado sobre dos piezas comunes:
 * `useCrmQuery` (lectura, clave bajo `["crm", …]`) y `useCrmMutation`
 * (escritura). **Toda escritura invalida la caché entera del CRM**: una
 * actividad cambia la ficha, el historial, el pipeline, las tareas y el
 * dashboard a la vez, y perseguir cada clave por separado ya dio datos
 * viejos en otras áreas del panel. El CRM es de un equipo pequeño:
 * refrescar lo que haya montado es barato.
 *
 * Errores: `CrmError` con `kind` (`sin_acceso`, `invalido`, `duplicado`,
 * `no_encontrado`, `desconocido`) y el `detail` del backend tal cual. Un
 * 409 de alta (`accounts/`, `contacts/`) trae además `duplicates`: el
 * formulario los enseña y ofrece «Crear igualmente» (`force: true`).
 */
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { ApiError, apiFetch, fetchWithAuth } from "@/lib/api/client";
import type {
  CrmAccount,
  CrmAccountDetail,
  CrmAccountRelation,
  CrmAccountSummary,
  CrmAccountWrite,
  CrmActivity,
  CrmAttention,
  CrmCalendarItem,
  CrmCatalogItem,
  CrmCatalogKind,
  CrmContact,
  CrmContract,
  CrmCoverageRow,
  CrmDashboard,
  CrmDocument,
  CrmDocumentVersion,
  CrmDuplicate,
  CrmExportResource,
  CrmFunnelRow,
  CrmImportRow,
  CrmMapPoint,
  CrmMe,
  CrmNote,
  CrmNotification,
  CrmOpportunity,
  CrmOwnerChange,
  CrmPipeline,
  CrmProposal,
  CrmRenewal,
  CrmReport,
  CrmSalespersonRow,
  CrmSearchResult,
  CrmSettings,
  CrmStage,
  CrmTag,
  CrmTask,
  CrmTaskCounts,
  CrmTimelineEvent,
  CrmUserRef,
  Paginated,
} from "@/lib/api/crmTypes";
import { detailOf } from "@/lib/api/drfError";
import { CRM } from "@/lib/api/endpoints";
import { filenameFromContentDisposition } from "@/lib/download/filenameFrom";
import { triggerDownload } from "@/lib/download/triggerDownload";

export type CrmErrorKind = "sin_acceso" | "invalido" | "duplicado" | "no_encontrado" | "desconocido";

export class CrmError extends Error {
  readonly kind: CrmErrorKind;
  readonly detail?: string;
  /** Solo en un 409 de alta: lo que ya existe y se parece. */
  readonly duplicates?: CrmDuplicate[];
  /** Errores de campo de DRF (`{campo: ["…"]}`), para pintarlos junto al campo. */
  readonly fields?: Record<string, string>;

  constructor(kind: CrmErrorKind, message: string, extra: {
    detail?: string;
    duplicates?: CrmDuplicate[];
    fields?: Record<string, string>;
  } = {}) {
    super(message);
    this.name = "CrmError";
    this.kind = kind;
    this.detail = extra.detail;
    this.duplicates = extra.duplicates;
    this.fields = extra.fields;
  }
}

function fieldErrors(body: unknown): Record<string, string> | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (key === "detail" || key === "duplicates") continue;
    if (Array.isArray(value) && typeof value[0] === "string") out[key] = value[0];
    else if (typeof value === "string") out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

export function toCrmError(error: unknown): CrmError {
  if (error instanceof CrmError) return error;
  if (error instanceof ApiError) {
    const detail = detailOf(error) ?? undefined;
    if (error.status === 409) {
      const body = error.body as { duplicates?: CrmDuplicate[] } | null;
      return new CrmError("duplicado", detail ?? "Ya existe algo parecido.", {
        detail,
        duplicates: body?.duplicates ?? [],
      });
    }
    if (error.status === 403) {
      return new CrmError("sin_acceso", detail ?? "No tienes permiso para esto.", { detail });
    }
    if (error.status === 404) {
      return new CrmError("no_encontrado", detail ?? "No existe o no la llevas tú.", { detail });
    }
    if (error.status === 400) {
      return new CrmError("invalido", detail ?? "Revisa los datos: alguno no es válido.", {
        detail,
        fields: fieldErrors(error.body),
      });
    }
  }
  return new CrmError("desconocido", "No se pudo completar. Inténtalo de nuevo.");
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** `?a=1&b=x` sin los vacíos. */
export function toQuery(params?: QueryParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const CRM_KEY = ["crm"] as const;

export function useCrmQuery<T>(key: QueryKey, path: string | null, options: { enabled?: boolean } = {}) {
  return useQuery<T, CrmError>({
    queryKey: [...CRM_KEY, ...key],
    queryFn: async () => {
      try {
        return await apiFetch<T>(path as string);
      } catch (error) {
        throw toCrmError(error);
      }
    },
    enabled: path !== null && (options.enabled ?? true),
  });
}

export function useCrmMutation<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, CrmError, TVars>({
    mutationFn: async (vars) => {
      try {
        return await fn(vars);
      } catch (error) {
        throw toCrmError(error);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CRM_KEY }),
  });
}

const json = (method: string, body?: unknown) => ({ method, body });

// ─── Quién soy, equipo y configuración ──────────────────────────────────────

export const useCrmMe = () => useCrmQuery<CrmMe>(["me"], CRM.ME);
export const useCrmUsers = () => useCrmQuery<CrmUserRef[]>(["users"], CRM.USERS);
export const useCrmStages = () => useCrmQuery<CrmStage[]>(["stages"], CRM.STAGES);
export const useCrmCatalog = (kind?: CrmCatalogKind) =>
  useCrmQuery<CrmCatalogItem[]>(["catalog", kind ?? "all"], `${CRM.CATALOG}${toQuery({ kind })}`);
export const useCrmTags = () => useCrmQuery<CrmTag[]>(["tags"], CRM.TAGS);
export const useCrmSettings = () => useCrmQuery<CrmSettings>(["settings"], CRM.SETTINGS);

export const useSaveStage = () =>
  useCrmMutation<Partial<CrmStage> & { id?: number }, CrmStage>(({ id, ...data }) =>
    apiFetch(id ? CRM.STAGE(id) : CRM.STAGES, json(id ? "PATCH" : "POST", data)));

export const useSaveCatalogItem = () =>
  useCrmMutation<Partial<CrmCatalogItem> & { id?: number }, CrmCatalogItem>(({ id, ...data }) =>
    apiFetch(id ? CRM.CATALOG_ITEM(id) : CRM.CATALOG, json(id ? "PATCH" : "POST", data)));

export const useCreateTag = () =>
  useCrmMutation<{ name: string; color?: string }, CrmTag>((data) =>
    apiFetch(CRM.TAGS, json("POST", data)));

export const useSaveSettings = () =>
  useCrmMutation<CrmSettings, CrmSettings>((data) => apiFetch(CRM.SETTINGS, json("PUT", data)));

// ─── Cuentas ────────────────────────────────────────────────────────────────

export const useCrmAccounts = (params?: QueryParams) =>
  useCrmQuery<Paginated<CrmAccount>>(["accounts", params ?? {}], `${CRM.ACCOUNTS}${toQuery(params)}`);
export const useCrmAccount = (id: number | string | null) =>
  useCrmQuery<CrmAccountDetail>(["account", String(id)], id ? CRM.ACCOUNT(id) : null);
export const useCrmAccountSummary = (id: number | string | null) =>
  useCrmQuery<CrmAccountSummary>(["account", String(id), "summary"], id ? CRM.ACCOUNT_SUMMARY(id) : null);
export const useCrmTimeline = (id: number | string | null, params?: QueryParams) =>
  useCrmQuery<Paginated<CrmTimelineEvent>>(["account", String(id), "timeline", params ?? {}],
    id ? `${CRM.ACCOUNT_TIMELINE(id)}${toQuery(params)}` : null);
export const useCrmOwnerHistory = (id: number | string | null) =>
  useCrmQuery<CrmOwnerChange[]>(["account", String(id), "owners"], id ? CRM.ACCOUNT_OWNER_HISTORY(id) : null);
export const useCrmAccountContacts = (id: number | string | null) =>
  useCrmQuery<CrmContact[]>(["account", String(id), "contacts"], id ? CRM.ACCOUNT_CONTACTS(id) : null);
export const useCrmRelations = (id: number | string | null) =>
  useCrmQuery<CrmAccountRelation[]>(["account", String(id), "relations"], id ? CRM.ACCOUNT_RELATIONS(id) : null);
export const useCrmNotes = (id: number | string | null) =>
  useCrmQuery<CrmNote[]>(["account", String(id), "notes"], id ? CRM.ACCOUNT_NOTES(id) : null);
export const useCrmAccountDuplicates = (params: { name?: string; tax_id?: string; place?: string | null }) =>
  useCrmQuery<CrmDuplicate[]>(["account-duplicates", params], `${CRM.ACCOUNT_DUPLICATES}${toQuery(params)}`,
    { enabled: (params.name ?? "").trim().length >= 3 || !!params.tax_id });

export const useCreateAccount = () =>
  useCrmMutation<CrmAccountWrite, CrmAccountDetail>((data) => apiFetch(CRM.ACCOUNTS, json("POST", data)));
export const useUpdateAccount = () =>
  useCrmMutation<{ id: number } & CrmAccountWrite, CrmAccountDetail>(({ id, ...data }) =>
    apiFetch(CRM.ACCOUNT(id), json("PATCH", data)));
export const useDeleteAccount = () =>
  useCrmMutation<number, void>((id) => apiFetch(CRM.ACCOUNT(id), { method: "DELETE" }));

export const useCreateContact = () =>
  useCrmMutation<{ account: number } & Partial<CrmContact> & { force?: boolean }, CrmContact>(
    ({ account, ...data }) => apiFetch(CRM.ACCOUNT_CONTACTS(account), json("POST", data)));
export const useUpdateContact = () =>
  useCrmMutation<{ id: number } & Partial<CrmContact>, CrmContact>(({ id, ...data }) =>
    apiFetch(CRM.CONTACT(id), json("PATCH", data)));
export const useDeleteContact = () =>
  useCrmMutation<number, void>((id) => apiFetch(CRM.CONTACT(id), { method: "DELETE" }));

export const useCreateRelation = () =>
  useCrmMutation<{ account: number; target: number; kind: string; notes?: string }, CrmAccountRelation>(
    ({ account, ...data }) => apiFetch(CRM.ACCOUNT_RELATIONS(account), json("POST", data)));
export const useDeleteRelation = () =>
  useCrmMutation<number, void>((id) => apiFetch(CRM.RELATION(id), { method: "DELETE" }));

export const useCreateNote = () =>
  useCrmMutation<{ account: number; body: string; important?: boolean; pinned?: boolean;
    opportunity?: number | null }, CrmNote>(({ account, ...data }) =>
    apiFetch(CRM.ACCOUNT_NOTES(account), json("POST", data)));
export const useUpdateNote = () =>
  useCrmMutation<{ id: number; important?: boolean; pinned?: boolean; body?: string }, CrmNote>(
    ({ id, ...data }) => apiFetch(CRM.NOTE(id), json("PATCH", data)));
export const useDeleteNote = () =>
  useCrmMutation<number, void>((id) => apiFetch(CRM.NOTE(id), { method: "DELETE" }));

// ─── Contactos ──────────────────────────────────────────────────────────────

export const useCrmContacts = (params?: QueryParams) =>
  useCrmQuery<Paginated<CrmContact>>(["contacts", params ?? {}], `${CRM.CONTACTS}${toQuery(params)}`);
export const useCrmContactDuplicates = (params: { email?: string; phone?: string }) =>
  useCrmQuery<CrmDuplicate[]>(["contact-duplicates", params], `${CRM.CONTACT_DUPLICATES}${toQuery(params)}`,
    { enabled: !!(params.email || params.phone) });

// ─── Oportunidades, propuestas, contratos ──────────────────────────────────

export const useCrmOpportunities = (params?: QueryParams) =>
  useCrmQuery<Paginated<CrmOpportunity>>(["opportunities", params ?? {}],
    `${CRM.OPPORTUNITIES}${toQuery(params)}`);
export const useCrmOpportunity = (id: number | string | null) =>
  useCrmQuery<CrmOpportunity>(["opportunity", String(id)], id ? CRM.OPPORTUNITY(id) : null);
export const useCrmProposals = (opportunityId: number | string | null) =>
  useCrmQuery<CrmProposal[]>(["opportunity", String(opportunityId), "proposals"],
    opportunityId ? CRM.OPPORTUNITY_PROPOSALS(opportunityId) : null);
export const useCrmRenewals = (days?: number) =>
  useCrmQuery<CrmRenewal[]>(["renewals", days ?? null], `${CRM.RENEWALS}${toQuery({ days })}`);

export const useCreateOpportunity = () =>
  useCrmMutation<Partial<CrmOpportunity> & { account: number }, CrmOpportunity>((data) =>
    apiFetch(CRM.OPPORTUNITIES, json("POST", data)));
export const useUpdateOpportunity = () =>
  useCrmMutation<{ id: number } & Partial<CrmOpportunity>, CrmOpportunity>(({ id, ...data }) =>
    apiFetch(CRM.OPPORTUNITY(id), json("PATCH", data)));
export const useDeleteOpportunity = () =>
  useCrmMutation<number, void>((id) => apiFetch(CRM.OPPORTUNITY(id), { method: "DELETE" }));
export const useMoveOpportunity = () =>
  useCrmMutation<{ id: number; stage: number; lost_reason?: string; lost_detail?: string }, CrmOpportunity>(
    ({ id, ...data }) => apiFetch(CRM.OPPORTUNITY_MOVE(id), json("POST", data)));
export const useWinOpportunity = () =>
  useCrmMutation<{ id: number } & Partial<CrmContract>, CrmContract>(({ id, ...data }) =>
    apiFetch(CRM.OPPORTUNITY_WIN(id), json("POST", data)));
export const useCreateProposal = () =>
  useCrmMutation<{ opportunity: number } & Partial<CrmProposal>, CrmProposal>(
    ({ opportunity, ...data }) => apiFetch(CRM.OPPORTUNITY_PROPOSALS(opportunity), json("POST", data)));
export const useUpdateProposal = () =>
  useCrmMutation<{ id: number } & Partial<CrmProposal>, CrmProposal>(({ id, ...data }) =>
    apiFetch(CRM.PROPOSAL(id), json("PATCH", data)));
export const useUpdateContract = () =>
  useCrmMutation<{ id: number } & Partial<CrmContract>, CrmContract>(({ id, ...data }) =>
    apiFetch(CRM.CONTRACT(id), json("PATCH", data)));

// ─── Actividades y tareas ───────────────────────────────────────────────────

export interface CrmFollowUpInput {
  kind?: string;
  title?: string;
  description?: string;
  due_at: string;
  assignee?: number | null;
  priority?: string;
  reminder_minutes?: number | null;
  contact?: number | null;
}

export type CrmActivityInput = Partial<Omit<CrmActivity, "follow_up">> & {
  account: number;
  follow_up?: CrmFollowUpInput | null;
};

export const useCrmActivities = (params?: QueryParams) =>
  useCrmQuery<Paginated<CrmActivity>>(["activities", params ?? {}], `${CRM.ACTIVITIES}${toQuery(params)}`);
export const useCreateActivity = () =>
  useCrmMutation<CrmActivityInput, CrmActivity>((data) => apiFetch(CRM.ACTIVITIES, json("POST", data)));
export const useUpdateActivity = () =>
  useCrmMutation<{ id: number } & Partial<CrmActivity>, CrmActivity>(({ id, ...data }) =>
    apiFetch(CRM.ACTIVITY(id), json("PATCH", data)));
export const useDeleteActivity = () =>
  useCrmMutation<number, void>((id) => apiFetch(CRM.ACTIVITY(id), { method: "DELETE" }));

export const useCrmTasks = (params?: QueryParams) =>
  useCrmQuery<Paginated<CrmTask>>(["tasks", params ?? {}], `${CRM.TASKS}${toQuery(params)}`);
export const useCrmTaskCounts = () => useCrmQuery<CrmTaskCounts>(["task-counts"], CRM.TASK_COUNTS);
export const useCreateTask = () =>
  useCrmMutation<Partial<CrmTask> & { due_at: string }, CrmTask>((data) => apiFetch(CRM.TASKS, json("POST", data)));
export const useUpdateTask = () =>
  useCrmMutation<{ id: number } & Partial<CrmTask>, CrmTask>(({ id, ...data }) =>
    apiFetch(CRM.TASK(id), json("PATCH", data)));

// ─── Documentos ─────────────────────────────────────────────────────────────

export const useCrmDocuments = (params?: QueryParams) =>
  useCrmQuery<Paginated<CrmDocument>>(["documents", params ?? {}], `${CRM.DOCUMENTS}${toQuery(params)}`);

export interface CrmUploadInput {
  file: File;
  account: number;
  opportunity?: number | null;
  activity?: number | null;
  name?: string;
  category?: string;
  description?: string;
  received?: boolean;
}

export const useUploadDocument = () =>
  useCrmMutation<CrmUploadInput, CrmDocument>(({ file, ...data }) => {
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null && value !== "") form.append(key, String(value));
    }
    return apiFetch(CRM.DOCUMENTS, { method: "POST", body: form });
  });
export const useAddDocumentVersion = () =>
  useCrmMutation<{ id: number; file: File }, CrmDocumentVersion>(({ id, file }) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch(CRM.DOCUMENT_VERSIONS(id), { method: "POST", body: form });
  });
export const useDeleteDocument = () =>
  useCrmMutation<number, void>((id) => apiFetch(CRM.DOCUMENT(id), { method: "DELETE" }));

/**
 * Descarga (o vista previa en otra pestaña con `inline`) de una versión.
 * El fichero nunca se enlaza por su URL: la petición lleva la sesión.
 */
export async function openCrmDocument(documentId: number, versionId: number, inline = false): Promise<void> {
  const response = await fetchWithAuth(`${CRM.DOCUMENT_DOWNLOAD(documentId, versionId)}${inline ? "?inline=1" : ""}`);
  const blob = await response.blob();
  if (inline) {
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
    return;
  }
  triggerDownload(blob, filenameFromContentDisposition(response.headers.get("Content-Disposition"), "documento"));
}

// ─── Vistas de conjunto ─────────────────────────────────────────────────────

export const useCrmPipeline = (params?: QueryParams) =>
  useCrmQuery<CrmPipeline>(["pipeline", params ?? {}], `${CRM.PIPELINE}${toQuery(params)}`);
export const useCrmDashboard = (params?: QueryParams) =>
  useCrmQuery<CrmDashboard>(["dashboard", params ?? {}], `${CRM.DASHBOARD}${toQuery(params)}`);
export const useCrmFunnel = (params?: QueryParams) =>
  useCrmQuery<CrmFunnelRow[]>(["funnel", params ?? {}], `${CRM.FUNNEL}${toQuery(params)}`);
export const useCrmReport = (params?: QueryParams) =>
  useCrmQuery<CrmReport>(["reports", params ?? {}], `${CRM.REPORTS}${toQuery(params)}`);
export const useCrmTeam = (params?: QueryParams) =>
  useCrmQuery<CrmSalespersonRow[]>(["team", params ?? {}], `${CRM.TEAM}${toQuery(params)}`);
export const useCrmCoverage = (params?: QueryParams) =>
  useCrmQuery<CrmCoverageRow[]>(["coverage", params ?? {}], `${CRM.COVERAGE}${toQuery(params)}`);
export const useCrmAttention = (params?: QueryParams) =>
  useCrmQuery<CrmAttention>(["attention", params ?? {}], `${CRM.ATTENTION}${toQuery(params)}`);
export const useCrmCalendar = (params: { since: string; until: string } & QueryParams) =>
  useCrmQuery<CrmCalendarItem[]>(["calendar", params], `${CRM.CALENDAR}${toQuery(params)}`);
export const useCrmMap = (params?: QueryParams) =>
  useCrmQuery<CrmMapPoint[]>(["map", params ?? {}], `${CRM.MAP}${toQuery(params)}`);
export const useCrmSearch = (q: string) =>
  useCrmQuery<CrmSearchResult>(["search", q], `${CRM.SEARCH}${toQuery({ q })}`, {
    enabled: q.trim().length >= 2,
  });

// ─── Avisos ─────────────────────────────────────────────────────────────────

export const useCrmNotifications = (params?: QueryParams) =>
  useCrmQuery<Paginated<CrmNotification>>(["notifications", params ?? {}],
    `${CRM.NOTIFICATIONS}${toQuery(params)}`);
export const useMarkNotificationRead = () =>
  useCrmMutation<number, void>((id) => apiFetch(CRM.NOTIFICATION_READ(id), { method: "POST" }));
export const useMarkAllNotificationsRead = () =>
  useCrmMutation<void, void>(() => apiFetch(CRM.NOTIFICATIONS_READ_ALL, { method: "POST" }));

// ─── Importación y exportación ──────────────────────────────────────────────

export const useImportPreview = () =>
  useCrmMutation<File, CrmImportRow[]>((file) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch(CRM.IMPORT_PREVIEW, { method: "POST", body: form });
  });
export const useImportCommit = () =>
  useCrmMutation<{ rows: CrmImportRow[]; owner?: number | null; include_duplicates?: boolean },
    { created: number; skipped: number }>((data) => apiFetch(CRM.IMPORT_COMMIT, json("POST", data)));

export async function downloadCrmExport(resource: CrmExportResource, params?: QueryParams): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithAuth(`${CRM.EXPORT(resource)}${toQuery(params)}`);
  } catch (error) {
    throw toCrmError(error);
  }
  const blob = await response.blob();
  triggerDownload(blob, filenameFromContentDisposition(response.headers.get("Content-Disposition"),
    `${resource}.csv`));
}
