import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useAttendeesMock = vi.hoisted(() => vi.fn());
const useMarkAttendanceMock = vi.hoisted(() => vi.fn());
const useCheckinMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useAttendees", () => ({ useAttendees: useAttendeesMock }));
vi.mock("@/hooks/useMarkAttendance", () => ({ useMarkAttendance: useMarkAttendanceMock }));
vi.mock("@/hooks/useCheckin", () => ({ useCheckin: useCheckinMock }));

import EntidadAsistenciaPage from "./page";

const ATTENDEE = {
  user: { id: 42, username: "ana", public_name: "Ana", photo: null, verification_level: 1 },
  public_name: "Ana",
  status: "registered",
  guests: 1,
  registered_at: "2026-01-01T09:00:00Z",
  marked_at: null,
};

afterEach(() => {
  getServerSessionMock.mockReset();
  useAttendeesMock.mockReset();
  useMarkAttendanceMock.mockReset();
  useCheckinMock.mockReset();
});

async function renderPage(slug = "alfaville", eventId = "event-uuid-1") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role: "titular", organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadAsistenciaPage({ params: Promise.resolve({ slug, eventId }) });
  return render(element);
}

describe("EntidadAsistenciaPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    useAttendeesMock.mockReturnValue({ data: [ATTENDEE], isError: false, error: null });
    useMarkAttendanceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, variables: undefined });
    useCheckinMock.mockReturnValue({ mutate: vi.fn(), isPending: false });

    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("muestra la lista de asistentes con su estado y acompañantes", async () => {
    useAttendeesMock.mockReturnValue({ data: [ATTENDEE], isError: false, error: null });
    useMarkAttendanceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, variables: undefined });
    useCheckinMock.mockReturnValue({ mutate: vi.fn(), isPending: false });

    await renderPage();

    expect(screen.getByRole("heading", { name: "Asistencia" })).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Inscrito")).toBeInTheDocument();
  });

  it("«Marcar asistió» llama a mark con {userId, attended:true}", async () => {
    useAttendeesMock.mockReturnValue({ data: [ATTENDEE], isError: false, error: null });
    const mutate = vi.fn();
    useMarkAttendanceMock.mockReturnValue({ mutate, isPending: false, variables: undefined });
    useCheckinMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const user = userEvent.setup();

    await renderPage();
    await user.click(screen.getByRole("button", { name: "Marcar asistió" }));

    expect(mutate).toHaveBeenCalledWith(
      { userId: 42, attended: true },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("«Marcar no asistió» llama a mark con {userId, attended:false}", async () => {
    useAttendeesMock.mockReturnValue({ data: [ATTENDEE], isError: false, error: null });
    const mutate = vi.fn();
    useMarkAttendanceMock.mockReturnValue({ mutate, isPending: false, variables: undefined });
    useCheckinMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const user = userEvent.setup();

    await renderPage();
    await user.click(screen.getByRole("button", { name: "Marcar no asistió" }));

    expect(mutate).toHaveBeenCalledWith(
      { userId: 42, attended: false },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("check-in: pegar un token (o el payload completo del QR) y enviarlo", async () => {
    useAttendeesMock.mockReturnValue({ data: [ATTENDEE], isError: false, error: null });
    useMarkAttendanceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, variables: undefined });
    const mutate = vi.fn((_vars, options) => options?.onSuccess?.({ status: "attended", already: false }));
    useCheckinMock.mockReturnValue({ mutate, isPending: false });
    const user = userEvent.setup();

    await renderPage();
    await user.type(screen.getByLabelText("Token"), "popyplan://checkin/token-abc-123");
    await user.click(screen.getByRole("button", { name: "Dar entrada" }));

    expect(mutate).toHaveBeenCalledWith(
      { token: "token-abc-123" },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(screen.getByText("Check-in correcto.")).toBeInTheDocument();
  });

  it("check-in ya usado (already:true) muestra el mensaje de idempotencia", async () => {
    useAttendeesMock.mockReturnValue({ data: [ATTENDEE], isError: false, error: null });
    useMarkAttendanceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, variables: undefined });
    const mutate = vi.fn((_vars, options) => options?.onSuccess?.({ status: "attended", already: true }));
    useCheckinMock.mockReturnValue({ mutate, isPending: false });
    const user = userEvent.setup();

    await renderPage();
    await user.type(screen.getByLabelText("Token"), "token-ya-usado");
    await user.click(screen.getByRole("button", { name: "Dar entrada" }));

    expect(screen.getByText("Este token ya se había usado (check-in ya dado).")).toBeInTheDocument();
  });

  it("check-in fuera de ventana (409) muestra el mensaje del contrato", async () => {
    useAttendeesMock.mockReturnValue({ data: [ATTENDEE], isError: false, error: null });
    useMarkAttendanceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, variables: undefined });
    const mutate = vi.fn((_vars, options) =>
      options?.onError?.({ message: "Fuera de la ventana de check-in de esta actividad." }),
    );
    useCheckinMock.mockReturnValue({ mutate, isPending: false });
    const user = userEvent.setup();

    await renderPage();
    await user.type(screen.getByLabelText("Token"), "token-tarde");
    await user.click(screen.getByRole("button", { name: "Dar entrada" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Fuera de la ventana de check-in de esta actividad.",
    );
  });

  it("sin BarcodeDetector en el navegador, no ofrece «Escanear con la cámara»", async () => {
    useAttendeesMock.mockReturnValue({ data: [ATTENDEE], isError: false, error: null });
    useMarkAttendanceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, variables: undefined });
    useCheckinMock.mockReturnValue({ mutate: vi.fn(), isPending: false });

    await renderPage();

    expect(screen.queryByRole("button", { name: "Escanear con la cámara" })).not.toBeInTheDocument();
  });

  it("sin inscritos muestra el estado vacío", async () => {
    useAttendeesMock.mockReturnValue({ data: [], isError: false, error: null });
    useMarkAttendanceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, variables: undefined });
    useCheckinMock.mockReturnValue({ mutate: vi.fn(), isPending: false });

    await renderPage();

    expect(screen.getByText("Sin inscritos en esta actividad")).toBeInTheDocument();
  });

  it("error cargando asistentes pinta ErrorState", async () => {
    useAttendeesMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudo cargar la lista de asistentes."),
    });
    useMarkAttendanceMock.mockReturnValue({ mutate: vi.fn(), isPending: false, variables: undefined });
    useCheckinMock.mockReturnValue({ mutate: vi.fn(), isPending: false });

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar la lista de asistentes");
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadAsistenciaPage({ params: Promise.resolve({ slug: "alfaville", eventId: "e1" }) }),
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
      EntidadAsistenciaPage({ params: Promise.resolve({ slug: "otra-entidad", eventId: "e1" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
