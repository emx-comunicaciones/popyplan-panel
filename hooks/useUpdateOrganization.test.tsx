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

import { UpdateOrganizationError, useUpdateOrganization } from "./useUpdateOrganization";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useUpdateOrganization", () => {
  it("hace PATCH con los campos indicados", async () => {
    const updated = buildOrganization({ primary_color: "#000000" });
    apiFetchMock.mockResolvedValueOnce(updated);

    const { result } = renderHook(() => useUpdateOrganization(7), { wrapper });
    result.current.mutate({ primary_color: "#000000" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/", {
      method: "PATCH",
      body: { primary_color: "#000000" },
    });
  });

  it("con un logo manda multipart: FormData con el fichero y el resto de campos como cadenas", async () => {
    apiFetchMock.mockResolvedValueOnce(buildOrganization());
    const logo = new File(["png"], "logo.png", { type: "image/png" });

    const { result } = renderHook(() => useUpdateOrganization(7), { wrapper });
    result.current.mutate({ description: "Nueva", primary_color: "#000000", logo });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [, init] = apiFetchMock.mock.calls[0] as [string, { method: string; body: FormData }];
    expect(init.method).toBe("PATCH");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get("logo")).toBe(logo);
    expect(init.body.get("description")).toBe("Nueva");
    expect(init.body.get("primary_color")).toBe("#000000");
  });

  it("400 surge como invalido con el detalle", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "on_call_user sin rol en la entidad" }));

    const { result } = renderHook(() => useUpdateOrganization(7), { wrapper });
    result.current.mutate({ on_call_user: 999 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as UpdateOrganizationError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("on_call_user sin rol en la entidad");
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useUpdateOrganization(7), { wrapper });
    result.current.mutate({ description: "Nueva descripción" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as UpdateOrganizationError).kind).toBe("sin_permiso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useUpdateOrganization(7), { wrapper });
    result.current.mutate({ description: "x" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as UpdateOrganizationError).kind).toBe("desconocido");
  });
});

describe("useUpdateOrganization (sede)", () => {
  it("manda la sede junto al resto de la lista blanca del titular", async () => {
    apiFetchMock.mockResolvedValueOnce(buildOrganization());

    const { result } = renderHook(() => useUpdateOrganization(7), { wrapper });
    result.current.mutate({ description: "Hola", place: "20069" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/", {
      method: "PATCH",
      body: { description: "Hola", place: "20069" },
    });
  });

  /**
   * M4 de la revisión final de rama: la columna «Sede» nueva de
   * `EntidadesTable` lee `["panel-organizations", …]`, y
   * `useSetOrganizationTerritory` ya invalidaba las dos claves — esta
   * mutación solo invalidaba la ficha, así que el listado se quedaba con
   * la sede vieja hasta recargar la página a mano.
   */
  it("invalida también el listado de entidades, no solo la ficha (M4)", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function sharedWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    queryClient.setQueryData(["panel-organization", "7"], buildOrganization({ id: 7 }));
    queryClient.setQueryData(["panel-organizations", "{}"], {
      count: 1,
      next: null,
      previous: null,
      results: [buildOrganization({ id: 7 })],
    });
    apiFetchMock.mockResolvedValueOnce(buildOrganization({ id: 7, place: "20069" }));

    const { result } = renderHook(() => useUpdateOrganization(7), { wrapper: sharedWrapper });
    result.current.mutate({ place: "20069" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(["panel-organization", "7"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["panel-organizations", "{}"])?.isInvalidated).toBe(true);
  });
});

/**
 * `lib/api/drfError.ts::detailOf`: el 400 por campo de DRF
 * (`{campo: ["mensaje"]}`) se pinta con el mensaje del backend, no con el
 * genérico del hook.
 */
describe("useUpdateOrganization (400 por campo)", () => {
  it("muestra el mensaje del campo que el backend rechaza", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { contact_email: ["Introduce una dirección de correo válida."] }));
    const { result } = renderHook(() => useUpdateOrganization(7), { wrapper });
    result.current.mutate({ contact_email: "no-es-un-correo" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Introduce una dirección de correo válida.");
  });
});
