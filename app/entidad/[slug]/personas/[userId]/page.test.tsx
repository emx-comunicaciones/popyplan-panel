import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const usePersonMock = vi.hoisted(() => vi.fn());
const useAssignReferentMock = vi.hoisted(() => vi.fn());
const useOrgMembersMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/usePerson", () => ({ usePerson: usePersonMock }));
vi.mock("@/hooks/useAssignReferent", () => ({ useAssignReferent: useAssignReferentMock }));
vi.mock("@/hooks/useOrgMembers", () => ({ useOrgMembers: useOrgMembersMock }));

import { buildOrgMembershipFull } from "@/test-utils/fixtures/orgMembershipFull";

import EntidadPersonaPage from "./page";

const PERSON_DETAIL = {
  user_id: 42,
  public_name: "Ana",
  photo: null,
  joined_at: "2025-01-01T09:00:00Z",
  communities_count: 1,
  events_period: 1,
  attended_period: 1,
  referent: { user_id: 7, public_name: "Bea" },
  next_event: { id: "e2", title: "Próximo taller", starts_at: "2026-09-08T18:00:00Z" },
  communities: [{ id: "c1", name: "Comunidad Uno", role: "member", joined_at: "2025-01-01T09:00:00Z" }],
  events: [{ id: "e1", title: "E1", starts_at: "2026-01-05T10:00:00Z", attendance_status: "attended" }],
  verification_level: 1,
};

beforeEach(() => {
  useOrgMembersMock.mockReturnValue({
    data: [buildOrgMembershipFull({ user: 9, role: "referente", public_name: "Coro" })],
    isError: false,
    error: null,
  });
});

afterEach(() => {
  getServerSessionMock.mockReset();
  usePersonMock.mockReset();
  useAssignReferentMock.mockReset();
  useOrgMembersMock.mockReset();
});

async function renderPage(role = "titular", slug = "alfaville", userId = "42") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadPersonaPage({ params: Promise.resolve({ slug, userId }) });
  return render(element);
}

describe("EntidadPersonaPage", () => {
  it("muestra alias, alta, referente, comunidades, actividades del periodo y próxima actividad", async () => {
    usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
    useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });

    await renderPage();

    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText(/Nivel de verificación: Teléfono verificado/)).toBeInTheDocument();
    expect(screen.getByText(/Referente: Bea/)).toBeInTheDocument();
    expect(screen.getByText("Comunidad Uno")).toBeInTheDocument();
    expect(screen.getByText("member")).toBeInTheDocument();
    expect(screen.getByText(/E1/)).toBeInTheDocument();
    expect(screen.getByText("Asistió")).toBeInTheDocument();
    expect(screen.getByText(/Próximo taller/)).toBeInTheDocument();
  });

  it("traduce cada nivel de verificación del contrato", async () => {
    for (const [level, label] of [
      [0, "Sin verificar"],
      [2, "Mayoría de edad"],
      [3, "Identidad completa"],
    ] as const) {
      usePersonMock.mockReturnValue({
        data: { ...PERSON_DETAIL, verification_level: level },
        isError: false,
        error: null,
      });
      useAssignReferentMock.mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isSuccess: false,
        isError: false,
      });

      const { unmount } = await renderPage();

      expect(screen.getByText(new RegExp(`Nivel de verificación: ${label}`))).toBeInTheDocument();
      unmount();
    }
  });

  it("nunca muestra email ni teléfono en el DOM", async () => {
    usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
    useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });

    const { container } = await (async () => {
      await renderPage();
      return { container: document.body };
    })();

    expect(container.textContent).not.toMatch(/@/);
    expect(container.textContent).not.toMatch(/\+34/);
    expect(screen.queryByText(/email|correo/i)).not.toBeInTheDocument();
    // La ficha sí dice «Nivel de verificación: Teléfono verificado» (el
    // nivel del contrato, `LevelEnum`): eso no es un dato de contacto, no
    // enseña ningún número. Lo que no puede aparecer es el teléfono en sí
    // ni una etiqueta que lo prometa.
    expect(screen.queryByText(/teléfono de contacto|teléfono:/i)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d{9}/);
  });

  it("titular/moderador ven «Asignar referente»; referente no", async () => {
    usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
    useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });

    await renderPage("titular");
    expect(screen.getByRole("button", { name: "Asignar referente" })).toBeInTheDocument();
  });

  it("si la lista de referentes falla, «Asignar referente» lo avisa bajo el select", async () => {
    usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
    useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });
    useOrgMembersMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("Solo el titular puede ver el equipo de la entidad."),
    });

    await renderPage("titular");

    expect(screen.getByText("No se pudieron cargar los referentes.")).toBeInTheDocument();
  });

  it("referente no ve el botón «Asignar referente»", async () => {
    usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
    useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });

    await renderPage("referente");

    expect(screen.queryByRole("button", { name: "Asignar referente" })).not.toBeInTheDocument();
  });

  it("asignar referente: manda userId y referentUserId al mutate", async () => {
    usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
    const mutate = vi.fn();
    useAssignReferentMock.mockReturnValue({ mutate, isPending: false, isSuccess: false, isError: false });
    const user = userEvent.setup();

    await renderPage("titular");
    await user.selectOptions(screen.getByLabelText("Persona referente"), "9");
    await user.click(screen.getByRole("button", { name: "Asignar referente" }));

    expect(mutate).toHaveBeenCalledWith({ userId: 42, referentUserId: 9 });
  });

  it("asignar referente con error muestra el mensaje", async () => {
    usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
    useAssignReferentMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: true,
      error: { message: "Esa persona ya tiene un referente asignado." },
    });

    await renderPage("titular");

    expect(screen.getByRole("alert")).toHaveTextContent("Esa persona ya tiene un referente asignado.");
  });

  it("referente sin Reference hacia esa persona (404 → sin_acceso): estado «Sin acceso»", async () => {
    usePersonMock.mockReturnValue({
      isError: true,
      error: { kind: "sin_acceso", message: "Sin acceso a esta ficha." },
      data: undefined,
    });

    await renderPage("referente");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadPersonaPage({ params: Promise.resolve({ slug: "alfaville", userId: "42" }) }),
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
      EntidadPersonaPage({ params: Promise.resolve({ slug: "otra-entidad", userId: "42" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });

  it("analista no ve la ficha de la persona: «Sin acceso»", async () => {
    usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
    useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });

    await renderPage("analista");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  });
});
