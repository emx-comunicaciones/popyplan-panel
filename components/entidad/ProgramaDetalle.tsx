"use client";

/**
 * Ficha de un programa (`docs/PANEL.md` §12): cabecera con estado (chip),
 * presupuesto formateado es-ES, botones «Activar» (`draft -> active`),
 * «Cerrar programa» (`active -> closed`, con `ConfirmDialog` y notas de
 * cierre) y «Descargar informe CSV/PDF»; bajo ella, las métricas del
 * periodo completo del programa (`useMetrics("entidad", orgId, {since:
 * starts_on, until: ends_on}, "month")`, reutilizando `MetricsTable`/
 * `SeriesChart` de la tarea W2). Solo `canManage` (titular/moderador)
 * activa, cierra o edita; solo `canExport` (titular/moderador/analista,
 * igual matriz que Informes, `docs/PANEL.md` §2.1) descarga el informe.
 *
 * `ProgramaMetrics` es un componente aparte para no llamar a
 * `useMetrics` hasta que el programa (con sus fechas) ya está cargado —
 * los hooks de React no pueden ser condicionales dentro de un mismo
 * componente, así que el periodo real solo existe una vez `program.data`
 * llega, y ese hook se difiere a un componente hijo que solo se monta
 * entonces.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { MetricsTable } from "@/components/metrics/MetricsTable";
import { SeriesChart } from "@/components/metrics/SeriesChart";
import { StatCard } from "@/components/metrics/StatCard";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useMetrics, type MetricsErrorKind } from "@/hooks/useMetrics";
import {
  useActivateProgram,
  useCloseProgram,
  type ProgramMutationErrorKind,
} from "@/hooks/useProgramMutations";
import { useProgram, type ProgramErrorKind } from "@/hooks/useProgram";
import { useProgramReport, type ProgramReportErrorKind } from "@/hooks/useProgramReport";
import type { Program, ProgramStatus } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeFor, activeLanguage } from "@/lib/i18n/locale";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { formatEuros } from "@/lib/programs/money";

import { ProgramaForm } from "./ProgramaForm";
import { PROGRAM_STATUS_KEYS } from "./ProgramasPanel";

export interface ProgramaDetalleProps {
  orgId: number | string;
  programId: number | string;
  /** `titular`/`moderador`: editar, activar, cerrar (`gestionar_programas`). */
  canManage: boolean;
  /** `titular`/`moderador`/`analista`: descargar el informe (`exportar_informes`). */
  canExport: boolean;
}

const STATUS_TONES: Record<ProgramStatus, BadgeTone> = {
  draft: "neutral",
  active: "success",
  closed: "info",
};

const PROGRAM_ERROR_KEYS: Record<ProgramErrorKind, string> = {
  sin_acceso: "errors.program.sinAcceso",
  no_encontrado: "errors.program.noEncontrado",
  desconocido: "errors.program.desconocido",
};

// Mismo criterio que `ProgramaForm.tsx`: solo cambia el «desconocido»
// según la acción, el resto de mensajes son idénticos venga de activar o
// de cerrar.
const ACTIVATE_PROGRAM_ERROR_KEYS: Record<ProgramMutationErrorKind, string> = {
  invalido: "errors.programMutation.invalido",
  sin_permiso: "errors.programMutation.sinPermiso",
  no_encontrado: "errors.programMutation.noEncontrado",
  conflicto: "errors.programMutation.conflicto",
  desconocido: "errors.programMutation.desconocidoActivar",
};

const CLOSE_PROGRAM_ERROR_KEYS: Record<ProgramMutationErrorKind, string> = {
  ...ACTIVATE_PROGRAM_ERROR_KEYS,
  desconocido: "errors.programMutation.desconocidoCerrar",
};

const PROGRAM_REPORT_ERROR_KEYS: Record<ProgramReportErrorKind, string> = {
  pdf_unavailable: "errors.programReport.pdfUnavailable",
  forbidden: "errors.programReport.forbidden",
  sesion_caducada: "errors.programReport.sesionCaducada",
  desconocido: "errors.programReport.desconocido",
};

// `useMetrics` reutilizado tal cual — mismo mapa de claves que
// `EntityHomeDashboard.tsx`/`{Paraguas,Plataforma}MetricsDashboard.tsx`
// (tarea 5 de i18n), sin duplicar el catálogo.
const METRICS_ERROR_KEYS: Record<MetricsErrorKind, string> = {
  periodo_invalido: "errors.metrics.periodoInvalido",
  sin_acceso: "errors.metrics.sinAcceso",
  desconocido: "errors.metrics.desconocido",
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(localeFor(activeLanguage()));
}

function ProgramaMetrics({ orgId, program }: { orgId: number | string; program: Program }) {
  const t = useTranslations();
  const metrics = useMetrics(
    "entidad",
    orgId,
    { since: program.starts_on, until: program.ends_on },
    "month",
  );

  return (
    <section aria-labelledby="programa-metricas-heading">
      <h2 id="programa-metricas-heading" className="mb-2 text-lg font-semibold text-text-base">
        {t("entidad.programaFicha.metricsHeading")}
      </h2>
      {metrics.isError ? (
        <ErrorState
          title={t("entidad.programaFicha.metricsError")}
          description={errorKindText(metrics.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
        />
      ) : !metrics.data ? (
        <p className="text-sm text-text-secondary">{t("entidad.programaFicha.metricsLoading")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label={t("entidad.programaFicha.activePeople")}
              value={formatCount(metrics.data.people.active, metrics.data.people.suppressed)}
            />
            <StatCard
              label={t("entidad.programaFicha.heldEvents")}
              value={formatCount(metrics.data.events.held, false)}
            />
            <StatCard
              label={t("entidad.programaFicha.attendance")}
              value={formatPct(metrics.data.attendance.rate, metrics.data.attendance.suppressed)}
            />
            <StatCard
              label={t("entidad.programaFicha.activeCommunities")}
              value={formatCount(metrics.data.communities.active, false)}
            />
          </div>
          {metrics.data.by_place.length > 0 ? (
            <MetricsTable
              caption={t("entidad.programaFicha.byPlaceCaption")}
              rows={metrics.data.by_place}
              nameHeader={t("entidad.programaFicha.byPlaceNameHeader")}
              codeHeader={t("entidad.programaFicha.byPlaceCodeHeader")}
            />
          ) : null}
          {metrics.data.series.length > 0 ? (
            <SeriesChart data={metrics.data.series} />
          ) : (
            <EmptyState title={t("entidad.programaFicha.noDataInPeriod")} />
          )}
        </div>
      )}
    </section>
  );
}

export function ProgramaDetalle({ orgId, programId, canManage, canExport }: ProgramaDetalleProps) {
  const t = useTranslations();
  const program = useProgram(orgId, programId);
  const activateProgram = useActivateProgram(orgId);
  const closeProgram = useCloseProgram(orgId);
  const programReport = useProgramReport();
  const [editing, setEditing] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");

  if (program.isError) {
    return (
      <ErrorState
        title={t("entidad.programaFicha.loadError")}
        description={errorKindText(program.error, PROGRAM_ERROR_KEYS, t, "errors.program.desconocido")}
      />
    );
  }
  if (!program.data) {
    return <p className="text-sm text-text-secondary">{t("entidad.programaFicha.loading")}</p>;
  }

  const data = program.data;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-text-base">{data.name}</h2>
              <Badge tone={STATUS_TONES[data.status]}>{t(PROGRAM_STATUS_KEYS[data.status])}</Badge>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {formatDate(data.starts_on)} – {formatDate(data.ends_on)}
              {data.funder ? ` · ${data.funder}` : ""}
            </p>
            {data.description ? <p className="mt-2 text-sm text-text-base">{data.description}</p> : null}
            <p className="mt-2 text-base font-semibold text-text-base">{formatEuros(data.budget_cents)}</p>
            {data.status === "closed" && data.closing_notes ? (
              <p className="mt-2 text-sm text-text-secondary">
                {t("entidad.programaFicha.closingNotes", { notes: data.closing_notes })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {canManage && data.status !== "closed" ? (
              <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                {t("entidad.programaFicha.edit")}
              </Button>
            ) : null}
            {canManage && data.status === "draft" ? (
              <Button
                type="button"
                onClick={() => activateProgram.mutate(data.id)}
                disabled={activateProgram.isPending}
              >
                {t("entidad.programaFicha.activate")}
              </Button>
            ) : null}
            {canManage && data.status === "active" ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  closeProgram.reset();
                  setClosing(true);
                }}
              >
                {t("entidad.programaFicha.close")}
              </Button>
            ) : null}
            {canExport ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => programReport.mutate({ orgId, programId, format: "csv" })}
                  disabled={programReport.isPending}
                >
                  {t("entidad.programaFicha.downloadCsv")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => programReport.mutate({ orgId, programId, format: "pdf" })}
                  disabled={programReport.isPending}
                >
                  {t("entidad.programaFicha.downloadPdf")}
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {activateProgram.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {errorKindText(
              activateProgram.error,
              ACTIVATE_PROGRAM_ERROR_KEYS,
              t,
              "errors.programMutation.desconocidoActivar",
            )}
          </p>
        ) : null}
        {programReport.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {errorKindText(
              programReport.error,
              PROGRAM_REPORT_ERROR_KEYS,
              t,
              "errors.programReport.desconocido",
            )}
          </p>
        ) : null}
      </Card>

      <ProgramaMetrics orgId={orgId} program={data} />

      <Dialog
        open={editing}
        titleId="editar-programa-title"
        title={t("entidad.programaFicha.editDialogTitle")}
        pending={editPending}
        onClose={() => setEditing(false)}
      >
        <ProgramaForm
          orgId={orgId}
          editing={data}
          onDone={() => setEditing(false)}
          onPendingChange={setEditPending}
        />
      </Dialog>

      <ConfirmDialog
        open={closing}
        title={t("entidad.programaFicha.close")}
        description={
          <div className="flex flex-col gap-2 text-left">
            <p>{t("entidad.programaFicha.closeWarning")}</p>
            <label htmlFor="programa-closing-notes" className="text-sm font-medium text-text-form">
              {t("entidad.programaFicha.closingNotesLabel")}
            </label>
            <textarea
              id="programa-closing-notes"
              value={closingNotes}
              onChange={(event) => setClosingNotes(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            />
            {/* El mensaje literal del backend (409 «Un programa cerrado no
                se modifica.», 400 por campo) se lee aquí dentro: el
                diálogo solo se cierra si el cierre sale bien. */}
            {closeProgram.isError ? (
              <p role="alert" className="text-error">
                {errorKindText(
                  closeProgram.error,
                  CLOSE_PROGRAM_ERROR_KEYS,
                  t,
                  "errors.programMutation.desconocidoCerrar",
                )}
              </p>
            ) : null}
          </div>
        }
        confirmLabel={t("entidad.programaFicha.close")}
        pending={closeProgram.isPending}
        onConfirm={() => {
          closeProgram.mutate(
            { programId: data.id, closingNotes },
            {
              onSuccess: () => {
                setClosing(false);
                setClosingNotes("");
              },
            },
          );
        }}
        onCancel={() => {
          closeProgram.reset();
          setClosing(false);
        }}
      />
    </div>
  );
}
