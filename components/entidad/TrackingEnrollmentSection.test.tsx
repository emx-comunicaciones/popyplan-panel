import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { buildOrgMembershipFull } from "@/test-utils/fixtures/orgMembershipFull";
import { buildEnrollment } from "@/test-utils/fixtures/tracking";

const useEnrollmentsMock = vi.hoisted(() => vi.fn());
const createMutate = vi.hoisted(() => vi.fn());
const updateMutate = vi.hoisted(() => vi.fn());
const closeMutate = vi.hoisted(() => vi.fn());
const closeState = vi.hoisted(() => ({ isError: false, isPending: false, error: null as unknown }));
const createState = vi.hoisted(() => ({ isError: false, error: null as unknown }));
const useOrgMembersMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useProgramEnrollments", () => ({
  useEnrollments: useEnrollmentsMock,
  useCreateEnrollment: () => ({ mutate: createMutate, reset: vi.fn(), isPending: false, ...createState }),
  useUpdateEnrollment: () => ({ mutate: updateMutate, reset: vi.fn(), isPending: false, isError: false }),
  useCloseEnrollment: () => ({ mutate: closeMutate, reset: vi.fn(), ...closeState }),
}));
vi.mock("@/hooks/useOrgMembers", () => ({ useOrgMembers: useOrgMembersMock }));

import { TrackingEnrollmentSection } from "./TrackingEnrollmentSection";

beforeEach(() => {
  useOrgMembersMock.mockReturnValue({
    data: [
      buildOrgMembershipFull({ id: 190, user: 11, role: "referente", public_name: "Referente" }),
      buildOrgMembershipFull({ id: 191, user: 12, role: "referente", public_name: "Iker" }),
      buildOrgMembershipFull({ id: 186, user: 7, role: "titular", public_name: "Titular" }),
    ],
    isError: false,
  });
});

afterEach(() => {
  useEnrollmentsMock.mockReset();
  createMutate.mockReset();
  updateMutate.mockReset();
  closeMutate.mockReset();
  useOrgMembersMock.mockReset();
  closeState.isError = false;
  closeState.error = null;
  createState.isError = false;
  createState.error = null;
});

function renderSection() {
  return render(<TrackingEnrollmentSection orgId={96} userId="13" personName="Persona 01" />);
}

describe("TrackingEnrollmentSection", () => {
  it("no tiene violaciones de accesibilidad con el diálogo de alta abierto (axe)", async () => {
    useEnrollmentsMock.mockReturnValue({ data: [], isError: false, error: null });
    const { container } = renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Dar de alta en el programa" }));

    expect(await axe(container)).toHaveNoViolations();
  });

  it("con un 404 del backend (servicio apagado) no pinta nada", () => {
    useEnrollmentsMock.mockReturnValue({ data: undefined, isError: true, error: { kind: "sin_acceso", message: "" } });
    const { container } = renderSection();
    expect(container).toBeEmptyDOMElement();
  });

  it("un fallo real se pinta dentro del bloque", () => {
    useEnrollmentsMock.mockReturnValue({ data: undefined, isError: true, error: { kind: "desconocido", message: "" } });
    renderSection();
    expect(screen.getByText("No se pudo cargar el programa")).toBeInTheDocument();
    expect(screen.getByText("No se pudieron cargar las inscripciones del programa.")).toBeInTheDocument();
  });

  it("mientras carga, un texto de carga", () => {
    useEnrollmentsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    renderSection();
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
  });

  it("sin inscripción abierta enseña la última y el botón de alta", () => {
    useEnrollmentsMock.mockReturnValue({
      data: [buildEnrollment({ status: "closed", ended_at: "2026-09-10T10:00:00Z" })],
      isError: false,
      error: null,
    });
    renderSection();
    expect(screen.getByText("No está en el programa.")).toBeInTheDocument();
    expect(screen.getByText(/Última inscripción: Cerrado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dar de alta en el programa" })).toBeInTheDocument();
  });

  it("alta: manda el id de la MEMBRESÍA del referente, no el de la cuenta", async () => {
    useEnrollmentsMock.mockReturnValue({ data: [], isError: false, error: null });
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Dar de alta en el programa" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Tipo de seguimiento"), "gambling");
    await userEvent.selectOptions(within(dialog).getByLabelText("Referente"), "Iker");
    // Solo los referentes: el titular no se ofrece.
    expect(within(dialog).queryByRole("option", { name: "Titular" })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Dar de alta" }));

    expect(createMutate).toHaveBeenCalledWith(
      { user_id: 13, tracking_type: "gambling", referent: 191 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("alta con «Otro» exige descripción y la manda; sin referente no manda la clave", async () => {
    useEnrollmentsMock.mockReturnValue({ data: [], isError: false, error: null });
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Dar de alta en el programa" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Tipo de seguimiento"), "other");
    const submit = within(dialog).getByRole("button", { name: "Dar de alta" });
    expect(submit).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Descripción del seguimiento"), "Pantallas");
    await userEvent.click(submit);

    expect(createMutate).toHaveBeenCalledWith(
      { user_id: 13, tracking_type: "other", tracking_label: "Pantallas" },
      expect.anything(),
    );
  });

  it("el error de la mutación se pinta dentro del diálogo, con el texto del backend", async () => {
    useEnrollmentsMock.mockReturnValue({ data: [], isError: false, error: null });
    createState.isError = true;
    createState.error = { kind: "invalido", message: "x", detail: "Esta persona no es de la entidad." };
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Dar de alta en el programa" }));
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent(
      "Esta persona no es de la entidad.",
    );
  });

  it("si la lista de referentes falla (moderador), lo avisa y se puede seguir sin referente", async () => {
    useEnrollmentsMock.mockReturnValue({ data: [], isError: false, error: null });
    useOrgMembersMock.mockReturnValue({ data: undefined, isError: true });
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Dar de alta en el programa" }));
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent(
      "No se pudieron cargar los referentes.",
    );
  });

  it("editar: conserva el referente actual aunque no esté en la lista y solo manda lo que cambió", async () => {
    useEnrollmentsMock.mockReturnValue({
      data: [buildEnrollment({ referent: { id: 999, public_name: "Antigua" } })],
      isError: false,
      error: null,
    });
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Cambiar tipo o referente" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Referente")).toHaveValue("999");
    await userEvent.selectOptions(within(dialog).getByLabelText("Referente"), "");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));

    expect(updateMutate).toHaveBeenCalledWith(
      { enrollmentId: 1, changes: { referent: null } },
      expect.anything(),
    );
  });

  it("editar el tipo manda tipo y etiqueta", async () => {
    useEnrollmentsMock.mockReturnValue({ data: [buildEnrollment({ status: "active" })], isError: false, error: null });
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Cambiar tipo o referente" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Tipo de seguimiento"), "drugs");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));

    expect(updateMutate).toHaveBeenCalledWith(
      { enrollmentId: 1, changes: { tracking_type: "drugs", tracking_label: "" } },
      expect.anything(),
    );
  });

  it("dar de baja pide confirmación y pinta el error dentro del diálogo", async () => {
    useEnrollmentsMock.mockReturnValue({
      data: [buildEnrollment({ status: "active", accepted_at: "2026-09-20T10:00:00Z" })],
      isError: false,
      error: null,
    });
    renderSection();
    expect(screen.getByText("Aceptó")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Dar de baja" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Persona 01 saldrá del programa de seguimiento.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Dar de baja" }));
    expect(closeMutate).toHaveBeenCalledWith(1, expect.objectContaining({ onSuccess: expect.any(Function) }));
  });

  it("con el cierre en error, el mensaje literal va dentro del diálogo", async () => {
    useEnrollmentsMock.mockReturnValue({ data: [buildEnrollment()], isError: false, error: null });
    closeState.isError = true;
    closeState.error = { kind: "conflicto", message: "x", detail: "La inscripción ya no está abierta." };
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Dar de baja" }));
    expect(within(screen.getByRole("alertdialog")).getByRole("alert")).toHaveTextContent(
      "La inscripción ya no está abierta.",
    );
  });
});
