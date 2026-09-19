import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { render, screen, waitFor } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildHelpRequest } from "@/test-utils/fixtures/helpRequest";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaAyudaPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

describe("PlataformaAyudaPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Ayuda");
  });

  it("moderator ve los avisos agregados de todas las entidades (ruta de plataforma sin `organization`)", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/safety/help-requests/pending/") {
        return [buildHelpRequest()];
      }
      throw new Error(`sin mock para ${path}`);
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });

    const element = await PlataformaAyudaPage();
    render(element);

    expect(screen.getByRole("heading", { name: "Ayuda" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Marta L.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "He contactado" })).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/safety/help-requests/pending/");
  });

  it("verifier ve «Sin acceso»", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const element = await PlataformaAyudaPage();
    render(element);

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(PlataformaAyudaPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin rol de plataforma redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(PlataformaAyudaPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
