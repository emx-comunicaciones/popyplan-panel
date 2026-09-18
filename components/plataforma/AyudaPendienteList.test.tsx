import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "@/test-utils/axe";
import { buildHelpRequest, buildHelpRequestUserDisplay } from "@/test-utils/fixtures/helpRequest";
import { render, screen } from "@/test-utils/render";

const usePlatformPendingHelpRequestsMock = vi.hoisted(() => vi.fn());
const useAcknowledgeHelpRequestGlobalMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/usePlatformPendingHelpRequests", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePlatformPendingHelpRequests")>(
    "@/hooks/usePlatformPendingHelpRequests",
  );
  return { ...actual, usePlatformPendingHelpRequests: usePlatformPendingHelpRequestsMock };
});
vi.mock("@/hooks/useAcknowledgeHelpRequestGlobal", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useAcknowledgeHelpRequestGlobal")>(
    "@/hooks/useAcknowledgeHelpRequestGlobal",
  );
  return { ...actual, useAcknowledgeHelpRequestGlobal: useAcknowledgeHelpRequestGlobalMock };
});

import { AyudaPendienteList } from "./AyudaPendienteList";

afterEach(() => {
  usePlatformPendingHelpRequestsMock.mockReset();
  useAcknowledgeHelpRequestGlobalMock.mockReset();
});

describe("AyudaPendienteList", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    usePlatformPendingHelpRequestsMock.mockReturnValue({
      data: [buildHelpRequest()],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestGlobalMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    const { container } = render(<AyudaPendienteList />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("recuerda siempre que Popyplan no guarda teléfonos, igual que la guardia de la entidad", () => {
    usePlatformPendingHelpRequestsMock.mockReturnValue({
      data: [buildHelpRequest()],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestGlobalMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<AyudaPendienteList />);

    expect(
      screen.getByText(
        "Popyplan no guarda teléfonos: contacta con la persona por el chat de la app o a través de su referente.",
      ),
    ).toBeInTheDocument();
  });

  it("sin avisos pendientes, el recordatorio sigue estando", () => {
    usePlatformPendingHelpRequestsMock.mockReturnValue({ data: [], isError: false, error: null });
    useAcknowledgeHelpRequestGlobalMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<AyudaPendienteList />);

    expect(screen.getByText("Sin avisos pendientes")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Popyplan no guarda teléfonos: contacta con la persona por el chat de la app o a través de su referente.",
      ),
    ).toBeInTheDocument();
  });

  it("miembro con referente: muestra la entidad y el referente, sin el badge de no pertenencia", () => {
    usePlatformPendingHelpRequestsMock.mockReturnValue({
      data: [
        buildHelpRequest({
          organization_display: { id: 7, name: "Asociación Vecinal Alfaville" },
          user_display: buildHelpRequestUserDisplay({
            public_name: "Marta L.",
            is_member: true,
            referent: { id: 9, public_name: "Ana Referente" },
          }),
        }),
      ],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestGlobalMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<AyudaPendienteList />);

    expect(screen.getByText("Marta L.")).toBeInTheDocument();
    expect(screen.getByText(/Asociación Vecinal Alfaville/)).toBeInTheDocument();
    expect(screen.getByText("Referente: Ana Referente")).toBeInTheDocument();
    expect(screen.queryByText("No pertenece a la entidad")).not.toBeInTheDocument();
  });

  it("miembro sin referente: sin línea de referente ni badge", () => {
    usePlatformPendingHelpRequestsMock.mockReturnValue({
      data: [
        buildHelpRequest({
          user_display: buildHelpRequestUserDisplay({
            public_name: "Marta L.",
            is_member: true,
            referent: null,
          }),
        }),
      ],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestGlobalMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<AyudaPendienteList />);

    expect(screen.getByText("Marta L.")).toBeInTheDocument();
    expect(screen.queryByText(/^Referente:/)).not.toBeInTheDocument();
    expect(screen.queryByText("No pertenece a la entidad")).not.toBeInTheDocument();
  });

  it("no miembro: muestra el badge de no pertenencia junto a la entidad", () => {
    usePlatformPendingHelpRequestsMock.mockReturnValue({
      data: [
        buildHelpRequest({
          organization_display: { id: 7, name: "Asociación Vecinal Alfaville" },
          user_display: buildHelpRequestUserDisplay({
            public_name: "Invitado X.",
            is_member: false,
            referent: null,
          }),
        }),
      ],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestGlobalMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<AyudaPendienteList />);

    expect(screen.getByText("Invitado X.")).toBeInTheDocument();
    expect(screen.getByText("No pertenece a la entidad")).toBeInTheDocument();
  });

  it("acuse de recibo fallido: el mensaje de error se pinta con role=alert", () => {
    usePlatformPendingHelpRequestsMock.mockReturnValue({
      data: [buildHelpRequest()],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestGlobalMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error("No tienes permiso para atender este aviso."),
    });

    render(<AyudaPendienteList />);

    expect(screen.getByRole("alert")).toHaveTextContent("No tienes permiso para atender este aviso.");
  });
});
