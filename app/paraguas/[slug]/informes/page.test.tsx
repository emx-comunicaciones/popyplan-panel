import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { render, screen } from "@/test-utils/render";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { ExportError } from "@/hooks/useExport";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useExportMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useExport", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useExport")>("@/hooks/useExport");
  return { ...actual, useExport: useExportMock };
});

import ParaguasInformesPage from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  useExportMock.mockReset();
});

async function renderPage(slug = "diputacion-demo", role = "titular") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 5 })],
    }),
    platformRole: buildPlatformRole(null),
  });

  const element = await ParaguasInformesPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("ParaguasInformesPage", () => {
  it("muestra el aviso de que los informes no llevan nombres de personas", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });

    await renderPage();

    expect(screen.getByRole("heading", { name: "Informes" })).toBeInTheDocument();
    expect(screen.getByText("Los informes no contienen nombres de personas.")).toBeInTheDocument();
  });

  it("«Exportar CSV» llama a useExport().mutate con format 'csv' y el orgId de la paraguas", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });
    const user = userEvent.setup();

    await renderPage();
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "paraguas", orgId: 5, format: "csv" }),
    );
  });

  it("«Exportar PDF» llama a useExport().mutate con format 'pdf'", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });
    const user = userEvent.setup();

    await renderPage();
    await user.click(screen.getByRole("button", { name: "Exportar PDF" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "paraguas", orgId: 5, format: "pdf" }),
    );
  });

  it("503 (PDF no disponible) muestra el mensaje de informe no disponible", async () => {
    useExportMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: new ExportError("pdf_unavailable", "El informe en PDF no está disponible ahora mismo."),
    });

    await renderPage();

    expect(
      screen.getByText(/El informe en PDF no está disponible ahora mismo/),
    ).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      ParaguasInformesPage({ params: Promise.resolve({ slug: "diputacion-demo" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/login" }));
  });

  it("sin membresía en esa entidad paraguas redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "diputacion-demo" })],
      }),
      platformRole: buildPlatformRole(null),
    });

    await expect(
      ParaguasInformesPage({ params: Promise.resolve({ slug: "otra-diputacion" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" }));
  });

  it("referente ve «Sin acceso» (no exporta informes del paraguas)", async () => {
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    await renderPage("diputacion-demo", "referente");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exportar CSV" })).not.toBeInTheDocument();
  });

  it("analista sí ve los informes del paraguas", async () => {
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    await renderPage("diputacion-demo", "analista");

    expect(screen.getByRole("heading", { name: "Informes" })).toBeInTheDocument();
    expect(screen.queryByText("Sin acceso")).not.toBeInTheDocument();
  });
});
