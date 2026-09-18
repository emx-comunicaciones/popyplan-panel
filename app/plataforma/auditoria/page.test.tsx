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

import { act, fireEvent, render, screen, waitFor } from "@/test-utils/render";
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
  vi.useRealTimers();
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

  /**
   * Los filtros van con retardo (`hooks/useDebouncedValue.ts`) y son
   * controlados: antes eran `<input>` sin `value`, así que el valor
   * inmediato y el aplicado no podían distinguirse. Estos tests usan
   * `fireEvent.change` (una tecla por llamada) y no `userEvent`, que se
   * queda colgado con `vi.useFakeTimers()`.
   */
  it("los filtros van con retardo: teclear «org» solo pide la auditoría una vez, con el valor final", async () => {
    apiFetchMock.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });
    vi.useFakeTimers();

    const element = await PlataformaAuditoriaPage();
    render(element);

    const input = screen.getByLabelText("Acción");
    for (const value of ["o", "or", "org"]) {
      fireEvent.change(input, { target: { value } });
    }

    // El input es controlado e inmediato; la query todavía no lleva el filtro.
    expect(input).toHaveValue("org");
    expect(apiFetchMock.mock.calls.some(([path]) => String(path).includes("action="))).toBe(false);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const filtered = apiFetchMock.mock.calls
      .map(([path]) => String(path))
      .filter((path) => path.includes("action="));
    expect(filtered).toEqual(["/api/safety/audit/?action=org"]);
  });

  it("la página vuelve a 1 cuando se aplica el filtro, no con cada tecla", async () => {
    apiFetchMock.mockResolvedValue({
      count: 40,
      next: "http://api.test/?page=2",
      previous: null,
      results: [ENTRY],
    });
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole("superadmin"),
    });

    const element = await PlataformaAuditoriaPage();
    render(element);
    await waitFor(() => expect(screen.getByText("organization.verified")).toBeInTheDocument());
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(apiFetchMock.mock.calls.at(-1)?.[0]).toBe("/api/safety/audit/?page=2");

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-01-01" } });
    // La tecla por sí sola no cambia el listado: sigue en la página 2.
    expect(apiFetchMock.mock.calls.at(-1)?.[0]).toBe("/api/safety/audit/?page=2");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(apiFetchMock.mock.calls.at(-1)?.[0]).toBe("/api/safety/audit/?since=2026-01-01");
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
