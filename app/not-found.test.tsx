import { describe, expect, it } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";

import NotFound from "./not-found";

describe("NotFound", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(<NotFound />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("explica que la página no existe y ofrece volver al inicio", () => {
    render(<NotFound />);

    expect(screen.getByText("Página no encontrada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
  });
});
