import { describe, expect, it } from "vitest";

import { PANEL_CLIENT_HEADER, panelClientHeaders } from "./panelClient";
import { SESSION_COOKIE_MAX_AGE_SECONDS, sessionCookieOptions } from "./cookie";

describe("panelClientHeaders", () => {
  it("marca el cliente como panel", () => {
    expect(PANEL_CLIENT_HEADER).toBe("X-Popyplan-Client");
    expect(panelClientHeaders()).toEqual({ "X-Popyplan-Client": "panel" });
  });
});

describe("cookie de sesión deslizante", () => {
  it("dura 30 días y cada Set-Cookie la vuelve a contar entera", () => {
    expect(SESSION_COOKIE_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(sessionCookieOptions().maxAge).toBe(SESSION_COOKIE_MAX_AGE_SECONDS);
  });
});
