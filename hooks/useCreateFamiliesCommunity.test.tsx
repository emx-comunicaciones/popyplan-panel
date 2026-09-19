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
import { buildEntityCommunityRow } from "@/test-utils/fixtures/community";

import { CreateFamiliesCommunityError, useCreateFamiliesCommunity } from "./useCreateFamiliesCommunity";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useCreateFamiliesCommunity", () => {
  it("manda POST /api/communities/ con space:'families' y owner_org", async () => {
    const created = buildEntityCommunityRow({ space: "families" });
    apiFetchMock.mockResolvedValueOnce(created);

    const { result } = renderHook(() => useCreateFamiliesCommunity(), { wrapper });
    result.current.mutate({
      orgId: 7,
      name: "Familias",
      description: "Espacio para familias",
      visibility: "open",
      codeOfConduct: "Sé amable",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/communities/", {
      method: "POST",
      body: {
        name: "Familias",
        description: "Espacio para familias",
        visibility: "open",
        code_of_conduct: "Sé amable",
        space: "families",
        owner_org: 7,
      },
    });
  });

  it("normaliza orgId de string a number en owner_org", async () => {
    apiFetchMock.mockResolvedValueOnce(buildEntityCommunityRow({ space: "families" }));

    const { result } = renderHook(() => useCreateFamiliesCommunity(), { wrapper });
    result.current.mutate({ orgId: "7", name: "Familias" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/communities/",
      expect.objectContaining({ body: expect.objectContaining({ owner_org: 7 }) }),
    );
  });

  it("400 surge como invalido con el detalle del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "El nombre es obligatorio." }));

    const { result } = renderHook(() => useCreateFamiliesCommunity(), { wrapper });
    result.current.mutate({ orgId: 7, name: "" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(CreateFamiliesCommunityError);
    expect(result.current.error?.kind).toBe("invalido");
    expect(result.current.error?.message).toBe("El nombre es obligatorio.");
    // `detail` es lo que `errorKindText` (`lib/i18n/errorKindText.ts`)
    // prioriza sobre la traducción por `kind` — sin él, `FamiliasPanel`
    // mostraría el genérico de la clave en cualquier idioma.
    expect(result.current.error?.detail).toBe("El nombre es obligatorio.");
  });

  it("400 con {error} en vez de {detail} también extrae el mensaje", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { error: "Ya existe una comunidad con ese nombre." }));

    const { result } = renderHook(() => useCreateFamiliesCommunity(), { wrapper });
    result.current.mutate({ orgId: 7, name: "Familias" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Ya existe una comunidad con ese nombre.");
  });

  it("400 sin detail ni error cae al mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, {}));

    const { result } = renderHook(() => useCreateFamiliesCommunity(), { wrapper });
    result.current.mutate({ orgId: 7, name: "Familias" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Revisa los datos: alguno no es válido.");
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, {}));

    const { result } = renderHook(() => useCreateFamiliesCommunity(), { wrapper });
    result.current.mutate({ orgId: 7, name: "Familias" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("sin_permiso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useCreateFamiliesCommunity(), { wrapper });
    result.current.mutate({ orgId: 7, name: "Familias" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });
});

/**
 * `lib/api/drfError.ts::detailOf`: el 400 por campo de DRF
 * (`{campo: ["mensaje"]}`) se pinta con el mensaje del backend, no con el
 * genérico del hook.
 */
describe("useCreateFamiliesCommunity (400 por campo)", () => {
  it("muestra el mensaje del campo que el backend rechaza", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { name: ["Este campo no puede estar en blanco."] }));
    const { result } = renderHook(() => useCreateFamiliesCommunity(), { wrapper });
    result.current.mutate({ orgId: 7, name: "" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Este campo no puede estar en blanco.");
  });
});
