import { describe, expect, it } from "vitest";

import { forwardedForHeaders } from "./clientIp";

function request(headers: Record<string, string>) {
  return { headers: new Headers(headers) };
}

describe("forwardedForHeaders", () => {
  it("sin ninguna cabecera de proxy no añade nada", () => {
    expect(forwardedForHeaders(request({}))).toEqual({});
  });

  it("reenvía el valor de x-forwarded-for cuando trae una sola IP", () => {
    expect(forwardedForHeaders(request({ "x-forwarded-for": "203.0.113.7" }))).toEqual({
      "X-Forwarded-For": "203.0.113.7",
    });
  });

  it("de una lista separada por comas toma el primer elemento, recortado", () => {
    expect(
      forwardedForHeaders(request({ "x-forwarded-for": " 203.0.113.7 , 70.41.3.18, 150.172.238.178" })),
    ).toEqual({ "X-Forwarded-For": "203.0.113.7" });
  });

  it("usa x-real-ip cuando no hay x-forwarded-for", () => {
    expect(forwardedForHeaders(request({ "x-real-ip": "198.51.100.4" }))).toEqual({
      "X-Forwarded-For": "198.51.100.4",
    });
  });

  it("prefiere x-forwarded-for sobre x-real-ip", () => {
    expect(
      forwardedForHeaders(request({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.4" })),
    ).toEqual({ "X-Forwarded-For": "203.0.113.7" });
  });

  it("ignora cabeceras vacías o con solo espacios", () => {
    expect(forwardedForHeaders(request({ "x-forwarded-for": "   " }))).toEqual({});
    expect(forwardedForHeaders(request({ "x-forwarded-for": " , ", "x-real-ip": "" }))).toEqual({});
  });
});
