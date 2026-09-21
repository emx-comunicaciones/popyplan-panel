import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, afterEach } from "vitest";

import { axe } from "@/test-utils/axe";
import { buildHelpRequest, buildHelpRequestUserDisplay } from "@/test-utils/fixtures/helpRequest";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildOrgMembershipFull } from "@/test-utils/fixtures/orgMembershipFull";
import { render, screen } from "@/test-utils/render";

const usePendingHelpRequestsMock = vi.hoisted(() => vi.fn());
const useAcknowledgeHelpRequestMock = vi.hoisted(() => vi.fn());
const useOrganizationMock = vi.hoisted(() => vi.fn());
const useUpdateOrganizationMock = vi.hoisted(() => vi.fn());
const useOrgMembersMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/usePendingHelpRequests", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePendingHelpRequests")>(
    "@/hooks/usePendingHelpRequests",
  );
  return { ...actual, usePendingHelpRequests: usePendingHelpRequestsMock };
});
vi.mock("@/hooks/useAcknowledgeHelpRequest", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useAcknowledgeHelpRequest")>(
    "@/hooks/useAcknowledgeHelpRequest",
  );
  return { ...actual, useAcknowledgeHelpRequest: useAcknowledgeHelpRequestMock };
});
vi.mock("@/hooks/useOrganization", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useOrganization")>(
    "@/hooks/useOrganization",
  );
  return { ...actual, useOrganization: useOrganizationMock };
});
vi.mock("@/hooks/useUpdateOrganization", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useUpdateOrganization")>(
    "@/hooks/useUpdateOrganization",
  );
  return { ...actual, useUpdateOrganization: useUpdateOrganizationMock };
});

vi.mock("@/hooks/useOrgMembers", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useOrgMembers")>("@/hooks/useOrgMembers");
  return { ...actual, useOrgMembers: useOrgMembersMock };
});

import { GuardiaPanel } from "./GuardiaPanel";

const SLUG = "asociacion-alfaville";

afterEach(() => {
  usePendingHelpRequestsMock.mockReset();
  useAcknowledgeHelpRequestMock.mockReset();
  useOrganizationMock.mockReset();
  useUpdateOrganizationMock.mockReset();
  useOrgMembersMock.mockReset();
});

function mockOrganizationHooks() {
  useOrganizationMock.mockReturnValue({ data: buildOrganization({ id: 7 }) });
  useOrgMembersMock.mockReturnValue({
    data: [buildOrgMembershipFull({ id: 1, user: 42, role: "titular", public_name: "Ana" })],
    isError: false,
    error: null,
  });
  useUpdateOrganizationMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    isSuccess: false,
  });
}

describe("GuardiaPanel", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockOrganizationHooks();
    usePendingHelpRequestsMock.mockReturnValue({
      data: [buildHelpRequest()],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    const { container } = render(<GuardiaPanel orgId={7} slug={SLUG} canOpenPersonSheet />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("si la ficha de la entidad falla, los ajustes de guardia lo dicen", () => {
    useOrgMembersMock.mockReturnValue({ data: [], isError: false, error: null });
    useOrganizationMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudo cargar la ficha de la entidad."),
    });
    useUpdateOrganizationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      isSuccess: false,
    });
    usePendingHelpRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    useAcknowledgeHelpRequestMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<GuardiaPanel orgId={7} slug={SLUG} canOpenPersonSheet />);

    expect(screen.getByText("No se pudieron cargar los ajustes de guardia")).toBeInTheDocument();
    expect(screen.queryByLabelText("Teléfono de ayuda")).not.toBeInTheDocument();
  });

  it("miembro con referente: enlaza a la ficha y muestra el referente", () => {
    mockOrganizationHooks();
    usePendingHelpRequestsMock.mockReturnValue({
      data: [
        buildHelpRequest({
          user_display: buildHelpRequestUserDisplay({
            id: 5,
            public_name: "Marta L.",
            is_member: true,
            referent: { id: 9, public_name: "Ana Referente" },
          }),
        }),
      ],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<GuardiaPanel orgId={7} slug={SLUG} canOpenPersonSheet />);

    const link = screen.getByRole("link", { name: "Marta L." });
    expect(link).toHaveAttribute("href", `/entidad/${SLUG}/personas/5`);
    expect(screen.getByText("Referente: Ana Referente")).toBeInTheDocument();
    expect(screen.queryByText("No pertenece a la entidad")).not.toBeInTheDocument();
  });

  it("sin la sección Personas en el menú, el nombre no enlaza (I1)", () => {
    // Una analista o un dinamizador de guardia ven esta pantalla pero no
    // tienen Personas: el enlace les aterrizaba en el «Sin acceso» a
    // página completa de `personas/[userId]/page.tsx`.
    mockOrganizationHooks();
    usePendingHelpRequestsMock.mockReturnValue({
      data: [
        buildHelpRequest({
          user_display: buildHelpRequestUserDisplay({
            id: 5,
            public_name: "Marta L.",
            is_member: true,
            referent: null,
          }),
        }),
      ],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<GuardiaPanel orgId={7} slug={SLUG} canOpenPersonSheet={false} />);

    expect(screen.queryByRole("link", { name: "Marta L." })).not.toBeInTheDocument();
    expect(screen.getByText("Marta L.")).toBeInTheDocument();
    // No es el caso de «no pertenece a la entidad»: sí pertenece, solo
    // que quien mira no puede abrir su ficha.
    expect(screen.queryByText("No pertenece a la entidad")).not.toBeInTheDocument();
  });

  it("miembro sin referente: enlaza a la ficha, sin línea de referente", () => {
    mockOrganizationHooks();
    usePendingHelpRequestsMock.mockReturnValue({
      data: [
        buildHelpRequest({
          user_display: buildHelpRequestUserDisplay({
            id: 5,
            public_name: "Marta L.",
            is_member: true,
            referent: null,
          }),
        }),
      ],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<GuardiaPanel orgId={7} slug={SLUG} canOpenPersonSheet />);

    expect(screen.getByRole("link", { name: "Marta L." })).toHaveAttribute(
      "href",
      `/entidad/${SLUG}/personas/5`,
    );
    expect(screen.queryByText(/^Referente:/)).not.toBeInTheDocument();
  });

  it("no miembro: sin enlace, badge y texto de aviso, sin referente", () => {
    mockOrganizationHooks();
    usePendingHelpRequestsMock.mockReturnValue({
      data: [
        buildHelpRequest({
          user_display: buildHelpRequestUserDisplay({
            id: 6,
            public_name: "Invitado X.",
            is_member: false,
            referent: null,
          }),
        }),
      ],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<GuardiaPanel orgId={7} slug={SLUG} canOpenPersonSheet />);

    expect(screen.queryByRole("link", { name: "Invitado X." })).not.toBeInTheDocument();
    expect(screen.getByText("Invitado X.")).toBeInTheDocument();
    expect(screen.getByText("No pertenece a la entidad")).toBeInTheDocument();
    expect(screen.getByText("Se apuntó a la actividad sin ser miembro.")).toBeInTheDocument();
  });

  it("pinta quién de la red de apoyo ya se está encargando (D-I4)", () => {
    mockOrganizationHooks();
    usePendingHelpRequestsMock.mockReturnValue({
      data: [
        buildHelpRequest({
          support_responses: [
            {
              supporter: { id: 185, public_name: "Laia" },
              responded_at: "2026-09-19T20:56:17Z",
            },
          ],
        }),
      ],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<GuardiaPanel orgId={7} slug={SLUG} canOpenPersonSheet />);

    expect(screen.getByText(/Laia, de su red de apoyo, se está encargando/)).toBeInTheDocument();
    expect(
      screen.queryByText("Nadie de su red de apoyo se ha encargado todavía."),
    ).not.toBeInTheDocument();
  });

  it("sin nadie de la red encargándose, lo dice en vez de dejar el hueco vacío", () => {
    mockOrganizationHooks();
    usePendingHelpRequestsMock.mockReturnValue({
      data: [buildHelpRequest({ support_responses: [] })],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<GuardiaPanel orgId={7} slug={SLUG} canOpenPersonSheet />);

    expect(
      screen.getByText("Nadie de su red de apoyo se ha encargado todavía."),
    ).toBeInTheDocument();
  });

  it("muestra siempre la línea de ayuda sobre cómo contactar", () => {
    mockOrganizationHooks();
    usePendingHelpRequestsMock.mockReturnValue({
      data: [buildHelpRequest()],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<GuardiaPanel orgId={7} slug={SLUG} canOpenPersonSheet />);

    expect(
      screen.getByText(
        "Popyplan no guarda teléfonos: contacta con la persona por el chat de la app o a través de su referente.",
      ),
    ).toBeInTheDocument();
  });

  it("guardar el teléfono de ayuda vacío lo limpia con cadena vacía (el contrato real no acepta null)", async () => {
    mockOrganizationHooks();
    useOrganizationMock.mockReturnValue({
      data: buildOrganization({ help_phone: "+34600000001" }),
    });
    const mutate = vi.fn();
    useUpdateOrganizationMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
      isSuccess: false,
    });
    usePendingHelpRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    useAcknowledgeHelpRequestMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });
    const user = userEvent.setup();

    render(<GuardiaPanel orgId={7} slug={SLUG} canOpenPersonSheet />);

    await user.clear(screen.getByLabelText("Teléfono de ayuda"));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(mutate).toHaveBeenCalledWith({ help_phone: "", on_call_user: null });
  });

  it("guardar con un 403 (dinamizador sin permiso) muestra el texto traducido de ese kind", async () => {
    const { UpdateOrganizationError } = await import("@/hooks/useUpdateOrganization");
    mockOrganizationHooks();
    useUpdateOrganizationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new UpdateOrganizationError(
        "sin_permiso",
        "Solo el titular puede editar la ficha de la entidad.",
      ),
      isSuccess: false,
    });
    usePendingHelpRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    useAcknowledgeHelpRequestMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<GuardiaPanel orgId={7} slug={SLUG} canOpenPersonSheet />);

    // En `es` el texto traducido coincide, letra por letra, con el que
    // manda el hook — la prueba real de que pasa por `errorKindText` (no
    // por casualidad) es que el `kind` decide, no `.message`.
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Solo el titular puede editar la ficha de la entidad.",
    );
  });

  it("acuse de recibo: mantiene el botón «He contactado» y pinta el error si falla", () => {
    mockOrganizationHooks();
    usePendingHelpRequestsMock.mockReturnValue({
      data: [buildHelpRequest()],
      isError: false,
      error: null,
    });
    const mutate = vi.fn();
    useAcknowledgeHelpRequestMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: true,
      error: new Error("No se pudo marcar el aviso como atendido."),
    });

    render(<GuardiaPanel orgId={7} slug={SLUG} canOpenPersonSheet />);

    expect(screen.getByRole("button", { name: "He contactado" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo marcar el aviso como atendido.");
  });
});
