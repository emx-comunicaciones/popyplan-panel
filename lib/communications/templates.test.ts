import { describe, expect, it } from "vitest";

import es from "@/messages/es.json";

import { SUPPORT_WELCOME_TEMPLATE_KEYS, applyTemplate } from "./templates";

const TEMPLATE = {
  title: "Bienvenida a la red de apoyo",
  body: "Gracias por acompañar a alguien de nuestra entidad. En este espacio de familias encontrarás actividades, formación y recursos pensados para ti. Recuerda: no verás las conversaciones, la actividad privada ni la ubicación de la persona a la que acompañas; solo lo que ella decida compartir con su red. Si necesitas hablar con la entidad, escribe a su referente desde la app.",
};

describe("SUPPORT_WELCOME_TEMPLATE_KEYS", () => {
  it("apuntan al catálogo es con el texto exacto del brief", () => {
    expect(es.entidad.comunicaciones.template.title).toBe(TEMPLATE.title);
    expect(es.entidad.comunicaciones.template.body).toBe(TEMPLATE.body);
  });

  it("las claves coinciden con las que resuelve `applyTemplate`", () => {
    expect(SUPPORT_WELCOME_TEMPLATE_KEYS.title).toBe("entidad.comunicaciones.template.title");
    expect(SUPPORT_WELCOME_TEMPLATE_KEYS.body).toBe("entidad.comunicaciones.template.body");
  });
});

describe("applyTemplate", () => {
  it("con título y cuerpo vacíos, aplica la plantilla y overwritten es false", () => {
    const result = applyTemplate({ title: "", body: "" }, TEMPLATE);

    expect(result).toEqual({
      title: TEMPLATE.title,
      body: TEMPLATE.body,
      overwritten: false,
    });
  });

  it("con solo espacios en blanco, overwritten es false", () => {
    const result = applyTemplate({ title: "   ", body: "\n  " }, TEMPLATE);

    expect(result.overwritten).toBe(false);
  });

  it("con título con texto, overwritten es true", () => {
    const result = applyTemplate({ title: "Borrador", body: "" }, TEMPLATE);

    expect(result.overwritten).toBe(true);
    expect(result.title).toBe(TEMPLATE.title);
    expect(result.body).toBe(TEMPLATE.body);
  });

  it("con cuerpo con texto, overwritten es true", () => {
    const result = applyTemplate({ title: "", body: "Ya hay algo escrito" }, TEMPLATE);

    expect(result.overwritten).toBe(true);
  });

  it("con título y cuerpo con texto, overwritten es true", () => {
    const result = applyTemplate({ title: "Borrador", body: "Ya hay algo escrito" }, TEMPLATE);

    expect(result.overwritten).toBe(true);
  });
});
