import { describe, expect, it } from "vitest";

import { isoToLocalInput, localInputToIso } from "./datetimeLocal";

describe("localInputToIso / isoToLocalInput", () => {
  it("cadena vacía da cadena vacía en los dos sentidos", () => {
    expect(localInputToIso("")).toBe("");
    expect(isoToLocalInput("")).toBe("");
  });

  it("un valor ilegible da cadena vacía", () => {
    expect(localInputToIso("no-es-una-fecha")).toBe("");
    expect(isoToLocalInput("no-es-una-fecha")).toBe("");
  });

  it("hace un viaje de ida y vuelta sin perder el minuto (independiente de la zona horaria del entorno)", () => {
    const localValue = "2026-09-25T14:30";
    const iso = localInputToIso(localValue);
    expect(iso).not.toBe("");
    // El ISO representa el mismo instante que `new Date(localValue)`.
    expect(new Date(iso).getTime()).toBe(new Date(localValue).getTime());
    // Y volver a convertirlo reproduce el mismo valor local.
    expect(isoToLocalInput(iso)).toBe(localValue);
  });

  it("rellena con ceros minutos/horas/mes/día de un dígito", () => {
    const early = new Date(2026, 0, 5, 3, 7, 0, 0); // 5 ene 2026, 03:07 local
    const iso = early.toISOString();
    expect(isoToLocalInput(iso)).toBe("2026-01-05T03:07");
  });
});
