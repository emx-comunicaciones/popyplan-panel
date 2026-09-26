/**
 * Ficha de la entidad (`GET /api/organizations/{id}/`) leída en el
 * servidor, memoizada por petición con `cache` de React.
 *
 * El layout y la página de `/entidad/[slug]` (y los de
 * `/paraguas/[slug]`) necesitan los mismos datos —el layout para la
 * cabecera con el color de marca, la página para el nombre—, y hasta
 * ahora cada uno hacía su propio `serverFetch`: dos llamadas idénticas
 * al backend por cada navegación (hallazgo B5). `cache` las une en una
 * sola mientras dure la misma petición; fuera de una petición de
 * servidor (p. ej. en los tests) `cache` no memoiza nada y la llamada
 * pasa directa, sin cambiar el comportamiento.
 */
import { cache } from "react";

import { ORGANIZATIONS } from "@/lib/api/endpoints";
import { serverFetch, type ServerFetchResult } from "@/lib/api/serverFetch";
import type { Organization } from "@/lib/api/types";

export const getServerOrganization = cache(
  async (orgId: number, token: string): Promise<ServerFetchResult<Organization>> =>
    serverFetch<Organization>(ORGANIZATIONS.DETAIL(orgId), token),
);

/**
 * ¿Es quien mira la **persona de guardia** de esa entidad
 * (`Organization.on_call_user`)? Hallazgo D-I8 de la auditoría de
 * integración: `safety/viewsets.py::HelpRequestViewSet.pending` acepta
 * `es_guardia or puede(user, org, 'moderar')`, así que la sección
 * «Guardia» no depende solo del rol — cualquier `OrgMembership` puede
 * ser la guardia (`entities/serializers.py::validate_on_call_user`). Lo
 * consumen el layout de entidad (para el menú) y el gate de
 * `guardia/page.tsx`, los dos vía `entidadMenuFor(role, { isOnCall })`.
 *
 * Con la ficha de la entidad no disponible (403/5xx/red) devuelve
 * `false`: se cae al menú por rol, que es lo que hacía el panel antes de
 * este arreglo. No añade ninguna petición — `getServerOrganization` está
 * memoizada por petición con `cache` de React y el layout ya la pide.
 */
export async function isOnCallUser(
  orgId: number,
  session: { token: string; me: { id: number } },
): Promise<boolean> {
  const result = await getServerOrganization(orgId, session.token);
  return result.ok && result.data.on_call_user === session.me.id;
}

/**
 * ¿Tiene la entidad el **programa de seguimiento** encendido
 * (`Organization.tracking_program_enabled`, `docs/PANEL.md` §18.2)? El
 * campo solo viaja a quien tiene rol en la entidad o en la plataforma
 * (para el resto la clave no existe): cualquier cosa que no sea `true`
 * —ficha ilegible incluida— es «no». Lo usan el gate de
 * `seguimiento/page.tsx` y la ficha de persona; sin petición extra
 * (`getServerOrganization` memoizada por petición).
 */
export async function isTrackingProgramEnabled(
  orgId: number,
  session: { token: string },
): Promise<boolean> {
  const result = await getServerOrganization(orgId, session.token);
  return result.ok && result.data.tracking_program_enabled === true;
}
