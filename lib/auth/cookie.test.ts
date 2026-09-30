import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACCESS_TOKEN_HEADER,
  ACCESS_TOKEN_MIN_SECONDS_LEFT,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  accessCookieOptions,
  accessTokenSecondsLeft,
  sessionCookieOptions,
  usableAccessToken,
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

describe("token de acceso en cookie", () => {
  const jwtCon = (exp: number) =>
    `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.x`;
  const ahora = Date.UTC(2026, 8, 30, 12);
  const s = ahora / 1000;

  it("accessTokenSecondsLeft lee el exp y da 0 si no se puede", () => {
    expect(accessTokenSecondsLeft(jwtCon(s + 600), ahora)).toBe(600);
    expect(accessTokenSecondsLeft(jwtCon(s - 5), ahora)).toBe(0);
    expect(accessTokenSecondsLeft("no-es-un-jwt", ahora)).toBe(0);
    expect(accessTokenSecondsLeft(undefined, ahora)).toBe(0);
    // Sin `nowMs`, mide contra el reloj.
    expect(accessTokenSecondsLeft(jwtCon(Math.floor(Date.now() / 1000) + 600))).toBeGreaterThan(590);
    expect(accessTokenSecondsLeft(`a.${Buffer.from("{").toString("base64url")}.c`, ahora)).toBe(0);
    expect(accessTokenSecondsLeft(`a.${Buffer.from('{"exp":"x"}').toString("base64url")}.c`, ahora)).toBe(0);
  });

  it("usableAccessToken exige más vida que el margen", () => {
    const vivo = jwtCon(s + ACCESS_TOKEN_MIN_SECONDS_LEFT + 60);
    expect(usableAccessToken(vivo, ahora)).toBe(vivo);
    expect(usableAccessToken(jwtCon(s + 30), ahora)).toBeNull();
    expect(usableAccessToken(undefined, ahora)).toBeNull();
  });

  it("la cookie caduca con el token, menos el margen, y es httpOnly", () => {
    const opts = accessCookieOptions(jwtCon(s + 3600), ahora);
    expect(opts.maxAge).toBe(3600 - ACCESS_TOKEN_MIN_SECONDS_LEFT);
    expect(opts.httpOnly).toBe(true);
    expect(accessCookieOptions(jwtCon(s + 10), ahora).maxAge).toBe(0);
  });
});
