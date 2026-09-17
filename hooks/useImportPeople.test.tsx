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

import { ImportPeopleError, useImportPeople } from "./useImportPeople";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const RESULT = { created: 3, resent: 1, already_members: 1, errors: [] };

describe("useImportPeople", () => {
  it("dry_run=true manda ?dry_run=true con el fichero en un FormData", async () => {
    apiFetchMock.mockResolvedValueOnce(RESULT);
    const file = new File(["a;b"], "personas.csv", { type: "text/csv" });

    const { result } = renderHook(() => useImportPeople(7), { wrapper });
    result.current.mutate({ file, dryRun: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, options] = apiFetchMock.mock.calls[0] as [string, { method: string; body: FormData }];
    expect(url).toBe("/api/organizations/7/invitations/import/?dry_run=true");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("file")).toBe(file);
    expect(result.current.data).toEqual(RESULT);
  });

  it("dry_run=false manda ?dry_run=false", async () => {
    apiFetchMock.mockResolvedValueOnce(RESULT);
    const file = new File(["a;b"], "personas.csv", { type: "text/csv" });

    const { result } = renderHook(() => useImportPeople(7), { wrapper });
    result.current.mutate({ file, dryRun: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/organizations/7/invitations/import/?dry_run=false",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("400 con detalle surge como invalido", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "Más de 2000 filas." }));
    const file = new File(["a"], "p.csv");

    const { result } = renderHook(() => useImportPeople(7), { wrapper });
    result.current.mutate({ file, dryRun: true });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as ImportPeopleError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Más de 2000 filas.");
  });

  it("400 sin detalle cae al mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));
    const file = new File(["a"], "p.csv");

    const { result } = renderHook(() => useImportPeople(7), { wrapper });
    result.current.mutate({ file, dryRun: true });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ImportPeopleError).message).toBe(
      "Revisa el fichero: alguna fila no es válida.",
    );
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const file = new File(["a"], "p.csv");

    const { result } = renderHook(() => useImportPeople(7), { wrapper });
    result.current.mutate({ file, dryRun: true });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ImportPeopleError).kind).toBe("sin_permiso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));
    const file = new File(["a"], "p.csv");

    const { result } = renderHook(() => useImportPeople(7), { wrapper });
    result.current.mutate({ file, dryRun: true });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ImportPeopleError).kind).toBe("desconocido");
  });
});

/**
 * `lib/api/drfError.ts::detailOf`: el 400 por campo de DRF
 * (`{campo: ["mensaje"]}`) se pinta con el mensaje del backend, no con el
 * genérico del hook.
 */
describe("useImportPeople (400 por campo)", () => {
  it("muestra el mensaje del campo que el backend rechaza", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { file: ["El fichero no tiene la cabecera esperada."] }));
    const file = new File(["a;b"], "personas.csv", { type: "text/csv" });
    const { result } = renderHook(() => useImportPeople(7), { wrapper });
    result.current.mutate({ file, dryRun: true });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("El fichero no tiene la cabecera esperada.");
  });
});
