import { describe, expect, it } from "vitest";

import { AUTH, ORGANIZATIONS, SAFETY, USERS } from "./endpoints";

describe("endpoints", () => {
  it("AUTH.LOGIN apunta a /api/auth/login/", () => {
    expect(AUTH.LOGIN).toBe("/api/auth/login/");
  });

  it("USERS.ME apunta a /api/users/users/me/", () => {
    expect(USERS.ME).toBe("/api/users/users/me/");
  });

  it("SAFETY.PLATFORM_ROLE_ME apunta a /api/safety/platform-roles/me/", () => {
    expect(SAFETY.PLATFORM_ROLE_ME).toBe("/api/safety/platform-roles/me/");
  });

  it("ORGANIZATIONS.DETAIL(id) interpola el id de la entidad", () => {
    expect(ORGANIZATIONS.DETAIL(7)).toBe("/api/organizations/7/");
    expect(ORGANIZATIONS.DETAIL("alfaville")).toBe("/api/organizations/alfaville/");
  });
});
