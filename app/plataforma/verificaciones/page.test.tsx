import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import userEvent from "@testing-library/user-event";

import { render, screen, waitFor } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import PlataformaVerificacionesPage from "./page";

const REVIEW = {
  id: "r1",
  user: 5,
  username: "marta",
  level: 3,
  provider: "mock",
  provider_reference: "ref-1",
  status: "pending",
  reason: "Documento borroso",
  appeal_text: "Vuelvo a intentarlo, subo foto nueva.",
  reviewed_by: null,
  reviewed_at: null,
  note: "",
  created_at: "2026-09-01T00:00:00Z",
};

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

describe("PlataformaVerificacionesPage", () => {
  it("verifier ve la cola con el recurso y puede aprobar/rechazar", async () => {
    apiFetchMock.mockResolvedValueOnce({ count: 1, next: null, previous: null, results: [REVIEW] });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const element = await PlataformaVerificacionesPage();
    render(element);

    expect(screen.getByRole("heading", { name: "Verificaciones" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Vuelvo a intentarlo/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
  });

  it("pagina la cola: recuento total y «Siguiente» pide la página 2", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.endsWith("?page=2")) {
        return {
          count: 12,
          next: null,
          previous: "http://api/anterior",
          results: [{ ...REVIEW, id: "r2", username: "jon", appeal_text: "Segunda página." }],
        };
      }
      return { count: 12, next: "http://api/siguiente", previous: null, results: [REVIEW] };
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const user = userEvent.setup();
    const element = await PlataformaVerificacionesPage();
    render(element);

    await waitFor(() => expect(screen.getByText("12 revisiones")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => expect(screen.getByText("Segunda página.")).toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining("?page=2"));
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });

  it("si la última página se queda vacía (ya revisada), vuelve a la primera", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.endsWith("?page=2")) {
        return { count: 1, next: null, previous: "http://api/anterior", results: [] };
      }
      return { count: 1, next: "http://api/siguiente", previous: null, results: [REVIEW] };
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("verifier"),
    });

    const user = userEvent.setup();
    const element = await PlataformaVerificacionesPage();
    render(element);

    await waitFor(() => expect(screen.getByText(/Vuelvo a intentarlo/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    // No se queda en una página 2 vacía sin manera de volver.
    await waitFor(() => expect(screen.getByText(/Vuelvo a intentarlo/)).toBeInTheDocument());
    expect(screen.queryByText("Sin revisiones pendientes")).not.toBeInTheDocument();
  });

  it("moderator ve «Sin acceso»", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("moderator"),
    });

    const element = await PlataformaVerificacionesPage();
    render(element);

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(PlataformaVerificacionesPage()).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin rol de plataforma redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    });

    await expect(PlataformaVerificacionesPage()).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
  });
});
