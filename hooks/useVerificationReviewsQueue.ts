"use client";

/**
 * `GET /api/users/verification/reviews/queue/`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §7): cola `pending` de revisiones de
 * verificación, `verifier`/`superadmin`. Paginada de verdad
 * (`PaginatedVerificationReviewList`, coincide con el esquema) —
 * `results` es opcional en el esquema generado (drf-spectacular no lo
 * marca obligatorio en ninguna respuesta paginada), así que se normaliza
 * a un array siempre presente.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { VERIFICATION } from "@/lib/api/endpoints";
import type { PaginatedVerificationReviewList, VerificationReview } from "@/lib/api/types";

export type VerificationReviewsQueueErrorKind = "sin_acceso" | "desconocido";

export class VerificationReviewsQueueError extends Error {
  readonly kind: VerificationReviewsQueueErrorKind;

  constructor(kind: VerificationReviewsQueueErrorKind, message: string) {
    super(message);
    this.name = "VerificationReviewsQueueError";
    this.kind = kind;
  }
}

export interface VerificationReviewsQueueFilters {
  page?: number;
}

export interface VerificationReviewsPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: VerificationReview[];
}

export function useVerificationReviewsQueue(
  filters: VerificationReviewsQueueFilters = {},
): UseQueryResult<VerificationReviewsPage, VerificationReviewsQueueError> {
  const query = filters.page && filters.page > 1 ? `?page=${filters.page}` : "";

  return useQuery<VerificationReviewsPage, VerificationReviewsQueueError>({
    queryKey: ["panel-verification-reviews-queue", filters.page ?? 1],
    queryFn: async () => {
      try {
        const data = await apiFetch<PaginatedVerificationReviewList>(
          `${VERIFICATION.REVIEWS_QUEUE()}${query}`,
        );
        return {
          count: data.count ?? 0,
          next: data.next ?? null,
          previous: data.previous ?? null,
          results: data.results ?? [],
        };
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new VerificationReviewsQueueError(
            "sin_acceso",
            "No tienes acceso a la cola de verificación.",
          );
        }
        throw new VerificationReviewsQueueError(
          "desconocido",
          "No se pudo cargar la cola de verificación.",
        );
      }
    },
  });
}
