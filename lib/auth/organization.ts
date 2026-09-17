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
