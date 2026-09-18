"use client";

/**
 * Cola de revisiones de verificación (tarea W5,
 * `docs/SEGURIDAD_Y_MODERACION.md` §7): `GET
 * /api/users/verification/reviews/queue/` (`pending`, paginada),
 * `verifier`/`superadmin`. Aprobar concede el nivel; rechazar no.
 * Paginada: «Anterior»/«Siguiente» y el recuento total, mismo patrón que
 * `EntidadesTable.tsx` (antes solo se veía la primera página).
 */
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useDecideVerificationReview } from "@/hooks/useDecideVerificationReview";
import { useVerificationReviewsQueue } from "@/hooks/useVerificationReviewsQueue";
import type { VerificationReview } from "@/lib/api/types";

const LEVEL_LABELS: Record<number, string> = {
  2: "Nivel 2 (mayoría de edad)",
  3: "Nivel 3 (identidad)",
};

function ReviewCard({ review }: { review: VerificationReview }) {
  const decide = useDecideVerificationReview();
  const [note, setNote] = useState("");

  return (
    <li>
      <Card>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-text-secondary">Cuenta</dt>
          <dd className="text-text-base">
            {review.username} (#{review.user})
          </dd>
          <dt className="text-text-secondary">Nivel solicitado</dt>
          <dd className="text-text-base">
            <Badge tone="info">{LEVEL_LABELS[review.level] ?? `Nivel ${review.level}`}</Badge>
          </dd>
          <dt className="text-text-secondary">Motivo del proveedor</dt>
          <dd className="text-text-base">{review.reason || "—"}</dd>
          <dt className="text-text-secondary">Recurso de la persona</dt>
          <dd className="text-text-base">{review.appeal_text || "Sin recurso todavía."}</dd>
        </dl>

        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor={`review-note-${review.id}`} className="block text-sm font-medium text-text-form">
            Nota de la decisión
          </label>
          <textarea
            id={`review-note-${review.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ reviewId: review.id, approved: true, note })}
            >
              Aprobar
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ reviewId: review.id, approved: false, note })}
            >
              Rechazar
            </Button>
          </div>
          {decide.isError ? (
            <p role="alert" className="text-sm text-error">
              {decide.error.message}
            </p>
          ) : null}
        </div>
      </Card>
    </li>
  );
}

export function VerificacionesQueue() {
  const [page, setPage] = useState(1);
  const reviews = useVerificationReviewsQueue({ page });

  // La cola se vacía sola según se van resolviendo revisiones: si la
  // página en la que estamos se queda sin filas, volver a la primera en
  // vez de dejar un «Sin revisiones pendientes» del que no se sale
  // (mismo patrón que `PersonasTable` cuando su página deja de existir).
  const emptyPage = reviews.data?.results.length === 0;
  useEffect(() => {
    if (page > 1 && emptyPage) setPage(1);
  }, [page, emptyPage]);

  if (reviews.isError) {
    if (reviews.error.kind === "sin_acceso") {
      return <EmptyState title="Sin acceso" description="Tu rol no tiene acceso a la cola de verificación." />;
    }
    return <ErrorState title="No se pudo cargar la cola de verificación" description={reviews.error.message} />;
  }
  if (!reviews.data) {
    return <p className="text-sm text-text-secondary">Cargando revisiones…</p>;
  }
  if (reviews.data.results.length === 0) {
    return <EmptyState title="Sin revisiones pendientes" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {reviews.data.results.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </ul>

      {/* Misma paginación que `EntidadesTable`: la cola está paginada de
          verdad y sin estos controles solo se veía la primera página. */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          disabled={!reviews.data.previous}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Anterior
        </Button>
        <span className="text-sm text-text-secondary">{reviews.data.count} revisiones</span>
        <Button
          type="button"
          variant="secondary"
          disabled={!reviews.data.next}
          onClick={() => setPage((prev) => prev + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
