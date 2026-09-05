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

import {
  OrganizationsError,
  useCreateOrganization,
  useOrganizations,
  useSetOrganizationParent,
  useVerifyOrganization,
} from "./useOrganizations";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const PAGE = { count: 0, next: null, previous: null, results: [] };
const ORG = { id: 1, name: "Ayuntamiento", slug: "ayto", org_type: "administracion", is_verified: false };

describe("useOrganizations", () => {
  it("pide el listado sin filtros", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);
    const { result } = renderHook(() => useOrganizations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/?");
  });

  it("añade verified, parent, search y page", async () => {
    apiFetchMock.mockResolvedValueOnce(PAGE);
    const { result } = renderHook(
      () => useOrganizations({ verified: true, parent: 3, search: "irun", page: 2 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/organizations/?verified=true&parent=3&search=irun&page=2",
    );
  });

  it("cualquier fallo surge como OrganizationsError", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));
    const { result } = renderHook(() => useOrganizations(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(OrganizationsError);
  });
});

describe("useCreateOrganization", () => {
  it("crea la entidad", async () => {
    apiFetchMock.mockResolvedValueOnce(ORG);
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });
    result.current.mutate({
      name: "Ayuntamiento",
      slug: "ayto",
      org_type: "administracion",
      cif: "A1",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/organizations/",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("400 con detail lo muestra literal", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "Slug repetido." }));
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });
    result.current.mutate({ name: "x", slug: "x", org_type: "asociacion", cif: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Slug repetido.");
  });

  it("403 sin permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });
    result.current.mutate({ name: "x", slug: "x", org_type: "asociacion", cif: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(OrganizationsError);
  });

  it("cualquier otro fallo", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });
    result.current.mutate({ name: "x", slug: "x", org_type: "asociacion", cif: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(OrganizationsError);
  });
});

describe("useVerifyOrganization", () => {
  it("verifica la entidad", async () => {
    apiFetchMock.mockResolvedValueOnce({ ...ORG, is_verified: true });
    const { result } = renderHook(() => useVerifyOrganization(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/organizations/1/verify/",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("403 sin permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const { result } = renderHook(() => useVerifyOrganization(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(OrganizationsError);
  });

  it("cualquier otro fallo", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));
    const { result } = renderHook(() => useVerifyOrganization(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(OrganizationsError);
  });
});

describe("useSetOrganizationParent", () => {
  it("cambia el paraguas", async () => {
    apiFetchMock.mockResolvedValueOnce(ORG);
    const { result } = renderHook(() => useSetOrganizationParent(), { wrapper });
    result.current.mutate({ orgId: 1, parent: 9 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/organizations/1/",
      expect.objectContaining({ method: "PATCH", body: { parent: 9 } }),
    );
  });

  it("400 con detail literal", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "Crearía un ciclo." }));
    const { result } = renderHook(() => useSetOrganizationParent(), { wrapper });
    result.current.mutate({ orgId: 1, parent: 1 });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Crearía un ciclo.");
  });

  it("403 sin permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const { result } = renderHook(() => useSetOrganizationParent(), { wrapper });
    result.current.mutate({ orgId: 1, parent: null });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(OrganizationsError);
  });

  it("cualquier otro fallo", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("caído"));
    const { result } = renderHook(() => useSetOrganizationParent(), { wrapper });
    result.current.mutate({ orgId: 1, parent: null });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(OrganizationsError);
  });
});
