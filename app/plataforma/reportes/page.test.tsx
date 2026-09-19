import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { axe } from "@/test-utils/axe";
import { render, screen, waitFor } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { buildReportRow } from "@/test-utils/fixtures/report";

import PlataformaReportesPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

describe("PlataformaReportesPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Reportes de plataforma");
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    apiFetchMock.mockResolvedValueOnce([buildReportRow({ organization: 7 })]);
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });

    const element = await PlataformaReportesPage();
    const { container } = render(element);
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());

    expect(await axe(container)).toHaveNoViolations();
  });

  it("moderator ve la cola global con la columna de entidad y el escalado", async () => {
    // Array plano de verdad (no `{count, ...}`, docs/SEGURIDAD_Y_MODERACION.md §4).
    apiFetchMock.mockResolvedValueOnce([
      buildReportRow({
        organization: 7,
        organization_display: { id: 7, name: "Asociación Demo" },
        escalated_at: "2026-09-01T00:00:00Z",
      }),
    ]);
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });

    const element = await PlataformaReportesPage();
    render(element);

    expect(screen.getByRole("heading", { name: "Reportes" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Asociación Demo")).toBeInTheDocument());
    expect(screen.getByText("Escalado")).toBeInTheDocument();
  });

  it("verifier ve «Sin acceso» (Reportes no está en su menú)", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const element = await PlataformaReportesPage();
    render(element);

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(PlataformaReportesPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin rol de plataforma redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(PlataformaReportesPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
