import { afterEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal, setPathname } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import ComercialLayout from "./layout";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

function session(role: string | null) {
  return { token: "t", me: buildMe({ org_memberships: [] }), platformRole: buildPlatformRole(role as never) };
}

describe("ComercialLayout", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    setPathname("/plataforma/comercial/pipeline");
    apiFetchMock.mockResolvedValue({ role: "sales", is_manager: false, unread_notifications: 0 });
    getServerSessionMock.mockResolvedValue(session("sales"));
    const { container } = render(await ComercialLayout({ children: <p>contenido</p> }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("pinta las secciones del CRM y marca la actual; sin Configuración para un comercial", async () => {
    setPathname("/plataforma/comercial/pipeline");
    apiFetchMock.mockResolvedValue({ role: "sales", is_manager: false, unread_notifications: 2 });
    getServerSessionMock.mockResolvedValue(session("sales"));
    render(await ComercialLayout({ children: <p>contenido</p> }));
    const nav = screen.getByRole("navigation", { name: "Secciones del CRM comercial" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pipeline" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("link", { name: "Configuración" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Registrar actividad" })).toBeInTheDocument();
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });

  it("dirección comercial ve también Configuración", async () => {
    setPathname("/plataforma/comercial");
    apiFetchMock.mockResolvedValue({ role: "sales_lead", is_manager: true, unread_notifications: 0 });
    getServerSessionMock.mockResolvedValue(session("sales_lead"));
    render(await ComercialLayout({ children: <p>contenido</p> }));
    expect(screen.getByRole("link", { name: "Configuración" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("otro rol de plataforma no entra en el CRM", async () => {
    getServerSessionMock.mockResolvedValue(session("moderator"));
    render(await ComercialLayout({ children: <p>contenido</p> }));
    expect(screen.getByText(/El CRM comercial es solo para/)).toBeInTheDocument();
    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
  });

  it("sin sesión va al login y sin rol de plataforma a la raíz", async () => {
    getServerSessionMock.mockResolvedValueOnce(null);
    await expect(ComercialLayout({ children: null })).rejects.toBeInstanceOf(NextRedirectSignal);
    getServerSessionMock.mockResolvedValueOnce(session(null));
    await expect(ComercialLayout({ children: null })).rejects.toBeInstanceOf(NextRedirectSignal);
  });
});
