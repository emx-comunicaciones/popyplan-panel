import { describe, expect, it } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";

import NotFound, { generateMetadata } from "./not-found";

describe("NotFound", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Página no encontrada");
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(await NotFound());

    expect(await axe(container)).toHaveNoViolations();
  });

  it("explica que la página no existe y ofrece volver al inicio", async () => {
    render(await NotFound());

    expect(screen.getByText("Página no encontrada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
  });
});
