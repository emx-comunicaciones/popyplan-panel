"use client";

/**
 * `GET /api/organizations/?verified=&parent=&search=&page=`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §8): listado paginado de entidades
 * para «Entidades» de plataforma, cualquier autenticado. `POST` (mismo
 * path) da de alta una entidad, `verifier`/`superadmin`.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { Organization, OrganizationCreateRequest, PaginatedOrganizationList } from "@/lib/api/types";

export class OrganizationsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationsError";
  }
}

export interface OrganizationsFilters {
  verified?: boolean;
  parent?: number | string;
  search?: string;
  page?: number;
}

/**
 * `PaginatedOrganizationList.results` es opcional en el esquema generado
 * (drf-spectacular no marca `results` como obligatorio en ninguna
 * respuesta paginada): esta forma normaliza a un array siempre presente,
 * para que quien consuma el hook no tenga que comprobar `undefined` en
 * cada sitio.
 */
export interface OrganizationsPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Organization[];
}

function buildQuery(filters: OrganizationsFilters): string {
  const params = new URLSearchParams();
  if (filters.verified !== undefined) params.set("verified", String(filters.verified));
  if (filters.parent !== undefined) params.set("parent", String(filters.parent));
  if (filters.search) params.set("search", filters.search);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

const QUERY_KEY = "panel-organizations";

export function useOrganizations(
  filters: OrganizationsFilters = {},
): UseQueryResult<OrganizationsPage, OrganizationsError> {
  const query = buildQuery(filters);

  return useQuery<OrganizationsPage, OrganizationsError>({
    queryKey: [QUERY_KEY, query],
    queryFn: async () => {
      try {
        const data = await apiFetch<PaginatedOrganizationList>(`${ORGANIZATIONS.LIST()}?${query}`);
        return {
          count: data.count ?? 0,
          next: data.next ?? null,
          previous: data.previous ?? null,
          results: data.results ?? [],
        };
      } catch {
        throw new OrganizationsError("No se pudo cargar el listado de entidades.");
      }
    },
  });
}

function invalidateOrganizations(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
}

export function useCreateOrganization(): UseMutationResult<
  Organization,
  OrganizationsError,
  OrganizationCreateRequest
> {
  const queryClient = useQueryClient();

  return useMutation<Organization, OrganizationsError, OrganizationCreateRequest>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<Organization>(ORGANIZATIONS.LIST(), { method: "POST", body: input });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const body = error.body as { detail?: unknown } | null;
          throw new OrganizationsError(
            typeof body?.detail === "string" ? body.detail : "Revisa los datos: alguno no es válido.",
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new OrganizationsError("Solo verificador o superadmin dan de alta entidades.");
        }
        throw new OrganizationsError("No se pudo dar de alta la entidad.");
      }
    },
    onSuccess: () => invalidateOrganizations(queryClient),
  });
}

export function useVerifyOrganization(): UseMutationResult<Organization, OrganizationsError, number | string> {
  const queryClient = useQueryClient();

  return useMutation<Organization, OrganizationsError, number | string>({
    mutationFn: async (orgId) => {
      try {
        return await apiFetch<Organization>(ORGANIZATIONS.VERIFY(orgId), { method: "POST" });
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new OrganizationsError("Solo verificador o superadmin verifican entidades.");
        }
        throw new OrganizationsError("No se pudo verificar la entidad.");
      }
    },
    onSuccess: (_data, orgId) => {
      invalidateOrganizations(queryClient);
      queryClient.invalidateQueries({ queryKey: ["panel-organization", orgId] });
    },
  });
}

export interface SetOrganizationParentInput {
  orgId: number | string;
  parent: number | null;
}

/**
 * `PATCH /api/organizations/{id}/ {"parent": <id>|null}` (§8): solo
 * `superadmin` — el backend lo distingue del resto de la lista blanca
 * mirando si `parent` está en el cuerpo, así que esta mutación nunca
 * manda otro campo junto a él (evita el 403 «cambiar la entidad paraguas
 * es cosa de la plataforma» de una petición mezclada).
 */
export function useSetOrganizationParent(): UseMutationResult<
  Organization,
  OrganizationsError,
  SetOrganizationParentInput
> {
  const queryClient = useQueryClient();

  return useMutation<Organization, OrganizationsError, SetOrganizationParentInput>({
    mutationFn: async ({ orgId, parent }) => {
      try {
        return await apiFetch<Organization>(ORGANIZATIONS.DETAIL(orgId), {
          method: "PATCH",
          body: { parent },
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const body = error.body as { detail?: unknown } | null;
          throw new OrganizationsError(
            typeof body?.detail === "string"
              ? body.detail
              : "Esa entidad paraguas no es válida (crearía un ciclo).",
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new OrganizationsError("Solo superadmin cambia la entidad paraguas.");
        }
        throw new OrganizationsError("No se pudo cambiar la entidad paraguas.");
      }
    },
    onSuccess: (_data, { orgId }) => {
      invalidateOrganizations(queryClient);
      queryClient.invalidateQueries({ queryKey: ["panel-organization", orgId] });
    },
  });
}
