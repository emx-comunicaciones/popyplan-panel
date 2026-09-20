import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { axe } from "@/test-utils/axe";
import { render, screen } from "@/test-utils/render";

import { ModeToggle } from "./ModeToggle";

/**
 * El conmutador «Planes / Comunidades» es el **único** componente con
 * estado de la web pública, así que tiene su propio test: `app/page.test.tsx`
 * comprueba que se pinta y cuál es la pastilla activa de entrada, y aquí
 * se comprueba lo que solo se ve al interactuar.
 */
describe("ModeToggle", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(<ModeToggle />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("empieza en Planes, con su frase", () => {
    render(<ModeToggle />);

    expect(screen.getByRole("button", { name: "Planes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByText("Rutas, entrenos y quedadas al aire libre, cerca de ti."),
    ).toBeInTheDocument();
  });

  it("al pulsar «Comunidades» cambia la frase y el estado de las dos pastillas", async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);

    await user.click(screen.getByRole("button", { name: "Comunidades" }));

    expect(screen.getByRole("button", { name: "Comunidades" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Planes" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByText("Grupos por deporte y afición, con sus propias normas."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Rutas, entrenos y quedadas al aire libre, cerca de ti."),
    ).toBeNull();
  });

  it("vuelve a Planes al pulsar la otra pastilla", async () => {
    const user = userEvent.setup();
    render(<ModeToggle />);

    await user.click(screen.getByRole("button", { name: "Comunidades" }));
    await user.click(screen.getByRole("button", { name: "Planes" }));

    expect(
      screen.getByText("Rutas, entrenos y quedadas al aire libre, cerca de ti."),
    ).toBeInTheDocument();
  });

  it("la frase vive en una región que se anuncia sola al cambiar", () => {
    // Siempre montada, solo cambia su texto: si la región naciera con el
    // mensaje, un lector de pantalla podría perderse el primer anuncio.
    render(<ModeToggle />);

    expect(
      screen.getByText("Rutas, entrenos y quedadas al aire libre, cerca de ti."),
    ).toHaveAttribute("aria-live", "polite");
  });

  it("el titular fijo va en un h2, sin saltar de nivel bajo el h1 de la portada", () => {
    render(<ModeToggle />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Diseñado para quien cuida su cuerpo y a su gente.",
      }),
    ).toBeInTheDocument();
  });
});
