import { describe, expect, it } from "vitest";

import { paraguasMenuFor } from "./paraguasMenu";

describe("paraguasMenuFor", () => {
  // Literales, no `[...PARAGUAS_MENU_ITEMS]`: con la constante, añadir una
  // sección al menú del paraguas dejaría estos casos en verde sin que
  // nadie hubiera decidido que ese rol la ve.
  it("titular, moderador y analista ven las cuatro secciones", () => {
    for (const role of ["titular", "moderador", "analista"]) {
      expect(paraguasMenuFor(role)).toEqual(["inicio", "territorio", "red-financiada", "informes"]);
    }
  });

  it("dinamizador y referente ven todo salvo Informes (no exportan)", () => {
    for (const role of ["dinamizador", "referente"]) {
      expect(paraguasMenuFor(role)).toEqual(["inicio", "territorio", "red-financiada"]);
    }
  });

  it("un rol desconocido no ve ninguna sección", () => {
    expect(paraguasMenuFor("voluntario")).toEqual([]);
  });
});
