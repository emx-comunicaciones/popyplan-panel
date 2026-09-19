"use client";

/**
 * `POST /api/users/verification/reviews/{id}/decide/ {approved, note?}`
 * (`docs/SEGURIDAD_Y_MODERACION.md` §7): decide una revisión de
 * verificación (`verifier`/`superadmin`). Aprobada concede el nivel;
 * siempre audita `verification_review.decided` en el backend. Invalida
 * la cola tras decidir (la fila decidida deja de ser `pending`, sale de
 * la cola).
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { VERIFICATION } from "@/lib/api/endpoints";
import type { VerificationReview } from "@/lib/api/types";

export type DecideVerificationReviewErrorKind = "sin_permiso" | "desconocido";

export class DecideVerificationReviewError extends Error {
  readonly kind: DecideVerificationReviewErrorKind;

  constructor(kind: DecideVerificationReviewErrorKind, message: string) {
    super(message);
    this.name = "DecideVerificationReviewError";
    this.kind = kind;
  }
}

export interface DecideVerificationReviewInput {
  reviewId: string;
  approved: boolean;
  note?: string;
}

export function useDecideVerificationReview(): UseMutationResult<
  VerificationReview,
  DecideVerificationReviewError,
  DecideVerificationReviewInput
> {
  const queryClient = useQueryClient();

  return useMutation<VerificationReview, DecideVerificationReviewError, DecideVerificationReviewInput>({
    mutationFn: async ({ reviewId, approved, note }) => {
      try {
        return await apiFetch<VerificationReview>(VERIFICATION.REVIEW_DECIDE(reviewId), {
          method: "POST",
          body: { approved, note: note ?? "" },
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new DecideVerificationReviewError("sin_permiso", "Solo verificador o superadmin deciden revisiones.");
        }
        throw new DecideVerificationReviewError("desconocido", "No se pudo decidir la revisión.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-verification-reviews-queue"] });
    },
  });
}
