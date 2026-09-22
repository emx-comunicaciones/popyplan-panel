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
import { EVENTS } from "@/lib/api/endpoints";
import type { EventDetail } from "@/lib/api/types";

import { EventError, useEvent } from "./useEvent";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const EVENT_DETAIL = { id: "e1", title: "Salida al monte" } as unknown as EventDetail;

describe("useEvent", () => {
  it("pide GET /api/events/{id}/ y devuelve el detalle", async () => {
    apiFetchMock.mockResolvedValueOnce(EVENT_DETAIL);

    const { result } = renderHook(() => useEvent("e1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(EVENTS.DETAIL("e1"));
    expect(result.current.data).toEqual(EVENT_DETAIL);
  });

  it("enabled: false no dispara la petición", () => {
    renderHook(() => useEvent("e1", false), { wrapper });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("eventId vacío no dispara la petición", () => {
    renderHook(() => useEvent(""), { wrapper });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("403/404 surge como sin_acceso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useEvent("e1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as EventError).kind).toBe("sin_acceso");

    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));
    const { result: result2 } = renderHook(() => useEvent("e2"), { wrapper });
    await waitFor(() => expect(result2.current.isError).toBe(true));
    expect((result2.current.error as EventError).kind).toBe("sin_acceso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useEvent("e1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as EventError).kind).toBe("desconocido");
  });
});
