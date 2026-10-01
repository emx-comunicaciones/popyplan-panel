import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { ApiError } from "@/lib/api/client";
import { render, screen, waitFor } from "@/test-utils/render";
import { buildCrmDocument, buildCrmOpportunity, buildCrmTask } from "@/test-utils/fixtures/crm";
import { callsTo, routeApi } from "@/test-utils/fixtures/crm-d";

import { DocumentsSection, OpportunitiesSection, TasksSection } from "./ListSections";

afterEach(() => apiFetchMock.mockReset());

/**
 * Tres páginas de 50 en la primera consulta; la página 2 ya no existe
 * (se borró lo que había en ella): DRF responde 404.
 */
function page(row: unknown) {
  return (path: string) => {
    if (path.includes("page=2")) throw new ApiError(404, { detail: "Página inválida." });
    return { count: 120, next: "x", previous: null, results: [row] };
  };
}

async function goToMissingPage2() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Siguiente" }));
}

async function expectBackOnPage1() {
  await waitFor(() => expect(screen.getByText("Página 1 de 3")).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
}

describe("listas paginadas de la ficha: la página ya no existe", () => {
  it("documentos vuelve a la página anterior", async () => {
    routeApi(apiFetchMock, { "/api/crm/documents/": page(buildCrmDocument()) });
    render(<DocumentsSection accountId={1} />);

    await goToMissingPage2();

    await expectBackOnPage1();
    expect(callsTo(apiFetchMock, "page=2")).toHaveLength(1);
  });

  it("oportunidades vuelve a la página anterior", async () => {
    routeApi(apiFetchMock, { "/api/crm/opportunities/": page(buildCrmOpportunity()) });
    render(<OpportunitiesSection accountId={1} />);

    await goToMissingPage2();

    await expectBackOnPage1();
    expect(callsTo(apiFetchMock, "page=2")).toHaveLength(1);
  });

  it("tareas abiertas vuelve a la página anterior", async () => {
    routeApi(apiFetchMock, {
      "/api/crm/tasks/": (path: string) =>
        path.includes("bucket=done")
          ? { count: 0, next: null, previous: null, results: [] }
          : page(buildCrmTask())(path),
    });
    render(<TasksSection accountId={1} />);

    await goToMissingPage2();

    await expectBackOnPage1();
    expect(callsTo(apiFetchMock, "page=2")).toHaveLength(1);
  });
});
