import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

// Como en `vitest.setup.ts` para el mapa del territorio, pero con las dos
// primitivas más que usa el mapa comercial: `Marker` (con su `icon`, que se
// vuelca como atributo para poder comprobar forma y letra) y `Popup`.
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "map-container" }, children),
  TileLayer: () => null,
  Marker: ({
    children,
    icon,
    title,
  }: {
    children?: React.ReactNode;
    icon?: { options: { html?: string } };
    title?: string;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "map-marker", "data-title": title, "data-icon": icon?.options.html },
      children,
    ),
  Popup: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
}));

import { axe } from "@/test-utils/axe";
import { buildCrmMapPoint } from "@/test-utils/fixtures/crm";
import { crmApiRouter, requestedPaths } from "@/test-utils/fixtures/crm-c";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { render, screen, within } from "@/test-utils/render";

import PlataformaComercialMapaPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

function session(role: string | null) {
  return { token: "t", me: buildMe({ org_memberships: [] }), platformRole: buildPlatformRole(role as never) };
}

const POINTS = [
  buildCrmMapPoint(),
  buildCrmMapPoint({ id: 2, name: "Ayuntamiento de Zarautz", municipality: "Zarautz", population: 23000, stage_key: "sin_contactar", stage_name: "Sin contactar", open_value: "0.00" }),
  buildCrmMapPoint({ id: 3, name: "Ayuntamiento de Irun", municipality: "Irun", population: 62000, stage_key: "negociacion", stage_name: "Negociación" }),
  buildCrmMapPoint({ id: 4, name: "Ayuntamiento de Getxo", municipality: "Getxo", population: 78000, stage_key: "ganado", stage_kind: "won", stage_name: "Ganado", is_client: true }),
  buildCrmMapPoint({ id: 5, name: "Ayuntamiento de Eibar", municipality: "Eibar", population: 27000, stage_key: "perdido", stage_kind: "lost", stage_name: "Perdido" }),
  buildCrmMapPoint({ id: 6, name: "Ayuntamiento de Tolosa", municipality: "Tolosa", population: 19000, stage_key: "contactado", stage_name: "Contactado" }),
];

async function renderPage(role = "sales_lead", points: unknown = POINTS) {
  apiFetchMock.mockImplementation(crmApiRouter({ map: points }));
  getServerSessionMock.mockResolvedValue(session(role));
  return render(await PlataformaComercialMapaPage());
}

describe("Mapa comercial", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = await renderPage();
    expect(await screen.findAllByTestId("map-marker")).toHaveLength(6);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("la leyenda lista cada estado con su recuento", async () => {
    await renderPage();
    const legend = (await screen.findByRole("heading", { name: "Leyenda" })).closest("section") as HTMLElement;
    for (const text of ["Sin contactar (1)", "Contactado (1)", "Interesado (1)", "Negociación (1)", "Cliente (1)", "Perdido (1)"]) {
      expect(within(legend).getByText(text)).toBeInTheDocument();
    }
    expect(within(legend).getAllByRole("listitem")).toHaveLength(6);
    expect(within(legend).getByText(/además del color/)).toBeInTheDocument();
  });

  it("cada estado se distingue por forma y letra, no solo por color", async () => {
    await renderPage();
    const markers = await screen.findAllByTestId("map-marker");
    const byTitle = Object.fromEntries(markers.map((m) => [m.dataset.title, m.dataset.icon ?? ""]));
    const expected: [string, string, string][] = [
      ["Ayuntamiento de Zarautz", "<circle", ">S<"],
      ["Ayuntamiento de Tolosa", "<rect", ">C<"],
      ["Ayuntamiento de Donostia", 'points="12,1 23,12 12,23 1,12"', ">I<"],
      ["Ayuntamiento de Irun", 'points="12,2 23,22 1,22"', ">N<"],
      ["Ayuntamiento de Getxo", 'points="7,2 17,2 23,12 17,22 7,22 1,12"', ">✓<"],
      ["Ayuntamiento de Eibar", 'points="12,1 23,9 19,22 5,22 1,9"', ">X<"],
    ];
    for (const [title, shape, letter] of expected) {
      expect(byTitle[title]).toContain(shape);
      expect(byTitle[title]).toContain(letter);
    }
    expect(new Set(Object.values(byTitle)).size).toBe(6);
  });

  it("el popup trae los datos de la entidad y el enlace a su ficha", async () => {
    await renderPage();
    const markers = await screen.findAllByTestId("map-marker");
    const popup = markers.find((m) => m.dataset.title === "Ayuntamiento de Donostia") as HTMLElement;
    expect(within(popup).getByText("Municipio: Donostia/San Sebastián")).toBeInTheDocument();
    expect(within(popup).getByText(/Población: 187\.000/)).toBeInTheDocument();
    expect(within(popup).getByText("Fase: Interesado")).toBeInTheDocument();
    expect(within(popup).getByText("Comercial: Mikel Errasti")).toBeInTheDocument();
    expect(within(popup).getByText(/Última actividad: /)).toBeInTheDocument();
    expect(within(popup).getByText(/Próxima actividad: /)).toBeInTheDocument();
    expect(within(popup).getByText(/Valor abierto: 8000/)).toBeInTheDocument();
    expect(within(popup).getByRole("link", { name: "Ver ficha" })).toHaveAttribute(
      "href",
      "/plataforma/comercial/entidades/1",
    );
  });

  it("la lista alternativa es plegable y trae las mismas entidades en una tabla", async () => {
    await renderPage();
    const toggle = await screen.findByRole("button", { name: "Ver la lista (6 entidades)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table", { name: /^Entidades del mapa/ })).not.toBeInTheDocument();

    await userEvent.click(toggle);

    const table = screen.getByRole("table", { name: /^Entidades del mapa/ });
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    const row = within(table).getByRole("row", { name: /Zarautz/ });
    expect(within(row).getByRole("link", { name: "Ayuntamiento de Zarautz" })).toHaveAttribute(
      "href",
      "/plataforma/comercial/entidades/2",
    );
    expect(row).toHaveTextContent("Sin contactar");
    expect(screen.getByRole("button", { name: "Ocultar la lista" })).toHaveAttribute("aria-expanded", "true");
  });

  it("filtra por fase en el servidor y por población mínima en el cliente", async () => {
    await renderPage();
    await screen.findAllByTestId("map-marker");
    await userEvent.selectOptions(screen.getByLabelText("Estado"), "5");
    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/map/?stage=5");
    await userEvent.selectOptions(screen.getByLabelText("Interés"), "high");
    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/map/?stage=5&interest=high");

    await userEvent.type(screen.getByLabelText("Población mínima"), "60000");
    const titles = (await screen.findAllByTestId("map-marker")).map((m) => m.dataset.title);
    expect(titles.sort()).toEqual(["Ayuntamiento de Donostia", "Ayuntamiento de Getxo", "Ayuntamiento de Irun"]);
  });

  it("dirección comercial puede filtrar por comercial", async () => {
    await renderPage("sales_lead");
    await screen.findAllByTestId("map-marker");
    expect(screen.getByLabelText("Comercial")).toBeInTheDocument();
  });

  it("un comercial no ve el filtro por comercial", async () => {
    await renderPage("sales");
    await screen.findAllByTestId("map-marker");
    expect(screen.queryByLabelText("Comercial")).not.toBeInTheDocument();
  });

  it("sin entidades con ubicación lo dice en vez de pintar un mapa vacío", async () => {
    await renderPage("sales", []);
    expect(await screen.findByText("Ninguna entidad con ubicación cumple estos filtros.")).toBeInTheDocument();
    expect(screen.queryByTestId("map-container")).not.toBeInTheDocument();
  });

  it("cobertura territorial: tabla por provincia con totales y conmutador a comunidad", async () => {
    await renderPage();
    const table = await screen.findByRole("table", { name: /^Cobertura territorial por Provincia/ });
    expect(screen.getByRole("button", { name: "Provincia" })).toHaveAttribute("aria-pressed", "true");
    for (const header of ["Municipios registrados", "Contactados", "En negociación", "Clientes", "% cobertura"]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const gipuzkoa = within(table).getByRole("row", { name: /Gipuzkoa/ });
    expect(gipuzkoa).toHaveTextContent("88");
    expect(gipuzkoa).toHaveTextContent("38,6 %");
    const totals = within(table).getByRole("row", { name: /Total/ });
    expect(totals).toHaveTextContent("100");
    expect(totals).toHaveTextContent("40 %");

    await userEvent.click(screen.getByRole("button", { name: "Comunidad" }));

    const region = await screen.findByRole("table", { name: /^Cobertura territorial por Comunidad/ });
    expect(within(region).getByRole("row", { name: /País Vasco/ })).toHaveTextContent("40 %");
    expect(requestedPaths(apiFetchMock)).toContain("/api/crm/coverage/?level=region");
    expect(screen.getByRole("button", { name: "Comunidad" })).toHaveAttribute("aria-pressed", "true");
  });
});
