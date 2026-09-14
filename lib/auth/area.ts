/**
 * Decide qué área del panel corresponde a la sesión: el rol de
 * plataforma manda sobre cualquier rol de entidad (decisión «Login del
 * panel», plan de Fase 5). Sin rol de plataforma, se mira
 * `me.org_memberships`.
 *
 * Regla de paraguas (W1): `OrgMembershipRef`, tal y como lo sirve hoy
 * `users/profile_serializers.py::OrgMembershipRefSerializer`, expone
 * `organization_type` (`source='organization.org_type'`, ronda de cierre
 * de Fase 5) — `isParaguas` lo mira (y también el `org_type` heredado
 * por compatibilidad), así que una membresía con
 * `organization_type === 'administracion'` resuelve a paraguas.
 */
import type { MeForArea, OrgMembershipForArea, PlatformRoleMe } from "@/lib/api/types";

/** Roles de `OrgMembership` con `ver_panel` (matriz de `entities/permissions.py`). */
const ENTIDAD_PANEL_ROLES = [
  "titular",
  "moderador",
  "dinamizador",
  "analista",
  "referente",
] as const;

export type EntidadPanelRole = (typeof ENTIDAD_PANEL_ROLES)[number];

export function isEntidadPanelRole(role: string): role is EntidadPanelRole {
  return (ENTIDAD_PANEL_ROLES as readonly string[]).includes(role);
}

export interface EntidadArea {
  kind: "entidad";
  slug: string;
}

export interface ParaguasArea {
  kind: "paraguas";
  slug: string;
}

export interface MultipleEntidadArea {
  kind: "multiple-entidad";
  orgs: { slug: string; name: string }[];
}

export type Area = "plataforma" | EntidadArea | ParaguasArea | MultipleEntidadArea | "sin-acceso";

function hasPanelRole(membership: OrgMembershipForArea): boolean {
  return isEntidadPanelRole(membership.role);
}

function isParaguas(membership: OrgMembershipForArea): boolean {
  return membership.organization_type === "administracion" || membership.org_type === "administracion";
}

export function resolveArea(
  me: MeForArea | null | undefined,
  platformRole: PlatformRoleMe | null | undefined,
): Area {
  if (platformRole?.role) {
    return "plataforma";
  }

  const memberships = (me?.org_memberships ?? []).filter(hasPanelRole);

  // Precedencia documentada (decisión del equipo): con al menos una
  // membresía paraguas se resuelve al paraguas —el primero del array si
  // hay varias— sin pasar por `/elegir-entidad`, aunque haya otras
  // membresías de entidad (una diputación manda sobre sus entidades
  // hijas a la hora de aterrizar el login). Comportamiento fijado por
  // los tests de `lib/auth/area.test.ts`; cambiarlo es una decisión de
  // producto, no un refactor.
  const paraguas = memberships.filter(isParaguas);
  if (paraguas.length > 0) {
    return { kind: "paraguas", slug: paraguas[0].organization_slug };
  }

  const entidades = memberships.filter((m) => !isParaguas(m));
  if (entidades.length === 1) {
    return { kind: "entidad", slug: entidades[0].organization_slug };
  }
  if (entidades.length > 1) {
    return {
      kind: "multiple-entidad",
      orgs: entidades.map((m) => ({ slug: m.organization_slug, name: m.organization_name })),
    };
  }

  return "sin-acceso";
}
