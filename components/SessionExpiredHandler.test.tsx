import { afterEach, describe, expect, it, vi } from "vitest";

import { render, waitFor } from "@/test-utils/render";
import { routerMock } from "@/test-utils/nextNavigationMock";
import { resetAccessTokenForTests, setAccessToken, getAccessToken } from "@/lib/auth/tokenStore";
import { notifySessionExpired } from "@/lib/auth/sessionEvents";

const fetchMock = vi.fn();

import { SessionExpiredHandler } from "./SessionExpiredHandler";

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  resetAccessTokenForTests();
});

describe("SessionExpiredHandler", () => {
  it("al caducar la sesión, cierra sesión y redirige a /login", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
    setAccessToken("token-vivo");

    render(<SessionExpiredHandler />);

    notifySessionExpired();

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/login"));
    expect(getAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({ method: "DELETE", signal: expect.any(AbortSignal) }),
    );
  });

  it("no pinta nada", () => {
    const { container } = render(<SessionExpiredHandler />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SessionExpiredHandler: cierre de sesión en otra pestaña (error 38)", () => {
  it("al recibir el aviso de otra pestaña olvida el token y va a /login", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    setAccessToken("token-vivo");
    render(<SessionExpiredHandler />);

    const other = new BroadcastChannel("pp-session");
    other.postMessage({ type: "logout", from: "otra-pestana" });
    other.close();

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
    expect(getAccessToken()).toBeNull();
  });

  it("logout() avisa a las demás pestañas", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
    const received = vi.fn();
    const other = new BroadcastChannel("pp-session");
    other.onmessage = (event) => received(event.data);

    const { logout } = await import("@/hooks/useAuth");
    await logout();

    await waitFor(() => expect(received).toHaveBeenCalledWith(expect.objectContaining({ type: "logout" })));
    other.close();
  });
});
