import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal, setPathname } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import PlataformaLayout from "./layout";

afterEach(() => {
  getServerSessionMock.mockReset();
});

describe("PlataformaLayout", () => {
  it("la cabecera lleva el botón de ayuda de la pantalla actual", async () => {
    setPathname("/plataforma");
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaLayout({ children: <p>contenido</p> });
    render(element);

    expect(screen.getByRole("button", { name: /^Ayuda:/ })).toBeInTheDocument();
  });

  it("pinta las 9 secciones del menú de plataforma", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaLayout({ children: <p>contenido</p> });
    render(element);

    for (const label of [
      "Inicio",
      "Entidades",
      "Reportes",
      "Ayuda",
      "Verificaciones",
      "Roles",
      "Auditoría",
      "Métricas",
      "Contratos",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("moderator solo ve inicio, reportes, ayuda y métricas", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });

    const element = await PlataformaLayout({ children: <p>contenido</p> });
    render(element);

    for (const label of ["Inicio", "Reportes", "Ayuda", "Métricas"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    for (const label of ["Entidades", "Verificaciones", "Roles", "Auditoría", "Contratos"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });

  it("support ve inicio, reportes, ayuda, métricas y contratos (W4: lectura de facturación)", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("support"),
    });

    const element = await PlataformaLayout({ children: <p>contenido</p> });
    render(element);

    for (const label of ["Inicio", "Reportes", "Ayuda", "Métricas", "Contratos"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    for (const label of ["Entidades", "Verificaciones", "Roles", "Auditoría"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });

  it("verifier solo ve inicio, entidades y verificaciones", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const element = await PlataformaLayout({ children: <p>contenido</p> });
    render(element);

    for (const label of ["Inicio", "Entidades", "Verificaciones"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: "Métricas" })).not.toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(PlataformaLayout({ children: <p /> })).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin rol de plataforma redirige a / (que decide el área real)", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(PlataformaLayout({ children: <p /> })).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("con un rol de plataforma desconocido redirige a / (como quien no tiene rol)", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: { role: "rol-que-el-backend-inventa" },
    });

    await expect(PlataformaLayout({ children: <p /> })).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
