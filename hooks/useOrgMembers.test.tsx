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
import { buildOrgMembershipFull } from "@/test-utils/fixtures/orgMembershipFull";

import { OrgMembersError, useAddOrgMember, useOrgMembers, useRemoveOrgMember } from "./useOrgMembers";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useOrgMembers", () => {
  it("pide el equipo de la entidad", async () => {
    const member = buildOrgMembershipFull();
    apiFetchMock.mockResolvedValueOnce([member]);

    const { result } = renderHook(() => useOrgMembers(7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/members/");
    expect(result.current.data).toEqual([member]);
  });

  it("403 muestra el mensaje de solo titular", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useOrgMembers(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(OrgMembersError);
    expect(result.current.error?.message).toBe("Solo el titular puede ver el equipo de la entidad.");
  });

  it("cualquier otro fallo muestra el mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useOrgMembers(7), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("No se pudo cargar el equipo de la entidad.");
  });
});

describe("useAddOrgMember", () => {
  it("hace POST con user y role", async () => {
    const created = buildOrgMembershipFull({ user: 55, role: "dinamizador" });
    apiFetchMock.mockResolvedValueOnce(created);

    const { result } = renderHook(() => useAddOrgMember(7), { wrapper });
    result.current.mutate({ user: 55, role: "dinamizador" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/members/", {
      method: "POST",
      body: { user: 55, role: "dinamizador" },
    });
  });

  it("400 (ya tiene rol) muestra el detalle", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(400, { detail: "Esa persona ya tiene un rol en esta entidad." }),
    );

    const { result } = renderHook(() => useAddOrgMember(7), { wrapper });
    result.current.mutate({ user: 55, role: "dinamizador" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Esa persona ya tiene un rol en esta entidad.");
  });

  it("403 muestra el mensaje de solo titular", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useAddOrgMember(7), { wrapper });
    result.current.mutate({ user: 55, role: "dinamizador" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Solo el titular puede dar de alta al equipo.");
  });

  it("cualquier otro fallo muestra el mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useAddOrgMember(7), { wrapper });
    result.current.mutate({ user: 55, role: "dinamizador" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No se pudo dar de alta a la persona.");
  });
});

describe("useRemoveOrgMember", () => {
  it("hace DELETE con user_id en la query", async () => {
    apiFetchMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useRemoveOrgMember(7), { wrapper });
    result.current.mutate(55);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/members/?user_id=55", {
      method: "DELETE",
    });
  });

  it("403 muestra el mensaje de permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useRemoveOrgMember(7), { wrapper });
    result.current.mutate(55);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Solo el titular puede quitar del equipo.");
  });

  it("cualquier otro fallo muestra el mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useRemoveOrgMember(7), { wrapper });
    result.current.mutate(55);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No se pudo quitar a la persona del equipo.");
  });
});

/**
 * `lib/api/drfError.ts::detailOf`: el 400 por campo de DRF
 * (`{campo: ["mensaje"]}`) se pinta con el mensaje del backend, no con el
 * genérico del hook.
 */
describe("useAddOrgMember (400 por campo)", () => {
  it("muestra el mensaje del campo que el backend rechaza", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { role: ["Ese rol no existe en esta entidad."] }));
    const { result } = renderHook(() => useAddOrgMember(7), { wrapper });
    result.current.mutate({ user: 55, role: "dinamizador" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Ese rol no existe en esta entidad.");
  });
});
