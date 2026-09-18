import { describe, expect, it } from "vitest";

import { filenameFromContentDisposition } from "@/lib/download/filenameFrom";

const FALLBACK = "informe.csv";

describe("filenameFromContentDisposition", () => {
  it("cae al nombre por defecto sin cabecera", () => {
    expect(filenameFromContentDisposition(null, FALLBACK)).toBe(FALLBACK);
    expect(filenameFromContentDisposition("", FALLBACK)).toBe(FALLBACK);
  });

  it("cae al nombre por defecto si la cabecera no trae `filename`", () => {
    expect(filenameFromContentDisposition("attachment", FALLBACK)).toBe(FALLBACK);
  });

  it("lee `filename=\"…\"` entrecomillado", () => {
    expect(
      filenameFromContentDisposition('attachment; filename="popyplan-bidasoa.csv"', FALLBACK),
    ).toBe("popyplan-bidasoa.csv");
  });

  it("lee `filename=…` sin comillas", () => {
    expect(filenameFromContentDisposition("attachment; filename=popyplan-bidasoa.csv", FALLBACK)).toBe(
      "popyplan-bidasoa.csv",
    );
  });

  it("lee `filename*=UTF-8''…` y lo descodifica", () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename*=UTF-8''informe%20del%20a%C3%B1o.csv",
        FALLBACK,
      ),
    ).toBe("informe del año.csv");
  });

  it("prefiere `filename*` al `filename` de reserva (RFC 6266)", () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename=\"informe.csv\"; filename*=UTF-8''informe%20del%20a%C3%B1o.csv",
        FALLBACK,
      ),
    ).toBe("informe del año.csv");
  });

  it("rechaza un `filename*` en otro juego de caracteres y usa el `filename` de reserva", () => {
    // `decodeURIComponent` solo sabe de UTF-8: descodificar un
    // ISO-8859-1 con él devuelve mojibake, no un error.
    expect(
      filenameFromContentDisposition(
        "attachment; filename=\"informe.csv\"; filename*=ISO-8859-1''informe%E1.csv",
        FALLBACK,
      ),
    ).toBe("informe.csv");
  });

  it("rechaza un `filename*` en otro juego de caracteres aunque se descodifique sin error", () => {
    // Solo ASCII: `decodeURIComponent` no protesta, así que sin mirar el
    // juego de caracteres este nombre pasaría como si fuera UTF-8.
    expect(
      filenameFromContentDisposition(
        "attachment; filename=\"reserva.csv\"; filename*=ISO-8859-1''informe.csv",
        FALLBACK,
      ),
    ).toBe("reserva.csv");
  });

  it("admite el juego de caracteres en cualquier caja (`utf-8`, `UTF-8`)", () => {
    expect(
      filenameFromContentDisposition("attachment; filename*=utf-8''informe%20del%20a%C3%B1o.csv", FALLBACK),
    ).toBe("informe del año.csv");
  });

  it("exige el juego de caracteres que manda la RFC 5987", () => {
    // `filename*=` sin juego de caracteres es una cabecera mal formada:
    // no hay forma de saber en qué está codificada.
    expect(filenameFromContentDisposition("attachment; filename*=otro.csv", FALLBACK)).toBe(FALLBACK);
  });

  it("si `filename*` viene mal codificado, usa el `filename` de reserva", () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename=\"informe.csv\"; filename*=UTF-8''informe%ZZ.csv",
        FALLBACK,
      ),
    ).toBe("informe.csv");
  });

  it("si `filename*` viene mal codificado y no hay reserva, usa el nombre por defecto", () => {
    expect(
      filenameFromContentDisposition("attachment; filename*=UTF-8''informe%ZZ.csv", FALLBACK),
    ).toBe(FALLBACK);
  });

  it("ignora un `filename*` vacío y usa el `filename` de reserva", () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename*=UTF-8''   ; filename=\"informe.csv\"",
        FALLBACK,
      ),
    ).toBe("informe.csv");
  });

  it("ignora un `filename` vacío", () => {
    expect(filenameFromContentDisposition('attachment; filename=""', FALLBACK)).toBe(FALLBACK);
  });
});
