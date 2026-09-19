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
import { PANEL } from "@/lib/api/endpoints";
import { PERSON_SUPPORT_ROWS } from "@/test-utils/fixtures/support";

import { PersonSupportError, usePersonSupport } from "./usePersonSupport";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("usePersonSupport", () => {
  it("pide la ruta exacta de PANEL.PERSON_SUPPORT y devuelve las filas", async () => {
    apiFetchMock.mockResolvedValueOnce(PERSON_SUPPORT_ROWS);

    const { result } = renderHook(() => usePersonSupport(7, "42", true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(PANEL.PERSON_SUPPORT(7, "42"));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/people/42/support/");
    expect(result.current.data).toEqual(PERSON_SUPPORT_ROWS);
  });

  it("un 404 (titular/moderador que no es el referente) surge como 'sin_acceso'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, { detail: "No existe esa persona en esta entidad." }));

    const { result } = renderHook(() => usePersonSupport(7, "42", true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(PersonSupportError);
    expect((result.current.error as PersonSupportError).kind).toBe("sin_acceso");
  });

  it("un 403 (analista, fuera de ver_ficha) surge también como 'sin_acceso'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => usePersonSupport(7, "42", true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect((result.current.error as PersonSupportError).kind).toBe("sin_acceso");
  });

  it("un 500 con {detail} surge como 'desconocido' con el mensaje del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, { detail: "Algo se rompió." }));

    const { result } = renderHook(() => usePersonSupport(7, "42", true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const error = result.current.error as PersonSupportError;
    expect(error.kind).toBe("desconocido");
    expect(error.message).toBe("Algo se rompió.");
  });

  it("un 500 sin detail reconocible cae al mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, null));

    const { result } = renderHook(() => usePersonSupport(7, "42", true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const error = result.current.error as PersonSupportError;
    expect(error.kind).toBe("desconocido");
    expect(error.message).toBe("No se pudo cargar la red de apoyo de esta persona.");
  });

  it("un fallo sin detail reconocible surge como 'desconocido' con el mensaje genérico", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => usePersonSupport(7, "42", true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const error = result.current.error as PersonSupportError;
    expect(error.kind).toBe("desconocido");
    expect(error.message).toBe("No se pudo cargar la red de apoyo de esta persona.");
  });

  it("con enabled=false no dispara la petición", () => {
    const { result } = renderHook(() => usePersonSupport(7, "42", false), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("usa String(userId) en la clave de caché (mismo patrón que evita el bug de useProgram)", async () => {
    apiFetchMock.mockResolvedValue(PERSON_SUPPORT_ROWS);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result: numeric } = renderHook(() => usePersonSupport(7, "42", true), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    await waitFor(() => expect(numeric.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(["panel-person-support", 7, "42"])?.data).toEqual(
      PERSON_SUPPORT_ROWS,
    );
  });
});
