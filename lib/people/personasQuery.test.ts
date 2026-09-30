import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  EMPTY_PERSONAS_URL_STATE,
  buildPersonasQuery,
  parsePersonasQuery,
  sanitizePersonasQuery,
} from "./personasQuery";

describe("personasQuery", () => {
  it("sin filtros la query es vacía y ida y vuelta conserva todo", () => {
    expect(buildPersonasQuery(EMPTY_PERSONAS_URL_STATE)).toBe("");
    const state = {
      search: "Iñaki B",
      community: "c-1",
      referent: "7",
      activeSince: "2026-01-02",
      joinedSince: "2025-05-06",
      includeInvited: true,
      page: 3,
    };
    expect(parsePersonasQuery(buildPersonasQuery(state))).toEqual(state);
  });

  it("descarta lo ajeno, el referente no numérico y las páginas absurdas", () => {
    expect(parsePersonasQuery("referente=abc&pagina=-4&otra=1")).toEqual(EMPTY_PERSONAS_URL_STATE);
    expect(parsePersonasQuery(null)).toEqual(EMPTY_PERSONAS_URL_STATE);
    expect(sanitizePersonasQuery("otra=1&q=ana&x=y")).toBe("q=ana");
    expect(sanitizePersonasQuery(undefined)).toBe("");
  });
});

describe("plantilla-personas.csv (informe del panel, error 17)", () => {
  it("sus filas de ejemplo no citan comunidad ni referente, que no existen en ninguna entidad", () => {
    const texto = readFileSync(join(process.cwd(), "public", "plantilla-personas.csv"), "utf8").replace(/^\uFEFF/, "");
    const [cabecera, ...filas] = texto.split(/\r?\n/).filter(Boolean);
    const columnas = cabecera.split(";");
    expect(columnas).toEqual(["nombre", "email", "telefono", "comunidad", "referente_email"]);
    expect(filas.length).toBeGreaterThan(0);
    for (const fila of filas) {
      const celdas = fila.split(";");
      expect(celdas[columnas.indexOf("email")]).toMatch(/@/);
      expect(celdas[columnas.indexOf("comunidad")] ?? "").toBe("");
      expect(celdas[columnas.indexOf("referente_email")] ?? "").toBe("");
    }
  });
});
