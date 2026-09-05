import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACCESS_TOKEN_HEADER,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "./cookie";

const ORIGINAL_ENV = process.env.NODE_ENV;

afterEach(() => {
  vi.stubEnv("NODE_ENV", ORIGINAL_ENV ?? "test");
});

describe("sessionCookieOptions", () => {
  it("usa el nombre y la vida máxima por defecto", () => {
    const options = sessionCookieOptions();

    expect(options.maxAge).toBe(SESSION_COOKIE_MAX_AGE_SECONDS);
    expect(SESSION_COOKIE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 30);
    expect(SESSION_COOKIE_NAME).toBe("pp_session");
    expect(ACCESS_TOKEN_HEADER).toBe("x-pp-access-token");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("strict");
    expect(options.path).toBe("/");
  });

  it("acepta una vida distinta (p. ej. maxAge 0 para borrar la cookie)", () => {
    expect(sessionCookieOptions(0).maxAge).toBe(0);
  });

  it("solo exige secure en producción", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions().secure).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieOptions().secure).toBe(false);
  });
});
