import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { ApiError } from "@/lib/api/client";
import { act, fireEvent, render, screen, waitFor } from "@/test-utils/render";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlaceRow } from "@/test-utils/fixtures/places";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaEntidadesPage, { generateMetadata } from "./page";

afterEach(() => {
  vi.useRealTimers();
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

describe("PlataformaEntidadesPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Entidades");
  });

  it("no tiene violaciones de accesibilidad (axe), tampoco con el diálogo «Nueva entidad» abierto", async () => {
    apiFetchMock.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [buildOrganization({ id: 9, name: "Ayuntamiento de Irun" })],
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });
    const user = userEvent.setup();

    const element = await PlataformaEntidadesPage();
    const { container } = render(element);
    await waitFor(() => expect(screen.getByText("Ayuntamiento de Irun")).toBeInTheDocument());

    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Nueva entidad" }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("superadmin ve el listado y el botón de nueva entidad", async () => {
    apiFetchMock.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [buildOrganization({ id: 9, name: "Ayuntamiento de Irun" })],
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaEntidadesPage();
    render(element);

    expect(screen.getByRole("heading", { name: "Entidades" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Ayuntamiento de Irun")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Nueva entidad" })).toBeInTheDocument();
  });

  it("el aviso de «creada» desaparece al reintentar: no se queda de un alta anterior", async () => {
    const created = buildOrganization({ id: 12, name: "Asociación Bidasoa" });
    apiFetchMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path.startsWith("/api/places/")) {
        return { count: 1, next: null, previous: null, results: [buildPlaceRow()] };
      }
      if (options?.method === "POST") {
        if (apiFetchMock.mock.calls.filter((call) => call[1]?.method === "POST").length > 1) {
          throw new ApiError(400, { slug: ["Ya existe una entidad con este slug."] });
        }
        return created;
      }
      return { count: 0, next: null, previous: null, results: [] };
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });
    const user = userEvent.setup();

    const element = await PlataformaEntidadesPage();
    render(element);

    await user.click(screen.getByRole("button", { name: "Nueva entidad" }));
    await user.type(screen.getByLabelText("Nombre"), "Asociación Bidasoa");
    await user.type(screen.getByLabelText("Slug"), "asociacion-bidasoa");
    await user.type(screen.getByLabelText("CIF"), "G12345678");
    await user.type(screen.getByLabelText("Buscar un municipio"), "irun");
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Irun (Gipuzkoa) · 20069" })).toBeInTheDocument(),
    );
    await user.selectOptions(screen.getByLabelText("Municipio de la sede"), "20069");
    await user.click(screen.getByRole("button", { name: "Crear entidad" }));

    await waitFor(() =>
      expect(screen.getByText("Entidad «Asociación Bidasoa» creada, sin verificar.")).toBeInTheDocument(),
    );

    // Segundo intento, que falla: el aviso de la primera alta no puede
    // seguir en pantalla junto al error del segundo envío. La sede se
    // limpió al tener éxito el primer alta, así que hay que volver a
    // elegirla.
    await user.type(screen.getByLabelText("Nombre"), "Asociación Bidasoa");
    await user.type(screen.getByLabelText("Slug"), "asociacion-bidasoa");
    await user.type(screen.getByLabelText("CIF"), "G12345678");
    await user.type(screen.getByLabelText("Buscar un municipio"), "irun");
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Irun (Gipuzkoa) · 20069" })).toBeInTheDocument(),
    );
    await user.selectOptions(screen.getByLabelText("Municipio de la sede"), "20069");
    await user.click(screen.getByRole("button", { name: "Crear entidad" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(
      screen.queryByText("Entidad «Asociación Bidasoa» creada, sin verificar."),
    ).not.toBeInTheDocument();
  });

  it("no deja crear una entidad sin sede", async () => {
    apiFetchMock.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });
    const user = userEvent.setup();

    const element = await PlataformaEntidadesPage();
    render(element);

    await user.click(screen.getByRole("button", { name: "Nueva entidad" }));
    await user.type(screen.getByLabelText("Nombre"), "Ayuntamiento de Irun");
    await user.type(screen.getByLabelText("Slug"), "ayto-irun");
    await user.type(screen.getByLabelText("CIF"), "P2000000A");

    expect(screen.getByRole("button", { name: "Crear entidad" })).toBeDisabled();
    expect(screen.getByText("La sede es obligatoria para dar de alta una entidad.")).toBeInTheDocument();
  });

  it("avisa de las entidades sin sede", async () => {
    apiFetchMock.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [buildOrganization({ id: 9, name: "Ayuntamiento de Irun", place: null })],
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaEntidadesPage();
    render(element);

    await waitFor(() => expect(screen.getByText("Sede sin municipio")).toBeInTheDocument());
  });

  /**
   * I1 de la revisión final de rama: la columna «Sede» pintaba el
   * código INE crudo («20069»), nunca el nombre del municipio — regla
   * B20 («nada de valores crudos del contrato»). Se resuelve con una
   * sola petición por página (`usePlacesByIne`, no una por fila).
   */
  it("resuelve el código INE de la sede a nombre + provincia (I1)", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/places/")) {
        return { count: 1, next: null, previous: null, results: [buildPlaceRow()] };
      }
      return {
        count: 1,
        next: null,
        previous: null,
        results: [buildOrganization({ id: 9, name: "Ayuntamiento de Irun", place: "20069" })],
      };
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaEntidadesPage();
    render(element);

    await waitFor(() => expect(screen.getByText("Irun (Gipuzkoa)")).toBeInTheDocument());
    expect(screen.queryByText("20069")).not.toBeInTheDocument();
    expect(
      apiFetchMock.mock.calls.filter(([path]) => String(path).startsWith("/api/places/")),
    ).toHaveLength(1);
  });

  /**
   * El buscador va con retardo (`hooks/useDebouncedValue.ts`): estos dos
   * tests usan `fireEvent.change` (una tecla por llamada) y no
   * `userEvent`, que se queda colgado con `vi.useFakeTimers()` (el
   * `asyncWrapper` de Testing Library solo adelanta los temporizadores
   * falsos de *jest*).
   */
  it("el buscador va con retardo: teclear «ana» solo pide el listado una vez, con el valor final", async () => {
    apiFetchMock.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });
    vi.useFakeTimers();

    const element = await PlataformaEntidadesPage();
    render(element);

    const input = screen.getByLabelText("Buscar por nombre");
    for (const value of ["a", "an", "ana"]) {
      fireEvent.change(input, { target: { value } });
    }

    // El input es inmediato, pero todavía no se ha pedido ninguna búsqueda.
    expect(input).toHaveValue("ana");
    expect(apiFetchMock.mock.calls.some(([path]) => String(path).includes("search="))).toBe(false);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const searched = apiFetchMock.mock.calls
      .map(([path]) => String(path))
      .filter((path) => path.includes("search="));
    expect(searched).toEqual(["/api/organizations/?search=ana"]);
  });

  it("la página vuelve a 1 cuando se aplica la búsqueda, no con cada tecla", async () => {
    apiFetchMock.mockResolvedValue({
      count: 40,
      next: "http://api.test/?page=2",
      previous: null,
      results: [buildOrganization({ id: 9, name: "Ayuntamiento de Irun" })],
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaEntidadesPage();
    render(element);
    // La primera carga se espera con temporizadores reales (`waitFor`);
    // los falsos entran después, para controlar solo el retardo.
    await waitFor(() => expect(screen.getByText("Ayuntamiento de Irun")).toBeInTheDocument());
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(apiFetchMock.mock.calls.at(-1)?.[0]).toBe("/api/organizations/?page=2");

    fireEvent.change(screen.getByLabelText("Buscar por nombre"), { target: { value: "ana" } });
    // La tecla por sí sola no cambia el listado: sigue en la página 2.
    expect(apiFetchMock.mock.calls.at(-1)?.[0]).toBe("/api/organizations/?page=2");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(apiFetchMock.mock.calls.at(-1)?.[0]).toBe("/api/organizations/?search=ana");
  });

  it("moderator ve «Sin acceso» (Entidades no está en su menú)", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });

    const element = await PlataformaEntidadesPage();
    render(element);

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("verifier también puede crear entidades", async () => {
    apiFetchMock.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const element = await PlataformaEntidadesPage();
    render(element);

    expect(screen.getByRole("button", { name: "Nueva entidad" })).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(PlataformaEntidadesPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin rol de plataforma redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(PlataformaEntidadesPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
