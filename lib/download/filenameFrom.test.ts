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

  it("admite `filename*` sin juego de caracteres ni idioma", () => {
    expect(filenameFromContentDisposition("attachment; filename*=informe.csv", FALLBACK)).toBe(
      "informe.csv",
    );
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

  it("ignora un `filename` vacío", () => {
    expect(filenameFromContentDisposition('attachment; filename=""', FALLBACK)).toBe(FALLBACK);
  });
});
