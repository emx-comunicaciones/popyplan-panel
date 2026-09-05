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

import { AttendeesError, useAttendees } from "./useAttendees";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useAttendees", () => {
  it("pide la ruta exacta", async () => {
    apiFetchMock.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useAttendees("event-uuid-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/events/event-uuid-1/attendees/");
  });

  it("sin eventId no llama a la API", () => {
    renderHook(() => useAttendees(""), { wrapper });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("un 403 (no organiza) surge como 'sin_permiso'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useAttendees("event-uuid-1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(AttendeesError);
    expect((result.current.error as AttendeesError).kind).toBe("sin_permiso");
  });

  it("cualquier otro error surge como 'desconocido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useAttendees("event-uuid-1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as AttendeesError).kind).toBe("desconocido");
  });
});
