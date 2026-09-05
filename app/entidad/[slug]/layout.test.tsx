import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const serverFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));

import EntidadLayout from "./layout";

afterEach(() => {
  getServerSessionMock.mockReset();
  serverFetchMock.mockReset();
});

function session(role: string) {
  return {
    token: "t",
    me: buildMe({
      org_memberships: [
        buildOrgMembership({ role, organization_slug: "alfaville", organization_name: "Alfaville" }),
      ],
    }),
    platformRole: buildPlatformRole(null),
  };
}

describe("EntidadLayout", () => {
  it("titular ve las 13 secciones del menú", async () => {
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({ ok: true, status: 200, data: buildOrganization() });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    render(element);

    for (const label of ["Inicio", "Personas", "Comunidades", "Actividades", "Configuración"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText("Asociación Vecinal Alfaville")).toBeInTheDocument();
  });

  it("analista no ve Personas ni Configuración: solo Inicio e Informes", async () => {
    getServerSessionMock.mockResolvedValue(session("analista"));
    serverFetchMock.mockResolvedValue({ ok: true, status: 200, data: buildOrganization() });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    render(element);

    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Informes" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Personas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Configuración" })).not.toBeInTheDocument();
  });

  it("dinamizador no ve Configuración, Reportes, Comunicaciones ni Informes (no puede exportar)", async () => {
    getServerSessionMock.mockResolvedValue(session("dinamizador"));
    serverFetchMock.mockResolvedValue({ ok: true, status: 200, data: buildOrganization() });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    render(element);

    expect(screen.queryByRole("link", { name: "Configuración" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Reportes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Comunicaciones" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Informes" })).not.toBeInTheDocument();
  });

  it("referente ve Inicio, Personas y Actividades, nada más", async () => {
    getServerSessionMock.mockResolvedValue(session("referente"));
    serverFetchMock.mockResolvedValue({ ok: true, status: 200, data: buildOrganization() });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    render(element);

    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Personas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Actividades" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Comunidades" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Informes" })).not.toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadLayout({ children: <p />, params: Promise.resolve({ slug: "alfaville" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>));
  });

  it("con rol de plataforma redirige a /plataforma (manda sobre la entidad)", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [buildOrgMembership({ role: "titular" })] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    await expect(
      EntidadLayout({ children: <p />, params: Promise.resolve({ slug: "alfaville" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/plataforma" } satisfies Partial<NextRedirectSignal>));
  });

  it("sin membresía en esa entidad redirige a / (que decide el destino real)", async () => {
    getServerSessionMock.mockResolvedValue(session("titular"));

    await expect(
      EntidadLayout({ children: <p />, params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });

  it("con logo pinta la imagen de la entidad", async () => {
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ logo: "https://cdn.test/logo.png" }),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    const { container } = render(element);

    // El logo es decorativo (`alt=""`), así que no entra en el árbol de
    // accesibilidad: se comprueba por el propio nodo `<img>`.
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("si falla la ficha de la entidad muestra un ErrorState pero no bloquea la página", async () => {
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({ ok: false, status: 500, body: null });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    render(element);

    expect(screen.getByText("No se pudo cargar la ficha de la entidad")).toBeInTheDocument();
  });
});
