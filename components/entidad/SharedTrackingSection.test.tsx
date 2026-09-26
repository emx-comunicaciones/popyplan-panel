import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { buildSharedNothing, buildSharedTracking } from "@/test-utils/fixtures/tracking";

const useSharedTrackingMock = vi.hoisted(() => vi.fn());
const proposeMutate = vi.hoisted(() => vi.fn());
const proposeState = vi.hoisted(() => ({ isSuccess: false, isError: false, error: null as unknown }));
vi.mock("@/hooks/useSharedTracking", () => ({
  useSharedTracking: useSharedTrackingMock,
  useProposeGoal: () => ({ mutate: proposeMutate, isPending: false, ...proposeState }),
}));

import { SharedTrackingSection } from "./SharedTrackingSection";

afterEach(() => {
  useSharedTrackingMock.mockReset();
  proposeMutate.mockReset();
  proposeState.isSuccess = false;
  proposeState.isError = false;
  proposeState.error = null;
});

function ok(data = buildSharedTracking()) {
  useSharedTrackingMock.mockReturnValue({ data, isPending: false, isError: false, error: null });
}

describe("SharedTrackingSection", () => {
  it("no tiene violaciones de accesibilidad con todo compartido (axe)", async () => {
    ok();
    const { container } = render(<SharedTrackingSection orgId={96} userId="13" enabled />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("sin habilitar, en vuelo o con 404 no pinta absolutamente nada", () => {
    ok();
    const disabled = render(<SharedTrackingSection orgId={96} userId="13" enabled={false} />);
    expect(disabled.container).toBeEmptyDOMElement();
    disabled.unmount();

    useSharedTrackingMock.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null });
    const pending = render(<SharedTrackingSection orgId={96} userId="13" enabled />);
    expect(pending.container).toBeEmptyDOMElement();
    pending.unmount();

    useSharedTrackingMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { kind: "sin_acceso", message: "" },
    });
    const notFound = render(<SharedTrackingSection orgId={96} userId="13" enabled />);
    expect(notFound.container).toBeEmptyDOMElement();
  });

  it("un fallo real pinta la cabecera, el aviso y el error, sin formulario", () => {
    useSharedTrackingMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { kind: "desconocido", message: "", detail: "Algo se rompió." },
    });
    render(<SharedTrackingSection orgId={96} userId="13" enabled />);
    expect(screen.getByRole("heading", { name: "Seguimiento compartido" })).toBeInTheDocument();
    expect(screen.getByText("Algo se rompió.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Objetivo")).not.toBeInTheDocument();
  });

  it("con todo compartido pinta el aviso fijo y las cinco secciones", () => {
    ok();
    render(<SharedTrackingSection orgId={96} userId="13" enabled />);

    expect(
      screen.getByText("Solo ves lo que la persona ha decidido compartir contigo; cada consulta queda registrada."),
    ).toBeInTheDocument();
    expect(screen.getByText("Estado general")).toBeInTheDocument();
    expect(screen.getByText("Último estado de ánimo: Bien")).toBeInTheDocument();
    expect(screen.getByText("Check-ins")).toBeInTheDocument();
    expect(screen.getByText(/Objetivo principal cumplido · Deporte · Quedó con alguien/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ganas de consumir" })).toBeInTheDocument();
    expect(screen.getByText("Bastante")).toBeInTheDocument();
    expect(screen.getByText("Caminar tres días")).toBeInTheDocument();
    expect(screen.getByText("Propuesto por la asociación")).toBeInTheDocument();
    expect(screen.getByText(/Actividades a las que asistió: 3/)).toBeInTheDocument();
    expect(screen.getByText("En los últimos 28 días.")).toBeInTheDocument();
  });

  it("solo pinta las secciones que llegan (lo no consentido es null)", () => {
    ok(buildSharedTracking({ checkins: null, urges: null, general_state: null, participation: null }));
    render(<SharedTrackingSection orgId={96} userId="13" enabled />);

    expect(screen.queryByText("Check-ins")).not.toBeInTheDocument();
    expect(screen.queryByText("Ganas de consumir")).not.toBeInTheDocument();
    expect(screen.queryByText("Estado general")).not.toBeInTheDocument();
    expect(screen.queryByText("Participación")).not.toBeInTheDocument();
    expect(screen.getByText("Objetivos semanales")).toBeInTheDocument();
  });

  it("sin nada compartido lo dice y sigue ofreciendo proponer un objetivo", () => {
    ok(buildSharedNothing());
    render(<SharedTrackingSection orgId={96} userId="13" enabled />);
    expect(screen.getByText("Todavía no comparte nada contigo.")).toBeInTheDocument();
    expect(screen.getByLabelText("Objetivo")).toBeInTheDocument();
  });

  it("secciones vacías, juego, otro tipo y valores desconocidos", () => {
    ok(
      buildSharedTracking({
        tracking_type: "gambling",
        checkins: [],
        urges: [],
        goals: [],
        general_state: { last_mood: null, weeks: [] },
      }),
    );
    const { unmount } = render(<SharedTrackingSection orgId={96} userId="13" enabled />);
    expect(screen.getByRole("heading", { name: "Ganas de apostar o jugar" })).toBeInTheDocument();
    expect(screen.getByText("Sin check-ins en este periodo.")).toBeInTheDocument();
    expect(screen.getByText("Sin registros en este periodo.")).toBeInTheDocument();
    expect(screen.getByText("Sin objetivos en estas semanas.")).toBeInTheDocument();
    expect(screen.getByText("Último estado de ánimo: sin check-ins todavía")).toBeInTheDocument();
    unmount();

    ok(
      buildSharedTracking({
        tracking_type: "other",
        tracking_label: "Pantallas",
        urges: [{ date: "2026-09-24", urge: "raro" }],
      }),
    );
    render(<SharedTrackingSection orgId={96} userId="13" enabled />);
    expect(screen.getByText(/Otro: Pantallas/)).toBeInTheDocument();
    expect(screen.getAllByText("Ganas").length).toBeGreaterThan(0);
    expect(screen.getByText("raro")).toBeInTheDocument();
  });

  it("proponer objetivo manda el título recortado", async () => {
    ok();
    render(<SharedTrackingSection orgId={96} userId="13" enabled />);

    const submit = screen.getByRole("button", { name: "Proponer" });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Objetivo"), "  Ir a una actividad  ");
    await userEvent.click(submit);

    expect(proposeMutate).toHaveBeenCalledWith(
      { title: "Ir a una actividad" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("pinta el éxito y el error literal de proponer", () => {
    ok();
    proposeState.isSuccess = true;
    proposeState.isError = true;
    proposeState.error = { kind: "invalido", message: "x", detail: "Máximo 10 objetivos por semana." };
    render(<SharedTrackingSection orgId={96} userId="13" enabled />);
    expect(screen.getByText("Objetivo propuesto.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Máximo 10 objetivos por semana.");
  });
});
