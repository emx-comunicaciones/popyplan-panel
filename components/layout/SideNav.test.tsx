import { describe, expect, it } from "vitest";

import { render, screen } from "@/test-utils/render";
import { setPathname } from "@/test-utils/nextNavigationMock";
import { axe } from "@/test-utils/axe";

import { SideNav } from "./SideNav";

const ITEMS = [
  { href: "/entidad/bidasoa", label: "Inicio" },
  { href: "/entidad/bidasoa/personas", label: "Personas" },
  { href: "/entidad/bidasoa/comunidades", label: "Comunidades" },
];

describe("SideNav", () => {
  it("pinta un enlace por sección con su etiqueta", () => {
    setPathname("/entidad/bidasoa");
    render(<SideNav ariaLabel="Menú de la entidad" items={ITEMS} />);

    expect(screen.getByRole("navigation", { name: "Menú de la entidad" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Personas" })).toHaveAttribute(
      "href",
      "/entidad/bidasoa/personas",
    );
  });

  it("marca la sección actual con aria-current y un fondo tenue", () => {
    setPathname("/entidad/bidasoa/personas");
    render(<SideNav ariaLabel="Menú de la entidad" items={ITEMS} />);

    const active = screen.getByRole("link", { name: "Personas" });

    expect(active).toHaveAttribute("aria-current", "page");
    // El activo no se distingue solo por color: fondo tenue ya auditado
    // (`text-base` sobre `primary-100`, 16,93:1) + `font-semibold`.
    expect(active.className).toContain("bg-primary-100");
    expect(active.className).toContain("font-semibold");
    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current");
  });

  it("una subpágina marca su sección, no «Inicio» (que es prefijo de todas)", () => {
    setPathname("/entidad/bidasoa/personas/42");
    render(<SideNav ariaLabel="Menú de la entidad" items={ITEMS} />);

    expect(screen.getByRole("link", { name: "Personas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current");
  });

  it("«Inicio» solo queda marcado en la ruta exacta de la entidad", () => {
    setPathname("/entidad/bidasoa");
    render(<SideNav ariaLabel="Menú de la entidad" items={ITEMS} />);

    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  });

  it("una sección hermana con el mismo prefijo literal no se marca (frontera de segmento)", () => {
    // «/personas-extra» empieza por «/personas» como texto, pero no es una
    // subruta suya: la coincidencia es por segmento, no por prefijo de cadena.
    const items = [...ITEMS, { href: "/entidad/bidasoa/personas-extra", label: "Personas extra" }];
    setPathname("/entidad/bidasoa/personas-extra/7");
    render(<SideNav ariaLabel="Menú de la entidad" items={items} />);

    expect(screen.getByRole("link", { name: "Personas extra" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Personas" })).not.toHaveAttribute("aria-current");
  });

  it("una ruta fuera del menú no marca ninguna sección", () => {
    setPathname("/otra-cosa");
    render(<SideNav ariaLabel="Menú de la entidad" items={ITEMS} />);

    for (const label of ["Inicio", "Personas", "Comunidades"]) {
      expect(screen.getByRole("link", { name: label })).not.toHaveAttribute("aria-current");
    }
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    setPathname("/entidad/bidasoa/personas");
    const { container } = render(<SideNav ariaLabel="Menú de la entidad" items={ITEMS} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
