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

import { SendAnnouncementError, useSendAnnouncement } from "./useSendAnnouncement";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useSendAnnouncement", () => {
  it("manda title, body y audience 'members'", async () => {
    const announcement = buildAnnouncement();
    apiFetchMock.mockResolvedValueOnce(announcement);

    const { result } = renderHook(() => useSendAnnouncement(7), { wrapper });
    result.current.mutate({ title: "Cerramos el jueves", body: "Aviso", audience: "members" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/announcements/", {
      method: "POST",
      body: { title: "Cerramos el jueves", body: "Aviso", audience: "members" },
    });
  });

  it("manda audience 'community:<uuid>' tal cual", async () => {
    apiFetchMock.mockResolvedValueOnce(buildAnnouncement({ audience: "community:c-1" }));

    const { result } = renderHook(() => useSendAnnouncement(7), { wrapper });
    result.current.mutate({ title: "T", body: "B", audience: "community:c-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/entidad/7/announcements/",
      expect.objectContaining({ body: expect.objectContaining({ audience: "community:c-1" }) }),
    );
  });

  it("400 (families: marcador de posición) surge como invalido con el detalle del contrato", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(400, { detail: "El espacio de familias llega en la siguiente tarea." }),
    );

    const { result } = renderHook(() => useSendAnnouncement(7), { wrapper });
    result.current.mutate({ title: "T", body: "B", audience: "families" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as SendAnnouncementError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("El espacio de familias llega en la siguiente tarea.");
  });

  it("400 sin detalle en el cuerpo cae al mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => useSendAnnouncement(7), { wrapper });
    result.current.mutate({ title: "T", body: "B", audience: "community:c-9" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as SendAnnouncementError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Revisa los datos: la audiencia no es válida.");
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useSendAnnouncement(7), { wrapper });
    result.current.mutate({ title: "T", body: "B", audience: "members" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as SendAnnouncementError).kind).toBe("sin_permiso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useSendAnnouncement(7), { wrapper });
    result.current.mutate({ title: "T", body: "B", audience: "members" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as SendAnnouncementError).kind).toBe("desconocido");
  });
});
