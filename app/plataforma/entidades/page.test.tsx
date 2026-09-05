import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { render, screen, waitFor } from "@/test-utils/render";
import userEvent from "@testing-library/user-event";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaEntidadesPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

describe("PlataformaEntidadesPage", () => {
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
