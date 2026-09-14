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
