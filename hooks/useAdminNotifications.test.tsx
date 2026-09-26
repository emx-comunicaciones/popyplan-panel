/**
 * `NOTIFICATIONS.SEND`, `NOTIFICATIONS.TEMPLATES` y `NOTIFICATIONS.TEMPLATE`
 * (admin de plataforma, bloque 3). El envío a una persona responde
 * `{detail, recipients}` y el masivo solo `{detail}`: los mocks usan las
 * dos formas reales.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { ApiError } from "@/lib/api/client";
import type { NotificationTemplateInput } from "@/lib/api/types";

import {
  NOTIFICATION_TEMPLATES_KEY,
  useDeleteNotificationTemplate,
  useNotificationTemplates,
  useSaveNotificationTemplate,
  useSendAdminNotification,
} from "./useAdminNotifications";

afterEach(() => {
  apiFetchMock.mockReset();
});

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
function freshClient() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return queryClient;
}

const TEMPLATE: NotificationTemplateInput = {
  name: "Aviso",
  notification_type: "system",
  title_template: "Hello {name}",
  message_template: "Body",
  email_subject_template: "",
  email_body_template: "",
  is_active: true,
  priority: "medium",
};

describe("useSendAdminNotification", () => {
  it("manda el cuerpo por POST y devuelve la respuesta", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce({ detail: "ok", recipients: 1 });
    const { result } = renderHook(() => useSendAdminNotification(), { wrapper });
    const input = { title: "T", message: "M", notification_type: "system" as const, target: "user" as const, user_id: 3 };
    const data = await result.current.mutateAsync(input);
    expect(data).toEqual({ detail: "ok", recipients: 1 });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/notifications/send/", { method: "POST", body: input });
  });

  it.each([
    [new ApiError(400, { user_id: ["Inactiva."] }), "invalido", "Inactiva."],
    [new ApiError(400, {}), "invalido", undefined],
    [new ApiError(403, null), "sin_acceso", undefined],
    [new ApiError(404, null), "no_encontrado", undefined],
    [new ApiError(500, null), "desconocido", undefined],
    [new Error("red"), "desconocido", undefined],
  ])("traduce el error %#", async (error, kind, detail) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useSendAdminNotification(), { wrapper });
    result.current.mutate({ title: "T", message: "M", notification_type: "system", target: "all" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe(kind);
    expect(result.current.error?.detail).toBe(detail);
  });
});

describe("useNotificationTemplates", () => {
  it("pide la página indicada", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] });
    const { result } = renderHook(() => useNotificationTemplates(2), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/notification-templates/?page=2");
  });

  it.each([
    [404, "pagina_inexistente"],
    [403, "sin_acceso"],
    [500, "desconocido"],
  ])("traduce un %s a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { result } = renderHook(() => useNotificationTemplates(1), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe(kind);
  });
});

describe("useSaveNotificationTemplate / useDeleteNotificationTemplate", () => {
  it("crea con POST, edita con PATCH e invalida el listado", async () => {
    const client = freshClient();
    client.setQueryData([NOTIFICATION_TEMPLATES_KEY, 1], { count: 0, next: null, previous: null, results: [] });
    apiFetchMock.mockResolvedValue({ id: 5, ...TEMPLATE });
    const { result } = renderHook(() => useSaveNotificationTemplate(), { wrapper });
    await result.current.mutateAsync({ id: null, data: TEMPLATE });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/notification-templates/", { method: "POST", body: TEMPLATE });
    await result.current.mutateAsync({ id: 5, data: TEMPLATE });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/notification-templates/5/", { method: "PATCH", body: TEMPLATE });
    await waitFor(() => expect(client.getQueryState([NOTIFICATION_TEMPLATES_KEY, 1])?.isInvalidated).toBe(true));
  });

  it("un 400 al guardar trae el detalle", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { name: ["Obligatorio."] }));
    const { result } = renderHook(() => useSaveNotificationTemplate(), { wrapper });
    result.current.mutate({ id: null, data: TEMPLATE });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.detail).toBe("Obligatorio.");
  });

  it("borra con DELETE e invalida; traduce el error", async () => {
    const client = freshClient();
    client.setQueryData([NOTIFICATION_TEMPLATES_KEY, 1], { count: 0, next: null, previous: null, results: [] });
    apiFetchMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDeleteNotificationTemplate(), { wrapper });
    await result.current.mutateAsync(5);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/notification-templates/5/", { method: "DELETE" });
    await waitFor(() => expect(client.getQueryState([NOTIFICATION_TEMPLATES_KEY, 1])?.isInvalidated).toBe(true));

    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));
    result.current.mutate(5);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("no_encontrado");
  });
});
