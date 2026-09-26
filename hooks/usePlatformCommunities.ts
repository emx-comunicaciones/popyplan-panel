"use client";

/**
 * Comunidades vistas por la plataforma (admin de plataforma, bloque 3,
 * 2026-09-26). Todo lo concede `is_staff` en el backend (hoy solo
 * `superadmin`), nunca `PlatformRole`:
 *
 * - **Listado** (`GET /api/communities/?search=&page=`,
 *   `communities/unified_viewset.py::CommunityViewSet`): a staff le da
 *   **todas** — privadas, de entidad, de los dos espacios de POP Familias
 *   e inactivas —, salvo las de entidades que esa cuenta haya ocultado a
 *   título personal (`hidden_org_ids_for`). La fila no lleva `is_active`.
 * - **Ficha** (`GET /api/communities/{id}/`, `CommunitySerializer`), con
 *   `is_active`. Desactivar/reactivar es `PATCH {is_active}` y borrar
 *   `DELETE` (borrado **real**, se lleva también el chat de la comunidad).
 * - **Publicaciones** (`GET /api/community-posts/?community=&is_active=
 *   &page=`, `AdminCommunityPostViewSet`, `IsAdminUser`): ocultar/mostrar
 *   es `PATCH {is_active}` y borrar `DELETE` (borrado real).
 *
 * Ninguna de estas acciones escribe en `AuditLog`.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { COMMUNITIES, COMMUNITY_POSTS } from "@/lib/api/endpoints";
import type {
  EntityCommunityRow,
  Paginated,
  PlatformCommunityDetail,
  PlatformCommunityPost,
} from "@/lib/api/types";

export type PlatformCommunitiesErrorKind =
  | "invalido"
  | "sin_acceso"
  | "no_encontrado"
  | "pagina_inexistente"
  | "desconocido";

export class PlatformCommunitiesError extends Error {
  readonly kind: PlatformCommunitiesErrorKind;
  readonly detail?: string;

  constructor(kind: PlatformCommunitiesErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "PlatformCommunitiesError";
    this.kind = kind;
    this.detail = detail;
  }
}

export const PLATFORM_COMMUNITIES_KEY = "panel-platform-communities";
export const PLATFORM_COMMUNITY_KEY = "panel-platform-community";
export const PLATFORM_COMMUNITY_POSTS_KEY = "panel-platform-community-posts";

function toReadError(error: unknown, notFoundKind: "no_encontrado" | "pagina_inexistente", fallback: string) {
  if (error instanceof ApiError && error.status === 403) {
    return new PlatformCommunitiesError("sin_acceso", "Solo el personal de plataforma ve esto.");
  }
  if (error instanceof ApiError && error.status === 404) {
    return new PlatformCommunitiesError(
      notFoundKind,
      notFoundKind === "no_encontrado" ? "Esta comunidad no existe." : "Esa página del listado ya no existe.",
    );
  }
  return new PlatformCommunitiesError("desconocido", fallback);
}

function toMutationError(error: unknown, fallback: string): PlatformCommunitiesError {
  if (error instanceof ApiError) {
    const detail = detailOf(error);
    if (error.status === 400) return new PlatformCommunitiesError("invalido", detail ?? fallback, detail);
    if (error.status === 403) return new PlatformCommunitiesError("sin_acceso", detail ?? fallback, detail);
    if (error.status === 404) return new PlatformCommunitiesError("no_encontrado", detail ?? fallback, detail);
  }
  return new PlatformCommunitiesError("desconocido", fallback);
}

export interface PlatformCommunitiesFilters {
  search?: string;
  page?: number;
}

export function usePlatformCommunities(
  filters: PlatformCommunitiesFilters,
): UseQueryResult<Paginated<EntityCommunityRow>, PlatformCommunitiesError> {
  const search = filters.search?.trim() ?? "";
  const page = filters.page ?? 1;
  return useQuery<Paginated<EntityCommunityRow>, PlatformCommunitiesError>({
    queryKey: [PLATFORM_COMMUNITIES_KEY, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      try {
        return await apiFetch<Paginated<EntityCommunityRow>>(`${COMMUNITIES.LIST()}?${params.toString()}`);
      } catch (error) {
        throw toReadError(error, "pagina_inexistente", "No se pudieron cargar las comunidades.");
      }
    },
  });
}

export function usePlatformCommunity(
  communityId: string,
): UseQueryResult<PlatformCommunityDetail, PlatformCommunitiesError> {
  return useQuery<PlatformCommunityDetail, PlatformCommunitiesError>({
    queryKey: [PLATFORM_COMMUNITY_KEY, communityId],
    queryFn: async () => {
      try {
        return await apiFetch<PlatformCommunityDetail>(COMMUNITIES.DETAIL(communityId));
      } catch (error) {
        throw toReadError(error, "no_encontrado", "No se pudo cargar la comunidad.");
      }
    },
  });
}

export function useSetPlatformCommunityActive(
  communityId: string,
): UseMutationResult<PlatformCommunityDetail, PlatformCommunitiesError, boolean> {
  const queryClient = useQueryClient();
  return useMutation<PlatformCommunityDetail, PlatformCommunitiesError, boolean>({
    mutationFn: async (isActive) => {
      try {
        return await apiFetch<PlatformCommunityDetail>(COMMUNITIES.DETAIL(communityId), {
          method: "PATCH",
          body: { is_active: isActive },
        });
      } catch (error) {
        throw toMutationError(error, "No se pudo cambiar el estado de la comunidad.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PLATFORM_COMMUNITY_KEY, communityId] });
      void queryClient.invalidateQueries({ queryKey: [PLATFORM_COMMUNITIES_KEY] });
    },
  });
}

export function useDeletePlatformCommunity(
  communityId: string,
): UseMutationResult<void, PlatformCommunitiesError, void> {
  const queryClient = useQueryClient();
  return useMutation<void, PlatformCommunitiesError, void>({
    mutationFn: async () => {
      try {
        await apiFetch(COMMUNITIES.DETAIL(communityId), { method: "DELETE" });
      } catch (error) {
        throw toMutationError(error, "No se pudo borrar la comunidad.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PLATFORM_COMMUNITIES_KEY] });
    },
  });
}

export interface PlatformCommunityPostsFilters {
  /** `true`/`false` filtra por `is_active`; `undefined`, todas. */
  isActive?: boolean;
  page?: number;
}

export function usePlatformCommunityPosts(
  communityId: string,
  filters: PlatformCommunityPostsFilters,
): UseQueryResult<Paginated<PlatformCommunityPost>, PlatformCommunitiesError> {
  const page = filters.page ?? 1;
  return useQuery<Paginated<PlatformCommunityPost>, PlatformCommunitiesError>({
    queryKey: [PLATFORM_COMMUNITY_POSTS_KEY, communityId, filters.isActive ?? null, page],
    queryFn: async () => {
      const params = new URLSearchParams({ community: communityId, page: String(page) });
      if (filters.isActive !== undefined) params.set("is_active", String(filters.isActive));
      try {
        return await apiFetch<Paginated<PlatformCommunityPost>>(`${COMMUNITY_POSTS.LIST()}?${params.toString()}`);
      } catch (error) {
        throw toReadError(error, "pagina_inexistente", "No se pudieron cargar las publicaciones.");
      }
    },
  });
}

export interface SetPostActiveInput {
  postId: string;
  isActive: boolean;
}

export function useSetCommunityPostActive(): UseMutationResult<
  PlatformCommunityPost,
  PlatformCommunitiesError,
  SetPostActiveInput
> {
  const queryClient = useQueryClient();
  return useMutation<PlatformCommunityPost, PlatformCommunitiesError, SetPostActiveInput>({
    mutationFn: async ({ postId, isActive }) => {
      try {
        return await apiFetch<PlatformCommunityPost>(COMMUNITY_POSTS.DETAIL(postId), {
          method: "PATCH",
          body: { is_active: isActive },
        });
      } catch (error) {
        throw toMutationError(error, "No se pudo cambiar la visibilidad de la publicación.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PLATFORM_COMMUNITY_POSTS_KEY] });
    },
  });
}

export function useDeleteCommunityPost(): UseMutationResult<void, PlatformCommunitiesError, string> {
  const queryClient = useQueryClient();
  return useMutation<void, PlatformCommunitiesError, string>({
    mutationFn: async (postId) => {
      try {
        await apiFetch(COMMUNITY_POSTS.DETAIL(postId), { method: "DELETE" });
      } catch (error) {
        throw toMutationError(error, "No se pudo borrar la publicación.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PLATFORM_COMMUNITY_POSTS_KEY] });
    },
  });
}
