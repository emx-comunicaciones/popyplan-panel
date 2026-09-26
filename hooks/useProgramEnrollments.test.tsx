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
import { TRACKING } from "@/lib/api/endpoints";
import { buildEnrollment } from "@/test-utils/fixtures/tracking";

import {
  EnrollmentMutationError,
  EnrollmentsError,
  useCloseEnrollment,
  useCreateEnrollment,
  useEnrollments,
  useUpdateEnrollment,
} from "./useProgramEnrollments";

afterEach(() => {
  apiFetchMock.mockReset();
});

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper };
}

describe("useEnrollments", () => {
  it("pide el array plano de TRACKING.ENROLLMENTS sin filtros", async () => {
    const rows = [buildEnrollment()];
    apiFetchMock.mockResolvedValueOnce(rows);
    const { wrapper } = setup();

    const { result } = renderHook(() => useEnrollments(96), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(TRACKING.ENROLLMENTS(96));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/96/program/enrollments/");
    expect(result.current.data).toEqual(rows);
  });

  it("añade ?status= y ?user= cuando se filtran", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    const { wrapper } = setup();

    const { result } = renderHook(() => useEnrollments(96, { status: "pending", user: "13" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/96/program/enrollments/?status=pending&user=13");
  });

  it("no pide nada con enabled=false", () => {
    const { wrapper } = setup();
    renderHook(() => useEnrollments(96, {}, false), { wrapper });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it.each([403, 404])("un %i (sin gestionar_seguimiento o servicio apagado) es 'sin_acceso'", async (status) => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, { detail: "No encontrado." }));
    const { wrapper } = setup();

    const { result } = renderHook(() => useEnrollments(96), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(EnrollmentsError);
    expect(result.current.error?.kind).toBe("sin_acceso");
  });

  it("cualquier otro fallo es 'desconocido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, null));
    const { wrapper } = setup();

    const { result } = renderHook(() => useEnrollments(96), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.kind).toBe("desconocido");
    expect(result.current.error?.message).toBe("No se pudieron cargar las inscripciones del programa.");
  });
});

describe("useCreateEnrollment", () => {
  it("manda POST con el cuerpo e invalida el listado (clave normalizada a string)", async () => {
    apiFetchMock.mockResolvedValueOnce([]);
    const { queryClient, wrapper } = setup();
    const list = renderHook(() => useEnrollments("96", { user: 13 }), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));

    apiFetchMock.mockResolvedValueOnce(buildEnrollment());
    const { result } = renderHook(() => useCreateEnrollment(96), { wrapper });
    const input = { user_id: 13, tracking_type: "alcohol" as const, referent: 190 };
    result.current.mutate(input);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(TRACKING.ENROLLMENTS(96), { method: "POST", body: input });
    expect(
      queryClient.getQueryState(["panel-program-enrollments", "96", { status: "", user: "13" }])?.isInvalidated,
    ).toBe(true);
  });

  it("400 con error de campo trae el texto literal del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { tracking_label: ["Describe the tracking type."] }));
    const { wrapper } = setup();

    const { result } = renderHook(() => useCreateEnrollment(96), { wrapper });
    result.current.mutate({ user_id: 13, tracking_type: "other" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const error = result.current.error as EnrollmentMutationError;
    expect(error.kind).toBe("invalido");
    expect(error.detail).toBe("Describe the tracking type.");
  });

  it("400 sin cuerpo cae al mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));
    const { wrapper } = setup();

    const { result } = renderHook(() => useCreateEnrollment(96), { wrapper });
    result.current.mutate({ user_id: 13, tracking_type: "alcohol" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Revisa los datos: alguno no es válido.");
    expect(result.current.error?.detail).toBeUndefined();
  });

  it("409 (ya tiene una abierta) es 'conflicto' con el detail del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, { detail: "Ya tiene una inscripción abierta." }));
    const { wrapper } = setup();

    const { result } = renderHook(() => useCreateEnrollment(96), { wrapper });
    result.current.mutate({ user_id: 13, tracking_type: "alcohol" });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.kind).toBe("conflicto");
    expect(result.current.error?.detail).toBe("Ya tiene una inscripción abierta.");
  });

  it("409 sin detail cae al mensaje por defecto; 404 es 'no_encontrado'; 500 'desconocido'", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateEnrollment(96), { wrapper });

    apiFetchMock.mockRejectedValueOnce(new ApiError(409, null));
    result.current.mutate({ user_id: 13, tracking_type: "alcohol" });
    await waitFor(() => expect(result.current.error?.kind).toBe("conflicto"));
    expect(result.current.error?.message).toBe("Esta inscripción no admite esa acción.");

    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));
    result.current.mutate({ user_id: 13, tracking_type: "alcohol" });
    await waitFor(() => expect(result.current.error?.kind).toBe("no_encontrado"));

    apiFetchMock.mockRejectedValueOnce(new Error("red"));
    result.current.mutate({ user_id: 13, tracking_type: "alcohol" });
    await waitFor(() => expect(result.current.error?.kind).toBe("desconocido"));
    expect(result.current.error?.message).toBe("No se pudo dar de alta en el programa.");
  });
});

describe("useUpdateEnrollment / useCloseEnrollment", () => {
  it("PATCH solo con los cambios", async () => {
    apiFetchMock.mockResolvedValueOnce(buildEnrollment({ referent: null }));
    const { wrapper } = setup();

    const { result } = renderHook(() => useUpdateEnrollment(96), { wrapper });
    result.current.mutate({ enrollmentId: 1, changes: { referent: null } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/96/program/enrollments/1/", {
      method: "PATCH",
      body: { referent: null },
    });
  });

  it("un fallo de red al editar es 'desconocido'", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red"));
    const { wrapper } = setup();

    const { result } = renderHook(() => useUpdateEnrollment(96), { wrapper });
    result.current.mutate({ enrollmentId: 1, changes: {} });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No se pudo guardar la inscripción.");
  });

  it("POST a close/ y 409 literal si ya no estaba abierta", async () => {
    apiFetchMock.mockResolvedValueOnce(buildEnrollment({ status: "closed" }));
    const { wrapper } = setup();

    const { result } = renderHook(() => useCloseEnrollment(96), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(TRACKING.ENROLLMENT_CLOSE(96, 1), { method: "POST" });
    expect(TRACKING.ENROLLMENT(96, 1)).toBe("/api/panel/entidad/96/program/enrollments/1/");

    apiFetchMock.mockRejectedValueOnce(new ApiError(409, { detail: "La inscripción ya no está abierta." }));
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.detail).toBe("La inscripción ya no está abierta.");

    apiFetchMock.mockRejectedValueOnce(new Error("red"));
    result.current.mutate(1);
    await waitFor(() => expect(result.current.error?.kind).toBe("desconocido"));
    expect(result.current.error?.message).toBe("No se pudo dar de baja del programa.");
  });
});
