"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useEnrollments } from "@/hooks/useProgramEnrollments";
import type { EnrollmentRow, EnrollmentStatus } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeForUseLocale } from "@/lib/i18n/locale";
import { enrollmentStatusKey, labelOrRaw, trackingTypeText } from "@/lib/tracking/labels";

const ENROLLMENTS_ERROR_KEYS = {
  sin_acceso: "errors.enrollments.sinAcceso",
  desconocido: "errors.enrollments.desconocido",
} as const;

const STATUS_OPTIONS: EnrollmentStatus[] = ["pending", "active", "left", "closed"];

export interface SeguimientoPanelProps {
  orgId: number;
  slug: string;
}

/**
 * Listado del programa de seguimiento (`docs/PANEL.md` §18.3): estado,
 * tipo y referente de cada inscripción — **nunca** datos de seguimiento
 * (el tipo `EnrollmentRow` no los trae). Solo lo monta
 * `seguimiento/page.tsx` para titular/moderador con el servicio encendido.
 * Dar de alta, cambiar y dar de baja se hace desde la ficha de la persona,
 * donde ya está el contexto de quién es.
 */
export function SeguimientoPanel({ orgId, slug }: SeguimientoPanelProps) {
  const [status, setStatus] = useState<EnrollmentStatus | "">("");
  const enrollments = useEnrollments(orgId, { status: status || undefined });
  const t = useTranslations("entidad.seguimiento");
  const tAll = useTranslations();
  const locale = useLocale();

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(localeForUseLocale(locale));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-secondary">{t("intro")}</p>
      <p className="text-sm text-text-secondary">
        {t("addHint")}{" "}
        <Link
          href={`/entidad/${slug}/personas`}
          className="font-medium text-primary-700 underline-offset-2 hover:underline"
        >
          {t("addHintLink")}
        </Link>
      </p>
      <div>
        <label htmlFor="seguimiento-status" className="mb-1 block text-sm font-medium text-text-form">
          {t("statusFilterLabel")}
        </label>
        <select
          id="seguimiento-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as EnrollmentStatus | "")}
          className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        >
          <option value="">{t("statusAll")}</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {labelOrRaw(enrollmentStatusKey(option), option, tAll)}
            </option>
          ))}
        </select>
      </div>

      {enrollments.isError ? (
        <ErrorState
          title={t("loadErrorTitle")}
          description={errorKindText(enrollments.error, ENROLLMENTS_ERROR_KEYS, tAll, "errors.enrollments.desconocido")}
        />
      ) : !enrollments.data ? (
        <p className="text-sm text-text-secondary">{t("loading")}</p>
      ) : enrollments.data.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Table<EnrollmentRow>
          caption={t("caption")}
          rows={enrollments.data}
          getRowKey={(row) => String(row.id)}
          columns={[
            {
              key: "person",
              header: t("colPerson"),
              render: (row) => (
                <Link
                  href={`/entidad/${slug}/personas/${row.user.id}`}
                  className="font-medium text-primary-700 underline-offset-2 hover:underline"
                >
                  {row.user.public_name}
                </Link>
              ),
            },
            {
              key: "status",
              header: t("colStatus"),
              render: (row) => (
                <Badge tone={row.status === "active" ? "success" : "neutral"}>
                  {labelOrRaw(enrollmentStatusKey(row.status), row.status, tAll)}
                </Badge>
              ),
            },
            {
              key: "type",
              header: t("colType"),
              render: (row) => trackingTypeText(row.tracking_type, row.tracking_label, tAll),
            },
            {
              key: "referent",
              header: t("colReferent"),
              render: (row) => row.referent?.public_name ?? t("noReferent"),
            },
            {
              key: "created",
              header: t("colCreated"),
              render: (row) => formatDate(row.created_at),
            },
          ]}
        />
      )}
    </div>
  );
}
