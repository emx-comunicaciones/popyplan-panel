import type { ReactElement } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import { axe } from "@/test-utils/axe";
import { createTestQueryClient, render, screen } from "@/test-utils/render";
import { setPathname } from "@/test-utils/nextNavigationMock";
import es from "@/messages/es.json";

import { UserMenu } from "./UserMenu";

afterEach(() => {
  setPathname("/");
});

const queryClient = createTestQueryClient();
function wrap(ui: ReactElement) {
  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="es" messages={es}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe("UserMenu", () => {
  it("cerrado: solo el botón de cuenta, con el email en su nombre accesible", () => {
    render(<UserMenu email="ana@alfaville.test" name="Ana Gómez" />);

    const button = screen.getByRole("button", {
      name: "Cuenta de ana@alfaville.test",
    });
    expect(button).toHaveAttribute("aria-haspopup", "true");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("group", { name: "Cuenta" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cerrar sesión" }),
    ).not.toBeInTheDocument();
  });

  it("al abrir enseña nombre, email, el selector de idioma y «Cerrar sesión», con el foco dentro", async () => {
    const user = userEvent.setup();
    render(<UserMenu email="ana@alfaville.test" name="Ana Gómez" />);

    await user.click(
      screen.getByRole("button", { name: "Cuenta de ana@alfaville.test" }),
    );

    const panel = screen.getByRole("group", { name: "Cuenta" });
    expect(panel).toHaveTextContent("Ana Gómez");
    expect(panel).toHaveTextContent("ana@alfaville.test");
    expect(screen.getByLabelText("Idioma")).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cuenta de ana@alfaville.test" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("sin nombre, solo el email", async () => {
    const user = userEvent.setup();
    render(<UserMenu email="ana@alfaville.test" name={null} />);

    await user.click(
      screen.getByRole("button", { name: "Cuenta de ana@alfaville.test" }),
    );

    expect(
      screen.getByRole("group", { name: "Cuenta" }).querySelectorAll("p"),
    ).toHaveLength(1);
  });

  it("Escape cierra y devuelve el foco al botón", async () => {
    const user = userEvent.setup();
    render(<UserMenu email="ana@alfaville.test" />);
    const button = screen.getByRole("button", {
      name: "Cuenta de ana@alfaville.test",
    });

    await user.click(button);
    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("group", { name: "Cuenta" }),
    ).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("un clic fuera cierra; un clic dentro no", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <p>fuera</p>
        <UserMenu email="ana@alfaville.test" />
      </div>,
    );

    await user.click(
      screen.getByRole("button", { name: "Cuenta de ana@alfaville.test" }),
    );
    await user.click(screen.getByText("ana@alfaville.test"));
    expect(screen.getByRole("group", { name: "Cuenta" })).toBeInTheDocument();

    await user.click(screen.getByText("fuera"));
    expect(
      screen.queryByRole("group", { name: "Cuenta" }),
    ).not.toBeInTheDocument();
  });

  it("cambiar de pantalla cierra el menú", async () => {
    const user = userEvent.setup();
    setPathname("/entidad/alfaville");
    // `render` de test-utils envuelve en los providers; `rerender` de RTL
    // no lo haría, así que se remonta con el mismo envoltorio a mano.
    const { rerender } = rtlRender(
      wrap(<UserMenu email="ana@alfaville.test" />),
    );

    await user.click(
      screen.getByRole("button", { name: "Cuenta de ana@alfaville.test" }),
    );
    expect(screen.getByRole("group", { name: "Cuenta" })).toBeInTheDocument();

    setPathname("/entidad/alfaville/personas");
    rerender(wrap(<UserMenu email="ana@alfaville.test" />));

    expect(
      screen.queryByRole("group", { name: "Cuenta" }),
    ).not.toBeInTheDocument();
  });

  it("no tiene violaciones de accesibilidad (axe), cerrado y abierto", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <UserMenu email="ana@alfaville.test" name="Ana Gómez" />,
    );

    expect(await axe(container)).toHaveNoViolations();
    await user.click(
      screen.getByRole("button", { name: "Cuenta de ana@alfaville.test" }),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
