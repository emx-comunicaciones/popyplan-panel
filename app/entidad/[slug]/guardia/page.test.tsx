import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildHelpRequest } from "@/test-utils/fixtures/helpRequest";
import { buildOrganization } from "@/test-utils/fixtures/organization";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const usePendingHelpRequestsMock = vi.hoisted(() => vi.fn());
const useAcknowledgeHelpRequestMock = vi.hoisted(() => vi.fn());
const useOrganizationMock = vi.hoisted(() => vi.fn());
const useUpdateOrganizationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/usePendingHelpRequests", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePendingHelpRequests")>(
    "@/hooks/usePendingHelpRequests",
  );
  return { ...actual, usePendingHelpRequests: usePendingHelpRequestsMock };
});
vi.mock("@/hooks/useAcknowledgeHelpRequest", () => ({
  useAcknowledgeHelpRequest: useAcknowledgeHelpRequestMock,
}));
vi.mock("@/hooks/useOrganization", () => ({ useOrganization: useOrganizationMock }));
vi.mock("@/hooks/useUpdateOrganization", () => ({ useUpdateOrganization: useUpdateOrganizationMock }));

import EntidadGuardiaPage from "./page";

function idleMutation() {
  return { mutate: vi.fn(), isPending: false, isError: false, isSuccess: false };
}

afterEach(() => {
  getServerSessionMock.mockReset();
  usePendingHelpRequestsMock.mockReset();
  useAcknowledgeHelpRequestMock.mockReset();
  useOrganizationMock.mockReset();
  useUpdateOrganizationMock.mockReset();
});

async function renderPage(role = "titular", slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadGuardiaPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadGuardiaPage", () => {
  it("lista los avisos pendientes y «He contactado» llama a la mutación", async () => {
    const request = buildHelpRequest({ id: "hr-1", acknowledged_at: null });
    usePendingHelpRequestsMock.mockReturnValue({ data: [request], isError: false, error: null });
    const acknowledgeMutate = vi.fn();
    useAcknowledgeHelpRequestMock.mockReturnValue({
      mutate: acknowledgeMutate,
      isPending: false,
      isError: false,
    });
    useOrganizationMock.mockReturnValue({ data: buildOrganization(), isError: false, error: null });
    useUpdateOrganizationMock.mockReturnValue(idleMutation());
    const user = userEvent.setup();

    await renderPage();

    expect(screen.getByRole("heading", { name: "Guardia" })).toBeInTheDocument();
    expect(screen.getByText("Marta L.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "He contactado" }));
    expect(acknowledgeMutate).toHaveBeenCalledWith("hr-1");
  });

  it("un aviso ya atendido muestra el badge, no el botón", async () => {
    const request = buildHelpRequest({ id: "hr-1", acknowledged_at: "2026-09-01T18:40:00Z" });
    usePendingHelpRequestsMock.mockReturnValue({ data: [request], isError: false, error: null });
    useAcknowledgeHelpRequestMock.mockReturnValue(idleMutation());
    useOrganizationMock.mockReturnValue({ data: buildOrganization(), isError: false, error: null });
    useUpdateOrganizationMock.mockReturnValue(idleMutation());

    await renderPage();

    expect(screen.getByText("Atendido")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "He contactado" })).not.toBeInTheDocument();
  });

  it("guardar el teléfono de ayuda llama a la mutación con help_phone", async () => {
    usePendingHelpRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    useAcknowledgeHelpRequestMock.mockReturnValue(idleMutation());
    useOrganizationMock.mockReturnValue({
      data: buildOrganization({ help_phone: "+34600000009" }),
      isError: false,
      error: null,
    });
    const updateMutate = vi.fn();
    useUpdateOrganizationMock.mockReturnValue({
      mutate: updateMutate,
      isPending: false,
      isError: false,
      isSuccess: false,
    });
    const user = userEvent.setup();

    await renderPage();
    const input = screen.getByLabelText("Teléfono de ayuda");
    await user.clear(input);
    await user.type(input, "+34611111111");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateMutate).toHaveBeenCalledWith({ help_phone: "+34611111111" });
  });

  it("sin avisos muestra el estado vacío", async () => {
    usePendingHelpRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    useAcknowledgeHelpRequestMock.mockReturnValue(idleMutation());
    useOrganizationMock.mockReturnValue({ data: buildOrganization(), isError: false, error: null });
    useUpdateOrganizationMock.mockReturnValue(idleMutation());

    await renderPage();

    expect(screen.getByText("Sin avisos pendientes")).toBeInTheDocument();
  });

  it("sin acceso (403) muestra «Sin acceso»", async () => {
    const { PendingHelpRequestsError } = await import("@/hooks/usePendingHelpRequests");
    usePendingHelpRequestsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new PendingHelpRequestsError("sin_acceso", "No tienes acceso a los avisos de ayuda."),
    });
    useAcknowledgeHelpRequestMock.mockReturnValue(idleMutation());
    useOrganizationMock.mockReturnValue({ data: buildOrganization(), isError: false, error: null });
    useUpdateOrganizationMock.mockReturnValue(idleMutation());

    await renderPage();

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("analista no ve Guardia: «Sin acceso» a nivel de página", async () => {
    usePendingHelpRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    useAcknowledgeHelpRequestMock.mockReturnValue(idleMutation());
    useOrganizationMock.mockReturnValue({ data: buildOrganization(), isError: false, error: null });
    useUpdateOrganizationMock.mockReturnValue(idleMutation());

    await renderPage("analista");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadGuardiaPage({ params: Promise.resolve({ slug: "alfaville" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>));
  });

  it("sin membresía en esa entidad redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
      }),
      platformRole: { role: null },
    });

    await expect(
      EntidadGuardiaPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
