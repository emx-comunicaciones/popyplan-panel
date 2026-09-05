import { describe, expect, it } from "vitest";

import { render, screen } from "@/test-utils/render";

import PlataformaInicioPage from "./page";

describe("PlataformaInicioPage", () => {
  it("muestra el título y el aviso de que las secciones llegan en próximas tareas", () => {
    render(<PlataformaInicioPage />);

    expect(screen.getByRole("heading", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByText(/Entidades, cola de reportes/)).toBeInTheDocument();
  });
});
