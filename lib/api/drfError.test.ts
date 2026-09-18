import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";

describe("detailOf", () => {
  it("devuelve el `detail` suelto (errores globales y de transición)", () => {
    expect(detailOf(new ApiError(409, { detail: "Un programa cerrado no se modifica." }))).toBe(
      "Un programa cerrado no se modifica.",
    );
  });

  it("devuelve el primer mensaje de un error por campo", () => {
    expect(
      detailOf(new ApiError(400, { ends_on: ["La fecha de fin no puede ser anterior al inicio."] })),
    ).toBe("La fecha de fin no puede ser anterior al inicio.");
  });

  it("cubre `non_field_errors` como un campo más", () => {
    expect(detailOf(new ApiError(400, { non_field_errors: ["Indica municipios, comarca o provincia."] }))).toBe(
      "Indica municipios, comarca o provincia.",
    );
  });

  it("devuelve el `error` suelto de las vistas que no usan `detail`", () => {
    expect(detailOf(new ApiError(400, { error: "El fichero supera el tamaño máximo." }))).toBe(
      "El fichero supera el tamaño máximo.",
    );
  });

  it("prefiere `detail` sobre el resto", () => {
    expect(
      detailOf(new ApiError(400, { detail: "Detalle", error: "Otro", campo: ["Y otro"] })),
    ).toBe("Detalle");
  });

  it("prefiere `error` sobre los errores por campo", () => {
    expect(detailOf(new ApiError(400, { error: "Otro", campo: ["Y otro"] }))).toBe("Otro");
  });

  it("devuelve undefined sin cuerpo, con cuerpo no reconocible o con arrays vacíos", () => {
    expect(detailOf(new ApiError(400, null))).toBeUndefined();
    expect(detailOf(new ApiError(400, "texto plano"))).toBeUndefined();
    expect(detailOf(new ApiError(400, ["fuera de contrato"]))).toBeUndefined();
    expect(detailOf(new ApiError(400, { campo: [] }))).toBeUndefined();
    expect(detailOf(new ApiError(400, { campo: 3 }))).toBeUndefined();
  });
});
