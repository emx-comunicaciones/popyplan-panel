/**
 * Tipos de dominio usados por el panel, elegidos a mano desde
 * `types.generated.ts` (generado con `npm run gen:types` desde
 * `../popyplan/docs/schema.yaml`). No reexportamos el fichero generado
 * entero para que cada import documente qué endpoint lo origina.
 */
import type { components } from "./types.generated";

/** `GET /api/users/users/me/`. */
export type Me = components["schemas"]["Me"];

/** Una entidad dentro de `Me.org_memberships`. */
export type OrgMembershipRef = components["schemas"]["OrgMembershipRef"];

/**
 * `OrgMembershipRef` tal y como lo devuelve hoy el backend nunca incluye
 * `org_type` (ver `users/profile_serializers.py::OrgMembershipRefSerializer`):
 * solo lo tiene `Organization` completa. `resolveArea` (`lib/auth/area.ts`)
 * acepta el campo como opcional para poder distinguir una entidad paraguas
 * (`org_type === 'administracion'`) el día que el backend lo añada a este
 * serializer, sin romper el contrato actual mientras tanto.
 */
export type OrgMembershipForArea = OrgMembershipRef & {
  org_type?: components["schemas"]["OrgTypeEnum"];
};

export type MeForArea = Omit<Me, "org_memberships"> & {
  org_memberships: OrgMembershipForArea[];
};

/** `GET /api/safety/platform-roles/me/`. */
export type PlatformRoleMe = components["schemas"]["PlatformRoleMe"];

/** `GET`/`PATCH /api/organizations/{id}/`. */
export type Organization = components["schemas"]["Organization"];

export type OrgMembershipRole = components["schemas"]["OrgMembershipRoleEnum"];

export type OrgTypeEnum = components["schemas"]["OrgTypeEnum"];

/** Respuesta de `POST /api/auth/login/`. */
export type LoginResponse = components["schemas"]["LoginResponse"];
