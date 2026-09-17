import { describe, expect, it } from "vitest";

import { PARAGUAS_MENU_ITEMS, paraguasMenuFor } from "./paraguasMenu";

describe("paraguasMenuFor", () => {
  it("titular ve las dos secciones", () => {
    expect(paraguasMenuFor("titular")).toEqual([...PARAGUAS_MENU_ITEMS]);
  });

  it("moderador ve las dos secciones", () => {
    expect(paraguasMenuFor("moderador")).toEqual([...PARAGUAS_MENU_ITEMS]);
  });

  it("analista ve las dos secciones (exporta informes)", () => {
    expect(paraguasMenuFor("analista")).toEqual([...PARAGUAS_MENU_ITEMS]);
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
