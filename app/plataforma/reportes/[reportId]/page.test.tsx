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
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { buildReportDetail } from "@/test-utils/fixtures/report";

import PlataformaReporteDetailPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

describe("PlataformaReporteDetailPage", () => {
  it("moderator ve las acciones de asignar/resolver/escalar", async () => {
    apiFetchMock.mockResolvedValueOnce(buildReportDetail());
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });

    const element = await PlataformaReporteDetailPage({
      params: Promise.resolve({ reportId: "11111111-1111-1111-1111-111111111111" }),
    });
    render(element);

    await waitFor(() => expect(screen.getByRole("button", { name: "Asignarme" })).toBeInTheDocument());
  });

  it("support solo lee: sin botones de acción", async () => {
    apiFetchMock.mockResolvedValueOnce(buildReportDetail());
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("support"),
    });

    const element = await PlataformaReporteDetailPage({
      params: Promise.resolve({ reportId: "11111111-1111-1111-1111-111111111111" }),
    });
    render(element);

    await waitFor(() => expect(screen.getByText("Sin asignar")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Asignarme" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolver" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Escalar" })).not.toBeInTheDocument();
  });

  it("verifier ve «Sin acceso»", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const element = await PlataformaReporteDetailPage({
      params: Promise.resolve({ reportId: "11111111-1111-1111-1111-111111111111" }),
    });
    render(element);

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(PlataformaReporteDetailPage({ params: Promise.resolve({ reportId: "11111111-1111-1111-1111-111111111111" }) })).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin rol de plataforma redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(PlataformaReporteDetailPage({ params: Promise.resolve({ reportId: "11111111-1111-1111-1111-111111111111" }) })).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
