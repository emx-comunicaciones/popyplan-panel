import { afterEach, describe, expect, it, vi } from "vitest";

import { getAccessToken, resetAccessTokenForTests, setAccessToken, subscribeAccessToken } from "./tokenStore";

afterEach(() => {
  resetAccessTokenForTests();
});

describe("tokenStore", () => {
  it("empieza sin token", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("setAccessToken actualiza el valor leído por getAccessToken", () => {
    setAccessToken("abc123");
    expect(getAccessToken()).toBe("abc123");
  });

  it("avisa a los subscriptores cuando cambia el token", () => {
    const listener = vi.fn();
    subscribeAccessToken(listener);

    setAccessToken("token-1");

    expect(listener).toHaveBeenCalledWith("token-1");
  });

  it("no avisa si el token nuevo es igual al actual", () => {
    setAccessToken("token-1");
    const listener = vi.fn();
    subscribeAccessToken(listener);

    setAccessToken("token-1");

    expect(listener).not.toHaveBeenCalled();
  });

  it("unsubscribe deja de avisar", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAccessToken(listener);
    unsubscribe();

    setAccessToken("token-2");

    expect(listener).not.toHaveBeenCalled();
  });
});
