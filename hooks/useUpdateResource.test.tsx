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
import { buildEntityResource } from "@/test-utils/fixtures/resource";

import { UpdateResourceError, useUpdateResource } from "./useUpdateResource";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useUpdateResource", () => {
  it("manda solo los campos presentes (edición parcial) al recurso indicado", async () => {
    apiFetchMock.mockResolvedValueOnce(buildEntityResource({ title: "Nuevo título" }));

    const { result } = renderHook(() => useUpdateResource(7), { wrapper });
    result.current.mutate({ resourceId: 1, title: "Nuevo título" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/resources/1/", {
      method: "PATCH",
      body: { title: "Nuevo título" },
    });
  });

  it("400 con detalle surge como invalido", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "Categoría no válida" }));

    const { result } = renderHook(() => useUpdateResource(7), { wrapper });
    result.current.mutate({ resourceId: 1, category: "help" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as UpdateResourceError).kind).toBe("invalido");
  });

  it("400 con error (sin detail) surge como invalido con ese mensaje", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { error: "Fichero demasiado grande" }));

    const { result } = renderHook(() => useUpdateResource(7), { wrapper });
    result.current.mutate({ resourceId: 1, category: "help" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as UpdateResourceError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Fichero demasiado grande");
  });

  it("400 sin detalle ni error en el cuerpo cae al mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => useUpdateResource(7), { wrapper });
    result.current.mutate({ resourceId: 1, category: "help" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as UpdateResourceError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Revisa los datos: alguno no es válido.");
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useUpdateResource(7), { wrapper });
    result.current.mutate({ resourceId: 1, title: "T" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as UpdateResourceError).kind).toBe("sin_permiso");
  });

  it("404 surge como no_encontrado", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));

    const { result } = renderHook(() => useUpdateResource(7), { wrapper });
    result.current.mutate({ resourceId: 999, title: "T" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as UpdateResourceError).kind).toBe("no_encontrado");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useUpdateResource(7), { wrapper });
    result.current.mutate({ resourceId: 1, title: "T" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as UpdateResourceError).kind).toBe("desconocido");
  });
});
