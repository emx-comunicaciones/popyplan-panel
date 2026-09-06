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
import { buildProgram } from "@/test-utils/fixtures/program";

import {
  ProgramMutationError,
  useActivateProgram,
  useCloseProgram,
  useCreateProgram,
  useUpdateProgram,
} from "./useProgramMutations";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const WRITE_FIELDS = {
  name: "Refuerzo escolar de verano",
  description: "Apoyo educativo en verano.",
  funder: "Diputación Foral de Gipuzkoa",
  starts_on: "2026-01-01",
  ends_on: "2026-06-30",
  budget_cents: 1250000,
};

describe("useCreateProgram", () => {
  it("manda POST /api/panel/entidad/{org_id}/programs/ con los campos", async () => {
    apiFetchMock.mockResolvedValueOnce(buildProgram());

    const { result } = renderHook(() => useCreateProgram(7), { wrapper });
    result.current.mutate(WRITE_FIELDS);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/programs/", {
      method: "POST",
      body: WRITE_FIELDS,
    });
  });

  it("400 con ends_on surge como invalido con el mensaje literal del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(400, { ends_on: ["La fecha de fin no puede ser anterior a la de inicio."] }),
    );

    const { result } = renderHook(() => useCreateProgram(7), { wrapper });
    result.current.mutate(WRITE_FIELDS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as ProgramMutationError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("La fecha de fin no puede ser anterior a la de inicio.");
  });

  it("400 sin cuerpo cae al mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => useCreateProgram(7), { wrapper });
    result.current.mutate(WRITE_FIELDS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as ProgramMutationError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Revisa los datos: alguno no es válido.");
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useCreateProgram(7), { wrapper });
    result.current.mutate(WRITE_FIELDS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ProgramMutationError).kind).toBe("sin_permiso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useCreateProgram(7), { wrapper });
    result.current.mutate(WRITE_FIELDS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ProgramMutationError).kind).toBe("desconocido");
  });
});

describe("useUpdateProgram", () => {
  it("manda PATCH /api/panel/entidad/{org_id}/programs/{id}/ solo con los campos tocados", async () => {
    apiFetchMock.mockResolvedValueOnce(buildProgram({ name: "Nuevo nombre" }));

    const { result } = renderHook(() => useUpdateProgram(7), { wrapper });
    result.current.mutate({ programId: 3, name: "Nuevo nombre" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/programs/3/", {
      method: "PATCH",
      body: { name: "Nuevo nombre" },
    });
  });

  it("409 (programa cerrado) surge como conflicto con el mensaje literal del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, { detail: "Un programa cerrado no se modifica." }));

    const { result } = renderHook(() => useUpdateProgram(7), { wrapper });
    result.current.mutate({ programId: 3, name: "X" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as ProgramMutationError;
    expect(error.kind).toBe("conflicto");
    expect(error.message).toBe("Un programa cerrado no se modifica.");
  });

  it("404 surge como no_encontrado", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));

    const { result } = renderHook(() => useUpdateProgram(7), { wrapper });
    result.current.mutate({ programId: 3, name: "X" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ProgramMutationError).kind).toBe("no_encontrado");
  });
});

describe("useActivateProgram", () => {
  it("manda POST .../activate/ sin cuerpo", async () => {
    apiFetchMock.mockResolvedValueOnce(buildProgram({ status: "active" }));

    const { result } = renderHook(() => useActivateProgram(7), { wrapper });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/programs/3/activate/", {
      method: "POST",
    });
  });

  it("409 (transición inválida) surge como conflicto con el mensaje del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(409, { detail: "Solo un programa en borrador puede activarse." }),
    );

    const { result } = renderHook(() => useActivateProgram(7), { wrapper });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as ProgramMutationError;
    expect(error.kind).toBe("conflicto");
    expect(error.message).toBe("Solo un programa en borrador puede activarse.");
  });

  it("409 sin detail ni campos de array cae al mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, {}));

    const { result } = renderHook(() => useActivateProgram(7), { wrapper });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as ProgramMutationError;
    expect(error.kind).toBe("conflicto");
    expect(error.message).toBe("Este programa no admite esa acción.");
  });
});

describe("useCloseProgram", () => {
  it("manda POST .../close/ con closing_notes", async () => {
    apiFetchMock.mockResolvedValueOnce(buildProgram({ status: "closed", closing_notes: "Cerrado con éxito" }));

    const { result } = renderHook(() => useCloseProgram(7), { wrapper });
    result.current.mutate({ programId: 3, closingNotes: "Cerrado con éxito" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/panel/entidad/7/programs/3/close/", {
      method: "POST",
      body: { closing_notes: "Cerrado con éxito" },
    });
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useCloseProgram(7), { wrapper });
    result.current.mutate({ programId: 3, closingNotes: "" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ProgramMutationError).kind).toBe("sin_permiso");
  });
});
