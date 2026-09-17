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

import { CheckinError, useCheckin } from "./useCheckin";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useCheckin", () => {
  it("hace POST con {token} exacto y devuelve already:false", async () => {
    apiFetchMock.mockResolvedValueOnce({ status: "attended", already: false });

    const { result } = renderHook(() => useCheckin("event-uuid-1", 7), { wrapper });
    result.current.mutate({ token: "token-abc" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/events/event-uuid-1/checkin/", {
      method: "POST",
      body: { token: "token-abc" },
    });
    expect(result.current.data).toEqual({ status: "attended", already: false });
  });

  it("token ya usado: already:true (idempotente, sigue en 200)", async () => {
    apiFetchMock.mockResolvedValueOnce({ status: "attended", already: true });

    const { result } = renderHook(() => useCheckin("event-uuid-1", 7), { wrapper });
    result.current.mutate({ token: "token-ya-usado" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ status: "attended", already: true });
  });

  it("409 (fuera de ventana) surge como 'fuera_de_ventana' con el mensaje del contrato", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, { detail: "Fuera de la ventana de check-in de esta actividad." }));

    const { result } = renderHook(() => useCheckin("event-uuid-1", 7), { wrapper });
    result.current.mutate({ token: "token-tarde" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(CheckinError);
    expect((result.current.error as CheckinError).kind).toBe("fuera_de_ventana");
    expect((result.current.error as CheckinError).message).toBe(
      "Fuera de la ventana de check-in de esta actividad.",
    );
  });

  it("404 (token desconocido o de otra actividad) surge como 'token_desconocido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));

    const { result } = renderHook(() => useCheckin("event-uuid-1", 7), { wrapper });
    result.current.mutate({ token: "token-que-no-existe" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as CheckinError).kind).toBe("token_desconocido");
  });

  it("403 (no organiza) surge como 'sin_permiso'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useCheckin("event-uuid-1", 7), { wrapper });
    result.current.mutate({ token: "token-abc" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as CheckinError).kind).toBe("sin_permiso");
  });

  it("cualquier otro error surge como 'desconocido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useCheckin("event-uuid-1", 7), { wrapper });
    result.current.mutate({ token: "token-abc" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as CheckinError).kind).toBe("desconocido");
  });
});

describe("useCheckin (listados que dependen de la asistencia)", () => {
  it("refresca las actividades de la entidad y las fichas de persona", async () => {
    apiFetchMock.mockResolvedValueOnce({ status: "attended", already: false });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const eventsKey = ["panel-entity-events", 7, "since=2026-01-01&until=2026-01-31"];
    const personKey = ["panel-person", 7, "42", "since=2026-01-01&until=2026-01-31"];
    queryClient.setQueryData(eventsKey, []);
    queryClient.setQueryData(personKey, { user_id: 42 });
    const clientWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCheckin("event-uuid-1", 7), { wrapper: clientWrapper });
    result.current.mutate({ token: "token-abc" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      expect(queryClient.getQueryState(eventsKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(personKey)?.isInvalidated).toBe(true);
    });
  });
});
