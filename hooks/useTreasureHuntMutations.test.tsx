/**
 * Escrituras de la búsqueda del tesoro. Las invalidaciones se comprueban
 * con `getQueryState(...).isInvalidated` sobre claves reales (la única
 * forma de atrapar el fallo string↔number que CLAUDE.md documenta).
 *
 * Endpoints cubiertos aquí y en `useTreasureHunt.test.tsx`:
 * `TREASURE_HUNT.LIST`, `TREASURE_HUNT.DETAIL`, `TREASURE_HUNT.OPEN`,
 * `TREASURE_HUNT.START`, `TREASURE_HUNT.FINISH`, `TREASURE_HUNT.STEPS_LIST`,
 * `TREASURE_HUNT.STEPS`, `TREASURE_HUNT.STEP`, `TREASURE_HUNT.PRIZE_TIERS`,
 * `TREASURE_HUNT.PRIZE_TIER`, `TREASURE_HUNT.PARTICIPANTS`,
 * `TREASURE_HUNT.PARTICIPANT_APPROVE`, `TREASURE_HUNT.PARTICIPANT_REJECT`,
 * `TREASURE_HUNT.RANKING`, `TREASURE_HUNT.COMPLETIONS`,
 * `TREASURE_HUNT.COMPLETION_VALIDATE`.
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
import { GAME_ID, buildTreasureGame, buildTreasureGameDetail } from "@/test-utils/fixtures/treasureHunt";

import {
  buildGamePayload,
  useCreateTreasureGame,
  useDecideTreasureParticipant,
  useDeleteTreasureGame,
  useDeleteTreasurePrizeTier,
  useDeleteTreasureStep,
  useSaveTreasurePrizeTier,
  useSaveTreasureStep,
  useTreasureLifecycle,
  useUpdateTreasureGame,
  useValidateTreasureCompletion,
} from "./useTreasureHuntMutations";

afterEach(() => {
  apiFetchMock.mockReset();
});

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function seeded() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  for (const key of [
    ["panel-treasure-games"],
    ["panel-treasure-game", GAME_ID],
    ["panel-treasure-steps", GAME_ID],
    ["panel-treasure-prize-tiers", GAME_ID],
    ["panel-treasure-participants", GAME_ID, ""],
    ["panel-treasure-participants", GAME_ID, "pending"],
    ["panel-treasure-completions", GAME_ID],
    ["panel-treasure-ranking", GAME_ID],
  ]) {
    client.setQueryData(key, []);
  }
  return client;
}
const invalidated = (key: unknown[]) => client.getQueryState(key)?.isInvalidated;

const INPUT = {
  name: "Juego",
  description: "d",
  city: "Donostia",
  prize_description: "p",
  start_time: "2030-10-10T10:00:00.000Z",
  duration_minutes: 90,
  game_mode: "individual" as const,
  max_participants: null,
  is_featured: false,
};

describe("buildGamePayload", () => {
  it("sin imagen devuelve el JSON tal cual", () => {
    expect(buildGamePayload(INPUT)).toBe(INPUT);
  });

  it("con imagen monta un FormData con el resto como cadenas y null como vacío", () => {
    const image = new File(["x"], "foto.png", { type: "image/png" });
    const body = buildGamePayload({ ...INPUT, image, description: undefined });
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get("max_participants")).toBe("");
    expect(form.get("is_featured")).toBe("false");
    expect(form.get("duration_minutes")).toBe("90");
    expect(form.has("description")).toBe(false);
    expect(form.get("image")).toBe(image);
  });
});

describe("juego", () => {
  it("crea e invalida el listado", async () => {
    seeded();
    apiFetchMock.mockResolvedValueOnce(buildTreasureGame());
    const { result } = renderHook(() => useCreateTreasureGame(), { wrapper });
    result.current.mutate(INPUT);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/treasure-hunt/", { method: "POST", body: INPUT });
    expect(invalidated(["panel-treasure-games"])).toBe(true);
  });

  it("un 400 al crear lleva el texto del backend", async () => {
    seeded();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { non_field_errors: ["La hora de inicio debe ser futura."] }));
    const { result } = renderHook(() => useCreateTreasureGame(), { wrapper });
    result.current.mutate(INPUT);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.detail).toBe("La hora de inicio debe ser futura.");
  });

  it("edita, escribe el detalle en caché e invalida ficha y listado", async () => {
    seeded();
    const detail = buildTreasureGameDetail({ name: "Nuevo" });
    apiFetchMock.mockResolvedValueOnce(detail);
    const { result } = renderHook(() => useUpdateTreasureGame(GAME_ID), { wrapper });
    result.current.mutate({ name: "Nuevo" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/treasure-hunt/${GAME_ID}/`, { method: "PATCH", body: { name: "Nuevo" } });
    expect(client.getQueryData(["panel-treasure-game", GAME_ID])).toEqual(detail);
    expect(invalidated(["panel-treasure-games"])).toBe(true);
  });

  it("un fallo al editar se traduce", async () => {
    seeded();
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, null));
    const { result } = renderHook(() => useUpdateTreasureGame(GAME_ID), { wrapper });
    result.current.mutate({ name: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No se pudo guardar el juego.");
  });

  it("borra, invalida el listado y retira la ficha", async () => {
    seeded();
    apiFetchMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDeleteTreasureGame(), { wrapper });
    result.current.mutate(GAME_ID);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/treasure-hunt/${GAME_ID}/`, { method: "DELETE" });
    expect(invalidated(["panel-treasure-games"])).toBe(true);
    expect(client.getQueryState(["panel-treasure-game", GAME_ID])).toBeUndefined();
  });

  it("un fallo al borrar se traduce", async () => {
    seeded();
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const { result } = renderHook(() => useDeleteTreasureGame(), { wrapper });
    result.current.mutate(GAME_ID);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("sin_acceso");
  });

  it.each([
    ["open", "open"],
    ["start", "start"],
    ["finish", "finish"],
  ] as const)("ciclo de vida %s", async (action, path) => {
    seeded();
    apiFetchMock.mockResolvedValueOnce({ detail: "ok" });
    const { result } = renderHook(() => useTreasureLifecycle(GAME_ID), { wrapper });
    result.current.mutate(action);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/treasure-hunt/${GAME_ID}/${path}/`, { method: "POST" });
    expect(invalidated(["panel-treasure-game", GAME_ID])).toBe(true);
    expect(invalidated(["panel-treasure-participants", GAME_ID, "pending"])).toBe(true);
    expect(invalidated(["panel-treasure-ranking", GAME_ID])).toBe(true);
  });

  it("un 400 del ciclo de vida lleva el detail", async () => {
    seeded();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "El juego no tiene pasos definidos." }));
    const { result } = renderHook(() => useTreasureLifecycle(GAME_ID), { wrapper });
    result.current.mutate("start");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.detail).toBe("El juego no tiene pasos definidos.");
  });
});

describe("pruebas", () => {
  it("alta por POST y edición por PATCH, invalidando pruebas, ficha y listado", async () => {
    seeded();
    apiFetchMock.mockResolvedValue({ id: "s1" });
    const { result } = renderHook(() => useSaveTreasureStep(GAME_ID), { wrapper });
    result.current.mutate({ input: { order: 1, clue: "c", challenge_type: "photo" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/treasure-hunt/${GAME_ID}/steps/`, {
      method: "POST",
      body: { order: 1, clue: "c", challenge_type: "photo" },
    });
    expect(invalidated(["panel-treasure-steps", GAME_ID])).toBe(true);
    expect(invalidated(["panel-treasure-games"])).toBe(true);

    result.current.mutate({ stepId: "s1", input: { clue: "otra" } });
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(`/api/treasure-hunt/${GAME_ID}/steps/s1/`, { method: "PATCH", body: { clue: "otra" } }),
    );
  });

  it("un fallo al guardar se traduce y borrar llama a DELETE", async () => {
    seeded();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { non_field_errors: ["Las pruebas de geolocalización requieren latitud y longitud."] }));
    const save = renderHook(() => useSaveTreasureStep(GAME_ID), { wrapper });
    save.result.current.mutate({ input: { challenge_type: "location" } });
    await waitFor(() => expect(save.result.current.isError).toBe(true));
    expect(save.result.current.error?.detail).toBe("Las pruebas de geolocalización requieren latitud y longitud.");

    apiFetchMock.mockResolvedValueOnce(undefined);
    const remove = renderHook(() => useDeleteTreasureStep(GAME_ID), { wrapper });
    remove.result.current.mutate("s1");
    await waitFor(() => expect(remove.result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenLastCalledWith(`/api/treasure-hunt/${GAME_ID}/steps/s1/`, { method: "DELETE" });
    expect(invalidated(["panel-treasure-steps", GAME_ID])).toBe(true);

    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));
    remove.result.current.mutate("s2");
    await waitFor(() => expect(remove.result.current.isError).toBe(true));
    expect(remove.result.current.error?.kind).toBe("no_encontrado");
  });
});

describe("premios", () => {
  const TIER = { rank_from: 1, rank_to: 3, tier_name: "Podio", description: "" };

  it("alta, edición y borrado", async () => {
    seeded();
    apiFetchMock.mockResolvedValue({ id: "t1", ...TIER });
    const save = renderHook(() => useSaveTreasurePrizeTier(GAME_ID), { wrapper });
    save.result.current.mutate({ input: TIER });
    await waitFor(() => expect(save.result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/treasure-hunt/${GAME_ID}/prize-tiers/`, { method: "POST", body: TIER });
    expect(invalidated(["panel-treasure-prize-tiers", GAME_ID])).toBe(true);

    save.result.current.mutate({ tierId: "t1", input: TIER });
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(`/api/treasure-hunt/${GAME_ID}/prize-tiers/t1/`, { method: "PATCH", body: TIER }),
    );

    apiFetchMock.mockResolvedValueOnce(undefined);
    const remove = renderHook(() => useDeleteTreasurePrizeTier(GAME_ID), { wrapper });
    remove.result.current.mutate("t1");
    await waitFor(() => expect(remove.result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenLastCalledWith(`/api/treasure-hunt/${GAME_ID}/prize-tiers/t1/`, { method: "DELETE" });
  });

  it("errores de guardar y borrar", async () => {
    seeded();
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(400, { non_field_errors: ["El rango de posiciones se solapa con un tramo de premio existente."] }),
    );
    const save = renderHook(() => useSaveTreasurePrizeTier(GAME_ID), { wrapper });
    save.result.current.mutate({ input: TIER });
    await waitFor(() => expect(save.result.current.isError).toBe(true));
    expect(save.result.current.error?.detail).toBe("El rango de posiciones se solapa con un tramo de premio existente.");

    apiFetchMock.mockRejectedValueOnce(new ApiError(500, null));
    const remove = renderHook(() => useDeleteTreasurePrizeTier(GAME_ID), { wrapper });
    remove.result.current.mutate("t1");
    await waitFor(() => expect(remove.result.current.isError).toBe(true));
    expect(remove.result.current.error?.message).toBe("No se pudo borrar el premio.");
  });
});

describe("participantes y validaciones", () => {
  it("aprueba y rechaza por su ruta, invalidando todas las listas de participantes", async () => {
    seeded();
    apiFetchMock.mockResolvedValue({ detail: "ok" });
    const { result } = renderHook(() => useDecideTreasureParticipant(GAME_ID), { wrapper });
    result.current.mutate({ participantId: 7, approve: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/treasure-hunt/${GAME_ID}/participants/7/approve/`, { method: "POST" });
    expect(invalidated(["panel-treasure-participants", GAME_ID, ""])).toBe(true);
    expect(invalidated(["panel-treasure-participants", GAME_ID, "pending"])).toBe(true);

    result.current.mutate({ participantId: 7, approve: false });
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(`/api/treasure-hunt/${GAME_ID}/participants/7/reject/`, { method: "POST" }),
    );
  });

  it("un 400 al decidir lleva el detail", async () => {
    seeded();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "Este participante no tiene una solicitud pendiente." }));
    const { result } = renderHook(() => useDecideTreasureParticipant(GAME_ID), { wrapper });
    result.current.mutate({ participantId: 7, approve: true });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.detail).toBe("Este participante no tiene una solicitud pendiente.");
  });

  it("valida un envío e invalida envíos y ranking; traduce su error", async () => {
    seeded();
    apiFetchMock.mockResolvedValueOnce({ is_valid: true, points_earned: 20 });
    const { result } = renderHook(() => useValidateTreasureCompletion(GAME_ID), { wrapper });
    result.current.mutate({ completionId: "c1", input: { is_valid: true, points_override: 20 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/treasure-hunt/${GAME_ID}/completions/c1/validate/`, {
      method: "POST",
      body: { is_valid: true, points_override: 20 },
    });
    expect(invalidated(["panel-treasure-completions", GAME_ID])).toBe(true);
    expect(invalidated(["panel-treasure-ranking", GAME_ID])).toBe(true);

    apiFetchMock.mockRejectedValueOnce(new ApiError(404, { detail: "Envío no encontrado o ya validado." }));
    result.current.mutate({ completionId: "c2", input: { is_valid: false } });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("no_encontrado");
    expect(result.current.error?.detail).toBe("Envío no encontrado o ya validado.");
  });
});
