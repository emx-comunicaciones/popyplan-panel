import { describe, expect, it } from "vitest";

import { csvBlob, csvCell, toCsv } from "./toCsv";

describe("csvCell", () => {
  it("entrecomilla siempre y duplica las comillas internas", () => {
    expect(csvCell('dijo "hola"')).toBe('"dijo ""hola"""');
  });

  it("el separador y los saltos de línea viajan dentro de las comillas", () => {
    expect(csvCell("Irun;Hondarribia")).toBe('"Irun;Hondarribia"');
    expect(csvCell("primera\nsegunda")).toBe('"primera\nsegunda"');
  });

  it("convierte números y nulos a texto", () => {
    expect(csvCell(42)).toBe('"42"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it("neutraliza las celdas que una hoja de cálculo interpretaría como fórmula", () => {
    expect(csvCell("=1+1")).toBe("\"'=1+1\"");
    expect(csvCell("+34600000000")).toBe("\"'+34600000000\"");
    expect(csvCell("-2")).toBe("\"'-2\"");
    expect(csvCell("@import")).toBe("\"'@import\"");
    expect(csvCell("\tSUM(A1)")).toBe("\"'\tSUM(A1)\"");
    expect(csvCell("\rSUM(A1)")).toBe("\"'\rSUM(A1)\"");
  });

  it("un número negativo también se neutraliza (llega como texto que empieza por «-»)", () => {
    expect(csvCell(-2)).toBe("\"'-2\"");
  });

  it("no toca una celda normal", () => {
    expect(csvCell("organization.created")).toBe('"organization.created"');
    expect(csvCell("")).toBe('""');
  });
});

describe("toCsv", () => {
  it("une celdas con «;» y filas con salto de línea", () => {
    expect(toCsv([["id", "accion"], [1, "organization.created"]])).toBe(
      '"id";"accion"\n"1";"organization.created"',
    );
  });

  it("sin filas devuelve una cadena vacía", () => {
    expect(toCsv([])).toBe("");
  });
});

describe("csvBlob", () => {
  it("antepone el BOM para que una hoja de cálculo lea UTF-8", async () => {
    const blob = csvBlob([["acción"]]);

    // `Blob.text()` descarta el BOM al decodificar (lo dice la propia
    // especificación), así que se comprueba sobre los bytes.
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blob.text()).toBe('"acción"');
    expect(blob.type).toBe("text/csv;charset=utf-8");
  });
});
