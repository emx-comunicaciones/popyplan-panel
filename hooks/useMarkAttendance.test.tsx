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

import { MarkAttendanceError, useMarkAttendance } from "./useMarkAttendance";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useMarkAttendance", () => {
  it("hace POST con {user_id, attended} exactos", async () => {
    apiFetchMock.mockResolvedValueOnce({ user_id: 42, status: "attended" });

    const { result } = renderHook(() => useMarkAttendance("event-uuid-1", 7), { wrapper });
    result.current.mutate({ userId: 42, attended: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/events/event-uuid-1/attendance/", {
      method: "POST",
      body: { user_id: 42, attended: true },
    });
    expect(result.current.data).toEqual({ user_id: 42, status: "attended" });
  });

  it("marcar 'no asistió' manda attended: false", async () => {
    apiFetchMock.mockResolvedValueOnce({ user_id: 42, status: "no_show" });

    const { result } = renderHook(() => useMarkAttendance("event-uuid-1", 7), { wrapper });
    result.current.mutate({ userId: 42, attended: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/events/event-uuid-1/attendance/", {
      method: "POST",
      body: { user_id: 42, attended: false },
    });
  });

  it("400 (actividad aún no empezada) surge con el detalle del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(400, { detail: "La asistencia se pasa cuando la actividad ha empezado." }),
    );

    const { result } = renderHook(() => useMarkAttendance("event-uuid-1", 7), { wrapper });
    result.current.mutate({ userId: 42, attended: true });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(MarkAttendanceError);
    expect((result.current.error as MarkAttendanceError).kind).toBe("invalido");
    expect((result.current.error as MarkAttendanceError).message).toBe(
      "La asistencia se pasa cuando la actividad ha empezado.",
    );
  });

  it("403 surge como 'sin_permiso'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useMarkAttendance("event-uuid-1", 7), { wrapper });
    result.current.mutate({ userId: 42, attended: true });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as MarkAttendanceError).kind).toBe("sin_permiso");
  });

  it("404 (no estaba apuntada) surge como 'no_inscrita'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, { detail: "Esa persona no está apuntada." }));

    const { result } = renderHook(() => useMarkAttendance("event-uuid-1", 7), { wrapper });
    result.current.mutate({ userId: 999, attended: true });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as MarkAttendanceError).kind).toBe("no_inscrita");
  });

  it("cualquier otro error surge como 'desconocido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useMarkAttendance("event-uuid-1", 7), { wrapper });
    result.current.mutate({ userId: 42, attended: true });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as MarkAttendanceError).kind).toBe("desconocido");
  });
});

/**
 * `lib/api/drfError.ts::detailOf`: el 400 por campo de DRF
 * (`{campo: ["mensaje"]}`) se pinta con el mensaje del backend, no con el
 * genérico del hook.
 */
describe("useMarkAttendance (400 por campo)", () => {
  it("muestra el mensaje del campo que el backend rechaza", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { user_id: ["Esta persona no está apuntada."] }));

    const { result } = renderHook(() => useMarkAttendance("event-uuid-1", 7), { wrapper });
    result.current.mutate({ userId: 42, attended: true });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Esta persona no está apuntada.");
  });
});

describe("useMarkAttendance (listados que dependen de la asistencia)", () => {
  it("refresca las actividades de la entidad y las fichas de persona", async () => {
    apiFetchMock.mockResolvedValueOnce({ user_id: 42, status: "attended" });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Marcar asistencia cambia el recuento «asistió/no asistió» de la
    // actividad y el historial de la ficha de esa persona: ambas familias
    // llevan periodo/filtros en la clave, así que se invalidan por prefijo.
    const eventsKey = ["panel-entity-events", 7, "since=2026-01-01&until=2026-01-31"];
    const personKey = ["panel-person", 7, "42", "since=2026-01-01&until=2026-01-31"];
    queryClient.setQueryData(eventsKey, []);
    queryClient.setQueryData(personKey, { user_id: 42 });
    const clientWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useMarkAttendance("event-uuid-1", 7), { wrapper: clientWrapper });
    result.current.mutate({ userId: 42, attended: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      expect(queryClient.getQueryState(eventsKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(personKey)?.isInvalidated).toBe(true);
    });
  });
});
