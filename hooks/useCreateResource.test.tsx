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

import { CreateResourceError, useCreateResource } from "./useCreateResource";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useCreateResource", () => {
  it("sin fichero, manda un objeto JSON plano", async () => {
    apiFetchMock.mockResolvedValueOnce(buildEntityResource());

    const { result } = renderHook(() => useCreateResource(7), { wrapper });
    result.current.mutate({
      title: "Guía de acogida",
      category: "help",
      kind: "text",
      body: "Bienvenida",
      audience: "members",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/resources/", {
      method: "POST",
      body: {
        title: "Guía de acogida",
        category: "help",
        kind: "text",
        body: "Bienvenida",
        audience: "members",
      },
    });
  });

  it("con fichero, manda un FormData con el fichero incluido", async () => {
    apiFetchMock.mockResolvedValueOnce(buildEntityResource({ kind: "pdf" }));
    const file = new File(["contenido"], "guia.pdf", { type: "application/pdf" });

    const { result } = renderHook(() => useCreateResource(7), { wrapper });
    result.current.mutate({
      title: "Guía",
      category: "help",
      kind: "pdf",
      audience: "members",
      file,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [, options] = apiFetchMock.mock.calls[0] as [string, { body: FormData }];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("file")).toBe(file);
  });

  it("400 con detalle surge como invalido (p. ej. fichero rechazado por el backend)", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { error: "Fichero demasiado grande" }));

    const { result } = renderHook(() => useCreateResource(7), { wrapper });
    result.current.mutate({ title: "T", category: "help", kind: "text", audience: "members" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as CreateResourceError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Fichero demasiado grande");
  });

  it("400 sin detalle ni error en el cuerpo cae al mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => useCreateResource(7), { wrapper });
    result.current.mutate({ title: "T", category: "help", kind: "text", audience: "members" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as CreateResourceError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Revisa los datos: alguno no es válido.");
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useCreateResource(7), { wrapper });
    result.current.mutate({ title: "T", category: "help", kind: "text", audience: "members" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as CreateResourceError).kind).toBe("sin_permiso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useCreateResource(7), { wrapper });
    result.current.mutate({ title: "T", category: "help", kind: "text", audience: "members" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as CreateResourceError).kind).toBe("desconocido");
  });
});
