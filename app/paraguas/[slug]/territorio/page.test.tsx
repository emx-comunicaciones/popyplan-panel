import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { render, screen, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal, redirectMock } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import {
  buildByPlaceRows,
  buildCompareResponse,
  buildMetricsResponse,
  buildSeriesRows,
} from "@/test-utils/fixtures/metrics";
import { buildPlaceRow, buildPlaceSheet } from "@/test-utils/fixtures/places";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import type { MetricsGroupBy, MetricsScope } from "@/hooks/useMetrics";
import { MetricsError } from "@/hooks/useMetrics";
import { PlacesError } from "@/hooks/usePlaces";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const serverFetchMock = vi.hoisted(() => vi.fn());
const useMetricsMock = vi.hoisted(() => vi.fn());
const useCompareMock = vi.hoisted(() => vi.fn());
const usePlacesByIneMock = vi.hoisted(() => vi.fn());
const usePlaceSheetMock = vi.hoisted(() => vi.fn());
const realParaguasMenuForRef = vi.hoisted(() => ({
  current: (undefined as unknown) as (role: string) => string[],
}));
const paraguasMenuForMock = vi.hoisted(() =>
  vi.fn((role: string) => realParaguasMenuForRef.current(role)),
);

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/auth/paraguasMenu", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/paraguasMenu")>("@/lib/auth/paraguasMenu");
  realParaguasMenuForRef.current = actual.paraguasMenuFor;
  return { ...actual, paraguasMenuFor: paraguasMenuForMock };
});
vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));
vi.mock("@/hooks/useMetrics", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useMetrics")>("@/hooks/useMetrics");
  return { ...actual, useMetrics: useMetricsMock };
});
vi.mock("@/hooks/useCompare", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCompare")>("@/hooks/useCompare");
  return { ...actual, useCompare: useCompareMock };
});
vi.mock("@/hooks/usePlaces", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePlaces")>("@/hooks/usePlaces");
  return { ...actual, usePlacesByIne: usePlacesByIneMock };
});
vi.mock("@/hooks/usePlaceSheet", async () => {
  const actual =
    await vi.importActual<typeof import("@/hooks/usePlaceSheet")>("@/hooks/usePlaceSheet");
  return { ...actual, usePlaceSheet: usePlaceSheetMock };
});

// El mapa real carga `leaflet` con `next/dynamic({ssr:false})`, que en
// jsdom resuelve de forma asíncrona y metería una espera en cada test de
// esta página. Aquí se sustituye por un doble con la misma interfaz
// (`bubbles`/`onSelect`); el mapa de verdad tiene su propio test, con su
// propio `axe`, en `components/metrics/TerritoryMap.test.tsx`.
vi.mock("@/components/metrics/TerritoryMap", () => ({
  TerritoryMap: ({
    bubbles,
    onSelect,
  }: {
    bubbles: { ineCode: string; label: string }[];
    onSelect: (ine: string) => void;
  }) => (
    <div data-testid="territory-map">
      {bubbles.map((bubble) => (
        <button key={bubble.ineCode} type="button" onClick={() => onSelect(bubble.ineCode)}>
          {bubble.label}
        </button>
      ))}
    </div>
  ),
}));

import ParaguasTerritorioPage, { generateMetadata } from "./page";

function mockMetricsByGroup(
  handlers: Partial<Record<"base" | MetricsGroupBy, ReturnType<typeof buildMetricsResponse>>>,
) {
  useMetricsMock.mockImplementation(
    (_scope: MetricsScope, _orgId: unknown, _period: unknown, groupBy?: MetricsGroupBy) => {
      const data = groupBy ? handlers[groupBy] : handlers.base;
      return { data, isError: false, error: null };
    },
  );
}

/** Escenario por defecto: métricas con dos municipios, uno suprimido. */
function mockHappyPath() {
  mockMetricsByGroup({
    base: buildMetricsResponse(),
    place: buildMetricsResponse({ by_place: buildByPlaceRows() }),
    month: buildMetricsResponse({ series: buildSeriesRows() }),
  });
  useCompareMock.mockReturnValue({ data: buildCompareResponse(), isError: false, error: null });
  usePlacesByIneMock.mockReturnValue({
    data: [
      buildPlaceRow({ ine_code: "30001", name: "Alfaville" }),
      buildPlaceRow({ ine_code: "30002", name: "Betaville" }),
    ],
    isError: false,
    error: null,
  });
  usePlaceSheetMock.mockReturnValue({ data: undefined, isError: false, error: null });
}

afterEach(() => {
  getServerSessionMock.mockReset();
  serverFetchMock.mockReset();
  useMetricsMock.mockReset();
  useCompareMock.mockReset();
  usePlacesByIneMock.mockReset();
  usePlaceSheetMock.mockReset();
});

async function renderPage(role = "analista", slug = "diputacion-demo") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug })],
    }),
    platformRole: buildPlatformRole(null),
  });

  const element = await ParaguasTerritorioPage({ params: Promise.resolve({ slug }) });
  return render(element);
}

describe("ParaguasTerritorioPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockHappyPath();
    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();

    // También con el panel lateral abierto (`Dialog placement="side"`).
    usePlaceSheetMock.mockReturnValue({ data: buildPlaceSheet(), isError: false, error: null });
    await userEvent.click(screen.getByRole("button", { name: "Ver ficha de Alfaville" }));

    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Observatorio del territorio");
  });

  it("pinta el mapa y la tabla por municipio del periodo", async () => {
    mockHappyPath();
    await renderPage();

    expect(screen.getByTestId("territory-map")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Por municipio" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Territorio" })).toBeInTheDocument();
    expect(screen.getAllByText("Alfaville").length).toBeGreaterThan(0);
    // La fila suprimida se lee «<5», nunca 0 (regla de `formatCount`).
    expect(screen.getAllByText("<5").length).toBeGreaterThan(0);
    // Ámbito `territorio`, nunca `paraguas`.
    expect(useMetricsMock).toHaveBeenCalledWith(
      "territorio",
      expect.anything(),
      expect.anything(),
      "place",
    );
    expect(useCompareMock).toHaveBeenCalledWith(
      "territorio",
      expect.anything(),
      expect.anything(),
      "comarca",
    );
  });

  /**
   * M1 de la revisión final de rama: los botones «Ver ficha» de la
   * columna de acciones se anunciaban todos igual, sin el municipio —
   * para quien navega por lista de botones (lector de pantalla) eran N
   * controles indistinguibles.
   */
  it("cada botón «Ver ficha» lleva el municipio en su nombre accesible (M1)", async () => {
    mockHappyPath();
    await renderPage();

    expect(screen.getByRole("button", { name: "Ver ficha de Alfaville" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver ficha de Betaville" })).toBeInTheDocument();
  });

  it("«Ver ficha» abre el panel lateral con la ficha de ese municipio", async () => {
    mockHappyPath();
    usePlaceSheetMock.mockReturnValue({ data: buildPlaceSheet(), isError: false, error: null });
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Ver ficha de Alfaville" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Irun" })).toBeInTheDocument();
    expect(within(dialog).getByText("Entidades con sede aquí")).toBeInTheDocument();
    // Nunca nombres de entidades ni de personas: solo el recuento.
    expect(
      within(dialog).getByText(
        "Esta ficha solo muestra agregados: nunca nombres de personas ni de las entidades con sede aquí.",
      ),
    ).toBeInTheDocument();
    expect(usePlaceSheetMock).toHaveBeenLastCalledWith(
      expect.anything(),
      "30001",
      expect.anything(),
    );
  });

  it("pulsar una burbuja del mapa abre el mismo panel lateral", async () => {
    mockHappyPath();
    usePlaceSheetMock.mockReturnValue({ data: buildPlaceSheet(), isError: false, error: null });
    await renderPage();

    const map = screen.getByTestId("territory-map");
    await userEvent.click(within(map).getByRole("button", { name: "Betaville" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(usePlaceSheetMock).toHaveBeenLastCalledWith(
      expect.anything(),
      "30002",
      expect.anything(),
    );
  });

  it("la ficha en error pinta su mensaje dentro del panel, sin romper la pantalla", async () => {
    mockHappyPath();
    usePlaceSheetMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: {
        kind: "fuera_de_territorio",
        message: "Ese municipio no está en el territorio de esta administración.",
      },
    });
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Ver ficha de Alfaville" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("No se pudo cargar la ficha del municipio")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Ese municipio no está en el territorio de esta administración."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Por municipio" })).toBeInTheDocument();
  });

  it("una administración sin territorio ve el aviso del contrato, no tarjetas a cero", async () => {
    useMetricsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new MetricsError(
        "sin_territorio",
        "Esta administración no tiene territorio declarado.",
        "Esta administración no tiene territorio declarado.",
      ),
    });
    useCompareMock.mockReturnValue({ data: undefined, isError: false, error: null });
    usePlacesByIneMock.mockReturnValue({ data: [], isError: false, error: null });
    usePlaceSheetMock.mockReturnValue({ data: undefined, isError: false, error: null });

    await renderPage();

    expect(
      screen.getByText("Esta administración no tiene territorio declarado."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "La plataforma declara el territorio de cada administración desde su ficha de entidad.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("territory-map")).not.toBeInTheDocument();
    expect(screen.queryByText("Personas activas")).not.toBeInTheDocument();
  });

  it("demasiados municipios para el mapa: aviso propio que pide acotar el periodo, con la tabla intacta", async () => {
    mockHappyPath();
    usePlacesByIneMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new PlacesError(
        "demasiadas_paginas",
        "Hay demasiados municipios para cargarlos todos; contacta con Popyplan.",
      ),
    });

    await renderPage();

    expect(
      screen.getByText("No se puede dibujar el mapa de este periodo"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Hay demasiados municipios con actividad para situarlos todos en el mapa. Acota el periodo para verlo; la tabla de abajo sigue completa.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("territory-map")).not.toBeInTheDocument();
    // La tabla y su «Ver ficha» siguen siendo la vía completa al municipio.
    expect(screen.getByRole("heading", { name: "Por municipio" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Ver ficha de /}).length).toBe(2);
  });

  it("un fallo real de las coordenadas pinta el error del mapa, no el aviso de «demasiados»", async () => {
    mockHappyPath();
    usePlacesByIneMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new PlacesError("desconocido", "No se pudo cargar el listado de municipios."),
    });

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudieron cargar las coordenadas del mapa",
    );
    expect(
      screen.getByText("No se pudo cargar el listado de municipios."),
    ).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      ParaguasTerritorioPage({ params: Promise.resolve({ slug: "diputacion-demo" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/login" }));
  });

  it("sin la sección en el menú de plataforma para ese rol, pinta el aviso de sin acceso", async () => {
    paraguasMenuForMock.mockReturnValueOnce(["inicio", "red-financiada", "informes"]);

    await renderPage();

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(screen.getByText("Tu rol no tiene acceso a Territorio.")).toBeInTheDocument();
  });

  it("una cuenta sin membresía de panel en esa entidad va a la raíz", async () => {
    // `paraguasMenuFor` da Territorio a los cinco roles de panel, así
    // que el `EmptyState` «Sin acceso» de esta página es defensivo (el
    // mismo patrón que `informes/page.tsx`) y no se puede provocar con
    // un rol real: lo que sí se prueba es el gate de antes, el de
    // membresía — `voluntario` no es rol de panel, así que la página
    // redirige, igual que el resto del área.
    await expect(renderPage("voluntario")).rejects.toThrow(NextRedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
