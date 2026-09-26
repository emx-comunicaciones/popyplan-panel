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
import { buildOrganization } from "@/test-utils/fixtures/organization";

import { SetTrackingProgramError, useSetTrackingProgram } from "./useSetTrackingProgram";

afterEach(() => {
  apiFetchMock.mockReset();
});

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper };
}

describe("useSetTrackingProgram", () => {
  it("manda PATCH con tracking_program_enabled e invalida la ficha", async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(["panel-organization", "96"], buildOrganization({ id: 96 }));
    apiFetchMock.mockResolvedValueOnce(buildOrganization({ id: 96, tracking_program_enabled: true }));

    const { result } = renderHook(() => useSetTrackingProgram(96), { wrapper });
    result.current.mutate(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/96/", {
      method: "PATCH",
      body: { tracking_program_enabled: true },
    });
    expect(queryClient.getQueryState(["panel-organization", "96"])?.isInvalidated).toBe(true);
  });

  it("400 (entidad no verificada o no asociación) trae el texto literal del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(400, { tracking_program_enabled: ["Solo asociaciones u ONG verificadas."] }),
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useSetTrackingProgram(96), { wrapper });
    result.current.mutate(true);
    await waitFor(() => expect(result.current.isError).toBe(true));

    const error = result.current.error as SetTrackingProgramError;
    expect(error.kind).toBe("invalido");
    expect(error.detail).toBe("Solo asociaciones u ONG verificadas.");
  });

  it("400 sin cuerpo, 403 y un fallo de red", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useSetTrackingProgram(96), { wrapper });

    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));
    result.current.mutate(true);
    await waitFor(() => expect(result.current.error?.message).toBe("Esta entidad no puede tener el programa de seguimiento."));

    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    result.current.mutate(false);
    await waitFor(() => expect(result.current.error?.kind).toBe("sin_permiso"));

    apiFetchMock.mockRejectedValueOnce(new Error("red"));
    result.current.mutate(false);
    await waitFor(() => expect(result.current.error?.kind).toBe("desconocido"));
  });
});
