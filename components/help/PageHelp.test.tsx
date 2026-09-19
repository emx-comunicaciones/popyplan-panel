import userEvent from "@testing-library/user-event";
import { render as rtlRenderUnwrapped } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { axe } from "@/test-utils/axe";
import { fireEvent, render, screen } from "@/test-utils/render";
import { setPathname } from "@/test-utils/nextNavigationMock";

import { PageHelp } from "./PageHelp";

describe("PageHelp", () => {
  it("sin entrada para la ruta actual, no renderiza nada", () => {
    setPathname("/login");
    const { container } = render(<PageHelp />);

    expect(container).toBeEmptyDOMElement();
  });

  it("con una ruta conocida, pinta el botón de ayuda cerrado", () => {
    setPathname("/entidad/alfaville/personas");
    render(<PageHelp />);

    const button = screen.getByRole("button", { name: "Ayuda: Personas" });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("al pulsar el botón abre el diálogo con el resumen, las acciones y la audiencia", async () => {
    setPathname("/entidad/alfaville/personas");
    const user = userEvent.setup();
    render(<PageHelp />);

    await user.click(screen.getByRole("button", { name: "Ayuda: Personas" }));

    const dialog = screen.getByRole("dialog", { name: "Personas" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ayuda: Personas" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByText(
        "Las personas que participan en tu entidad, con sus comunidades, su actividad reciente y su referente. Nunca muestra datos de contacto: Popyplan trabaja con alias.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Qué puedes hacer aquí" })).toBeInTheDocument();
    expect(
      screen.getByText("Invitar a una persona o importar un Excel/CSV (titular y moderador)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "Quién la ve: Titular, moderador, dinamizador y referente."),
    ).toBeInTheDocument();
  });

  it("tiene fondo blanco para ser legible sobre cualquier cabecera de color", () => {
    setPathname("/entidad/alfaville/personas");
    render(<PageHelp />);

    const button = screen.getByRole("button", { name: "Ayuda: Personas" });
    expect(button.className).toContain("bg-white");
  });

  it("cambiar de pathname cierra el diálogo abierto", () => {
    // `render` de test-utils envuelve en <QueryClientProvider>; su
    // `rerender` sustituiría ese wrapper por completo si le pasáramos
    // <PageHelp /> a secas, desmontando y remontando el componente (lo
    // que resetearía `open` por sí solo, sin probar nada). PageHelp no
    // usa TanStack Query, así que aquí se monta con el `render` sin
    // envolver de Testing Library para que `rerender` actualice el
    // mismo árbol de verdad, sin remontar.
    setPathname("/entidad/alfaville/personas");
    const { rerender } = rtlRenderUnwrapped(<PageHelp />);

    fireEvent.click(screen.getByRole("button", { name: "Ayuda: Personas" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    setPathname("/entidad/alfaville/actividades");
    rerender(<PageHelp />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape cierra el diálogo y devuelve el foco al botón", async () => {
    setPathname("/entidad/alfaville/personas");
    const user = userEvent.setup();
    render(<PageHelp />);

    const button = screen.getByRole("button", { name: "Ayuda: Personas" });
    await user.click(button);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("no tiene violaciones de accesibilidad (axe), cerrado y abierto", async () => {
    setPathname("/entidad/alfaville/personas");
    const user = userEvent.setup();
    const { container } = render(<PageHelp />);

    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Ayuda: Personas" }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
