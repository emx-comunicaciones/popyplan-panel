import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetAccessTokenForTests, setAccessToken } from "@/lib/auth/tokenStore";
import { resetSessionEventsForTests } from "@/lib/auth/sessionEvents";

import { downloadProgramReport, ProgramReportError, useProgramReport } from "./useProgramReport";

const fetchMock = vi.fn();
const createObjectURLMock = vi.fn(() => "blob:mock-url");
const revokeObjectURLMock = vi.fn();

function fakeResponse(options: {
  ok: boolean;
  status: number;
  json?: unknown;
  blob?: Blob;
  headers?: Record<string, string>;
}): Response {
  const headerMap = new Map(Object.entries(options.headers ?? {}));
  return {
    ok: options.ok,
    status: options.status,
    json: async () => {
      if (options.json === undefined) throw new Error("sin cuerpo JSON");
      return options.json;
    },
    // `fetchWithAuth` parsea los errores con `response.text()`, no con `json()`.
    text: async () => (options.json === undefined ? "" : JSON.stringify(options.json)),
    blob: async () => options.blob ?? new Blob(["contenido"]),
    headers: { get: (name: string) => headerMap.get(name) ?? null },
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("URL", Object.assign(URL, {
    createObjectURL: createObjectURLMock,
    revokeObjectURL: revokeObjectURLMock,
  }));
});

afterEach(() => {
  fetchMock.mockReset();
  createObjectURLMock.mockClear();
  revokeObjectURLMock.mockClear();
  vi.unstubAllGlobals();
  resetAccessTokenForTests();
  resetSessionEventsForTests();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("downloadProgramReport", () => {
  it("pide el fichero con Authorization y dispara la descarga con un <a download>", async () => {
    setAccessToken("token-1");
    const blob = new Blob(["a,b\n1,2"], { type: "text/csv" });
    fetchMock.mockResolvedValueOnce(
      fakeResponse({
        ok: true,
        status: 200,
        blob,
        headers: { "Content-Disposition": 'attachment; filename="popyplan-programa-3.csv"' },
      }),
    );
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await downloadProgramReport({ orgId: 7, programId: 3, format: "csv" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8001/api/panel/entidad/7/programs/3/report/?format=csv",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-1" }),
      }),
    );
    expect(createObjectURLMock).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    // `triggerDownload` libera la URL del blob en el siguiente turno, no
    // en la misma vuelta (revocarla antes cancela la descarga).
    await waitFor(() => expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url"));

    clickSpy.mockRestore();
  });

  it("sin Content-Disposition, cae al nombre por defecto", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: true, status: 200 }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await downloadProgramReport({ orgId: 7, programId: 3, format: "pdf" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8001/api/panel/entidad/7/programs/3/report/?format=pdf",
      expect.anything(),
    );

    clickSpy.mockRestore();
  });

  it("con access caducado (401) refresca la sesión y reintenta la descarga", async () => {
    setAccessToken("token-caducado");
    const blob = new Blob(["a,b\n1,2"], { type: "text/csv" });
    fetchMock
      // 1) la descarga llega con el access caducado;
      .mockResolvedValueOnce(fakeResponse({ ok: false, status: 401 }))
      // 2) `/api/session/refresh` rota la sesión y devuelve un access nuevo;
      .mockResolvedValueOnce(fakeResponse({ ok: true, status: 200, json: { accessToken: "token-2" } }))
      // 3) reintento de la descarga con el access nuevo.
      .mockResolvedValueOnce(fakeResponse({ ok: true, status: 200, blob }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await downloadProgramReport({ orgId: 7, programId: 3, format: "csv" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/session/refresh",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8001/api/panel/entidad/7/programs/3/report/?format=csv",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-2" }),
      }),
    );
    expect(createObjectURLMock).toHaveBeenCalledWith(blob);

    clickSpy.mockRestore();
  });

  it("si el refresco también falla (401), el error avisa de sesión caducada", async () => {
    setAccessToken("token-caducado");
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ ok: false, status: 401 }))
      .mockResolvedValueOnce(fakeResponse({ ok: false, status: 401 }));

    const error = await downloadProgramReport({ orgId: 7, programId: 3, format: "csv" }).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(ProgramReportError);
    expect((error as ProgramReportError).kind).toBe("sesion_caducada");
    expect((error as ProgramReportError).message).toBe("Tu sesión ha caducado.");
    // El cuerpo de este 401 es siempre `null` (`requestWithAuth`), así que
    // `detailOf` nunca encuentra nada aquí en la práctica — `errorKindText`
    // cae entonces a la traducción fija por `kind`, que dice lo mismo.
    expect((error as ProgramReportError).detail).toBeUndefined();
  });

  it("un fallo de red (no ApiError) sube tal cual, sin envolver en ProgramReportError", async () => {
    setAccessToken("token-1");
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const error = await downloadProgramReport({ orgId: 7, programId: 3, format: "csv" }).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(ProgramReportError);
  });

  it("503 (PDF no disponible) lanza ProgramReportError con kind 'pdf_unavailable'", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({ ok: false, status: 503, json: { detail: "Exportación PDF no disponible en este entorno." } }),
    );

    const error = await downloadProgramReport({ orgId: 7, programId: 3, format: "pdf" }).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(ProgramReportError);
    expect((error as ProgramReportError).kind).toBe("pdf_unavailable");
    expect((error as ProgramReportError).message).toBe("Exportación PDF no disponible en este entorno.");
    // `detail` es lo que `errorKindText` (`lib/i18n/errorKindText.ts`)
    // prioriza sobre la traducción por `kind` en `ProgramaDetalle.tsx` —
    // sin él, el aviso mostraría el genérico de la clave en cualquier
    // idioma en vez del motivo real que dio el backend.
    expect((error as ProgramReportError).detail).toBe("Exportación PDF no disponible en este entorno.");
  });

  it("503 sin detalle en el cuerpo cae al mensaje genérico, sin `detail`", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: false, status: 503 }));

    const error = await downloadProgramReport({ orgId: 7, programId: 3, format: "pdf" }).catch(
      (caught) => caught,
    );

    expect((error as ProgramReportError).message).toBe("El informe en PDF no está disponible ahora mismo.");
    expect((error as ProgramReportError).detail).toBeUndefined();
  });

  it("403 lanza ProgramReportError con kind 'forbidden'", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: false, status: 403 }));

    const error = await downloadProgramReport({ orgId: 7, programId: 3, format: "csv" }).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(ProgramReportError);
    expect((error as ProgramReportError).kind).toBe("forbidden");
  });

  it("cualquier otro error de estado lanza ProgramReportError con kind 'desconocido'", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: false, status: 500 }));

    const error = await downloadProgramReport({ orgId: 7, programId: 3, format: "csv" }).catch(
      (caught) => caught,
    );

    expect((error as ProgramReportError).kind).toBe("desconocido");
  });
});

describe("useProgramReport", () => {
  it("mutate dispara downloadProgramReport y refleja el resultado en el estado del hook", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: true, status: 200 }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const { result } = renderHook(() => useProgramReport(), { wrapper });

    result.current.mutate({ orgId: 7, programId: 3, format: "csv" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    clickSpy.mockRestore();
  });

  it("mutate con 503 deja el error tipado en el estado del hook", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: false, status: 503 }));

    const { result } = renderHook(() => useProgramReport(), { wrapper });

    result.current.mutate({ orgId: 7, programId: 3, format: "pdf" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProgramReportError);
    expect((result.current.error as ProgramReportError).kind).toBe("pdf_unavailable");
  });
});
