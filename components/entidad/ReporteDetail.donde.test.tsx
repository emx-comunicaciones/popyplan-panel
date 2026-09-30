import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { render, screen } from "@/test-utils/render";
import { buildReportDetail } from "@/test-utils/fixtures/report";

import { ReporteDetail } from "./ReporteDetail";

afterEach(() => apiFetchMock.mockReset());

async function show(overrides: Parameters<typeof buildReportDetail>[0]) {
  apiFetchMock.mockResolvedValue(buildReportDetail(overrides));
  render(<ReporteDetail reportId="r1" readOnly />);
  await screen.findByText("Motivo");
}

describe("ReporteDetail: de dónde viene una publicación", () => {
  it("un reporte de usuario no lleva la fila", async () => {
    await show({});
    expect(screen.queryByText("De dónde viene")).not.toBeInTheDocument();
  });

  it("post de comunidad: nombre de la comunidad", async () => {
    await show({
      target_type: "post",
      target: { type: "post", id: "p1", content: "hola" },
      community_display: { id: "c1", name: "Senderistas" },
    });
    expect(screen.getByText("De dónde viene")).toBeInTheDocument();
    expect(screen.getByText("Comunidad: Senderistas")).toBeInTheDocument();
  });

  it("post sin comunidad y sin `where`: fuera de una comunidad, sin inventar cuál", async () => {
    await show({ target_type: "post", target: { type: "post", id: "p1", content: "hola" }, community_display: null });
    expect(screen.getByText("Fuera de una comunidad (abierto o de una actividad)")).toBeInTheDocument();
  });

  it("`where` null es abierto; de actividad dice la actividad; de comunidad, su nombre", async () => {
    await show({ target: { type: "post", id: "p1", content: "hola", where: null } });
    expect(screen.getByText("Abierto (sin comunidad ni actividad)")).toBeInTheDocument();
  });

  it("comentario de una actividad", async () => {
    await show({
      target_type: "comment",
      target: {
        type: "comment",
        id: "c1",
        content: "hola",
        where: { type: "activity", id: 4, title: "Ruta por el Gorbea", starts_at: null },
      },
    });
    expect(screen.getByText("Actividad: Ruta por el Gorbea")).toBeInTheDocument();
  });

  it("`where` de comunidad gana a community_display", async () => {
    await show({
      target: { type: "post", id: "p1", where: { type: "community", id: "c2", name: "Otra" } },
      community_display: { id: "c1", name: "Senderistas" },
    });
    expect(screen.getByText("Comunidad: Otra")).toBeInTheDocument();
  });
});
