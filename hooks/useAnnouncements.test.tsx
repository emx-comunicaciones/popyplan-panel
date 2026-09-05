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
import { buildAnnouncement } from "@/test-utils/fixtures/announcement";

import { AnnouncementsError, useAnnouncements } from "./useAnnouncements";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useAnnouncements", () => {
  it("pide el historial de comunicaciones de la entidad", async () => {
    const announcement = buildAnnouncement();
    apiFetchMock.mockResolvedValueOnce([announcement]);

    const { result } = renderHook(() => useAnnouncements(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/announcements/");
    expect(result.current.data).toEqual([announcement]);
  });

  it("403 surge como sin acceso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useAnnouncements(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(AnnouncementsError);
    expect(result.current.error?.message).toMatch(/No tienes acceso/);
  });

  it("cualquier otro fallo surge con mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useAnnouncements(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("No se pudieron cargar las comunicaciones.");
  });
});
