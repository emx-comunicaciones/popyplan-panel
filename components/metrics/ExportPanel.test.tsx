import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { axe } from "@/test-utils/axe";
import { render, screen } from "@/test-utils/render";

const useExportMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useExport", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useExport")>("@/hooks/useExport");
  return { ...actual, useExport: useExportMock };
});

import { ExportPanel } from "./ExportPanel";

afterEach(() => {
  useExportMock.mockReset();
});

describe("ExportPanel", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    const { container } = render(<ExportPanel scope="entidad" orgId={7} />);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("por defecto exporta con el groupBy pasado por props (desglose habitual)", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });
    const user = userEvent.setup();

    render(<ExportPanel scope="plataforma" groupBy="organization" />);
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ groupBy: "organization" }));
  });

  it("al elegir «Por año», ignora el groupBy de props y exporta group_by=year", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });
    const user = userEvent.setup();

    render(<ExportPanel scope="plataforma" groupBy="organization" />);
    await user.selectOptions(
      screen.getByLabelText("Desglose del informe"),
      "Por año (memoria plurianual)",
    );
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ groupBy: "year" }));
  });

  it("con periodo controlado, exporta el que le pasa el dashboard, no el suyo", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });
    const user = userEvent.setup();

    render(
      <ExportPanel
        scope="paraguas"
        orgId={3}
        period={{ since: "2025-01-01", until: "2025-12-31" }}
        preset="anio"
        onPeriodChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ period: { since: "2025-01-01", until: "2025-12-31" } }),
    );
    expect(screen.getByRole("button", { name: "Año" })).toHaveAttribute("aria-pressed", "true");
  });

  it("con periodo controlado, cambiar el selector avisa al dashboard en vez de guardarlo aparte", async () => {
    const onPeriodChange = vi.fn();
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
    const user = userEvent.setup();

    render(
      <ExportPanel
        scope="paraguas"
        orgId={3}
        period={{ since: "2025-01-01", until: "2025-12-31" }}
        preset="anio"
        onPeriodChange={onPeriodChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Trimestre" }));

    expect(onPeriodChange).toHaveBeenCalledWith(expect.objectContaining({ since: expect.any(String) }), "trimestre");
    // El panel no se queda con un periodo propio: sigue pintando el del dashboard.
    expect(screen.getByRole("button", { name: "Año" })).toHaveAttribute("aria-pressed", "true");
  });

  it("sin groupBy en props: exporta sin group_by mientras el desglose siga en «habitual»", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });
    const user = userEvent.setup();

    render(<ExportPanel scope="entidad" orgId={7} />);
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ groupBy: undefined }));
  });

  it("con varios ámbitos ofrece elegir entre territorio y red financiada", async () => {
    const mutate = vi.fn();
    useExportMock.mockReturnValue({ mutate, isPending: false, error: null });
    const user = userEvent.setup();

    render(<ExportPanel scope="territorio" orgId={3} scopeChoices={["territorio", "paraguas"]} />);

    const select = screen.getByLabelText("Ámbito del informe");
    expect(select).toHaveValue("territorio");
    expect(screen.getByRole("option", { name: "Territorio" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Red financiada" })).toBeInTheDocument();

    await user.selectOptions(select, "paraguas");
    expect(select).toHaveValue("paraguas");

    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ scope: "paraguas" }));
  });

  it("con un solo ámbito no pinta el selector (las dos páginas de Informes de entidad)", () => {
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    render(<ExportPanel scope="entidad" orgId={7} />);

    expect(screen.queryByLabelText("Ámbito del informe")).not.toBeInTheDocument();
  });

  it("el tipo de props impide un `period` sin `onPeriodChange`", () => {
    // Comprobación de tipos, no de comportamiento: `ExportPanelProps` es una
    // unión discriminada, así que un periodo controlado sin la función para
    // cambiarlo no compila (el selector no podría cambiar nada). Si alguien
    // deshace la unión, `@ts-expect-error` se queda sin error y
    // `npm run typecheck` falla.
    useExportMock.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });

    render(
      // @ts-expect-error falta `onPeriodChange` (y `preset`) junto a `period`
      <ExportPanel scope="entidad" orgId={7} period={{ since: "2025-01-01", until: "2025-01-31" }} />,
    );

    expect(screen.getByRole("heading", { name: "Exportar informe" })).toBeInTheDocument();
  });
});
