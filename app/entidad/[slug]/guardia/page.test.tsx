import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildHelpRequest } from "@/test-utils/fixtures/helpRequest";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildOrgMembershipFull } from "@/test-utils/fixtures/orgMembershipFull";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const usePendingHelpRequestsMock = vi.hoisted(() => vi.fn());
const useAcknowledgeHelpRequestMock = vi.hoisted(() => vi.fn());
const useOrganizationMock = vi.hoisted(() => vi.fn());
const useUpdateOrganizationMock = vi.hoisted(() => vi.fn());
// El gate de la página pide la ficha de la entidad para saber si quien
// mira es la persona de guardia (D-I8, `lib/auth/organization.ts
// ::isOnCallUser`): sin guardia nombrada, el menú manda.
const serverFetchMock = vi.hoisted(() => vi.fn());
const useOrgMembersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));
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
vi.mock("@/hooks/useOrgMembers", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useOrgMembers")>("@/hooks/useOrgMembers");
  return { ...actual, useOrgMembers: useOrgMembersMock };
});

import EntidadGuardiaPage, { generateMetadata } from "./page";

function idleMutation() {
  return { mutate: vi.fn(), isPending: false, isError: false, isSuccess: false };
}

afterEach(() => {
  getServerSessionMock.mockReset();
  usePendingHelpRequestsMock.mockReset();
  useAcknowledgeHelpRequestMock.mockReset();
  useOrganizationMock.mockReset();
  useUpdateOrganizationMock.mockReset();
  serverFetchMock.mockReset();
  useOrgMembersMock.mockReset();
});

// El selector de persona de guardia sale del equipo de la entidad
// (solo-titular): por defecto, un equipo vacío; cada test que se ocupe de
// él lo sobrescribe.
beforeEach(() => {
  useOrgMembersMock.mockReturnValue({ data: [], isError: false, error: null });
});

async function renderPage(role = "titular", slug = "alfaville", onCallUser: number | null = null) {
  serverFetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    data: buildOrganization({ id: 7, on_call_user: onCallUser }),
  });
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
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Guardia");
  });

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

    // Los dos campos de la lista blanca solo-titular viajan en el mismo
    // `PATCH` (D-I8): sin guardia elegida, `on_call_user` es `null`
    // (el campo es `null=True`/`SET_NULL`, no `blank`).
    expect(updateMutate).toHaveBeenCalledWith({ help_phone: "+34611111111", on_call_user: null });
  });

  it("la persona de guardia se elige por nombre, nunca por id (D-I8)", async () => {
    usePendingHelpRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    useAcknowledgeHelpRequestMock.mockReturnValue(idleMutation());
    useOrganizationMock.mockReturnValue({
      data: buildOrganization({ help_phone: "+34600000009", on_call_user: 11 }),
      isError: false,
      error: null,
    });
    useOrgMembersMock.mockReturnValue({
      data: [
        buildOrgMembershipFull({ id: 1, user: 11, role: "titular", public_name: "Ana" }),
        buildOrgMembershipFull({ id: 2, user: 12, role: "referente", public_name: "Bea" }),
      ],
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

    const select = screen.getByLabelText("Persona de guardia");
    // La guardia actual se lee por su nombre, no como «Persona de
    // guardia actual: 11».
    expect(select).toHaveValue("11");
    expect(screen.queryByText(/: 11/)).not.toBeInTheDocument();

    await user.selectOptions(select, "12");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateMutate).toHaveBeenCalledWith({
      help_phone: "+34600000009",
      on_call_user: 12,
    });
  });

  it("«Sin asignar» vacía la guardia con null, no con cadena vacía", async () => {
    usePendingHelpRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    useAcknowledgeHelpRequestMock.mockReturnValue(idleMutation());
    useOrganizationMock.mockReturnValue({
      data: buildOrganization({ help_phone: "", on_call_user: 11 }),
      isError: false,
      error: null,
    });
    useOrgMembersMock.mockReturnValue({
      data: [buildOrgMembershipFull({ id: 1, user: 11, public_name: "Ana" })],
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

    await user.selectOptions(screen.getByLabelText("Persona de guardia"), "");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateMutate).toHaveBeenCalledWith({ help_phone: "", on_call_user: null });
  });

  it("el 403 solo-titular del equipo no rompe la pantalla: dice quién puede cambiarla", async () => {
    const { OrgMembersError } = await import("@/hooks/useOrgMembers");
    usePendingHelpRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    useAcknowledgeHelpRequestMock.mockReturnValue(idleMutation());
    useOrganizationMock.mockReturnValue({
      data: buildOrganization({ on_call_user: 11 }),
      isError: false,
      error: null,
    });
    useOrgMembersMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new OrgMembersError("sin_acceso", "Solo el titular puede ver el equipo de la entidad."),
    });
    useUpdateOrganizationMock.mockReturnValue(idleMutation());

    await renderPage("moderador");

    expect(screen.queryByLabelText("Persona de guardia")).not.toBeInTheDocument();
    expect(
      screen.getByText("Solo el titular puede ver y cambiar la persona de guardia."),
    ).toBeInTheDocument();
    // El id de cuenta de la guardia no se pinta nunca.
    expect(screen.queryByText(/11/)).not.toBeInTheDocument();
    // El teléfono de ayuda se sigue pudiendo guardar.
    expect(screen.getByLabelText("Teléfono de ayuda")).toBeInTheDocument();
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

  it("dinamizador no ve Guardia: «Sin acceso» (D-I8, `pending` pide `moderar`)", async () => {
    usePendingHelpRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    useAcknowledgeHelpRequestMock.mockReturnValue(idleMutation());
    useOrganizationMock.mockReturnValue({ data: buildOrganization(), isError: false, error: null });
    useUpdateOrganizationMock.mockReturnValue(idleMutation());

    await renderPage("dinamizador");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("la persona de guardia entra aunque su rol no traiga la sección", async () => {
    // `buildMe()` es la cuenta 42: nombrarla `on_call_user` es lo único
    // que mira `HelpRequestViewSet.pending` además de `moderar`.
    usePendingHelpRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    useAcknowledgeHelpRequestMock.mockReturnValue(idleMutation());
    useOrganizationMock.mockReturnValue({ data: buildOrganization(), isError: false, error: null });
    useUpdateOrganizationMock.mockReturnValue(idleMutation());

    await renderPage("analista", "alfaville", 42);

    expect(screen.getByRole("heading", { name: "Guardia" })).toBeInTheDocument();
    expect(screen.queryByText("Sin acceso")).not.toBeInTheDocument();
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
