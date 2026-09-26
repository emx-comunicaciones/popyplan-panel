/**
 * Los seis `TRAINING.*` (Nomencladores de plataforma, catálogo de
 * entrenamiento): `TRAINING.DISCIPLINES`, `TRAINING.DISCIPLINE`,
 * `TRAINING.EXERCISES`, `TRAINING.EXERCISE`, `TRAINING.TEMPLATES` y
 * `TRAINING.TEMPLATE`. Los mocks usan la forma real del backend: los tres
 * listados **paginan** (`{count, next, previous, results}`).
 */
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
import type { TrainingDisciplineWrite, TrainingExerciseWrite, TrainingTemplateWrite } from "@/lib/api/types";

import {
  MAX_PAGES,
  TRAINING_QUERY_KEY,
  TrainingCatalogError,
  useDeleteDiscipline,
  useDeleteExercise,
  useDeleteTemplate,
  useSaveDiscipline,
  useSaveExercise,
  useSaveTemplate,
  useSystemTemplates,
  useTrainingDisciplines,
  useTrainingExercises,
} from "./useTrainingCatalog";

afterEach(() => {
  apiFetchMock.mockReset();
});

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
function freshClient() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return queryClient;
}

function page<T>(results: T[], next: string | null = null) {
  return { count: results.length, next, previous: null, results };
}

const GYM = {
  id: 1,
  code: "gym",
  name: "Gimnasio",
  name_es: "Gimnasio",
  name_eu: "Gimnasioa",
  name_ca: "Gimnàs",
  kind: "strength",
  icon: "dumbbell",
  order: 1,
  is_active: true,
};

describe("listados", () => {
  it("disciplinas: recorre todas las páginas", async () => {
    freshClient();
    apiFetchMock
      .mockResolvedValueOnce(page([GYM], "http://x/?page=2"))
      .mockResolvedValueOnce(page([{ ...GYM, id: 2, code: "running" }]));
    const { result } = renderHook(() => useTrainingDisciplines(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, "/api/training/disciplines/?page=1");
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/api/training/disciplines/?page=2");
    expect(result.current.data?.map((d) => d.code)).toEqual(["gym", "running"]);
  });

  it("ejercicios: sin disciplina pide todos; con disciplina filtra por id", async () => {
    freshClient();
    apiFetchMock.mockResolvedValue(page([]));
    const all = renderHook(() => useTrainingExercises(null), { wrapper });
    await waitFor(() => expect(all.result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/training/exercises/?page=1");
    const one = renderHook(() => useTrainingExercises(2), { wrapper });
    await waitFor(() => expect(one.result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/training/exercises/?discipline=2&page=1");
  });

  it("ejercicios: con `enabled: false` no pide nada", () => {
    freshClient();
    const { result } = renderHook(() => useTrainingExercises(null, false), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("plantillas: siempre `?scope=system` (nunca rutinas de nadie)", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce(page([{ id: 1, name: "Pierna" }]));
    const { result } = renderHook(() => useSystemTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/training/templates/?scope=system&page=1");
    expect(apiFetchMock.mock.calls.every(([url]) => !String(url).includes("scope=mine"))).toBe(true);
  });

  it("lanza en vez de truncar si se agotan las páginas", async () => {
    freshClient();
    apiFetchMock.mockResolvedValue(page([GYM], "http://x/?page=next"));
    const { result } = renderHook(() => useTrainingDisciplines(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledTimes(MAX_PAGES);
    expect(result.current.error?.kind).toBe("demasiadas_paginas");
  });

  it.each([
    [403, "sin_acceso"],
    [404, "no_encontrado"],
    [500, "desconocido"],
  ])("un %i al leer se traduce a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, {}));
    const { result } = renderHook(() => useSystemTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(TrainingCatalogError);
    expect(result.current.error?.kind).toBe(kind);
  });

  it("un error que no es de la API es desconocido", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new Error("red"));
    const { result } = renderHook(() => useTrainingDisciplines(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
    expect(result.current.error?.message).toBe("No se pudo cargar el catálogo de entrenamiento.");
  });
});

const DISCIPLINE_BODY: TrainingDisciplineWrite = {
  code: "swim",
  name: "Natación",
  name_eu: "Igeriketa",
  name_ca: "Natació",
  kind: "endurance",
  icon: "swim",
  order: 5,
  is_active: true,
};

const EXERCISE_BODY: TrainingExerciseWrite = {
  code: "plank",
  name: "Plancha",
  name_eu: "",
  name_ca: "",
  discipline_id: 1,
  muscle_group: "core",
  metric: "time",
  order: 0,
  is_active: true,
};

const TEMPLATE_BODY: TrainingTemplateWrite = {
  name: "Core",
  name_eu: "",
  name_ca: "",
  description: "",
  discipline_id: 1,
  duration_minutes: 20,
  distance_km: null,
  order: 0,
  is_active: true,
  items: [{ exercise_id: 7, sets: 3, reps: null, weight_kg: null, seconds: 45, distance_km: null }],
  system: true,
};

describe("escrituras", () => {
  it("crear disciplina: POST a la colección e invalida todo el catálogo", async () => {
    const client = freshClient();
    client.setQueryData([TRAINING_QUERY_KEY, "templates"], []);
    apiFetchMock.mockResolvedValueOnce({ id: 9 });
    const { result } = renderHook(() => useSaveDiscipline(), { wrapper });
    await result.current.mutateAsync({ id: null, body: DISCIPLINE_BODY });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/training/disciplines/", { method: "POST", body: DISCIPLINE_BODY });
    expect(client.getQueryState([TRAINING_QUERY_KEY, "templates"])?.isInvalidated).toBe(true);
  });

  it("editar ejercicio: PATCH al detalle", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce({ id: 3 });
    const { result } = renderHook(() => useSaveExercise(), { wrapper });
    await result.current.mutateAsync({ id: 3, body: EXERCISE_BODY });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/training/exercises/3/", { method: "PATCH", body: EXERCISE_BODY });
  });

  it("crear plantilla: POST con `system: true`", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce({ id: 12 });
    const { result } = renderHook(() => useSaveTemplate(), { wrapper });
    await result.current.mutateAsync({ id: null, body: TEMPLATE_BODY });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/training/templates/", { method: "POST", body: TEMPLATE_BODY });
  });

  it("un 400 conserva el detalle literal del backend", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { items: ["Cada ejercicio tiene que ser de la disciplina."] }));
    const { result } = renderHook(() => useSaveTemplate(), { wrapper });
    await expect(result.current.mutateAsync({ id: 1, body: TEMPLATE_BODY })).rejects.toMatchObject({
      kind: "invalido",
      detail: "Cada ejercicio tiene que ser de la disciplina.",
    });
  });

  it("un 400 sin detalle da el mensaje genérico", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, {}));
    const { result } = renderHook(() => useSaveDiscipline(), { wrapper });
    await expect(result.current.mutateAsync({ id: 1, body: DISCIPLINE_BODY })).rejects.toMatchObject({
      kind: "invalido",
      message: "Revisa los datos.",
      detail: undefined,
    });
  });

  it("un 403 es sin_acceso, con el detalle del backend si lo trae", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, { detail: "Solo la plataforma crea plantillas de Popyplan." }));
    const { result } = renderHook(() => useSaveTemplate(), { wrapper });
    await expect(result.current.mutateAsync({ id: null, body: TEMPLATE_BODY })).rejects.toMatchObject({
      kind: "sin_acceso",
      detail: "Solo la plataforma crea plantillas de Popyplan.",
    });
  });

  it("borrar disciplina en uso: 409 → en_uso con el mensaje literal", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(409, { detail: "Está en uso y no se puede borrar; desactívalo en su lugar." }),
    );
    const { result } = renderHook(() => useDeleteDiscipline(), { wrapper });
    await expect(result.current.mutateAsync(1)).rejects.toMatchObject({
      kind: "en_uso",
      detail: "Está en uso y no se puede borrar; desactívalo en su lugar.",
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/training/disciplines/1/", { method: "DELETE" });
  });

  it("un 409 sin detalle da el mensaje genérico", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, {}));
    const { result } = renderHook(() => useDeleteDiscipline(), { wrapper });
    await expect(result.current.mutateAsync(1)).rejects.toMatchObject({
      kind: "en_uso",
      message: "Está en uso y no se puede borrar.",
    });
  });

  it("borrar ejercicio y plantilla: DELETE al detalle e invalida", async () => {
    const client = freshClient();
    client.setQueryData([TRAINING_QUERY_KEY, "exercises", "all"], []);
    apiFetchMock.mockResolvedValue(undefined);
    const exercise = renderHook(() => useDeleteExercise(), { wrapper });
    await exercise.result.current.mutateAsync(4);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/training/exercises/4/", { method: "DELETE" });
    expect(client.getQueryState([TRAINING_QUERY_KEY, "exercises", "all"])?.isInvalidated).toBe(true);
    const template = renderHook(() => useDeleteTemplate(), { wrapper });
    await template.result.current.mutateAsync(5);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/training/templates/5/", { method: "DELETE" });
  });

  it("un fallo de red al borrar es desconocido", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new Error("red"));
    const { result } = renderHook(() => useDeleteTemplate(), { wrapper });
    await expect(result.current.mutateAsync(5)).rejects.toMatchObject({
      kind: "desconocido",
      message: "No se pudo borrar.",
    });
  });

  it("un fallo de red al guardar es desconocido", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new Error("red"));
    const { result } = renderHook(() => useSaveExercise(), { wrapper });
    await expect(result.current.mutateAsync({ id: null, body: EXERCISE_BODY })).rejects.toMatchObject({
      kind: "desconocido",
      message: "No se pudo guardar.",
    });
  });
});
