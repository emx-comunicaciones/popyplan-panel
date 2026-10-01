import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
const fetchWithAuthMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock, fetchWithAuth: fetchWithAuthMock };
});
const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
const downloadMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/download/triggerDownload", () => ({ triggerDownload: downloadMock }));

import { axe } from "@/test-utils/axe";
import { buildCrmContact, paginated } from "@/test-utils/fixtures/crm";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import { render, screen, waitFor, within, fireEvent, act } from "@/test-utils/render";

import PlataformaComercialContactosPage, { generateMetadata } from "./page";

const CONTACT = buildCrmContact();
const SECOND = buildCrmContact({ id: 8, first_name: "Joseba", last_name: "Urrutia", position: "Alcalde", department: null, department_name: "", email: "", phone: "", mobile: "", last_contact_at: null, activities_count: 0, account: 2, account_name: "Ayuntamiento de Irun" });

function mock() {
  apiFetchMock.mockImplementation(async (path: string) => {
    if (path.startsWith("/api/crm/contacts/")) return paginated([CONTACT, SECOND]);
    if (path.startsWith("/api/crm/catalog/")) return [{ id: 20, kind: "department", name: "Servicios Sociales", order: 0, is_active: true }];
    throw new Error(`sin mock para ${path}`);
  });
}

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
  fetchWithAuthMock.mockReset();
  downloadMock.mockReset();
});

async function renderPage(role = "sales") {
  getServerSessionMock.mockResolvedValue({ token: "t", me: buildMe({ org_memberships: [] }), platformRole: buildPlatformRole(role as never) });
  return render(await PlataformaComercialContactosPage());
}

const contactCalls = () => apiFetchMock.mock.calls.map((c) => c[0] as string).filter((p) => p.startsWith("/api/crm/contacts/?"));

describe("PlataformaComercialContactosPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mock();
    const { container } = await renderPage();
    await screen.findByText("María Etxeberria");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título", async () => {
    expect((await generateMetadata()).title).toBe("Contactos");
  });

  it("lista los contactos con cargo, entidad, teléfono, email y actividades", async () => {
    mock();
    await renderPage();
    const table = await screen.findByRole("table", { name: "Contactos del CRM comercial" });
    const row = within(table).getByText("María Etxeberria").closest("tr") as HTMLElement;
    expect(within(row).getByText("Responsable de Servicios Sociales")).toBeInTheDocument();
    expect(within(row).getByText("Servicios Sociales")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Ayuntamiento de Donostia" })).toHaveAttribute("href", "/plataforma/comercial/entidades/1");
    expect(within(row).getByRole("link", { name: "943111111" })).toHaveAttribute("href", "tel:943111111");
    expect(within(row).getByRole("link", { name: "maria@donostia.eus" })).toHaveAttribute("href", "mailto:maria@donostia.eus");
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Contactos" })).toBeInTheDocument();
  });

  it("el filtro de departamento y la búsqueda cambian la URL pedida", async () => {
    mock();
    const user = userEvent.setup();
    await renderPage();
    await screen.findByText("María Etxeberria");
    await user.selectOptions(screen.getByLabelText("Departamento"), "20");
    await waitFor(() => expect(contactCalls().some((p) => p.includes("department=20"))).toBe(true));

    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByLabelText("Buscar por nombre, cargo, email o teléfono"), { target: { value: "joseba" } });
      expect(contactCalls().some((p) => p.includes("q=joseba"))).toBe(false);
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(contactCalls().some((p) => p.includes("q=joseba"))).toBe(true));
  });

  it("«Exportar CSV» descarga con los filtros actuales", async () => {
    mock();
    fetchWithAuthMock.mockResolvedValue({ blob: async () => new Blob(["x"]), headers: new Headers({ "Content-Disposition": 'attachment; filename="contactos.csv"' }) });
    const user = userEvent.setup();
    await renderPage();
    await screen.findByText("María Etxeberria");
    await user.selectOptions(screen.getByLabelText("Departamento"), "20");
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(downloadMock).toHaveBeenCalled());
    expect(fetchWithAuthMock.mock.calls[0][0]).toContain("/api/crm/export/contacts/?department=20");
  });

  it("muestra el vacío y el error de carga", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/crm/contacts/")) return paginated([]);
      return [];
    });
    const { unmount } = await renderPage();
    expect(await screen.findByText("Ningún contacto coincide.")).toBeInTheDocument();
    unmount();
    const { ApiError } = await import("@/lib/api/client");
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/crm/contacts/")) throw new ApiError(500, {});
      return [];
    });
    await renderPage();
    expect(await screen.findByText("No se pudieron cargar los contactos.")).toBeInTheDocument();
  });
});
