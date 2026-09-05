import { describe, expect, it } from "vitest";

import { AUTH, EXPORT, METRICS, ORGANIZATIONS, SAFETY, USERS } from "./endpoints";

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

  it("METRICS.ENTIDAD(orgId) apunta a /api/panel/entidad/{orgId}/metrics/", () => {
    expect(METRICS.ENTIDAD(7)).toBe("/api/panel/entidad/7/metrics/");
  });

  it("METRICS.PARAGUAS(orgId) apunta a /api/panel/paraguas/{orgId}/metrics/", () => {
    expect(METRICS.PARAGUAS(3)).toBe("/api/panel/paraguas/3/metrics/");
  });

  it("METRICS.PLATAFORMA() apunta a /api/panel/plataforma/metrics/", () => {
    expect(METRICS.PLATAFORMA()).toBe("/api/panel/plataforma/metrics/");
  });

  it("EXPORT.ENTIDAD(orgId) apunta a /api/panel/entidad/{orgId}/export/", () => {
    expect(EXPORT.ENTIDAD(7)).toBe("/api/panel/entidad/7/export/");
  });

  it("EXPORT.PARAGUAS(orgId) apunta a /api/panel/paraguas/{orgId}/export/", () => {
    expect(EXPORT.PARAGUAS(3)).toBe("/api/panel/paraguas/3/export/");
  });

  it("EXPORT.PLATAFORMA() apunta a /api/panel/plataforma/export/", () => {
    expect(EXPORT.PLATAFORMA()).toBe("/api/panel/plataforma/export/");
  });
});
