import { describe, expect, it } from "vitest";

import { requestLanguageHeader } from "./requestLanguage";

function request(cookieValue: string | undefined, acceptLanguage?: string) {
  return {
    cookies: { get: (name: string) => (name === "pp_lang" && cookieValue !== undefined ? { value: cookieValue } : undefined) },
    headers: new Headers(acceptLanguage ? { "accept-language": acceptLanguage } : {}),
  };
}

describe("requestLanguageHeader", () => {
  it("usa la cookie pp_lang cuando está presente", () => {
    expect(requestLanguageHeader(request("eu"))).toEqual({ "Accept-Language": "eu" });
  });

  it("sin cookie, cae a Accept-Language", () => {
    expect(requestLanguageHeader(request(undefined, "ca-ES,ca;q=0.9"))).toEqual({
      "Accept-Language": "ca",
    });
  });

  it("sin cookie ni Accept-Language soportado, cae a es", () => {
    expect(requestLanguageHeader(request(undefined))).toEqual({ "Accept-Language": "es" });
  });

  it("una cookie con un idioma no soportado se ignora", () => {
    expect(requestLanguageHeader(request("de", "eu"))).toEqual({ "Accept-Language": "eu" });
  });
});
