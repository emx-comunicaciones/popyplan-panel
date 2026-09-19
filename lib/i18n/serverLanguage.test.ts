import { describe, expect, it, vi } from "vitest";

const headersMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ headers: headersMock, cookies: cookiesMock }));

import { getServerLanguage } from "./serverLanguage";

function headerStore(entries: Record<string, string> = {}) {
  return { get: (name: string) => entries[name.toLowerCase()] ?? null };
}

function cookieStore(entries: Record<string, string> = {}) {
  return { get: (name: string) => (name in entries ? { value: entries[name] } : undefined) };
}

describe("getServerLanguage", () => {
  it("usa la cookie pp_lang cuando está presente", async () => {
    cookiesMock.mockResolvedValue(cookieStore({ pp_lang: "ca" }));
    headersMock.mockResolvedValue(headerStore());

    expect(await getServerLanguage()).toBe("ca");
  });

  it("sin cookie, cae al Accept-Language de la petición", async () => {
    cookiesMock.mockResolvedValue(cookieStore());
    headersMock.mockResolvedValue(headerStore({ "accept-language": "eu-ES,eu;q=0.9" }));

    expect(await getServerLanguage()).toBe("eu");
  });

  it("sin cookie ni Accept-Language soportado, cae a es", async () => {
    cookiesMock.mockResolvedValue(cookieStore());
    headersMock.mockResolvedValue(headerStore());

    expect(await getServerLanguage()).toBe("es");
  });

  it("fuera de un ámbito de petición (next/headers lanza), cae a es sin reventar", async () => {
    cookiesMock.mockRejectedValue(new Error("`cookies` was called outside a request scope."));
    headersMock.mockRejectedValue(new Error("`headers` was called outside a request scope."));

    expect(await getServerLanguage()).toBe("es");
  });
});
