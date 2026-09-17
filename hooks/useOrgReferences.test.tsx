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
import type { Reference } from "@/lib/api/types";

import {
  OrgReferencesError,
  useCreateOrgReference,
  useOrgReferences,
  useRemoveOrgReference,
} from "./useOrgReferences";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const REFERENCE = {
  id: 1,
  organization: 7,
  referent: 9,
  user: 42,
  created_at: "2026-01-05T09:00:00Z",
  public_name: "Bea",
  photo: "",
} as Reference;

describe("useOrgReferences", () => {
  it("pide la lista de referencias", async () => {
    apiFetchMock.mockResolvedValueOnce([REFERENCE]);

    const { result } = renderHook(() => useOrgReferences(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/references/");
    expect(result.current.data).toEqual([REFERENCE]);
  });

  it("cualquier fallo surge como OrgReferencesError", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useOrgReferences(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(OrgReferencesError);
  });
});

describe("useCreateOrgReference", () => {
  it("hace POST con user y referent_user", async () => {
    apiFetchMock.mockResolvedValueOnce(REFERENCE);

    const { result } = renderHook(() => useCreateOrgReference(7), { wrapper });
    result.current.mutate({ user: 42, referent_user: 9 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/references/", {
      method: "POST",
      body: { user: 42, referent_user: 9 },
    });
  });

  it("400 muestra el detalle del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "Ya tiene referente." }));

    const { result } = renderHook(() => useCreateOrgReference(7), { wrapper });
    result.current.mutate({ user: 42, referent_user: 9 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Ya tiene referente.");
  });

  it("cualquier otro fallo muestra el mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useCreateOrgReference(7), { wrapper });
    result.current.mutate({ user: 42, referent_user: 9 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No se pudo asignar el referente.");
  });
});

describe("useRemoveOrgReference", () => {
  it("hace DELETE con user_id en la query", async () => {
    apiFetchMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useRemoveOrgReference(7), { wrapper });
    result.current.mutate(42);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/references/?user_id=42", {
      method: "DELETE",
    });
  });

  it("cualquier fallo muestra el mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useRemoveOrgReference(7), { wrapper });
    result.current.mutate(42);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No se pudo quitar el referente.");
  });
});

/**
 * `lib/api/drfError.ts::detailOf`: el 400 por campo de DRF
 * (`{campo: ["mensaje"]}`) se pinta con el mensaje del backend, no con el
 * genérico del hook.
 */
describe("useCreateOrgReference (400 por campo)", () => {
  it("muestra el mensaje del campo que el backend rechaza", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { referent_user: ["Esa persona no tiene el rol referente."] }));
    const { result } = renderHook(() => useCreateOrgReference(7), { wrapper });
    result.current.mutate({ user: 42, referent_user: 9 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Esa persona no tiene el rol referente.");
  });
});

describe("useCreateOrgReference/useRemoveOrgReference (personas y fichas)", () => {
  it("asignar un referente refresca el listado de personas y sus fichas", async () => {
    apiFetchMock.mockResolvedValueOnce({ id: 1, organization: 7, referent: 9, user: 42, created_at: "2026-01-01T00:00:00Z" });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // La columna «Referente» del listado y la ficha de la persona salen
    // de estas dos familias, con filtros/periodo en la clave: prefijo.
    const peopleKey = ["panel-people", 7, "since=2026-01-01&until=2026-01-31"];
    const personKey = ["panel-person", 7, "42", "since=2026-01-01&until=2026-01-31"];
    queryClient.setQueryData(peopleKey, { count: 0, next: null, previous: null, results: [] });
    queryClient.setQueryData(personKey, { user_id: 42 });
    const clientWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateOrgReference(7), { wrapper: clientWrapper });
    result.current.mutate({ user: 42, referent_user: 9 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      expect(queryClient.getQueryState(peopleKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(personKey)?.isInvalidated).toBe(true);
    });
  });

  it("quitar un referente refresca el listado de personas y sus fichas", async () => {
    apiFetchMock.mockResolvedValueOnce(undefined);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const peopleKey = ["panel-people", 7, "since=2026-01-01&until=2026-01-31"];
    const personKey = ["panel-person", 7, "42", "since=2026-01-01&until=2026-01-31"];
    queryClient.setQueryData(peopleKey, { count: 0, next: null, previous: null, results: [] });
    queryClient.setQueryData(personKey, { user_id: 42 });
    const clientWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRemoveOrgReference(7), { wrapper: clientWrapper });
    result.current.mutate(42);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      expect(queryClient.getQueryState(peopleKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(personKey)?.isInvalidated).toBe(true);
    });
  });
});
