import { describe, expect, it } from "vitest";

import { buildResourcePayload } from "./resourceFormData";

describe("buildResourcePayload", () => {
  it("sin fichero, construye un objeto plano con solo los campos definidos", () => {
    const payload = buildResourcePayload({
      title: "Guía de acogida",
      category: "help",
      kind: "text",
      body: "Contenido",
      audience: "members",
    });

    expect(payload).toEqual({
      title: "Guía de acogida",
      category: "help",
      kind: "text",
      body: "Contenido",
      audience: "members",
    });
  });

  it("sin fichero, omite los campos undefined (edición parcial)", () => {
    const payload = buildResourcePayload({ title: "Nuevo título" });
    expect(payload).toEqual({ title: "Nuevo título" });
  });

  it("la cadena vacía sí viaja (limpiar `body`/`url` al cambiar de tipo)", () => {
    const payload = buildResourcePayload({ title: "Guía", body: "", url: "" });
    expect(payload).toEqual({ title: "Guía", body: "", url: "" });

    const file = new File(["contenido"], "guia.pdf");
    const formData = buildResourcePayload({ title: "Guía", body: "", url: "", file }) as FormData;
    expect(formData.get("body")).toBe("");
    expect(formData.get("url")).toBe("");
  });

  it("con fichero, construye un FormData con todos los campos y el fichero", () => {
    const file = new File(["contenido"], "guia.pdf", { type: "application/pdf" });
    const payload = buildResourcePayload({
      title: "Guía",
      category: "help",
      kind: "pdf",
      audience: "members",
      is_featured: true,
      file,
    });

    expect(payload).toBeInstanceOf(FormData);
    const formData = payload as FormData;
    expect(formData.get("title")).toBe("Guía");
    expect(formData.get("category")).toBe("help");
    expect(formData.get("kind")).toBe("pdf");
    expect(formData.get("audience")).toBe("members");
    expect(formData.get("is_featured")).toBe("true");
    expect(formData.get("file")).toBe(file);
  });

  it("con fichero, no añade los campos undefined", () => {
    const file = new File(["contenido"], "guia.pdf");
    const payload = buildResourcePayload({ title: "Guía", file }) as FormData;

    expect(payload.has("category")).toBe(false);
    expect(payload.has("body")).toBe(false);
  });
});
