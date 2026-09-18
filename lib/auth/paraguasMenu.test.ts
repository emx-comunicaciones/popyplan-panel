import { describe, expect, it } from "vitest";

import { paraguasMenuFor } from "./paraguasMenu";

describe("paraguasMenuFor", () => {
  // Literales, no `[...PARAGUAS_MENU_ITEMS]`: con la constante, añadir una
  // sección al menú del paraguas dejaría estos tres casos en verde sin que
  // nadie hubiera decidido que ese rol la ve.
  it("titular ve las dos secciones", () => {
    expect(paraguasMenuFor("titular")).toEqual(["inicio", "informes"]);
  });

  it("moderador ve las dos secciones", () => {
    expect(paraguasMenuFor("moderador")).toEqual(["inicio", "informes"]);
  });

  it("analista ve las dos secciones (exporta informes)", () => {
    expect(paraguasMenuFor("analista")).toEqual(["inicio", "informes"]);
  });

  it("dinamizador solo ve Inicio (no exporta informes)", () => {
    expect(paraguasMenuFor("dinamizador")).toEqual(["inicio"]);
  });

  it("referente solo ve Inicio (no exporta informes)", () => {
    expect(paraguasMenuFor("referente")).toEqual(["inicio"]);
  });

  it("un rol desconocido no ve ninguna sección", () => {
    expect(paraguasMenuFor("desconocido")).toEqual([]);
  });
});
