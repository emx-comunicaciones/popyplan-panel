import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { render, screen } from "@/test-utils/render";
import { paginated } from "@/test-utils/fixtures/crm";
import { routeApi } from "@/test-utils/fixtures/crm-d";

import { QuickActivityDialog } from "./QuickActivityDialog";

beforeEach(() => {
  routeApi(apiFetchMock, { "/api/crm/accounts/": paginated([]) });
  window.sessionStorage.clear();
});
afterEach(() => apiFetchMock.mockReset());

function open(userId: number) {
  return render(<QuickActivityDialog preset={{}} userId={userId} isManager={false} onClose={() => {}} />);
}

describe("QuickActivityDialog: borrador", () => {
  it("el borrador del resumen es de cada cuenta", async () => {
    window.sessionStorage.setItem("crm-activity-draft:1", "Notas de la cuenta 1");
    const first = open(1);
    expect(await screen.findByLabelText(/Resumen/)).toHaveValue("Notas de la cuenta 1");
    first.unmount();
    open(2);
    expect(await screen.findByLabelText(/Resumen/)).toHaveValue("");
  });

  it("descarta el borrador antiguo sin cuenta", async () => {
    window.sessionStorage.setItem("crm-activity-draft", "Notas ajenas");
    open(7);
    expect(await screen.findByLabelText(/Resumen/)).toHaveValue("");
    expect(window.sessionStorage.getItem("crm-activity-draft")).toBeNull();
  });
});
