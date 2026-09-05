import { describe, expect, it } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";

import AccesibilidadPage from "./page";

describe("AccesibilidadPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(<AccesibilidadPage />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("tiene el título de la declaración", () => {
    render(<AccesibilidadPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Declaración de accesibilidad de Popyplan" }),
    ).toBeInTheDocument();
  });

  it("tiene las seis secciones exigidas por el RD 1112/2018", () => {
    render(<AccesibilidadPage />);

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

  it("enlaza al correo de contacto por defecto", () => {
    render(<AccesibilidadPage />);

    expect(screen.getByRole("link", { name: "accesibilidad@popyplan.com" })).toHaveAttribute(
      "href",
      "mailto:accesibilidad@popyplan.com",
    );
  });

  it("enlaza a la declaración pública desde su propio pie", () => {
    render(<AccesibilidadPage />);

    expect(screen.getByRole("link", { name: "Accesibilidad" })).toHaveAttribute(
      "href",
      "/accesibilidad",
    );
  });
});
