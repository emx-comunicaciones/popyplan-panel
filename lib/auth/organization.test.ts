import { afterEach, describe, expect, it, vi } from "vitest";

import { buildOrganization } from "@/test-utils/fixtures/organization";

const serverFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));

import { getServerOrganization } from "./organization";

afterEach(() => {
  serverFetchMock.mockReset();
});

describe("getServerOrganization", () => {
  it("pide la ficha de la entidad al endpoint del contrato con el token de la sesión", async () => {
    const org = buildOrganization({ id: 7, name: "Asociación Demo" });
    serverFetchMock.mockResolvedValue({ ok: true, status: 200, data: org });

    const result = await getServerOrganization(7, "token-123");

    expect(serverFetchMock).toHaveBeenCalledWith("/api/organizations/7/", "token-123");
    expect(result).toEqual({ ok: true, status: 200, data: org });
  });

  it("propaga el fallo tal cual (quien llama decide qué pintar)", async () => {
    serverFetchMock.mockResolvedValue({ ok: false, status: 503, body: null });

    expect(await getServerOrganization(7, "token-123")).toEqual({
      ok: false,
      status: 503,
      body: null,
    });
  });
});
