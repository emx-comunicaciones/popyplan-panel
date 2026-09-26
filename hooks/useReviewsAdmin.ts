"use client";

/**
 * Reseñas vistas por la plataforma (admin de plataforma, bloque 3,
 * 2026-09-26): `GET /api/reviews/?page=` y `DELETE /api/reviews/{id}/`
 * (`reviews/unified_viewset.py::ReviewViewSet`).
 *
 * A `is_staff` el listado le da **todas** las reseñas, 20 por página, de
 * la más reciente a la más antigua (salvo las de cuentas que esa cuenta
 * de staff tenga bloqueadas, en cualquier sentido). El esquema envuelve
 * la respuesta dos veces; el cuerpo real es la paginación estándar.
 * `DELETE` lo pueden hacer el autor o `is_staff`, responde **200**
 * `{"message": …}` (no el 204 del esquema) y el 403 trae `{"error": …}`,
 * que `detailOf` ya lee. Borrado real, sin `AuditLog`.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { REVIEWS } from "@/lib/api/endpoints";
import type { Paginated, PlatformReview } from "@/lib/api/types";

export type ReviewsAdminErrorKind = "sin_acceso" | "no_encontrado" | "pagina_inexistente" | "desconocido";

export class ReviewsAdminError extends Error {
  readonly kind: ReviewsAdminErrorKind;
  readonly detail?: string;

  constructor(kind: ReviewsAdminErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "ReviewsAdminError";
    this.kind = kind;
    this.detail = detail;
  }
}

export const REVIEWS_ADMIN_KEY = "panel-reviews-admin";

export function useReviewsAdmin(page: number): UseQueryResult<Paginated<PlatformReview>, ReviewsAdminError> {
  return useQuery<Paginated<PlatformReview>, ReviewsAdminError>({
    queryKey: [REVIEWS_ADMIN_KEY, page],
    queryFn: async () => {
      try {
        return await apiFetch<Paginated<PlatformReview>>(`${REVIEWS.LIST()}?page=${page}`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new ReviewsAdminError("sin_acceso", "Solo el personal de plataforma ve todas las reseñas.");
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new ReviewsAdminError("pagina_inexistente", "Esa página del listado ya no existe.");
        }
        throw new ReviewsAdminError("desconocido", "No se pudieron cargar las reseñas.");
      }
    },
  });
}

export function useDeleteReview(): UseMutationResult<void, ReviewsAdminError, string> {
  const queryClient = useQueryClient();
  return useMutation<void, ReviewsAdminError, string>({
    mutationFn: async (reviewId) => {
      try {
        await apiFetch(REVIEWS.DETAIL(reviewId), { method: "DELETE" });
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          const detail = detailOf(error);
          throw new ReviewsAdminError("sin_acceso", detail ?? "Solo el autor o el personal de plataforma pueden borrarla.", detail);
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new ReviewsAdminError("no_encontrado", "Esta reseña ya no existe.");
        }
        throw new ReviewsAdminError("desconocido", "No se pudo borrar la reseña.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [REVIEWS_ADMIN_KEY] });
    },
  });
}
