import { describe, expect, it } from "vitest";

import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import { resolveArea } from "./area";

describe("resolveArea", () => {
  it("con rol de plataforma resuelve 'plataforma'", () => {
    const me = buildMe();
    const platformRole = buildPlatformRole("superadmin");

    expect(resolveArea(me, platformRole)).toBe("plataforma");
  });

  it("titular de una entidad resuelve esa entidad", () => {
    const me = buildMe({
      org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
    });

    expect(resolveArea(me, buildPlatformRole(null))).toEqual({
      kind: "entidad",
      slug: "alfaville",
    });
  });

  it("analista de una entidad de tipo administración resuelve paraguas", () => {
    const me = buildMe({
      org_memberships: [
        buildOrgMembership({
          role: "analista",
          organization_slug: "diputacion-demo",
          organization_type: "administracion",
        }),
      ],
    });

    expect(resolveArea(me, buildPlatformRole(null))).toEqual({
      kind: "paraguas",
      slug: "diputacion-demo",
    });
  });

  it("sin rol de plataforma ni membresías con panel resuelve 'sin-acceso'", () => {
    const me = buildMe({ org_memberships: [] });

    expect(resolveArea(me, buildPlatformRole(null))).toBe("sin-acceso");
  });

  it("un solo rol de voluntario (sin ver_panel) también resuelve 'sin-acceso'", () => {
    const me = buildMe({
      org_memberships: [buildOrgMembership({ role: "voluntario" })],
    });

    expect(resolveArea(me, buildPlatformRole(null))).toBe("sin-acceso");
  });

  it("el rol de plataforma manda sobre cualquier rol de entidad", () => {
    const me = buildMe({
      org_memberships: [buildOrgMembership({ role: "titular" })],
    });

    expect(resolveArea(me, buildPlatformRole("moderator"))).toBe("plataforma");
  });

  it("dos entidades con rol de panel resuelve 'multiple-entidad' con ambas", () => {
    const me = buildMe({
      org_memberships: [
        buildOrgMembership({ role: "titular", organization_slug: "alfaville", organization_name: "Alfaville" }),
        buildOrgMembership({ role: "moderador", organization_slug: "betaville", organization_name: "Betaville" }),
      ],
    });

    expect(resolveArea(me, buildPlatformRole(null))).toEqual({
      kind: "multiple-entidad",
      orgs: [
        { slug: "alfaville", name: "Alfaville" },
        { slug: "betaville", name: "Betaville" },
      ],
    });
  });

  it("sin sesión (me null) y sin rol de plataforma resuelve 'sin-acceso'", () => {
    expect(resolveArea(null, null)).toBe("sin-acceso");
  });
});
