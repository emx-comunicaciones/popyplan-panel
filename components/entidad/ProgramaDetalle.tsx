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
import { useMetrics } from "@/hooks/useMetrics";
import { useActivateProgram, useCloseProgram } from "@/hooks/useProgramMutations";
import { useProgram } from "@/hooks/useProgram";
import { useProgramReport } from "@/hooks/useProgramReport";
import type { Program, ProgramStatus } from "@/lib/api/types";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { formatEuros } from "@/lib/programs/money";

import { ProgramaForm } from "./ProgramaForm";

export interface ProgramaDetalleProps {
  orgId: number | string;
  programId: number | string;
  /** `titular`/`moderador`: editar, activar, cerrar (`gestionar_programas`). */
  canManage: boolean;
  /** `titular`/`moderador`/`analista`: descargar el informe (`exportar_informes`). */
  canExport: boolean;
}

const STATUS_LABELS: Record<ProgramStatus, string> = {
  draft: "Borrador",
  active: "En curso",
  closed: "Cerrado",
};

const STATUS_TONES: Record<ProgramStatus, BadgeTone> = {
  draft: "neutral",
  active: "success",
  closed: "info",
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES");
}

function ProgramaMetrics({ orgId, program }: { orgId: number | string; program: Program }) {
  const metrics = useMetrics(
    "entidad",
    orgId,
    { since: program.starts_on, until: program.ends_on },
    "month",
  );

  return (
    <section aria-labelledby="programa-metricas-heading">
      <h2 id="programa-metricas-heading" className="mb-2 text-lg font-semibold text-text-base">
        Métricas del periodo
      </h2>
      {metrics.isError ? (
        <ErrorState title="No se pudieron cargar las métricas" description={metrics.error.message} />
      ) : !metrics.data ? (
        <p className="text-sm text-text-secondary">Cargando métricas…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Personas activas"
              value={formatCount(metrics.data.people.active, metrics.data.people.suppressed)}
            />
            <StatCard label="Actividades celebradas" value={formatCount(metrics.data.events.held, false)} />
            <StatCard
              label="Asistencia"
              value={formatPct(metrics.data.attendance.rate, metrics.data.attendance.suppressed)}
            />
            <StatCard label="Comunidades activas" value={formatCount(metrics.data.communities.active, false)} />
          </div>
          {metrics.data.by_place.length > 0 ? (
            <MetricsTable
              caption="Por municipio"
              rows={metrics.data.by_place}
              nameHeader="Municipio"
              codeHeader="Código INE"
            />
          ) : null}
          {metrics.data.series.length > 0 ? (
            <SeriesChart data={metrics.data.series} />
          ) : (
            <EmptyState title="Sin datos en este periodo" />
          )}
        </div>
      )}
    </section>
  );
}

export function ProgramaDetalle({ orgId, programId, canManage, canExport }: ProgramaDetalleProps) {
  const program = useProgram(orgId, programId);
  const activateProgram = useActivateProgram(orgId);
  const closeProgram = useCloseProgram(orgId);
  const programReport = useProgramReport();
  const [editing, setEditing] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");

  if (program.isError) {
    return <ErrorState title="No se pudo cargar el programa" description={program.error.message} />;
  }
  if (!program.data) {
    return <p className="text-sm text-text-secondary">Cargando programa…</p>;
  }

  const data = program.data;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-text-base">{data.name}</h2>
              <Badge tone={STATUS_TONES[data.status]}>{STATUS_LABELS[data.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {formatDate(data.starts_on)} – {formatDate(data.ends_on)}
              {data.funder ? ` · ${data.funder}` : ""}
            </p>
            {data.description ? <p className="mt-2 text-sm text-text-base">{data.description}</p> : null}
            <p className="mt-2 text-base font-semibold text-text-base">{formatEuros(data.budget_cents)}</p>
            {data.status === "closed" && data.closing_notes ? (
              <p className="mt-2 text-sm text-text-secondary">Notas de cierre: {data.closing_notes}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {canManage && data.status !== "closed" ? (
              <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                Editar
              </Button>
            ) : null}
            {canManage && data.status === "draft" ? (
              <Button
                type="button"
                onClick={() => activateProgram.mutate(data.id)}
                disabled={activateProgram.isPending}
              >
                Activar
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
                Cerrar programa
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
                  Descargar informe CSV
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => programReport.mutate({ orgId, programId, format: "pdf" })}
                  disabled={programReport.isPending}
                >
                  Descargar informe PDF
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {activateProgram.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {activateProgram.error.message}
          </p>
        ) : null}
        {programReport.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {programReport.error.message}
          </p>
        ) : null}
      </Card>

      <ProgramaMetrics orgId={orgId} program={data} />

      <Dialog
        open={editing}
        titleId="editar-programa-title"
        title="Editar programa"
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
        title="Cerrar programa"
        description={
          <div className="flex flex-col gap-2 text-left">
            <p>Un programa cerrado no se puede volver a editar ni reactivar.</p>
            <label htmlFor="programa-closing-notes" className="text-sm font-medium text-text-form">
              Notas de cierre
            </label>
            <textarea
              id="programa-closing-notes"
              value={closingNotes}
              onChange={(event) => setClosingNotes(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            />
            {/* El mensaje literal del backend (409 «Un programa cerrado no
                se modifica.», 400 por campo) se lee aquí dentro: el
                diálogo solo se cierra si el cierre sale bien. */}
            {closeProgram.isError ? (
              <p role="alert" className="text-error">
                {closeProgram.error.message}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Cerrar programa"
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
