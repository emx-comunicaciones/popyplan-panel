import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetAccessTokenForTests, setAccessToken } from "@/lib/auth/tokenStore";
import { resetSessionEventsForTests } from "@/lib/auth/sessionEvents";

import { downloadExport, ExportError, useExport } from "./useExport";

const fetchMock = vi.fn();
const createObjectURLMock = vi.fn(() => "blob:mock-url");
const revokeObjectURLMock = vi.fn();

const PERIOD = { since: "2026-01-01", until: "2026-01-31" };

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
  // jsdom no implementa `URL.createObjectURL`/`revokeObjectURL` (son APIs de navegador).
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

describe("downloadExport", () => {
  it("pide el fichero con Authorization y dispara la descarga con un <a download>", async () => {
    setAccessToken("token-1");
    const blob = new Blob(["a,b\n1,2"], { type: "text/csv" });
    fetchMock.mockResolvedValueOnce(
      fakeResponse({
        ok: true,
        status: 200,
        blob,
        headers: { "Content-Disposition": 'attachment; filename="informe-enero.csv"' },
      }),
    );
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await downloadExport({ scope: "entidad", orgId: 7, period: PERIOD, format: "csv" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8001/api/panel/entidad/7/export/?format=csv&since=2026-01-01&until=2026-01-31",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-1" }),
      }),
    );
    expect(createObjectURLMock).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");

    clickSpy.mockRestore();
  });

  it("incluye group_by en la query cuando se pasa", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: true, status: 200 }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await downloadExport({
      scope: "plataforma",
      period: PERIOD,
      format: "pdf",
      groupBy: "organization",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8001/api/panel/plataforma/export/?format=pdf&since=2026-01-01&until=2026-01-31&group_by=organization",
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

    await downloadExport({ scope: "entidad", orgId: 7, period: PERIOD, format: "csv" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/session/refresh",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8001/api/panel/entidad/7/export/?format=csv&since=2026-01-01&until=2026-01-31",
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

    const error = await downloadExport({
      scope: "entidad",
      orgId: 7,
      period: PERIOD,
      format: "csv",
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ExportError);
    expect((error as ExportError).kind).toBe("sesion_caducada");
    expect((error as ExportError).message).toBe("Tu sesión ha caducado.");
  });

  it("un fallo de red (no ApiError) sube tal cual, sin envolver en ExportError", async () => {
    setAccessToken("token-1");
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const error = await downloadExport({
      scope: "entidad",
      orgId: 7,
      period: PERIOD,
      format: "csv",
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(ExportError);
  });

  it("503 (PDF no disponible) lanza ExportError con kind 'pdf_unavailable'", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse({ ok: false, status: 503, json: { detail: "WeasyPrint no disponible" } }),
    );

    const error = await downloadExport({
      scope: "paraguas",
      orgId: 3,
      period: PERIOD,
      format: "pdf",
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ExportError);
    expect((error as ExportError).kind).toBe("pdf_unavailable");
    expect((error as ExportError).message).toBe("WeasyPrint no disponible");
  });

  it("403 lanza ExportError con kind 'forbidden'", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: false, status: 403 }));

    const error = await downloadExport({
      scope: "entidad",
      orgId: 7,
      period: PERIOD,
      format: "csv",
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ExportError);
    expect((error as ExportError).kind).toBe("forbidden");
  });

  it("cualquier otro error de estado lanza ExportError con kind 'desconocido'", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: false, status: 500 }));

    const error = await downloadExport({
      scope: "entidad",
      orgId: 7,
      period: PERIOD,
      format: "csv",
    }).catch((caught) => caught);

    expect((error as ExportError).kind).toBe("desconocido");
  });

  it("entidad sin orgId lanza (error de programación)", async () => {
    await expect(
      downloadExport({ scope: "entidad", period: PERIOD, format: "csv" }),
    ).rejects.toThrow("falta orgId para el ámbito 'entidad'");
  });

  it("paraguas sin orgId lanza (error de programación)", async () => {
    await expect(
      downloadExport({ scope: "paraguas", period: PERIOD, format: "csv" }),
    ).rejects.toThrow("falta orgId para el ámbito 'paraguas'");
  });
});

describe("useExport", () => {
  it("mutate dispara downloadExport y refleja el resultado en el estado del hook", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: true, status: 200 }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const { result } = renderHook(() => useExport(), { wrapper });

    result.current.mutate({ scope: "entidad", orgId: 7, period: PERIOD, format: "csv" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    clickSpy.mockRestore();
  });

  it("mutate con 503 deja el error tipado en el estado del hook", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ ok: false, status: 503 }));

    const { result } = renderHook(() => useExport(), { wrapper });

    result.current.mutate({ scope: "entidad", orgId: 7, period: PERIOD, format: "pdf" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ExportError);
    expect((result.current.error as ExportError).kind).toBe("pdf_unavailable");
  });
});
