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

import { AssignReferentError, useAssignReferent } from "./useAssignReferent";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useAssignReferent", () => {
  it("hace POST con {user, referent_user} exactos", async () => {
    const reference = { id: 1, organization: 7, referent: 3, user: 42, created_at: "2026-01-01T00:00:00Z" };
    apiFetchMock.mockResolvedValueOnce(reference);

    const { result } = renderHook(() => useAssignReferent(7), { wrapper });
    result.current.mutate({ userId: 42, referentUserId: 3 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/references/", {
      method: "POST",
      body: { user: 42, referent_user: 3 },
    });
    expect(result.current.data).toEqual(reference);
  });

  it("400 (p. ej. referente sin rol referente, o persona ya con referente) surge con el detalle del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(400, { detail: "Esa persona ya tiene un referente asignado." }),
    );

    const { result } = renderHook(() => useAssignReferent(7), { wrapper });
    result.current.mutate({ userId: 42, referentUserId: 3 });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(AssignReferentError);
    expect((result.current.error as AssignReferentError).kind).toBe("invalido");
    expect((result.current.error as AssignReferentError).message).toBe(
      "Esa persona ya tiene un referente asignado.",
    );
  });

  it("400 sin detalle usa el mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => useAssignReferent(7), { wrapper });
    result.current.mutate({ userId: 42, referentUserId: 3 });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as AssignReferentError).message).toBe(
      "No se pudo asignar el referente: revisa los datos.",
    );
  });

  it("403 surge como 'sin_permiso'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useAssignReferent(7), { wrapper });
    result.current.mutate({ userId: 42, referentUserId: 3 });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as AssignReferentError).kind).toBe("sin_permiso");
  });

  it("cualquier otro error surge como 'desconocido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useAssignReferent(7), { wrapper });
    result.current.mutate({ userId: 42, referentUserId: 3 });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as AssignReferentError).kind).toBe("desconocido");
  });
});
