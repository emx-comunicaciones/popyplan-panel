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

  it("precedencia documentada: membresía paraguas + entidad resuelve al paraguas sin selector", () => {
    const me = buildMe({
      org_memberships: [
        buildOrgMembership({
          role: "titular",
          organization_slug: "asociacion-bidasoa",
          organization_name: "Asociación Bidasoa",
        }),
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

  it("precedencia documentada: con dos paraguas resuelve al primero del array", () => {
    const me = buildMe({
      org_memberships: [
        buildOrgMembership({
          role: "analista",
          organization_slug: "diputacion-gipuzkoa",
          organization_type: "administracion",
        }),
        buildOrgMembership({
          role: "analista",
          organization_slug: "diputacion-bizkaia",
          organization_type: "administracion",
        }),
      ],
    });

    expect(resolveArea(me, buildPlatformRole(null))).toEqual({
      kind: "paraguas",
      slug: "diputacion-gipuzkoa",
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

  it("un rol de plataforma desconocido no resuelve 'plataforma': cae a su membresía de entidad", () => {
    // El layout de plataforma manda a `/` a quien no tiene uno de los
    // cuatro roles conocidos; si aquí siguiéramos resolviendo
    // 'plataforma' por el mero hecho de que `role` no es null, `/` lo
    // devolvería a `/plataforma` y el bucle dejaría a esa cuenta sin
    // ningún área (hallazgo de la revisión de la tarea 2).
    const me = buildMe({
      org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
    });

    expect(resolveArea(me, { role: "rol-que-el-backend-inventa" })).toEqual({
      kind: "entidad",
      slug: "alfaville",
    });
  });

  it("un rol de plataforma desconocido sin ninguna membresía resuelve 'sin-acceso'", () => {
    const me = buildMe({ org_memberships: [] });

    expect(resolveArea(me, { role: "rol-que-el-backend-inventa" })).toBe("sin-acceso");
  });

  it("con `is_administration: true` resuelve paraguas aunque no venga organization_type", () => {
    const me = buildMe({
      org_memberships: [
        buildOrgMembership({
          role: "analista",
          organization_slug: "gipuzkoako-foru-aldundia",
          organization_type: "",
          is_administration: true,
        }),
      ],
    });

    expect(resolveArea(me, buildPlatformRole(null))).toEqual({
      kind: "paraguas",
      slug: "gipuzkoako-foru-aldundia",
    });
  });

  it("`is_administration: false` manda sobre un organization_type heredado", () => {
    const me = buildMe({
      org_memberships: [
        buildOrgMembership({
          role: "titular",
          organization_slug: "asociacion-bidasoa",
          organization_type: "administracion",
          is_administration: false,
        }),
      ],
    });

    expect(resolveArea(me, buildPlatformRole(null))).toEqual({
      kind: "entidad",
      slug: "asociacion-bidasoa",
    });
  });

  it("sin `is_administration` (backend anterior al despliegue) sigue el respaldo por organization_type", () => {
    const me = buildMe({
      org_memberships: [
        buildOrgMembership({
          role: "analista",
          organization_slug: "gipuzkoako-foru-aldundia",
          organization_type: "administracion",
        }),
      ],
    });

    expect(resolveArea(me, buildPlatformRole(null))).toEqual({
      kind: "paraguas",
      slug: "gipuzkoako-foru-aldundia",
    });
  });
});
