/**
 * Lecturas de la búsqueda del tesoro (`TREASURE_HUNT.*`). Todas son arrays
 * planos de verdad (`pagination_class = None`): los mocks usan esa forma.
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
import {
  GAME_ID,
  buildTreasureCompletion,
  buildTreasureGame,
  buildTreasureGameDetail,
  buildTreasureParticipant,
  buildTreasurePrizeTier,
  buildTreasureRankingRow,
  buildTreasureStep,
} from "@/test-utils/fixtures/treasureHunt";

import {
  TreasureHuntError,
  toTreasureHuntError,
  useTreasureCompletions,
  useTreasureGame,
  useTreasureGames,
  useTreasureParticipants,
  useTreasurePrizeTiers,
  useTreasureRanking,
  useTreasureSteps,
} from "./useTreasureHunt";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("toTreasureHuntError", () => {
  it("400 conserva el detail literal del backend", () => {
    const error = toTreasureHuntError(new ApiError(400, { is_paid: ["Los juegos de pago llegarán más adelante."] }), "x");
    expect(error.kind).toBe("invalido");
    expect(error.detail).toBe("Los juegos de pago llegarán más adelante.");
  });

  it("400 sin mensaje cae al genérico, sin detail", () => {
    const error = toTreasureHuntError(new ApiError(400, null), "x");
    expect(error.detail).toBeUndefined();
    expect(error.message).toBe("Revisa los datos.");
  });

  it.each([
    [403, "sin_acceso"],
    [404, "no_encontrado"],
    [500, "desconocido"],
  ])("traduce un %s a %s", (status, kind) => {
    expect(toTreasureHuntError(new ApiError(status, null), "fallo").kind).toBe(kind);
  });

  it("un fallo que no es de la API es desconocido con el mensaje de repuesto", () => {
    const error = toTreasureHuntError(new Error("red"), "No se pudo.");
    expect(error).toBeInstanceOf(TreasureHuntError);
    expect(error.kind).toBe("desconocido");
    expect(error.message).toBe("No se pudo.");
  });
});

describe("lecturas", () => {
  it("useTreasureGames pide el listado y traduce el error", async () => {
    apiFetchMock.mockResolvedValueOnce([buildTreasureGame()]);
    const { result } = renderHook(() => useTreasureGames(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/treasure-hunt/");

    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));
    const failing = renderHook(() => useTreasureGames(), { wrapper });
    await waitFor(() => expect(failing.result.current.isError).toBe(true));
    expect(failing.result.current.error?.kind).toBe("sin_acceso");
  });

  it("useTreasureGame pide el detalle y traduce el 404", async () => {
    apiFetchMock.mockResolvedValueOnce(buildTreasureGameDetail());
    const { result } = renderHook(() => useTreasureGame(GAME_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(`/api/treasure-hunt/${GAME_ID}/`);

    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));
    const other = renderHook(() => useTreasureGame("otro"), { wrapper });
    await waitFor(() => expect(other.result.current.isError).toBe(true));
    expect(other.result.current.error?.kind).toBe("no_encontrado");
  });

  it.each([
    ["steps", () => useTreasureSteps(GAME_ID), `/api/treasure-hunt/${GAME_ID}/steps/list/`, buildTreasureStep()],
    ["prize-tiers", () => useTreasurePrizeTiers(GAME_ID), `/api/treasure-hunt/${GAME_ID}/prize-tiers/`, buildTreasurePrizeTier()],
    ["completions", () => useTreasureCompletions(GAME_ID), `/api/treasure-hunt/${GAME_ID}/completions/`, buildTreasureCompletion()],
    ["ranking", () => useTreasureRanking(GAME_ID), `/api/treasure-hunt/${GAME_ID}/ranking/`, buildTreasureRankingRow()],
    ["participants", () => useTreasureParticipants(GAME_ID, ""), `/api/treasure-hunt/${GAME_ID}/participants/`, buildTreasureParticipant()],
    [
      "participants pending",
      () => useTreasureParticipants(GAME_ID, "pending"),
      `/api/treasure-hunt/${GAME_ID}/participants/?status=pending`,
      buildTreasureParticipant(),
    ],
  ] as [string, () => { isSuccess: boolean; data?: unknown }, string, unknown][])("%s pide su ruta", async (_name, hook, path, row) => {
    apiFetchMock.mockResolvedValueOnce([row]);
    const { result } = renderHook(hook, { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(path);
    expect(result.current.data).toEqual([row]);
  });

  it("una lista traduce su error", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, null));
    const { result } = renderHook(() => useTreasureSteps(GAME_ID), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
    expect(result.current.error?.message).toBe("No se pudieron cargar las pruebas.");
  });
});
