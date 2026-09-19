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
import { buildReportDetail } from "@/test-utils/fixtures/report";

import {
  ReportActionError,
  useAssignReport,
  useEscalateReport,
  useResolveReport,
} from "./useReportActions";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useAssignReport", () => {
  it("llama a assign sin cuerpo", async () => {
    const detail = buildReportDetail({ assigned_to: 42 });
    apiFetchMock.mockResolvedValueOnce(detail);

    const { result } = renderHook(() => useAssignReport(), { wrapper });
    result.current.mutate("r1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/reports/r1/assign/", { method: "POST" });
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useAssignReport(), { wrapper });
    result.current.mutate("r1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ReportActionError).kind).toBe("sin_permiso");
  });
});

describe("useResolveReport", () => {
  it("manda resolution y note", async () => {
    const detail = buildReportDetail({ status: "resolved", resolution: "warned" });
    apiFetchMock.mockResolvedValueOnce(detail);

    const { result } = renderHook(() => useResolveReport(), { wrapper });
    result.current.mutate({ reportId: "r1", resolution: "warned", note: "Primer aviso" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/reports/r1/resolve/", {
      method: "POST",
      body: { resolution: "warned", note: "Primer aviso" },
    });
  });

  it("sin note no manda la clave", async () => {
    apiFetchMock.mockResolvedValueOnce(buildReportDetail());

    const { result } = renderHook(() => useResolveReport(), { wrapper });
    result.current.mutate({ reportId: "r1", resolution: "dismissed" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/reports/r1/resolve/", {
      method: "POST",
      body: { resolution: "dismissed" },
    });
  });

  it("400 (resolución inválida para el tipo) surge como invalido con el detalle", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { error: "Resolución no válida" }));

    const { result } = renderHook(() => useResolveReport(), { wrapper });
    result.current.mutate({ reportId: "r1", resolution: "user_suspended" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as ReportActionError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Resolución no válida");
    // El texto del backend queda también en `detail`, la prioridad que lee
    // `errorKindText` (`lib/i18n/errorKindText.ts`) antes que traducir por
    // `kind` — sin este campo, el aviso mostraría el genérico de la clave
    // en vez del motivo real que dio el backend.
    expect(error.detail).toBe("Resolución no válida");
  });

  it("400 sin detalle ni error en el cuerpo cae al mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => useResolveReport(), { wrapper });
    result.current.mutate({ reportId: "r1", resolution: "dismissed" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No se pudo resolver el reporte.");
  });
});

describe("useEscalateReport", () => {
  it("manda note cuando la hay", async () => {
    apiFetchMock.mockResolvedValueOnce(buildReportDetail({ escalated_at: "2026-09-02T10:00:00Z" }));

    const { result } = renderHook(() => useEscalateReport(), { wrapper });
    result.current.mutate({ reportId: "r1", note: "Requiere plataforma" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/reports/r1/escalate/", {
      method: "POST",
      body: { note: "Requiere plataforma" },
    });
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useEscalateReport(), { wrapper });
    result.current.mutate({ reportId: "r1" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ReportActionError).kind).toBe("desconocido");
  });
});

/**
 * `lib/api/drfError.ts::detailOf`: el 400 por campo de DRF
 * (`{campo: ["mensaje"]}`) se pinta con el mensaje del backend, no con el
 * genérico del hook.
 */
describe("useResolveReport (400 por campo)", () => {
  it("muestra el mensaje del campo que el backend rechaza", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { resolution: ["Esa resolución no es válida."] }));
    const { result } = renderHook(() => useResolveReport(), { wrapper });
    result.current.mutate({ reportId: "r1", resolution: "warned" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Esa resolución no es válida.");
  });
});

describe("useReportActions (contadores de Inicio)", () => {
  it("resolver un reporte refresca el contador de Inicio y las estadísticas de plataforma", async () => {
    apiFetchMock.mockResolvedValueOnce(buildReportDetail());

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // La acción no sabe de qué entidad es el reporte (la cola de
    // plataforma es global), así que la familia de contadores de Inicio
    // se invalida entera por prefijo.
    const homeKey = ["panel-home-pending-reports", 7];
    const statsKey = ["panel-dashboard-stats"];
    queryClient.setQueryData(homeKey, 2);
    queryClient.setQueryData(statsKey, { pending_reports: 2 });
    const clientWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useResolveReport(), { wrapper: clientWrapper });
    result.current.mutate({ reportId: "r1", resolution: "warned" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      expect(queryClient.getQueryState(homeKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(statsKey)?.isInvalidated).toBe(true);
    });
  });
});
