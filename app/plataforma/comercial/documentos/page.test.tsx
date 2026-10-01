import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const openDocMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useCrm", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCrm")>("@/hooks/useCrm");
  return { ...actual, openCrmDocument: openDocMock };
});

import { render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { buildCrmAccount, buildCrmDocument, paginated } from "@/test-utils/fixtures/crm";
import { callsTo, crmSession, routeApi } from "@/test-utils/fixtures/crm-d";

import Page from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
  openDocMock.mockReset();
});

const V1 = {
  id: 501, version: 1, filename: "Propuesta_v1.pdf", content_type: "application/pdf", size: 120000,
  uploaded_by_name: "Mikel Errasti", created_at: "2026-09-30T12:30:00Z", download_url: "",
};
const V2 = { ...V1, id: 502, version: 2, filename: "Propuesta_v2.pdf", created_at: "2026-10-01T09:00:00Z" };
const DOCS = [
  buildCrmDocument({ latest: V2 as never, versions: [V1, V2] }),
  buildCrmDocument({ id: 501, name: "Acta de la reunión", category: "minutes", received: true, opportunity: null, opportunity_name: "" }),
];

async function setup() {
  getServerSessionMock.mockResolvedValue(crmSession("sales"));
  routeApi(apiFetchMock, {
    "/api/crm/documents/": (_p: string, init?: { method?: string }) => (init?.method === "POST" ? DOCS[0] : paginated(DOCS)),
    "/api/crm/documents/500/versions/": V2,
    "/api/crm/documents/500/": () => undefined,
    "/api/crm/accounts/": paginated([buildCrmAccount()]),
  });
  return render(await Page());
}

const pdf = () => new File(["contenido"], "contrato.pdf", { type: "application/pdf" });

describe("Documentos del CRM", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = await setup();
    await screen.findByText("Propuesta Popyplan");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("lista los documentos con categoría, entidad, versión y sentido", async () => {
    await setup();
    const table = await screen.findByRole("table", { name: "Documentos del CRM" });
    const row = within(table).getByText("Propuesta Popyplan").closest("tr") as HTMLElement;
    expect(within(row).getByText("Propuestas")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Ayuntamiento de Donostia" })).toHaveAttribute(
      "href",
      "/plataforma/comercial/entidades/1",
    );
    expect(within(row).getByRole("link", { name: "Popyplan Asociaciones" })).toHaveAttribute(
      "href",
      "/plataforma/comercial/oportunidades/30",
    );
    expect(within(row).getByText("v2")).toBeInTheDocument();
    expect(within(row).getByText("Enviado")).toBeInTheDocument();
    expect(within(table).getByText("Recibido")).toBeInTheDocument();
  });

  it("los filtros cambian las peticiones", async () => {
    await setup();
    await screen.findByText("Propuesta Popyplan");
    await userEvent.selectOptions(screen.getByLabelText("Categoría"), "minutes");
    await waitFor(() => expect(callsTo(apiFetchMock, "category=minutes")).not.toHaveLength(0));
    await userEvent.type(screen.getByLabelText("Buscar"), "acta");
    await waitFor(() => expect(callsTo(apiFetchMock, "q=acta")).not.toHaveLength(0));
    await userEvent.type(screen.getByLabelText("Entidad"), "Dono");
    await userEvent.click(await screen.findByRole("button", { name: /Ayuntamiento de Donostia/ }));
    await waitFor(() => expect(callsTo(apiFetchMock, "account=1")).not.toHaveLength(0));
  });

  it("ver y descargar abren la última versión por la API", async () => {
    await setup();
    const row = (await screen.findByText("Propuesta Popyplan")).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Ver" }));
    expect(openDocMock).toHaveBeenLastCalledWith(500, 502, true);
    await userEvent.click(within(row).getByRole("button", { name: "Descargar" }));
    expect(openDocMock).toHaveBeenLastCalledWith(500, 502, false);
  });

  it("el historial lista todas las versiones y descarga cualquiera", async () => {
    await setup();
    const row = (await screen.findByText("Propuesta Popyplan")).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Versiones" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/nunca se borran/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Propuesta_v1\.pdf/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Propuesta_v2\.pdf/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Descargar versión 1" }));
    expect(openDocMock).toHaveBeenLastCalledWith(500, 501, false);
  });

  it("sube un documento nuevo como FormData", async () => {
    await setup();
    await screen.findByText("Propuesta Popyplan");
    await userEvent.click(screen.getByRole("button", { name: "+ Subir documento" }));
    const dialog = await screen.findByRole("dialog", { name: "Subir documento" });
    expect(within(dialog).getByText("Tamaño máximo: 25 MB por fichero.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Subir" })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Entidad"), "Dono");
    await userEvent.click(await within(dialog).findByRole("button", { name: /Ayuntamiento de Donostia/ }));
    await userEvent.upload(within(dialog).getByLabelText("Fichero"), pdf());
    await userEvent.selectOptions(within(dialog).getByLabelText("Categoría"), "contract");
    await userEvent.click(within(dialog).getByLabelText(/Documento recibido/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Subir" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [, init] = callsTo(apiFetchMock, "/api/crm/documents/", "POST")[0];
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get("file") as File).name).toBe("contrato.pdf");
    expect(form.get("account")).toBe("1");
    expect(form.get("category")).toBe("contract");
    expect(form.get("received")).toBe("true");
  });

  it("sube una versión nueva", async () => {
    await setup();
    const row = (await screen.findByText("Propuesta Popyplan")).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Nueva versión" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/las versiones nunca se borran/)).toBeInTheDocument();
    await userEvent.upload(within(dialog).getByLabelText("Fichero"), pdf());
    await userEvent.click(within(dialog).getByRole("button", { name: "Subir versión" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const [, init] = callsTo(apiFetchMock, "/api/crm/documents/500/versions/", "POST")[0];
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("borra con confirmación y el error se queda en el diálogo", async () => {
    await setup();
    const row = (await screen.findByText("Propuesta Popyplan")).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Borrar" }));
    const dialog = screen.getByRole("alertdialog");
    expect(callsTo(apiFetchMock, "/api/crm/documents/500/", "DELETE")).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar documento" }));
    await waitFor(() => expect(callsTo(apiFetchMock, "/api/crm/documents/500/", "DELETE")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("avisa si no se puede abrir el documento", async () => {
    await setup();
    openDocMock.mockRejectedValueOnce(new Error("boom"));
    const row = (await screen.findByText("Propuesta Popyplan")).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Descargar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo abrir el documento");
  });
});
