import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { routerMock, setSearchParams } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { ApiError } from "@/lib/api/client";
import { notifySessionExpired, resetSessionEventsForTests } from "@/lib/auth/sessionEvents";

const loginMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({ login: loginMock }));

import LoginPage from "./page";

afterEach(() => {
  loginMock.mockReset();
  resetSessionEventsForTests();
});

describe("LoginPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(<LoginPage />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("envía usuario y contraseña y redirige según el área tras el éxito", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      accessToken: "token-1",
      user: buildMe({ org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })] }),
      platformRole: buildPlatformRole(null),
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Usuario o email"), "titular@alfaville.test");
    await user.type(screen.getByLabelText("Contraseña"), "correcta-1234");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(loginMock).toHaveBeenCalledWith("titular@alfaville.test", "correcta-1234");
    expect(routerMock.replace).toHaveBeenCalledWith("/entidad/alfaville");
  });

  it("redirige a /plataforma cuando el área es plataforma", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      accessToken: "token-1",
      user: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Usuario o email"), "admin@popyplan.test");
    await user.type(screen.getByLabelText("Contraseña"), "correcta-1234");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(routerMock.replace).toHaveBeenCalledWith("/plataforma");
  });

  it("redirige a /paraguas/{slug} cuando el área es una entidad paraguas", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      accessToken: "token-1",
      user: buildMe({
        org_memberships: [
          buildOrgMembership({
            role: "analista",
            organization_slug: "diputacion-demo",
            org_type: "administracion",
          }),
        ],
      }),
      platformRole: buildPlatformRole(null),
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Usuario o email"), "analista@diputacion.test");
    await user.type(screen.getByLabelText("Contraseña"), "correcta-1234");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(routerMock.replace).toHaveBeenCalledWith("/paraguas/diputacion-demo");
  });

  it("redirige a /elegir-entidad con varias entidades", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      accessToken: "token-1",
      user: buildMe({
        org_memberships: [
          buildOrgMembership({ role: "titular", organization_slug: "alfaville" }),
          buildOrgMembership({ role: "moderador", organization_slug: "betaville" }),
        ],
      }),
      platformRole: buildPlatformRole(null),
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Usuario o email"), "titular@varias.test");
    await user.type(screen.getByLabelText("Contraseña"), "correcta-1234");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(routerMock.replace).toHaveBeenCalledWith("/elegir-entidad");
  });

  it("con returnTo válido vuelve al destino que pidió el middleware", async () => {
    const user = userEvent.setup();
    setSearchParams({ returnTo: "/entidad/alfaville/personas?page=3" });
    loginMock.mockResolvedValue({
      accessToken: "token-1",
      user: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
      }),
      platformRole: buildPlatformRole(null),
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Usuario o email"), "titular@alfaville.test");
    await user.type(screen.getByLabelText("Contraseña"), "correcta-1234");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(routerMock.replace).toHaveBeenCalledWith("/entidad/alfaville/personas?page=3");
  });

  it("con un returnTo que apunta fuera del panel, ignora el destino y va al área", async () => {
    const user = userEvent.setup();
    setSearchParams({ returnTo: "//evil.example/entidad/alfaville" });
    loginMock.mockResolvedValue({
      accessToken: "token-1",
      user: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
      }),
      platformRole: buildPlatformRole(null),
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Usuario o email"), "titular@alfaville.test");
    await user.type(screen.getByLabelText("Contraseña"), "correcta-1234");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(routerMock.replace).toHaveBeenCalledWith("/entidad/alfaville");
  });

  it("un error de servidor (500) muestra el mensaje genérico", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(new ApiError(500, { detail: "boom" }));

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Usuario o email"), "titular@alfaville.test");
    await user.type(screen.getByLabelText("Contraseña"), "algo");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo iniciar sesión. Inténtalo de nuevo.",
    );
  });

  it("un error que no es de la API también muestra el mensaje genérico", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(new Error("fallo de red"));

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Usuario o email"), "titular@alfaville.test");
    await user.type(screen.getByLabelText("Contraseña"), "algo");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo iniciar sesión. Inténtalo de nuevo.",
    );
  });

  it("credenciales incorrectas (400) muestran un error y no redirige", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(new ApiError(400, { detail: "Credenciales inválidas" }));

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Usuario o email"), "titular@alfaville.test");
    await user.type(screen.getByLabelText("Contraseña"), "mala");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Usuario o contraseña incorrectos.");
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("demasiados intentos (429) muestra el mensaje de espera y no redirige", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(new ApiError(429, { detail: "throttled" }));

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Usuario o email"), "titular@alfaville.test");
    await user.type(screen.getByLabelText("Contraseña"), "correcta-1234");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Demasiados intentos; espera un minuto.",
    );
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("con un aviso de sesión caducada pendiente, lo pinta de entrada", async () => {
    notifySessionExpired();

    render(<LoginPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Tu sesión ha caducado.");
  });
});
