import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";

import ErrorBoundary from "./error";

const error = Object.assign(new Error("fallo inesperado"), { digest: "abc123" });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(<ErrorBoundary error={error} reset={vi.fn()} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("pinta el aviso de error con «Reintentar» y un enlace a /login", () => {
    render(<ErrorBoundary error={error} reset={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Algo ha fallado");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al inicio de sesión" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("«Reintentar» llama a reset()", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<ErrorBoundary error={error} reset={reset} />);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
