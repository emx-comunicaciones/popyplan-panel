import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
const triggerDownloadMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock, fetchWithAuth: fetchWithAuthMock };
});
vi.mock("@/lib/download/triggerDownload", () => ({ triggerDownload: triggerDownloadMock }));

import { ApiError } from "@/lib/api/client";
import { CRM } from "@/lib/api/endpoints";

import * as H from "./useCrm";

afterEach(() => {
  apiFetchMock.mockReset();
  fetchWithAuthMock.mockReset();
  triggerDownloadMock.mockReset();
});

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

const QUERIES: [string, () => unknown, string][] = [
  ["useCrmMe", () => H.useCrmMe(), CRM.ME],
  ["useCrmUsers", () => H.useCrmUsers(), CRM.USERS],
  ["useCrmStages", () => H.useCrmStages(), CRM.STAGES],
  ["useCrmCatalog", () => H.useCrmCatalog("source"), `${CRM.CATALOG}?kind=source`],
  ["useCrmCatalog sin tipo", () => H.useCrmCatalog(), CRM.CATALOG],
  ["useCrmTags", () => H.useCrmTags(), CRM.TAGS],
  ["useCrmSettings", () => H.useCrmSettings(), CRM.SETTINGS],
  ["useCrmAccounts", () => H.useCrmAccounts({ q: "donos", page: 2, empty: "" }), `${CRM.ACCOUNTS}?q=donos&page=2`],
  ["useCrmAccount", () => H.useCrmAccount(1), CRM.ACCOUNT(1)],
  ["useCrmAccountSummary", () => H.useCrmAccountSummary(1), CRM.ACCOUNT_SUMMARY(1)],
  ["useCrmTimeline", () => H.useCrmTimeline(1, { kind: "activity" }), `${CRM.ACCOUNT_TIMELINE(1)}?kind=activity`],
  ["useCrmOwnerHistory", () => H.useCrmOwnerHistory(1), CRM.ACCOUNT_OWNER_HISTORY(1)],
  ["useCrmAccountContacts", () => H.useCrmAccountContacts(1), CRM.ACCOUNT_CONTACTS(1)],
  ["useCrmRelations", () => H.useCrmRelations(1), CRM.ACCOUNT_RELATIONS(1)],
  ["useCrmNotes", () => H.useCrmNotes(1), CRM.ACCOUNT_NOTES(1)],
  ["useCrmAccountDuplicates", () => H.useCrmAccountDuplicates({ name: "Terrassa" }), `${CRM.ACCOUNT_DUPLICATES}?name=Terrassa`],
  ["useCrmContacts", () => H.useCrmContacts({ q: "maria" }), `${CRM.CONTACTS}?q=maria`],
  ["useCrmContactDuplicates", () => H.useCrmContactDuplicates({ email: "a@b.es" }), `${CRM.CONTACT_DUPLICATES}?email=a%40b.es`],
  ["useCrmOpportunities", () => H.useCrmOpportunities({ status: "open" }), `${CRM.OPPORTUNITIES}?status=open`],
  ["useCrmOpportunity", () => H.useCrmOpportunity(30), CRM.OPPORTUNITY(30)],
  ["useCrmProposals", () => H.useCrmProposals(30), CRM.OPPORTUNITY_PROPOSALS(30)],
  ["useCrmRenewals", () => H.useCrmRenewals(60), `${CRM.RENEWALS}?days=60`],
  ["useCrmActivities", () => H.useCrmActivities({ account: 1 }), `${CRM.ACTIVITIES}?account=1`],
  ["useCrmTasks", () => H.useCrmTasks({ bucket: "today" }), `${CRM.TASKS}?bucket=today`],
  ["useCrmTaskCounts", () => H.useCrmTaskCounts(), CRM.TASK_COUNTS],
  ["useCrmDocuments", () => H.useCrmDocuments({ category: "proposal" }), `${CRM.DOCUMENTS}?category=proposal`],
  ["useCrmPipeline", () => H.useCrmPipeline({ of: "accounts" }), `${CRM.PIPELINE}?of=accounts`],
  ["useCrmDashboard", () => H.useCrmDashboard({ period: "month" }), `${CRM.DASHBOARD}?period=month`],
  ["useCrmFunnel", () => H.useCrmFunnel(), CRM.FUNNEL],
  ["useCrmReport", () => H.useCrmReport({ period: "year" }), `${CRM.REPORTS}?period=year`],
  ["useCrmTeam", () => H.useCrmTeam(), CRM.TEAM],
  ["useCrmCoverage", () => H.useCrmCoverage({ level: "region" }), `${CRM.COVERAGE}?level=region`],
  ["useCrmAttention", () => H.useCrmAttention(), CRM.ATTENTION],
  ["useCrmCalendar", () => H.useCrmCalendar({ since: "2026-10-01", until: "2026-10-31" }), `${CRM.CALENDAR}?since=2026-10-01&until=2026-10-31`],
  ["useCrmMap", () => H.useCrmMap({ province: "Gipuzkoa" }), `${CRM.MAP}?province=Gipuzkoa`],
  ["useCrmSearch", () => H.useCrmSearch("donos"), `${CRM.SEARCH}?q=donos`],
  ["useCrmNotifications", () => H.useCrmNotifications({ unread: true }), `${CRM.NOTIFICATIONS}?unread=true`],
];

describe("consultas del CRM", () => {
  it.each(QUERIES)("%s pide su ruta", async (_name, hook, path) => {
    apiFetchMock.mockResolvedValueOnce({ ok: true });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(hook as () => { isSuccess: boolean }, { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(path);
  });

  it("sin id, sin código completo o sin texto no pide nada", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => H.useCrmAccount(null), { wrapper });
    renderHook(() => H.useCrmAccountDuplicates({ name: "ab" }), { wrapper });
    renderHook(() => H.useCrmContactDuplicates({}), { wrapper });
    renderHook(() => H.useCrmSearch("a"), { wrapper });
    renderHook(() => H.useCrmProposals(null), { wrapper });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});

const file = new File(["x"], "a.pdf", { type: "application/pdf" });

const MUTATIONS: [string, () => { mutateAsync: (v: never) => Promise<unknown> }, unknown, string, string][] = [
  ["useSaveStage (nueva)", () => H.useSaveStage(), { name: "Licitación" }, CRM.STAGES, "POST"],
  ["useSaveStage (editar)", () => H.useSaveStage(), { id: 3, name: "X" }, CRM.STAGE(3), "PATCH"],
  ["useSaveCatalogItem (nuevo)", () => H.useSaveCatalogItem(), { kind: "product", name: "X" }, CRM.CATALOG, "POST"],
  ["useSaveCatalogItem (editar)", () => H.useSaveCatalogItem(), { id: 4, is_active: false }, CRM.CATALOG_ITEM(4), "PATCH"],
  ["useCreateTag", () => H.useCreateTag(), { name: "Piloto" }, CRM.TAGS, "POST"],
  ["useSaveSettings", () => H.useSaveSettings(), { attention_days: [7] }, CRM.SETTINGS, "PUT"],
  ["useCreateAccount", () => H.useCreateAccount(), { name: "Ayto" }, CRM.ACCOUNTS, "POST"],
  ["useUpdateAccount", () => H.useUpdateAccount(), { id: 1, interest: "high" }, CRM.ACCOUNT(1), "PATCH"],
  ["useDeleteAccount", () => H.useDeleteAccount(), 1, CRM.ACCOUNT(1), "DELETE"],
  ["useCreateContact", () => H.useCreateContact(), { account: 1, first_name: "M" }, CRM.ACCOUNT_CONTACTS(1), "POST"],
  ["useUpdateContact", () => H.useUpdateContact(), { id: 7, position: "X" }, CRM.CONTACT(7), "PATCH"],
  ["useDeleteContact", () => H.useDeleteContact(), 7, CRM.CONTACT(7), "DELETE"],
  ["useCreateRelation", () => H.useCreateRelation(), { account: 1, target: 2, kind: "parent" }, CRM.ACCOUNT_RELATIONS(1), "POST"],
  ["useDeleteRelation", () => H.useDeleteRelation(), 9, CRM.RELATION(9), "DELETE"],
  ["useCreateNote", () => H.useCreateNote(), { account: 1, body: "x" }, CRM.ACCOUNT_NOTES(1), "POST"],
  ["useUpdateNote", () => H.useUpdateNote(), { id: 300, pinned: true }, CRM.NOTE(300), "PATCH"],
  ["useDeleteNote", () => H.useDeleteNote(), 300, CRM.NOTE(300), "DELETE"],
  ["useCreateOpportunity", () => H.useCreateOpportunity(), { account: 1, name: "X" }, CRM.OPPORTUNITIES, "POST"],
  ["useUpdateOpportunity", () => H.useUpdateOpportunity(), { id: 30, name: "Y" }, CRM.OPPORTUNITY(30), "PATCH"],
  ["useDeleteOpportunity", () => H.useDeleteOpportunity(), 30, CRM.OPPORTUNITY(30), "DELETE"],
  ["useMoveOpportunity", () => H.useMoveOpportunity(), { id: 30, stage: 8 }, CRM.OPPORTUNITY_MOVE(30), "POST"],
  ["useWinOpportunity", () => H.useWinOpportunity(), { id: 30, final_amount: "1" }, CRM.OPPORTUNITY_WIN(30), "POST"],
  ["useCreateProposal", () => H.useCreateProposal(), { opportunity: 30, amount: "1" }, CRM.OPPORTUNITY_PROPOSALS(30), "POST"],
  ["useUpdateProposal", () => H.useUpdateProposal(), { id: 600, status: "sent" }, CRM.PROPOSAL(600), "PATCH"],
  ["useUpdateContract", () => H.useUpdateContract(), { id: 3, notes: "x" }, CRM.CONTRACT(3), "PATCH"],
  ["useCreateActivity", () => H.useCreateActivity(), { account: 1, kind: "call" }, CRM.ACTIVITIES, "POST"],
  ["useUpdateActivity", () => H.useUpdateActivity(), { id: 100, summary: "x" }, CRM.ACTIVITY(100), "PATCH"],
  ["useDeleteActivity", () => H.useDeleteActivity(), 100, CRM.ACTIVITY(100), "DELETE"],
  ["useCreateTask", () => H.useCreateTask(), { title: "X", due_at: "2026-10-01T10:00:00Z" }, CRM.TASKS, "POST"],
  ["useUpdateTask", () => H.useUpdateTask(), { id: 200, status: "done" }, CRM.TASK(200), "PATCH"],
  ["useDeleteDocument", () => H.useDeleteDocument(), 500, CRM.DOCUMENT(500), "DELETE"],
  ["useMarkNotificationRead", () => H.useMarkNotificationRead(), 700, CRM.NOTIFICATION_READ(700), "POST"],
  ["useMarkAllNotificationsRead", () => H.useMarkAllNotificationsRead(), undefined, CRM.NOTIFICATIONS_READ_ALL, "POST"],
  ["useImportCommit", () => H.useImportCommit(), { rows: [] }, CRM.IMPORT_COMMIT, "POST"],
];

describe("escrituras del CRM", () => {
  it.each(MUTATIONS)("%s llama a su ruta e invalida la caché del CRM", async (_n, hook, vars, path, method) => {
    apiFetchMock.mockResolvedValueOnce({ id: 1 });
    const { client, wrapper } = makeWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(hook, { wrapper });
    await act(async () => {
      await result.current.mutateAsync(vars as never);
    });
    expect(apiFetchMock.mock.calls[0][0]).toBe(path);
    expect(apiFetchMock.mock.calls[0][1].method).toBe(method);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["crm"] });
  });

  it("los ficheros viajan como FormData (documento, versión e importación)", async () => {
    apiFetchMock.mockResolvedValue({ id: 1 });
    const { wrapper } = makeWrapper();
    const upload = renderHook(() => H.useUploadDocument(), { wrapper });
    await act(async () => {
      await upload.result.current.mutateAsync({ file, account: 1, opportunity: null, category: "proposal" });
    });
    expect(apiFetchMock.mock.calls[0][0]).toBe(CRM.DOCUMENTS);
    const form = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(form.get("file")).toBe(file);
    expect(form.get("account")).toBe("1");
    expect(form.get("opportunity")).toBeNull();
    const version = renderHook(() => H.useAddDocumentVersion(), { wrapper });
    await act(async () => {
      await version.result.current.mutateAsync({ id: 500, file });
    });
    expect(apiFetchMock.mock.calls[1][0]).toBe(CRM.DOCUMENT_VERSIONS(500));
    const preview = renderHook(() => H.useImportPreview(), { wrapper });
    await act(async () => {
      await preview.result.current.mutateAsync(file);
    });
    expect(apiFetchMock.mock.calls[2][0]).toBe(CRM.IMPORT_PREVIEW);
  });
});

describe("errores del CRM", () => {
  it.each([
    [409, { detail: "Ya existe.", duplicates: [{ id: 1, name: "Ayto" }] }, "duplicado"],
    [409, { detail: "Ya existe." }, "duplicado"],
    [403, { detail: "Solo dirección." }, "sin_acceso"],
    [404, null, "no_encontrado"],
    [400, { name: ["Obligatorio."], tags: "mal", detail: 1 }, "invalido"],
    [500, null, "desconocido"],
  ])("%s → %s", (status, body, kind) => {
    const error = H.toCrmError(new ApiError(status as number, body));
    expect(error.kind).toBe(kind);
  });

  it("duplicados y errores de campo llegan a la pantalla", () => {
    const dup = H.toCrmError(new ApiError(409, { detail: "Ya existe.", duplicates: [{ id: 1, name: "Ayto" }] }));
    expect(dup.duplicates).toEqual([{ id: 1, name: "Ayto" }]);
    expect(dup.detail).toBe("Ya existe.");
    const invalid = H.toCrmError(new ApiError(400, { name: ["Obligatorio."], tags: "mal" }));
    expect(invalid.fields).toEqual({ name: "Obligatorio.", tags: "mal" });
    expect(H.toCrmError(new ApiError(400, ["x"])).fields).toBeUndefined();
    expect(H.toCrmError(new ApiError(400, {})).fields).toBeUndefined();
    expect(H.toCrmError(new Error("x")).kind).toBe("desconocido");
    expect(H.toCrmError(dup)).toBe(dup);
  });

  it("una consulta que falla da un CrmError", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, { detail: "No." }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => H.useCrmMe(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("sin_acceso");
  });

  it("una escritura que falla da un CrmError", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, { detail: "Ya existe.", duplicates: [] }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => H.useCreateAccount(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: "X" }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.error?.kind).toBe("duplicado"));
  });
});

describe("descargas", () => {
  function response(disposition: string | null) {
    return {
      blob: async () => new Blob(["x"]),
      headers: { get: () => disposition },
    };
  }

  it("exportar descarga el CSV con el nombre que da el backend", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(response('attachment; filename="cuentas-2026-10-01.csv"'));
    await H.downloadCrmExport("accounts", { province: "Gipuzkoa" });
    expect(fetchWithAuthMock).toHaveBeenCalledWith(`${CRM.EXPORT("accounts")}?province=Gipuzkoa`);
    expect(triggerDownloadMock.mock.calls[0][1]).toBe("cuentas-2026-10-01.csv");
  });

  it("si la exportación falla, da un CrmError", async () => {
    fetchWithAuthMock.mockRejectedValueOnce(new ApiError(403, { detail: "No." }));
    await expect(H.downloadCrmExport("contacts")).rejects.toMatchObject({ kind: "sin_acceso" });
  });

  it("un documento se descarga o se abre en otra pestaña", async () => {
    fetchWithAuthMock.mockResolvedValue(response(null));
    await H.openCrmDocument(500, 501);
    expect(fetchWithAuthMock).toHaveBeenCalledWith(CRM.DOCUMENT_DOWNLOAD(500, 501));
    expect(triggerDownloadMock).toHaveBeenCalled();
    const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const create = vi.fn(() => "blob:x");
    Object.defineProperty(URL, "createObjectURL", { value: create, configurable: true });
    await H.openCrmDocument(500, 501, true);
    expect(fetchWithAuthMock).toHaveBeenLastCalledWith(`${CRM.DOCUMENT_DOWNLOAD(500, 501)}?inline=1`);
    expect(open).toHaveBeenCalledWith("", "_blank");
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe("blob:x");
  });

  it("la vista previa corta el opener nada más abrir la pestaña, sin esperar al fichero", async () => {
    const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    let openerWhilePending: unknown = "sin comprobar";
    fetchWithAuthMock.mockImplementation(() => {
      openerWhilePending = tab.opener;
      return Promise.reject(new Error("boom"));
    });
    await expect(H.openCrmDocument(500, 501, true)).rejects.toThrow("boom");
    expect(openerWhilePending).toBeNull();
  });

  it("si el navegador bloquea la pestaña de vista previa, falla sin pedir el fichero", async () => {
    fetchWithAuthMock.mockClear();
    vi.spyOn(window, "open").mockReturnValue(null);
    await expect(H.openCrmDocument(500, 501, true)).rejects.toThrow();
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
  });

  it("si la descarga de la vista previa falla, cierra la pestaña ya abierta", async () => {
    const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    fetchWithAuthMock.mockRejectedValue(new Error("boom"));
    await expect(H.openCrmDocument(500, 501, true)).rejects.toThrow("boom");
    expect(tab.close).toHaveBeenCalled();
  });
});

describe("toQuery", () => {
  it("omite los vacíos y codifica", () => {
    expect(H.toQuery()).toBe("");
    expect(H.toQuery({ a: "", b: null, c: undefined })).toBe("");
    expect(H.toQuery({ q: "a b", n: 2, f: false })).toBe("?q=a+b&n=2&f=false");
  });
});
