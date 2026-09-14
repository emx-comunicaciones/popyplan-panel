import { describe, expect, it, vi } from "vitest";

import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

const serverFetchMock = vi.hoisted(() => vi.fn());
const headersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));
vi.mock("next/headers", () => ({ headers: headersMock }));

import { getServerSession } from "./session";

function headerStore(value: string | undefined) {
  return { get: () => value ?? null };
}

describe("getServerSession", () => {
  it("sin cabecera de acceso (middleware no la puso) devuelve null", async () => {
    headersMock.mockResolvedValue(headerStore(undefined));

    expect(await getServerSession()).toBeNull();
    expect(serverFetchMock).not.toHaveBeenCalled();
  });

  it("con cabecera de acceso trae me y el rol de plataforma en paralelo", async () => {
    const me = buildMe();
    const platformRole = buildPlatformRole("superadmin");
    headersMock.mockResolvedValue(headerStore("token-123"));
    serverFetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, data: me })
      .mockResolvedValueOnce({ ok: true, status: 200, data: platformRole });

    const session = await getServerSession();

    expect(session).toEqual({ token: "token-123", me, platformRole });
  });

  it("si el backend rechaza el token (401) devuelve null", async () => {
    headersMock.mockResolvedValue(headerStore("token-caducado"));
    serverFetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, body: null })
      .mockResolvedValueOnce({ ok: true, status: 200, data: buildPlatformRole(null) });

    expect(await getServerSession()).toBeNull();
  });

  it("si /me/ va bien pero platform-roles/me/ responde 5xx, la sesión resuelve con rol null", async () => {
    const me = buildMe();
    headersMock.mockResolvedValue(headerStore("token-123"));
    serverFetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, data: me })
      .mockResolvedValueOnce({ ok: false, status: 502, body: { detail: "bad gateway" } });

    const session = await getServerSession();

    expect(session).toEqual({ token: "token-123", me, platformRole: { role: null } });
  });

  it("si platform-roles/me/ revienta de red, la sesión también resuelve con rol null", async () => {
    const me = buildMe();
    headersMock.mockResolvedValue(headerStore("token-123"));
    serverFetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, data: me })
      .mockRejectedValueOnce(new Error("red caída"));

    const session = await getServerSession();

    expect(session).toEqual({ token: "token-123", me, platformRole: { role: null } });
  });

  it("un 403 de platform-roles/me/ SÍ anula la sesión (el token es el problema)", async () => {
    headersMock.mockResolvedValue(headerStore("token-123"));
    serverFetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, data: buildMe() })
      .mockResolvedValueOnce({ ok: false, status: 403, body: null });

    expect(await getServerSession()).toBeNull();
  });
});
