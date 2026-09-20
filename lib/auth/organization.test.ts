import { afterEach, describe, expect, it, vi } from "vitest";

import { buildOrganization } from "@/test-utils/fixtures/organization";

const serverFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));

import { getServerOrganization, isOnCallUser } from "./organization";

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

describe("isOnCallUser", () => {
  const session = { token: "token-123", me: { id: 11 } };

  it("es cierto cuando `on_call_user` es quien mira", async () => {
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ id: 7, on_call_user: 11 }),
    });

    expect(await isOnCallUser(7, session)).toBe(true);
  });

  it("es falso con otra persona de guardia, o sin ninguna", async () => {
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ id: 7, on_call_user: 12 }),
    });
    expect(await isOnCallUser(7, session)).toBe(false);

    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ id: 7, on_call_user: null }),
    });
    expect(await isOnCallUser(7, session)).toBe(false);
  });

  it("es falso si la ficha de la entidad no se puede leer", async () => {
    serverFetchMock.mockResolvedValue({ ok: false, status: 503, body: null });

    expect(await isOnCallUser(7, session)).toBe(false);
  });
});
