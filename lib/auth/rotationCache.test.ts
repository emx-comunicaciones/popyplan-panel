import { afterEach, describe, expect, it, vi } from "vitest";

import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import {
  clearRecentRotations,
  recallRotation,
  rememberRotation,
  ROTATION_REPLAY_TTL_MS,
  type RotatedResult,
} from "./rotationCache";

function okResult(refresh: string): RotatedResult {
  return {
    kind: "ok",
    refresh,
    access: `access-de-${refresh}`,
    user: buildMe(),
    platformRole: buildPlatformRole(null),
  };
}

afterEach(() => {
  clearRecentRotations();
  vi.restoreAllMocks();
});

describe("rotationCache", () => {
  it("repite el resultado de una rotación reciente", () => {
    const result = okResult("r2");
    rememberRotation("r1", result);

    expect(recallRotation("r1")).toBe(result);
  });

  it("no devuelve nada para un refresh que nadie rotó", () => {
    expect(recallRotation("desconocido")).toBeNull();
  });

  it("olvida la rotación pasado el TTL", () => {
    const start = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(start);
    rememberRotation("r1", okResult("r2"));

    vi.spyOn(Date, "now").mockReturnValue(start + ROTATION_REPLAY_TTL_MS + 1);

    expect(recallRotation("r1")).toBeNull();
  });

  it("purga lo caducado al guardar, no solo al consultar (el mapa no crece sin límite)", () => {
    const start = Date.now();
    const now = vi.spyOn(Date, "now").mockReturnValue(start);
    rememberRotation("viejo-1", okResult("r2"));
    rememberRotation("viejo-2", okResult("r3"));

    now.mockReturnValue(start + ROTATION_REPLAY_TTL_MS + 1);
    rememberRotation("nuevo", okResult("r4"));

    // Las entradas caducadas ya no están en el mapa, sin haberlas consultado.
    now.mockReturnValue(start);
    expect(recallRotation("viejo-1")).toBeNull();
    expect(recallRotation("viejo-2")).toBeNull();
    expect(recallRotation("nuevo")).not.toBeNull();
  });

  it("el logout borra todo lo guardado", () => {
    rememberRotation("r1", okResult("r2"));

    clearRecentRotations();

    expect(recallRotation("r1")).toBeNull();
  });

  it("la ventana de repetición es corta (solo cubre la carrera de arranque)", () => {
    expect(ROTATION_REPLAY_TTL_MS).toBe(3_000);
  });
});
