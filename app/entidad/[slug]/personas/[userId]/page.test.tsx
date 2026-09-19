import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { PERSON_SUPPORT_ROWS } from "@/test-utils/fixtures/support";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const usePersonMock = vi.hoisted(() => vi.fn());
const useAssignReferentMock = vi.hoisted(() => vi.fn());
const useOrgMembersMock = vi.hoisted(() => vi.fn());
const usePersonSupportMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/usePerson", () => ({ usePerson: usePersonMock }));
vi.mock("@/hooks/useAssignReferent", () => ({ useAssignReferent: useAssignReferentMock }));
vi.mock("@/hooks/useOrgMembers", () => ({ useOrgMembers: useOrgMembersMock }));
vi.mock("@/hooks/usePersonSupport", () => ({ usePersonSupport: usePersonSupportMock }));

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
  usePersonSupportMock.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null });
});

afterEach(() => {
  getServerSessionMock.mockReset();
  usePersonMock.mockReset();
  useAssignReferentMock.mockReset();
  useOrgMembersMock.mockReset();
  usePersonSupportMock.mockReset();
  vi.unstubAllEnvs();
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
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
    useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });
    usePersonSupportMock.mockReturnValue({ data: PERSON_SUPPORT_ROWS, isError: false, error: null });

    const { container } = await renderPage("referente");

    expect(await axe(container)).toHaveNoViolations();
  });

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
    // «Teléfono verificado» (nivel del contrato, `LevelEnum`) es la única
    // excepción permitida: dice que el teléfono está verificado, no cuál
    // es. Cualquier otra mención a un teléfono sí sería un dato de
    // contacto, y el número en sí nunca aparece.
    expect(screen.queryByText(/teléfono(?! verificado)/i)).not.toBeInTheDocument();
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

  it("una foto en un host permitido se pinta", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
    usePersonMock.mockReturnValue({
      data: { ...PERSON_DETAIL, photo: "https://api.test/media/ana.png" },
      isError: false,
      error: null,
    });
    useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });

    const { container } = await renderPage();

    expect(container.querySelector("img")).not.toBeNull();
  });

  it("una foto en un host NO permitido no se pinta y la ficha sigue en pie", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
    usePersonMock.mockReturnValue({
      data: { ...PERSON_DETAIL, photo: "https://host-ajeno.example/ana.png" },
      isError: false,
      error: null,
    });
    useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });

    const { container } = await renderPage();

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  describe("Red de apoyo (solo referente)", () => {
    it("referente con red de apoyo ve la sección con cada vínculo y el aviso fijo", async () => {
      usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
      useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });
      usePersonSupportMock.mockReturnValue({ data: PERSON_SUPPORT_ROWS, isError: false, error: null });

      const { container } = await renderPage("referente");

      expect(usePersonSupportMock).toHaveBeenCalledWith(7, "42", true);
      expect(screen.getByRole("heading", { name: "Red de apoyo", level: 2 })).toBeInTheDocument();
      expect(screen.getByText("Miren · Madre o padre · Recibe avisos")).toBeInTheDocument();
      expect(screen.getByText("Jon · Amistad · Sin avisos")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Solo tú, como referente, ves esta red. Popyplan no guarda teléfonos: contacta con la persona por el chat de la app.",
        ),
      ).toBeInTheDocument();
      expect(container.textContent).not.toMatch(/@/);
    });

    it("referente sin red de apoyo activa ve el mensaje de vacío", async () => {
      usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
      useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });
      usePersonSupportMock.mockReturnValue({ data: [], isError: false, error: null });

      await renderPage("referente");

      expect(screen.getByRole("heading", { name: "Red de apoyo", level: 2 })).toBeInTheDocument();
      expect(screen.getByText("Esta persona no tiene red de apoyo activa.")).toBeInTheDocument();
    });

    it("404/403 (kind 'sin_acceso'): la sección no existe, sin mensaje", async () => {
      usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
      useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });
      usePersonSupportMock.mockReturnValue({
        data: undefined,
        isError: true,
        error: { kind: "sin_acceso", message: "Sin acceso a la red de apoyo de esta persona." },
      });

      await renderPage("referente");

      expect(screen.queryByRole("heading", { name: "Red de apoyo" })).not.toBeInTheDocument();
      expect(screen.queryByText(/Sin acceso a la red de apoyo/)).not.toBeInTheDocument();
    });

    it("error 'desconocido': ErrorState dentro de la sección, el resto de la ficha sigue", async () => {
      usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
      useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });
      usePersonSupportMock.mockReturnValue({
        data: undefined,
        isError: true,
        error: { kind: "desconocido", message: "No se pudo cargar la red de apoyo de esta persona." },
      });

      await renderPage("referente");

      expect(screen.getByRole("heading", { name: "Red de apoyo", level: 2 })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar la red de apoyo de esta persona.");
      // el resto de la ficha sigue en pie
      expect(screen.getByText("Ana")).toBeInTheDocument();
      expect(screen.getByText("Comunidad Uno")).toBeInTheDocument();
    });

    it("titular no es referente: el hook se llama con enabled false y no hay sección", async () => {
      usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
      useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });

      await renderPage("titular");

      expect(usePersonSupportMock).toHaveBeenCalledWith(7, "42", false);
      expect(screen.queryByRole("heading", { name: "Red de apoyo" })).not.toBeInTheDocument();
    });

    it("consulta en vuelo: no se pinta ni la cabecera (sin parpadeo antes de un posible 404), el resto de la ficha sigue", async () => {
      usePersonMock.mockReturnValue({ data: PERSON_DETAIL, isError: false, error: null });
      useAssignReferentMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false });
      usePersonSupportMock.mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
        error: null,
      });

      await renderPage("referente");

      expect(screen.queryByRole("heading", { name: "Red de apoyo" })).not.toBeInTheDocument();
      expect(screen.queryByText(/Cargando red de apoyo/)).not.toBeInTheDocument();
      // el resto de la ficha sigue en pie
      expect(screen.getByText("Ana")).toBeInTheDocument();
      expect(screen.getByText("Comunidad Uno")).toBeInTheDocument();
    });
  });
});
