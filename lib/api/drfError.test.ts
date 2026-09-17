import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import { detailOf, fieldErrorsOf } from "@/lib/api/drfError";

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

describe("fieldErrorsOf", () => {
  it("devuelve el primer mensaje de cada campo", () => {
    expect(
      fieldErrorsOf(
        new ApiError(400, {
          email: ["Introduce una dirección de correo válida.", "Segundo mensaje ignorado."],
          starts_on: ["Este campo es obligatorio."],
        }),
      ),
    ).toEqual({
      email: "Introduce una dirección de correo válida.",
      starts_on: "Este campo es obligatorio.",
    });
  });

  it("admite el mensaje suelto como cadena (`detail`, `error`)", () => {
    expect(fieldErrorsOf(new ApiError(400, { detail: "Revisa los datos." }))).toEqual({
      detail: "Revisa los datos.",
    });
  });

  it("ignora los valores que no son ni cadena ni array de cadenas", () => {
    expect(fieldErrorsOf(new ApiError(400, { campo: [], otro: 3, anidado: { a: 1 } }))).toEqual({});
  });

  it("devuelve un objeto vacío sin cuerpo o con un cuerpo que no es un objeto", () => {
    expect(fieldErrorsOf(new ApiError(400, null))).toEqual({});
    expect(fieldErrorsOf(new ApiError(400, "texto plano"))).toEqual({});
    expect(fieldErrorsOf(new ApiError(400, ["fuera de contrato"]))).toEqual({});
  });
});
