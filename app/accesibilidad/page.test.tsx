import { describe, expect, it } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";

import AccesibilidadPage, { generateMetadata } from "./page";

describe("AccesibilidadPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Declaración de accesibilidad");
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(await AccesibilidadPage());

    expect(await axe(container)).toHaveNoViolations();
  });

  it("tiene el título de la declaración", async () => {
    render(await AccesibilidadPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Declaración de accesibilidad de Popyplan" }),
    ).toBeInTheDocument();
  });

  it("tiene las seis secciones exigidas por el RD 1112/2018", async () => {
    render(await AccesibilidadPage());

    for (const name of [
      "Alcance",
      "Situación de cumplimiento",
      "Contenido no accesible",
      "Preparación de la declaración",
      "Observaciones y datos de contacto",
      "Procedimiento de aplicación",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("enlaza al correo de contacto por defecto", async () => {
    render(await AccesibilidadPage());

    expect(screen.getByRole("link", { name: "accesibilidad@popyplan.com" })).toHaveAttribute(
      "href",
      "mailto:accesibilidad@popyplan.com",
    );
  });

  it("enlaza a la declaración pública desde su propio pie", async () => {
    render(await AccesibilidadPage());

    expect(screen.getByRole("link", { name: "Accesibilidad" })).toHaveAttribute(
      "href",
      "/accesibilidad",
    );
  });
});
