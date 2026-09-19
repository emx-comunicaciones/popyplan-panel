import { QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRenderUnwrapped } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "@/test-utils/axe";
import { buildHelpRequest, buildHelpRequestUserDisplay } from "@/test-utils/fixtures/helpRequest";
import { createTestQueryClient, render, screen } from "@/test-utils/render";
import eu from "@/messages/eu.json";

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

  it("con la consulta en error, el recordatorio sigue estando", () => {
    usePlatformPendingHelpRequestsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("No se pudieron cargar los avisos de ayuda."),
    });
    useAcknowledgeHelpRequestGlobalMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<AyudaPendienteList />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar los avisos de ayuda");
    expect(
      screen.getByText(
        "Popyplan no guarda teléfonos: contacta con la persona por el chat de la app o a través de su referente.",
      ),
    ).toBeInTheDocument();
  });

  it("mientras carga, el recordatorio sigue estando", () => {
    usePlatformPendingHelpRequestsMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useAcknowledgeHelpRequestGlobalMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    render(<AyudaPendienteList />);

    expect(screen.getByText("Cargando avisos…")).toBeInTheDocument();
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

  it("con el panel en euskera, la fecha del aviso se pinta en formato eu-ES (I2)", () => {
    usePlatformPendingHelpRequestsMock.mockReturnValue({
      data: [buildHelpRequest({ created_at: "2026-09-01T18:30:00Z" })],
      isError: false,
      error: null,
    });
    useAcknowledgeHelpRequestGlobalMock.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });

    const queryClient = createTestQueryClient();
    rtlRenderUnwrapped(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="eu" messages={eu}>
          <AyudaPendienteList />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    // El formato exacto de eu-ES (año/mes/día, hora entre paréntesis en
    // Node 24: "26/9/1 (20:30)") depende de los datos ICU de la versión de
    // Node — Node 20 en CI lo escribe distinto —, así que el valor esperado
    // se calcula con la misma API en vez de fijarlo a mano; lo que se fija
    // es que difiere del formato es-ES de la misma fecha.
    const date = new Date("2026-09-01T18:30:00Z");
    const options = { dateStyle: "short", timeStyle: "short" } as const;
    const expectedEu = date.toLocaleString("eu-ES", options);
    const expectedEs = date.toLocaleString("es-ES", options);
    expect(expectedEu).not.toBe(expectedEs);
    expect(screen.getByText(expectedEu)).toBeInTheDocument();
    expect(screen.queryByText(expectedEs)).not.toBeInTheDocument();
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
      error: { message: "No tienes permiso para atender este aviso.", kind: "sin_permiso" },
    });

    render(<AyudaPendienteList />);

    expect(screen.getByRole("alert")).toHaveTextContent("No tienes permiso para atender este aviso.");
  });
});
