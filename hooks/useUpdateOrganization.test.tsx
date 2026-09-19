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
