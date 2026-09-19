import { describe, expect, it } from "vitest";

import { SUPPORT_WELCOME_TEMPLATE, applyTemplate } from "./templates";

describe("SUPPORT_WELCOME_TEMPLATE", () => {
  it("tiene el texto exacto del brief", () => {
    expect(SUPPORT_WELCOME_TEMPLATE).toEqual({
      title: "Bienvenida a la red de apoyo",
      body: "Gracias por acompañar a alguien de nuestra entidad. En este espacio de familias encontrarás actividades, formación y recursos pensados para ti. Recuerda: no verás las conversaciones, la actividad privada ni la ubicación de la persona a la que acompañas; solo lo que ella decida compartir con su red. Si necesitas hablar con la entidad, escribe a su referente desde la app.",
    });
  });
});

describe("applyTemplate", () => {
  it("con título y cuerpo vacíos, aplica la plantilla y overwritten es false", () => {
    const result = applyTemplate({ title: "", body: "" }, SUPPORT_WELCOME_TEMPLATE);

    expect(result).toEqual({
      title: SUPPORT_WELCOME_TEMPLATE.title,
      body: SUPPORT_WELCOME_TEMPLATE.body,
      overwritten: false,
    });
  });

  it("con solo espacios en blanco, overwritten es false", () => {
    const result = applyTemplate({ title: "   ", body: "\n  " }, SUPPORT_WELCOME_TEMPLATE);

    expect(result.overwritten).toBe(false);
  });

  it("con título con texto, overwritten es true", () => {
    const result = applyTemplate({ title: "Borrador", body: "" }, SUPPORT_WELCOME_TEMPLATE);

    expect(result.overwritten).toBe(true);
    expect(result.title).toBe(SUPPORT_WELCOME_TEMPLATE.title);
    expect(result.body).toBe(SUPPORT_WELCOME_TEMPLATE.body);
  });

  it("con cuerpo con texto, overwritten es true", () => {
    const result = applyTemplate({ title: "", body: "Ya hay algo escrito" }, SUPPORT_WELCOME_TEMPLATE);

    expect(result.overwritten).toBe(true);
  });

  it("con título y cuerpo con texto, overwritten es true", () => {
    const result = applyTemplate(
      { title: "Borrador", body: "Ya hay algo escrito" },
      SUPPORT_WELCOME_TEMPLATE,
    );

    expect(result.overwritten).toBe(true);
  });
});
