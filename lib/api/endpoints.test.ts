import { describe, expect, it } from "vitest";

import { AUTH, EVENTS, EXPORT, METRICS, ORGANIZATIONS, PANEL, SAFETY, USERS } from "./endpoints";

describe("endpoints", () => {
  it("AUTH.LOGIN apunta a /api/auth/login/", () => {
    expect(AUTH.LOGIN).toBe("/api/auth/login/");
  });

  it("AUTH.TOKEN_REFRESH apunta a /api/auth/token/refresh/", () => {
    expect(AUTH.TOKEN_REFRESH).toBe("/api/auth/token/refresh/");
  });

  it("AUTH.LOGOUT apunta a /api/auth/logout/", () => {
    expect(AUTH.LOGOUT).toBe("/api/auth/logout/");
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

  it("ORGANIZATIONS.REFERENCES(id) apunta a /api/organizations/{id}/references/", () => {
    expect(ORGANIZATIONS.REFERENCES(7)).toBe("/api/organizations/7/references/");
  });

  it("SAFETY.REPORTS_QUEUE() apunta a /api/safety/reports/queue/", () => {
    expect(SAFETY.REPORTS_QUEUE()).toBe("/api/safety/reports/queue/");
  });

  it("SAFETY.HELP_REQUESTS_PENDING() apunta a /api/safety/help-requests/pending/", () => {
    expect(SAFETY.HELP_REQUESTS_PENDING()).toBe("/api/safety/help-requests/pending/");
  });

  it("PANEL.PEOPLE(orgId) apunta a /api/panel/entidad/{orgId}/people/", () => {
    expect(PANEL.PEOPLE(7)).toBe("/api/panel/entidad/7/people/");
  });

  it("PANEL.PERSON(orgId, userId) apunta a /api/panel/entidad/{orgId}/people/{userId}/", () => {
    expect(PANEL.PERSON(7, 42)).toBe("/api/panel/entidad/7/people/42/");
  });

  it("PANEL.EVENTS(orgId) apunta a /api/panel/entidad/{orgId}/events/", () => {
    expect(PANEL.EVENTS(7)).toBe("/api/panel/entidad/7/events/");
  });

  it("EVENTS.ATTENDEES(id) apunta a /api/events/{id}/attendees/", () => {
    expect(EVENTS.ATTENDEES("event-1")).toBe("/api/events/event-1/attendees/");
  });

  it("EVENTS.ATTENDANCE(id) apunta a /api/events/{id}/attendance/", () => {
    expect(EVENTS.ATTENDANCE("event-1")).toBe("/api/events/event-1/attendance/");
  });

  it("EVENTS.CHECKIN(id) apunta a /api/events/{id}/checkin/", () => {
    expect(EVENTS.CHECKIN("event-1")).toBe("/api/events/event-1/checkin/");
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
