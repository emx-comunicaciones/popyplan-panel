import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { ApiError } from "@/lib/api/client";
import { render, screen, waitFor, within } from "@/test-utils/render";
import { NextNotFoundSignal, NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { buildContract, buildInvoice } from "@/test-utils/fixtures/billing";

import PlataformaEntidadDetailPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

describe("PlataformaEntidadDetailPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Ficha de la entidad (plataforma)");
  });

  it("pinta la ficha con las secciones y permite verificar", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun", is_verified: false });
      }
      throw new Error(`sin mock para ${path}`);
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    expect(screen.getByRole("heading", { name: "Ficha de la entidad" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Ayuntamiento de Irun")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Verificar entidad" })).toBeInTheDocument();
  });

  it("pinta el bloque «Contrato» con tramo, vigencia y última factura", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun" });
      }
      if (path === "/api/plataforma/billing/contracts/?organization=9") {
        return [buildContract({ id: 4, status: "active" })];
      }
      if (path === "/api/plataforma/billing/contracts/4/invoices/") {
        return [
          buildInvoice({ id: 1, issued_on: "2026-01-05", status: "paid" }),
          buildInvoice({ id: 2, issued_on: "2026-03-05", status: "overdue", amount_cents: 60000 }),
        ];
      }
      throw new Error(`sin mock para ${path}`);
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const user = userEvent.setup();
    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await user.click(screen.getByRole("button", { name: "Suscripción" }));

    await waitFor(() => expect(screen.getByText("Municipio pequeño")).toBeInTheDocument());
    expect(screen.getByText("Vigente")).toBeInTheDocument();
    // Última factura por `issued_on`: la del 5 de marzo (vencida), no la de enero (pagada).
    expect(screen.getByText("Vencida")).toBeInTheDocument();
    expect(screen.getByText("Última factura").closest("dl")).toHaveTextContent("600,00 €");
  });

  it("las pestañas de la ficha anuncian cuál está activa con aria-pressed", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun" });
      }
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const user = userEvent.setup();
    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    expect(screen.getByRole("button", { name: "Datos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Ámbito" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Ámbito" }));

    expect(screen.getByRole("button", { name: "Ámbito" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Datos" })).toHaveAttribute("aria-pressed", "false");
  });

  it("Equipo: verifier ve el listado sin formularios ni «Quitar»", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun" });
      }
      if (path.includes("/members/")) {
        return [{ id: 1, user: 4, public_name: "Ane", role: "titular" }];
      }
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const user = userEvent.setup();
    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await user.click(screen.getByRole("button", { name: "Equipo" }));

    await waitFor(() => expect(screen.getByText(/Ane/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Añadir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Asignar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
    expect(screen.getByText(/Tu rol de plataforma no gestiona el equipo/)).toBeInTheDocument();
  });

  it("Equipo: superadmin añade a alguien y el formulario se limpia solo si la llamada sale bien", async () => {
    const members: unknown[] = [];
    apiFetchMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun" });
      }
      if (path.includes("/members/") && options?.method === "POST") {
        throw new ApiError(400, { user: ["Esta persona ya está en el equipo."] });
      }
      if (path.includes("/members/")) return members;
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const user = userEvent.setup();
    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await user.click(screen.getByRole("button", { name: "Equipo" }));
    await user.type(screen.getByLabelText("Id de usuario"), "42");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    // La llamada falla: el id sigue en el campo para poder corregirlo.
    await waitFor(() =>
      expect(screen.getByText("Esta persona ya está en el equipo.")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Id de usuario")).toHaveValue(42);
  });

  it("Equipo: «Quitar» pide confirmación y el error se lee dentro del diálogo", async () => {
    apiFetchMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun" });
      }
      if (path.includes("/members/") && options?.method === "DELETE") {
        throw new ApiError(400, { detail: "La entidad se quedaría sin titular." });
      }
      if (path.includes("/members/")) {
        return [{ id: 1, user: 4, public_name: "Ane", role: "titular" }];
      }
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const user = userEvent.setup();
    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await user.click(screen.getByRole("button", { name: "Equipo" }));
    await user.click(await screen.findByRole("button", { name: "Quitar" }));

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/Ane/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Quitar" }));

    // El mensaje lo decide `useRemoveOrgMember`: con un `detail` del
    // backend se pinta literal (`lib/api/drfError.ts::detailOf`), que es
    // lo único que explica por qué no se puede. Se comprueba además que
    // se lee dentro del diálogo y que este no se cierra con la baja
    // fallida.
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "La entidad se quedaría sin titular.",
      ),
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("no enseña rutas de documentación interna en los avisos de la ficha", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, name: "Ayuntamiento de Irun" });
      }
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const user = userEvent.setup();
    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    const { container } = render(element);

    await user.click(screen.getByRole("button", { name: "Equipo" }));
    expect(container.textContent).not.toMatch(/docs\//);
    expect(container.textContent).not.toMatch(/`/);
  });

  it("superadmin ve y edita sede, nivel y territorio de una administración", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({
          id: 9,
          org_type: "administracion",
          place: "20069",
          admin_level: "diputacion",
        });
      }
      return { count: 0, next: null, previous: null, results: [] };
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await waitFor(() => expect(screen.getByLabelText("Municipio de la sede")).toBeInTheDocument());
    expect(screen.getByLabelText("Nivel administrativo")).toHaveValue("diputacion");
    expect(screen.getByLabelText("Tipo de territorio")).toBeInTheDocument();
  });

  it("verifier ve la sede y el territorio en solo lectura, ningún control editable", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({
          id: 9,
          org_type: "administracion",
          place: "20069",
          admin_level: "diputacion",
          territory_kind: "provincia",
          territory_code: "20",
          territory_places_count: 88,
        });
      }
      return [];
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await waitFor(() => expect(screen.getByText("20069")).toBeInTheDocument());
    expect(screen.queryByLabelText("Municipio de la sede")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tipo de territorio")).not.toBeInTheDocument();
    // Solo lectura, pero no oculto: el nivel y el territorio siguen
    // siendo visibles para un rol de plataforma sin permiso de gestión.
    expect(screen.getByText("Diputación")).toBeInTheDocument();
    expect(screen.getByText("Provincia")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
  });

  it("una asociación no tiene nivel ni territorio, ni siquiera para superadmin", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/organizations/9/") {
        return buildOrganization({ id: 9, org_type: "asociacion", place: "20069" });
      }
      return { count: 0, next: null, previous: null, results: [] };
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await waitFor(() => expect(screen.getByLabelText("Municipio de la sede")).toBeInTheDocument());
    expect(screen.queryByLabelText("Tipo de territorio")).not.toBeInTheDocument();
  });

  /**
   * Fix round 1, hallazgo C1: `TerritorioForm` mandaba
   * `organization.id` (number) a `useSetOrganizationTerritory`, mientras
   * `useOrganization`/`DatosTab` cachean la ficha con el `orgId` de la
   * ruta (string) — la invalidación tras guardar nunca encontraba la
   * entrada, así que la ficha se quedaba obsoleta hasta recargar. Aquí
   * `organization.id` (999) y el id de la ruta (9) difieren a propósito:
   * si el bug reapareciera, el `PATCH` iría a `/api/organizations/999/`
   * (sin mock, el test fallaría) o el recuento no se refrescaría solo.
   */
  it("guardar el territorio refresca la ficha sin recargar (fix round 1: caché string/number)", async () => {
    let currentOrg = buildOrganization({
      id: 999,
      org_type: "administracion",
      admin_level: "",
      territory_kind: "",
      territory_code: "",
      territory_places_count: 0,
    });
    apiFetchMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/api/organizations/9/" && options?.method === "PATCH") {
        currentOrg = {
          ...currentOrg,
          admin_level: "diputacion",
          territory_kind: "provincia",
          territory_code: "20",
          territory_places_count: 88,
        };
        return currentOrg;
      }
      if (path === "/api/organizations/9/") {
        return currentOrg;
      }
      throw new Error(`sin mock para ${path}`);
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });
    const user = userEvent.setup();

    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await waitFor(() => expect(screen.getByLabelText("Nivel administrativo")).toBeInTheDocument());
    const territorioCard = screen
      .getByRole("heading", { name: "Territorio declarado" })
      .closest("div") as HTMLElement;
    await user.click(within(territorioCard).getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(screen.getByText("88 municipios en el territorio guardado")).toBeInTheDocument(),
    );
  });

  /**
   * Fix round 1, hallazgo C2: `sede` usaba `null` tanto para «todavía no
   * se ha tocado el selector» como para el valor que emite `SedeSelector`
   * al elegir «Sin municipio», así que limpiar la sede y guardar
   * reenviaba `org.place` en vez de `null`.
   */
  it("elegir «Sin municipio» y guardar manda `place: null`, no el valor guardado (fix round 1)", async () => {
    let currentOrg = buildOrganization({ id: 9, place: "20045" });
    const patchBodies: unknown[] = [];
    apiFetchMock.mockImplementation(
      async (path: string, options?: { method?: string; body?: unknown }) => {
        if (path === "/api/organizations/9/" && options?.method === "PATCH") {
          patchBodies.push(options.body);
          currentOrg = { ...currentOrg, place: (options.body as { place: string | null }).place };
          return currentOrg;
        }
        if (path === "/api/organizations/9/") {
          return currentOrg;
        }
        return { count: 0, next: null, previous: null, results: [] };
      },
    );
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });
    const user = userEvent.setup();

    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    await waitFor(() => expect(screen.getByText("20045")).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText("Municipio de la sede"), "Sin municipio");

    const sedeCard = screen.getByRole("heading", { name: "Sede" }).closest("div") as HTMLElement;
    await user.click(within(sedeCard).getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(patchBodies).toContainEqual({ place: null }));
  });

  it("moderator ve «Sin acceso»", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });

    const element = await PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) });
    render(element);

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) })).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin rol de plataforma redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "9" }) })).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("un id que no es un número entero da 404 (nunca llega a pedir la ficha)", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    await expect(
      PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "no-soy-un-id" }) }),
    ).rejects.toBeInstanceOf(NextNotFoundSignal);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("un id vacío también da 404", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    await expect(
      PlataformaEntidadDetailPage({ params: Promise.resolve({ id: "" }) }),
    ).rejects.toBeInstanceOf(NextNotFoundSignal);
  });
});
