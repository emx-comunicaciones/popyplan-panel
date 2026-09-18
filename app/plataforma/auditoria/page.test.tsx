import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

const triggerDownloadMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/download/triggerDownload", () => ({ triggerDownload: triggerDownloadMock }));

import userEvent from "@testing-library/user-event";

import { render, screen, waitFor } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaAuditoriaPage from "./page";

const ENTRY = {
  id: "a1",
  actor: { id: 2, public_name: "Bea" },
  action: "organization.verified",
  target_type: "entities.organization",
  target_id: "7",
  metadata: { since: "2026-01-01" },
  created_at: "2026-09-01T10:00:00Z",
};

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
  triggerDownloadMock.mockReset();
});

describe("PlataformaAuditoriaPage", () => {
  it("superadmin ve la auditoría con metadata legible", async () => {
    apiFetchMock.mockResolvedValueOnce({ count: 1, next: null, previous: null, results: [ENTRY] });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaAuditoriaPage();
    render(element);

    expect(screen.getByRole("heading", { name: "Auditoría" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("organization.verified")).toBeInTheDocument());
    expect(screen.getByText(/since="2026-01-01"/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar CSV de esta página" })).toBeInTheDocument();
  });

  it("la exportación CSV neutraliza las celdas que parecen una fórmula", async () => {
    apiFetchMock.mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          ...ENTRY,
          action: "=HYPERLINK(\"http://malo\";\"pincha\")",
          metadata: { nota: "texto; con separador" },
        },
      ],
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const user = userEvent.setup();
    const element = await PlataformaAuditoriaPage();
    render(element);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Exportar CSV de esta página" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Exportar CSV de esta página" }));

    expect(triggerDownloadMock).toHaveBeenCalledTimes(1);
    const [blob, filename] = triggerDownloadMock.mock.calls[0];
    expect(filename).toBe("auditoria.csv");
    const text = await (blob as Blob).text();
    expect(text).toContain("\"'=HYPERLINK(\"\"http://malo\"\";\"\"pincha\"\")\"");
    expect(text).toContain('"nota=""texto; con separador"""');
  });

  it("moderator ve «Sin acceso»", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });

    const element = await PlataformaAuditoriaPage();
    render(element);

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(PlataformaAuditoriaPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin rol de plataforma redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(PlataformaAuditoriaPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
