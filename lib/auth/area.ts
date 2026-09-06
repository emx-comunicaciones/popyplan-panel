/**
 * Decide qué área del panel corresponde a la sesión: el rol de
 * plataforma manda sobre cualquier rol de entidad (decisión «Login del
 * panel», plan de Fase 5). Sin rol de plataforma, se mira
 * `me.org_memberships`.
 *
 * Regla de paraguas (W1): `OrgMembershipRef`, tal y como lo sirve hoy
 * `users/profile_serializers.py::OrgMembershipRefSerializer`, no incluye
 * `org_type` — la instrucción de esta tarea es tratar una membresía como
 * paraguas **solo si** el payload lo expone (`organization_type === 'administracion'` (o `org_type` heredado))
 * y, si no, como entidad normal. Hoy nunca lo expone, así que toda
 * membresía resuelve a `entidad` salvo que el backend añada el campo más
 * adelante (entonces esta función ya sabe distinguirlo sin cambios).
 * `docs/preguntas-diseno.md` deja constancia de esta limitación para
 * cuando el panel de paraguas (W2+) necesite detectarlo de verdad.
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
  return (membership.organization_type ?? membership.org_type) === "administracion";
}

export function resolveArea(
  me: MeForArea | null | undefined,
  platformRole: PlatformRoleMe | null | undefined,
): Area {
  if (platformRole?.role) {
    return "plataforma";
  }

  const memberships = (me?.org_memberships ?? []).filter(hasPanelRole);

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
