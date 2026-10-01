import { describe, expect, it } from "vitest";

import {
  PLATFORM_ROLES,
  TEAM_MANAGER_ROLES,
  canManageTeamFromPlatform,
  isPlatformRole,
  plataformaMenuFor, isCrmManager, isCrmRole, isSalesOnly } from "./plataformaMenu";

describe("plataformaMenuFor", () => {
  it("superadmin ve todo", () => {
    expect(plataformaMenuFor("superadmin")).toEqual([
      "inicio",
      "comercial",
      "entidades",
      "usuarios",
      "comunidades",
      "publicaciones",
      "actividades",
      "reportes",
      "bloqueos",
      "resenas",
      "chats",
      "notificaciones",
      "ayuda",
      "verificaciones",
      "roles",
      "auditoria",
      "metricas",
      "suscripciones",
      "nomencladores",
      "busca-del-tesoro",
    ]);
  });

  it("verifier ve inicio, entidades y verificaciones", () => {
    expect(plataformaMenuFor("verifier")).toEqual(["inicio", "entidades", "verificaciones"]);
  });

  it("moderator ve inicio, reportes, ayuda y métricas", () => {
    expect(plataformaMenuFor("moderator")).toEqual(["inicio", "reportes", "ayuda", "metricas"]);
  });

  it("support ve lo mismo que moderator más Suscripciones (lectura de facturación, W4)", () => {
    expect(plataformaMenuFor("support")).toEqual(["inicio", "reportes", "ayuda", "metricas", "suscripciones"]);
  });

  it("sin rol, sin menú", () => {
    expect(plataformaMenuFor(null)).toEqual([]);
    expect(plataformaMenuFor(undefined)).toEqual([]);
    expect(plataformaMenuFor("otro")).toEqual([]);
  });

  it("TEAM_MANAGER_ROLES son los que el backend deja gestionar el equipo de una entidad", () => {
    expect([...TEAM_MANAGER_ROLES]).toEqual(["superadmin", "moderator"]);
    expect((TEAM_MANAGER_ROLES as readonly string[]).includes("verifier")).toBe(false);
    expect((TEAM_MANAGER_ROLES as readonly string[]).includes("support")).toBe(false);
  });

  it("canManageTeamFromPlatform solo deja pasar a esos dos roles", () => {
    expect(canManageTeamFromPlatform("superadmin")).toBe(true);
    expect(canManageTeamFromPlatform("moderator")).toBe(true);
    expect(canManageTeamFromPlatform("verifier")).toBe(false);
    expect(canManageTeamFromPlatform("support")).toBe(false);
    expect(canManageTeamFromPlatform(null)).toBe(false);
    expect(canManageTeamFromPlatform(undefined)).toBe(false);
  });

  it("PLATFORM_ROLES lista los seis roles conocidos y isPlatformRole los reconoce", () => {
    expect([...PLATFORM_ROLES]).toEqual([
      "superadmin",
      "verifier",
      "moderator",
      "support",
      "sales_lead",
      "sales",
    ]);
    for (const role of PLATFORM_ROLES) {
      expect(isPlatformRole(role)).toBe(true);
    }
    expect(isPlatformRole("rol-que-el-backend-inventa")).toBe(false);
    expect(isPlatformRole(null)).toBe(false);
  });

  it("los roles comerciales solo tienen la pestaña Comercial (CRM)", () => {
    expect(plataformaMenuFor("sales_lead")).toEqual(["comercial"]);
    expect(plataformaMenuFor("sales")).toEqual(["comercial"]);
    expect(plataformaMenuFor("moderator")).not.toContain("comercial");
  });

  it("quién entra en el CRM, quién lo dirige y quién solo tiene el CRM", () => {
    expect(isCrmRole("superadmin")).toBe(true);
    expect(isCrmRole("sales")).toBe(true);
    expect(isCrmRole("support")).toBe(false);
    expect(isCrmRole(null)).toBe(false);
    expect(isCrmManager("sales_lead")).toBe(true);
    expect(isCrmManager("sales")).toBe(false);
    expect(isCrmManager(undefined)).toBe(false);
    expect(isSalesOnly("sales")).toBe(true);
    expect(isSalesOnly("superadmin")).toBe(false);
    expect(isSalesOnly(null)).toBe(false);
  });
});
