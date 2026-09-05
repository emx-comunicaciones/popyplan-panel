import { describe, expect, it, vi } from "vitest";

import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

const serverFetchMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import { getServerSession } from "./session";

function cookieJar(value: string | undefined) {
  return { get: () => (value === undefined ? undefined : { value }) };
}

describe("getServerSession", () => {
  it("sin cookie de sesión devuelve null", async () => {
    cookiesMock.mockResolvedValue(cookieJar(undefined));

    expect(await getServerSession()).toBeNull();
    expect(serverFetchMock).not.toHaveBeenCalled();
  });

  it("con cookie válida trae me y el rol de plataforma en paralelo", async () => {
    const me = buildMe();
    const platformRole = buildPlatformRole("superadmin");
    cookiesMock.mockResolvedValue(cookieJar("token-123"));
    serverFetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, data: me })
      .mockResolvedValueOnce({ ok: true, status: 200, data: platformRole });

    const session = await getServerSession();

    expect(session).toEqual({ token: "token-123", me, platformRole });
  });

  it("si el backend rechaza el token (401) devuelve null", async () => {
    cookiesMock.mockResolvedValue(cookieJar("token-caducado"));
    serverFetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, body: null })
      .mockResolvedValueOnce({ ok: true, status: 200, data: buildPlatformRole(null) });

    expect(await getServerSession()).toBeNull();
  });
});
