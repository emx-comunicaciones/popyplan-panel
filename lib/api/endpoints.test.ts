import { describe, expect, it } from "vitest";

import {
  AUTH,
  BILLING,
  COMMUNITIES,
  DASHBOARD,
  EVENTS,
  EXPORT,
  METRICS,
  ORGANIZATIONS,
  PANEL,
  PLACES,
  PROGRAMS,
  SAFETY,
  TERRITORIO,
  USERS,
  VERIFICATION,
} from "./endpoints";

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

  it("METRICS.COMPARE_PARAGUAS(orgId) apunta a /api/panel/paraguas/{orgId}/compare/", () => {
    expect(METRICS.COMPARE_PARAGUAS(3)).toBe("/api/panel/paraguas/3/compare/");
  });

  it("METRICS.COMPARE_PLATAFORMA() apunta a /api/panel/plataforma/compare/", () => {
    expect(METRICS.COMPARE_PLATAFORMA()).toBe("/api/panel/plataforma/compare/");
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

  it("SAFETY.REPORT_DETAIL(id) apunta a /api/safety/reports/{id}/", () => {
    expect(SAFETY.REPORT_DETAIL("r1")).toBe("/api/safety/reports/r1/");
  });

  it("SAFETY.REPORT_ASSIGN(id) apunta a /api/safety/reports/{id}/assign/", () => {
    expect(SAFETY.REPORT_ASSIGN("r1")).toBe("/api/safety/reports/r1/assign/");
  });

  it("SAFETY.REPORT_RESOLVE(id) apunta a /api/safety/reports/{id}/resolve/", () => {
    expect(SAFETY.REPORT_RESOLVE("r1")).toBe("/api/safety/reports/r1/resolve/");
  });

  it("SAFETY.REPORT_ESCALATE(id) apunta a /api/safety/reports/{id}/escalate/", () => {
    expect(SAFETY.REPORT_ESCALATE("r1")).toBe("/api/safety/reports/r1/escalate/");
  });

  it("SAFETY.HELP_REQUEST_ACKNOWLEDGE(id) apunta a /api/safety/help-requests/{id}/acknowledge/", () => {
    expect(SAFETY.HELP_REQUEST_ACKNOWLEDGE("hr1")).toBe("/api/safety/help-requests/hr1/acknowledge/");
  });

  it("ORGANIZATIONS.MEMBERS(id) apunta a /api/organizations/{id}/members/", () => {
    expect(ORGANIZATIONS.MEMBERS(7)).toBe("/api/organizations/7/members/");
  });

  it("ORGANIZATIONS.SCOPE(id) apunta a /api/organizations/{id}/scope/", () => {
    expect(ORGANIZATIONS.SCOPE(7)).toBe("/api/organizations/7/scope/");
  });

  it("ORGANIZATIONS.INVITATIONS(id) apunta a /api/organizations/{id}/invitations/", () => {
    expect(ORGANIZATIONS.INVITATIONS(7)).toBe("/api/organizations/7/invitations/");
  });

  it("ORGANIZATIONS.INVITATIONS_IMPORT(id) apunta a /api/organizations/{id}/invitations/import/", () => {
    expect(ORGANIZATIONS.INVITATIONS_IMPORT(7)).toBe("/api/organizations/7/invitations/import/");
  });

  it("ORGANIZATIONS.INVITATION(id, iid) apunta a /api/organizations/{id}/invitations/{iid}/", () => {
    expect(ORGANIZATIONS.INVITATION(7, 3)).toBe("/api/organizations/7/invitations/3/");
  });

  it("ORGANIZATIONS.INVITATION_RESEND(id, iid) apunta a /api/organizations/{id}/invitations/{iid}/resend/", () => {
    expect(ORGANIZATIONS.INVITATION_RESEND(7, 3)).toBe("/api/organizations/7/invitations/3/resend/");
  });

  it("COMMUNITIES.LIST() apunta a /api/communities/", () => {
    expect(COMMUNITIES.LIST()).toBe("/api/communities/");
  });

  it("COMMUNITIES.MEMBERS(id) apunta a /api/communities/{id}/members/", () => {
    expect(COMMUNITIES.MEMBERS("c1")).toBe("/api/communities/c1/members/");
  });

  it("COMMUNITIES.PENDING_REQUESTS(id) apunta a /api/communities/{id}/pending-requests/", () => {
    expect(COMMUNITIES.PENDING_REQUESTS("c1")).toBe("/api/communities/c1/pending-requests/");
  });

  it("COMMUNITIES.APPROVE_MEMBER(id, memberId) apunta a .../members/{memberId}/approve/", () => {
    expect(COMMUNITIES.APPROVE_MEMBER("c1", "m1")).toBe("/api/communities/c1/members/m1/approve/");
  });

  it("COMMUNITIES.REJECT_MEMBER(id, memberId) apunta a .../members/{memberId}/reject/", () => {
    expect(COMMUNITIES.REJECT_MEMBER("c1", "m1")).toBe("/api/communities/c1/members/m1/reject/");
  });

  it("COMMUNITIES.KICK_MEMBER(id, memberId) apunta a .../members/{memberId}/kick/", () => {
    expect(COMMUNITIES.KICK_MEMBER("c1", "m1")).toBe("/api/communities/c1/members/m1/kick/");
  });

  it("COMMUNITIES.MEMBER_ROLE(id, memberId) apunta a .../members/{memberId}/role/", () => {
    expect(COMMUNITIES.MEMBER_ROLE("c1", "m1")).toBe("/api/communities/c1/members/m1/role/");
  });

  it("COMMUNITIES.DETAIL(id) apunta a /api/communities/{id}/", () => {
    expect(COMMUNITIES.DETAIL("c1")).toBe("/api/communities/c1/");
  });

  it("ORGANIZATIONS.RESOURCES(id) apunta a /api/organizations/{id}/resources/", () => {
    expect(ORGANIZATIONS.RESOURCES(7)).toBe("/api/organizations/7/resources/");
  });

  it("ORGANIZATIONS.RESOURCE(id, resourceId) apunta a /api/organizations/{id}/resources/{resourceId}/", () => {
    expect(ORGANIZATIONS.RESOURCE(7, 3)).toBe("/api/organizations/7/resources/3/");
  });

  it("PANEL.ANNOUNCEMENTS(orgId) apunta a /api/panel/entidad/{orgId}/announcements/", () => {
    expect(PANEL.ANNOUNCEMENTS(7)).toBe("/api/panel/entidad/7/announcements/");
  });

  it("PANEL.SURVEYS(orgId) apunta a /api/panel/entidad/{orgId}/surveys/", () => {
    expect(PANEL.SURVEYS(7)).toBe("/api/panel/entidad/7/surveys/");
  });

  it("PANEL.SURVEY_RESULTS(orgId, surveyId) apunta a /api/panel/entidad/{orgId}/surveys/{surveyId}/results/", () => {
    expect(PANEL.SURVEY_RESULTS(7, 3)).toBe("/api/panel/entidad/7/surveys/3/results/");
  });

  it("PANEL.FAMILIES(orgId) apunta a /api/panel/entidad/{orgId}/families/", () => {
    expect(PANEL.FAMILIES(7)).toBe("/api/panel/entidad/7/families/");
  });

  it("USERS.SEARCH() apunta a /api/users/users/", () => {
    expect(USERS.SEARCH()).toBe("/api/users/users/");
  });

  it("SAFETY.PLATFORM_ROLES() apunta a /api/safety/platform-roles/", () => {
    expect(SAFETY.PLATFORM_ROLES()).toBe("/api/safety/platform-roles/");
  });

  it("SAFETY.PLATFORM_ROLE_DETAIL(userId) apunta a /api/safety/platform-roles/{userId}/", () => {
    expect(SAFETY.PLATFORM_ROLE_DETAIL(9)).toBe("/api/safety/platform-roles/9/");
  });

  it("SAFETY.AUDIT() apunta a /api/safety/audit/", () => {
    expect(SAFETY.AUDIT()).toBe("/api/safety/audit/");
  });

  it("ORGANIZATIONS.LIST() apunta a /api/organizations/", () => {
    expect(ORGANIZATIONS.LIST()).toBe("/api/organizations/");
  });

  it("ORGANIZATIONS.VERIFY(id) apunta a /api/organizations/{id}/verify/", () => {
    expect(ORGANIZATIONS.VERIFY(7)).toBe("/api/organizations/7/verify/");
  });

  it("VERIFICATION.REVIEWS_QUEUE() apunta a /api/users/verification/reviews/queue/", () => {
    expect(VERIFICATION.REVIEWS_QUEUE()).toBe("/api/users/verification/reviews/queue/");
  });

  it("VERIFICATION.REVIEW_DECIDE(id) apunta a /api/users/verification/reviews/{id}/decide/", () => {
    expect(VERIFICATION.REVIEW_DECIDE("r1")).toBe("/api/users/verification/reviews/r1/decide/");
  });

  it("DASHBOARD.STATS() apunta a /api/admin/dashboard-stats/", () => {
    expect(DASHBOARD.STATS()).toBe("/api/admin/dashboard-stats/");
  });

  it("PROGRAMS.LIST(orgId) apunta a /api/panel/entidad/{orgId}/programs/", () => {
    expect(PROGRAMS.LIST(7)).toBe("/api/panel/entidad/7/programs/");
  });

  it("PROGRAMS.DETAIL(orgId, programId) apunta a /api/panel/entidad/{orgId}/programs/{programId}/", () => {
    expect(PROGRAMS.DETAIL(7, 3)).toBe("/api/panel/entidad/7/programs/3/");
  });

  it("PROGRAMS.ACTIVATE(orgId, programId) apunta a .../programs/{programId}/activate/", () => {
    expect(PROGRAMS.ACTIVATE(7, 3)).toBe("/api/panel/entidad/7/programs/3/activate/");
  });

  it("PROGRAMS.CLOSE(orgId, programId) apunta a .../programs/{programId}/close/", () => {
    expect(PROGRAMS.CLOSE(7, 3)).toBe("/api/panel/entidad/7/programs/3/close/");
  });

  it("PROGRAMS.REPORT(orgId, programId) apunta a .../programs/{programId}/report/", () => {
    expect(PROGRAMS.REPORT(7, 3)).toBe("/api/panel/entidad/7/programs/3/report/");
  });

  it("BILLING.TIERS() apunta a /api/plataforma/billing/tiers/", () => {
    expect(BILLING.TIERS()).toBe("/api/plataforma/billing/tiers/");
  });

  it("BILLING.TIER(tierId) apunta a /api/plataforma/billing/tiers/{tierId}/", () => {
    expect(BILLING.TIER(3)).toBe("/api/plataforma/billing/tiers/3/");
  });

  it("BILLING.CONTRACTS() apunta a /api/plataforma/billing/contracts/", () => {
    expect(BILLING.CONTRACTS()).toBe("/api/plataforma/billing/contracts/");
  });

  it("BILLING.CONTRACT(contractId) apunta a /api/plataforma/billing/contracts/{contractId}/", () => {
    expect(BILLING.CONTRACT(3)).toBe("/api/plataforma/billing/contracts/3/");
  });

  it("BILLING.CONTRACT_ACTIVATE(contractId) apunta a .../contracts/{contractId}/activate/", () => {
    expect(BILLING.CONTRACT_ACTIVATE(3)).toBe("/api/plataforma/billing/contracts/3/activate/");
  });

  it("BILLING.CONTRACT_END(contractId) apunta a .../contracts/{contractId}/end/", () => {
    expect(BILLING.CONTRACT_END(3)).toBe("/api/plataforma/billing/contracts/3/end/");
  });

  it("BILLING.CONTRACT_INVOICES(contractId) apunta a .../contracts/{contractId}/invoices/", () => {
    expect(BILLING.CONTRACT_INVOICES(3)).toBe("/api/plataforma/billing/contracts/3/invoices/");
  });

  it("BILLING.INVOICE_PAY(invoiceId) apunta a /api/plataforma/billing/invoices/{invoiceId}/pay/", () => {
    expect(BILLING.INVOICE_PAY(5)).toBe("/api/plataforma/billing/invoices/5/pay/");
  });

  it("BILLING.SUMMARY() apunta a /api/plataforma/billing/summary/", () => {
    expect(BILLING.SUMMARY()).toBe("/api/plataforma/billing/summary/");
  });

  it("METRICS.TERRITORIO(orgId) apunta a /api/panel/territorio/{orgId}/metrics/", () => {
    expect(METRICS.TERRITORIO(3)).toBe("/api/panel/territorio/3/metrics/");
  });

  it("METRICS.COMPARE_TERRITORIO(orgId) apunta a /api/panel/territorio/{orgId}/compare/", () => {
    expect(METRICS.COMPARE_TERRITORIO(3)).toBe("/api/panel/territorio/3/compare/");
  });

  it("EXPORT.TERRITORIO(orgId) apunta a /api/panel/territorio/{orgId}/export/", () => {
    expect(EXPORT.TERRITORIO(3)).toBe("/api/panel/territorio/3/export/");
  });

  it("TERRITORIO.PLACE_SHEET(orgId, ineCode) apunta a /api/panel/territorio/{orgId}/places/{ineCode}/", () => {
    expect(TERRITORIO.PLACE_SHEET(3, "20069")).toBe("/api/panel/territorio/3/places/20069/");
  });

  /**
   * M10 de la revisión final de rama: `ineCode` viene de `by_place[].key`
   * del backend, no de una constante del panel — sin `encodeURIComponent`
   * un valor con `/` o `?` rompería la ruta en vez de dar un 404 limpio.
   */
  it("TERRITORIO.PLACE_SHEET codifica el ineCode en la URL (M10)", () => {
    expect(TERRITORIO.PLACE_SHEET(3, "20/69")).toBe("/api/panel/territorio/3/places/20%2F69/");
  });

  it("PLACES.LIST() apunta a /api/places/", () => {
    expect(PLACES.LIST()).toBe("/api/places/");
  });
});
