import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";

import { TesoroJuegoForm } from "./TesoroJuegoForm";

function fillRequired() {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ruta" } });
  fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Una ruta" } });
  fireEvent.change(screen.getByLabelText("Ciudad"), { target: { value: "Irun" } });
  fireEvent.change(screen.getByLabelText(/Premio/), { target: { value: "Una camiseta" } });
  fireEvent.change(screen.getByLabelText("Inicio"), { target: { value: "2099-01-01T10:00" } });
}

describe("TesoroJuegoForm", () => {
  it("una duración no entera o menor que 1 dice por qué «Guardar» no se activa", () => {
    render(<TesoroJuegoForm pending={false} submitLabel="Guardar" onSubmit={vi.fn()} />);
    fillRequired();
    const submit = screen.getByRole("button", { name: "Guardar" });
    expect(submit).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const duration = screen.getByLabelText("Duración (minutos)");
    fireEvent.change(duration, { target: { value: "0" } });
    expect(submit).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("La duración tiene que ser un número entero de minutos, 1 o más.");
    expect(duration).toHaveAttribute("aria-describedby", "tesoro-juego-duration-error");

    fireEvent.change(duration, { target: { value: "1.5" } });
    expect(screen.getByRole("alert")).toHaveTextContent("La duración tiene que ser un número entero");

    fireEvent.change(duration, { target: { value: "90" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(submit).toBeEnabled();
  });

  it("un máximo de participantes no válido lo explica; vacío es «sin límite» y vale", () => {
    render(<TesoroJuegoForm pending={false} submitLabel="Guardar" onSubmit={vi.fn()} />);
    fillRequired();
    const max = screen.getByLabelText("Máximo de participantes");
    fireEvent.change(max, { target: { value: "0" } });

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El máximo de participantes tiene que ser un número entero, 1 o más (o vacío, sin límite).",
    );
    expect(max.getAttribute("aria-describedby")).toContain("tesoro-juego-max-error");

    fireEvent.change(max, { target: { value: "" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });
});
