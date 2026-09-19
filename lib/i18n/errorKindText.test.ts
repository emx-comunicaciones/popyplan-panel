import { describe, expect, it } from "vitest";

import { errorKindText } from "./errorKindText";

type Kind = "invalido" | "desconocido";
const KEYS: Record<Kind, string> = {
  invalido: "errors.example.invalido",
  desconocido: "errors.example.desconocido",
};

function fakeT(key: string): string {
  return `t(${key})`;
}

describe("errorKindText", () => {
  it("sin error, usa la clave por defecto", () => {
    expect(errorKindText(null, KEYS, fakeT, "errors.example.desconocido")).toBe(
      "t(errors.example.desconocido)",
    );
    expect(errorKindText(undefined, KEYS, fakeT, "errors.example.desconocido")).toBe(
      "t(errors.example.desconocido)",
    );
  });

  it("con `detail`, lo devuelve tal cual, sin traducir", () => {
    expect(
      errorKindText({ kind: "invalido", detail: "Detalle del backend." }, KEYS, fakeT, "errors.example.desconocido"),
    ).toBe("Detalle del backend.");
  });

  it("sin `detail`, traduce por `kind`", () => {
    expect(errorKindText({ kind: "invalido" }, KEYS, fakeT, "errors.example.desconocido")).toBe(
      "t(errors.example.invalido)",
    );
  });

  it("un `kind` que el mapa no cubre cae al `fallbackKey`", () => {
    expect(
      errorKindText({ kind: "otro" as Kind }, KEYS, fakeT, "errors.example.desconocido"),
    ).toBe("t(errors.example.desconocido)");
  });

  it("sin `kind` (mock de test solo con `.message`) cae al `fallbackKey`", () => {
    expect(errorKindText({}, KEYS, fakeT, "errors.example.desconocido")).toBe(
      "t(errors.example.desconocido)",
    );
  });
});
