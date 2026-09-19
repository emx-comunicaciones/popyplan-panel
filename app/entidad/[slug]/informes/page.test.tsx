import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { ExportError } from "@/hooks/useExport";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useExportMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useExport", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useExport")>("@/hooks/useExport");
  return { ...actual, useExport: useExportMock };
});

import EntidadInformesPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  useExportMock.mockReset();
});

async function renderPage(role = "titular", slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadInformesPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadInformesPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Informes de la entidad");
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });

    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville", organization_id: 7 })],
      }),
      platformRole: { role: null },
    });
    const element = await EntidadInformesPage({ params: Promise.resolve({ slug: "alfaville" }) });
    const { container } = render(element);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("titular ve el panel de exportación", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });

    await renderPage("titular");

    expect(screen.getByRole("heading", { name: "Informes" })).toBeInTheDocument();
    expect(screen.getByText("Los informes no contienen nombres de personas.")).toBeInTheDocument();
  });

  it("«Exportar CSV» llama a useExport().mutate con scope 'entidad' y el orgId", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });
    const user = userEvent.setup();

    await renderPage("moderador");
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "entidad", orgId: 7, format: "csv" }),
    );
  });

  it("«Exportar PDF» llama a useExport().mutate con format 'pdf'", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });
    const user = userEvent.setup();

    await renderPage("analista");
    await user.click(screen.getByRole("button", { name: "Exportar PDF" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "entidad", orgId: 7, format: "pdf" }),
    );
  });

  it("503 (PDF no disponible) muestra el mensaje de informe no disponible", async () => {
    useExportMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: new ExportError("pdf_unavailable", "El informe en PDF no está disponible ahora mismo."),
    });

    await renderPage("titular");

    expect(
      screen.getByText(/El informe en PDF no está disponible ahora mismo/),
    ).toBeInTheDocument();
  });

  it("dinamizador ve «Sin acceso» (no puede exportar informes)", async () => {
    await renderPage("dinamizador");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("referente ve «Sin acceso» (no puede exportar informes)", async () => {
    await renderPage("referente");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadInformesPage({ params: Promise.resolve({ slug: "alfaville" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/login" }));
  });

  it("sin membresía en esa entidad redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "otra" })],
      }),
      platformRole: { role: null },
    });

    await expect(
      EntidadInformesPage({ params: Promise.resolve({ slug: "alfaville" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" }));
  });
});
