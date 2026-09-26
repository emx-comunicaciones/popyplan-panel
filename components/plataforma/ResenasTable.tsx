"use client";

/**
 * Reseñas del admin de plataforma (bloque 3, 2026-09-26):
 * `GET /api/reviews/?page=` (a `is_staff` le da todas, 20 por página) y
 * «Borrar» (`DELETE /api/reviews/{id}/`, borrado real, sin Auditoría) con
 * `ConfirmDialog` y el error dentro. La reseña solo trae el id de la
 * actividad, nunca su título, así que no se pinta.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useDeleteReview, useReviewsAdmin, type ReviewsAdminErrorKind } from "@/hooks/useReviewsAdmin";
import type { PlatformReview } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { formatAccountDate } from "./UsuariosTable";

const REVIEWS_ERROR_KEYS: Record<ReviewsAdminErrorKind, string> = {
  sin_acceso: "errors.reviewsAdmin.sinAcceso",
  no_encontrado: "errors.reviewsAdmin.noEncontrado",
  pagina_inexistente: "errors.reviewsAdmin.paginaInexistente",
  desconocido: "errors.reviewsAdmin.desconocido",
};

const REVIEW_TYPE_KEYS: Record<string, string> = {
  event: "plataforma.resenas.typeEvent",
  team: "plataforma.resenas.typeTeam",
};

export function ResenasTable() {
  const t = useTranslations();
  const [page, setPage] = useState(1);
  const reviews = useReviewsAdmin(page);
  const remove = useDeleteReview();
  const [deleting, setDeleting] = useState<PlatformReview | null>(null);

  useEffect(() => {
    if (reviews.error?.kind === "pagina_inexistente" && page > 1) setPage(1);
  }, [reviews.error, page]);

  function closeConfirm() {
    remove.reset();
    setDeleting(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {reviews.isError ? (
        <ErrorState
          title={t("plataforma.resenas.loadError")}
          description={errorKindText(reviews.error, REVIEWS_ERROR_KEYS, t, "errors.reviewsAdmin.desconocido")}
        />
      ) : !reviews.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : reviews.data.results.length === 0 ? (
        <EmptyState title={t("plataforma.resenas.emptyTitle")} />
      ) : (
        <>
          <Table<PlatformReview>
            caption={t("plataforma.resenas.tableCaption")}
            rows={reviews.data.results}
            getRowKey={(review) => review.id}
            columns={[
              {
                key: "reviewer",
                header: t("plataforma.resenas.reviewerHeader"),
                render: (review) => review.reviewer.public_name,
              },
              {
                key: "rating",
                header: t("plataforma.resenas.ratingHeader"),
                render: (review) => t("plataforma.resenas.rating", { rating: review.rating }),
              },
              {
                key: "comment",
                header: t("plataforma.resenas.commentHeader"),
                render: (review) => review.comment || "—",
              },
              {
                key: "type",
                header: t("plataforma.resenas.typeHeader"),
                render: (review) => {
                  const key = REVIEW_TYPE_KEYS[review.review_type];
                  return key ? t(key) : review.review_type;
                },
              },
              {
                key: "date",
                header: t("plataforma.resenas.dateHeader"),
                render: (review) => formatAccountDate(review.created_at),
              },
              {
                key: "actions",
                header: <span className="sr-only">{t("plataforma.resenas.actionsHeader")}</span>,
                render: (review) => (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      remove.reset();
                      setDeleting(review);
                    }}
                  >
                    {t("plataforma.resenas.delete")}
                  </Button>
                ),
              },
            ]}
          />
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={!reviews.data.previous}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {t("plataforma.usuarios.previous")}
            </Button>
            <span className="text-sm text-text-secondary">
              {t("plataforma.resenas.count", { count: reviews.data.count })}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={!reviews.data.next}
              onClick={() => setPage((prev) => prev + 1)}
            >
              {t("plataforma.usuarios.next")}
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t("plataforma.resenas.deleteTitle")}
        description={
          <>
            <span>
              {t("plataforma.resenas.deleteDescription", { name: deleting?.reviewer.public_name ?? "" })}
            </span>
            {remove.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(remove.error, REVIEWS_ERROR_KEYS, t, "errors.reviewsAdmin.desconocido")}
              </span>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.resenas.delete")}
        pending={remove.isPending}
        onCancel={closeConfirm}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
