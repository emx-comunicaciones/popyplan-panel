"use client";

/**
 * Auditoría de plataforma (tarea W5): `GET /api/safety/audit/?actor=&
 * action=&target_type=&target_id=&since=&until=`, solo `superadmin`.
 * **Pendiente de backend** al escribir esta tarea — ver el docstring de
 * `hooks/useAuditLog.ts` y el informe de esta tarea: la ruta existe ya en
 * el repo backend (tarea P6, en curso en paralelo) pero no está
 * commiteada ni documentada en `docs/PANEL.md` todavía. Exporta CSV de
 * la página actual en el cliente (no del listado completo: eso pide una
 * ruta de exportación auditada aparte, fuera del alcance de esta tarea —
 * ver el informe).
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { AuditLogEntry } from "@/lib/api/types";
import { csvBlob } from "@/lib/csv/toCsv";
import { triggerDownload } from "@/lib/download/triggerDownload";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function metadataText(entry: AuditLogEntry): string {
  const entries = Object.entries(entry.metadata ?? {});
  if (entries.length === 0) return "—";
  return entries.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(", ");
}

const CSV_HEADER = ["id", "actor", "action", "target_type", "target_id", "metadata", "created_at"];

/**
 * El CSV lo arma `lib/csv/toCsv.ts`, que entrecomilla toda celda y
 * neutraliza las que una hoja de cálculo leería como fórmula (`=`, `+`,
 * `-`, `@`, tabulador, retorno de carro): `action`, `target_type` y
 * `metadata` los escribe quien genera la acción auditada, no el panel.
 */
function downloadCsv(rows: AuditLogEntry[]): void {
  const blob = csvBlob([
    CSV_HEADER,
    ...rows.map((row) => [
      row.id,
      `${row.actor.public_name} (#${row.actor.id})`,
      row.action,
      row.target_type,
      row.target_id,
      metadataText(row),
      row.created_at,
    ]),
  ]);
  triggerDownload(blob, "auditoria.csv");
}

/**
 * Los seis filtros son texto libre (dos de ellos fechas), así que se
 * guardan como cadenas: el `<input>` es controlado e inmediato y lo que
 * llega a la query es el valor con retardo (`useDebouncedValue`, 300 ms)
 * — teclear «organization.created» pedía antes una página de auditoría
 * por cada letra.
 */
interface AuditFormFilters {
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  since: string;
  until: string;
}

const EMPTY_FILTERS: AuditFormFilters = {
  actor: "",
  action: "",
  target_type: "",
  target_id: "",
  since: "",
  until: "",
};

export function AuditoriaPanel() {
  const [filters, setFilters] = useState<AuditFormFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const actor = useDebouncedValue(filters.actor);
  const action = useDebouncedValue(filters.action);
  const targetType = useDebouncedValue(filters.target_type);
  const targetId = useDebouncedValue(filters.target_id);
  const since = useDebouncedValue(filters.since);
  const until = useDebouncedValue(filters.until);

  const audit = useAuditLog({
    actor: actor || undefined,
    action: action || undefined,
    target_type: targetType || undefined,
    target_id: targetId || undefined,
    since: since || undefined,
    until: until || undefined,
    page,
  });

  /**
   * La página vuelve a 1 cuando cambia un filtro **aplicado**, no con
   * cada tecla.
   */
  useEffect(() => {
    setPage(1);
  }, [actor, action, targetType, targetId, since, until]);

  function updateFilter<K extends keyof AuditFormFilters>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="audit-actor" className="mb-1 block text-sm font-medium text-text-form">
            Actor (id)
          </label>
          <input
            id="audit-actor"
            type="number"
            value={filters.actor}
            onChange={(event) => updateFilter("actor", event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="audit-action" className="mb-1 block text-sm font-medium text-text-form">
            Acción
          </label>
          <input
            id="audit-action"
            type="text"
            value={filters.action}
            placeholder="organization.created"
            onChange={(event) => updateFilter("action", event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="audit-target-type" className="mb-1 block text-sm font-medium text-text-form">
            Tipo de objetivo
          </label>
          <input
            id="audit-target-type"
            type="text"
            value={filters.target_type}
            placeholder="entities.organization"
            onChange={(event) => updateFilter("target_type", event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="audit-target-id" className="mb-1 block text-sm font-medium text-text-form">
            Id de objetivo
          </label>
          <input
            id="audit-target-id"
            type="text"
            value={filters.target_id}
            onChange={(event) => updateFilter("target_id", event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="audit-since" className="mb-1 block text-sm font-medium text-text-form">
            Desde
          </label>
          <input
            id="audit-since"
            type="date"
            value={filters.since}
            onChange={(event) => updateFilter("since", event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="audit-until" className="mb-1 block text-sm font-medium text-text-form">
            Hasta
          </label>
          <input
            id="audit-until"
            type="date"
            value={filters.until}
            onChange={(event) => updateFilter("until", event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
      </div>

      {audit.isError ? (
        audit.error.kind === "sin_acceso" ? (
          <EmptyState title="Sin acceso" description="Solo superadmin ve la auditoría de la plataforma." />
        ) : (
          <ErrorState title="No se pudo cargar la auditoría" description={audit.error.message} />
        )
      ) : !audit.data ? (
        <p className="text-sm text-text-secondary">Cargando auditoría…</p>
      ) : audit.data.results.length === 0 ? (
        <EmptyState title="Sin entradas con estos filtros" />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">{audit.data.count} entradas</span>
            <Button type="button" variant="secondary" onClick={() => downloadCsv(audit.data!.results)}>
              Exportar CSV de esta página
            </Button>
          </div>

          <Table<AuditLogEntry>
            caption="Auditoría de plataforma"
            rows={audit.data.results}
            getRowKey={(entry) => entry.id}
            columns={[
              {
                key: "actor",
                header: "Actor",
                render: (entry) => `${entry.actor.public_name} (#${entry.actor.id})`,
              },
              { key: "action", header: "Acción", render: (entry) => entry.action },
              {
                key: "target",
                header: "Objetivo",
                render: (entry) => `${entry.target_type} #${entry.target_id}`,
              },
              { key: "metadata", header: "Detalle", render: metadataText },
              { key: "created_at", header: "Fecha", render: (entry) => formatDateTime(entry.created_at) },
            ]}
          />

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={!audit.data.previous}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!audit.data.next}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Siguiente
            </Button>
          </div>
        </>
      )}

      <p className="text-xs text-text-secondary">
        Esta exportación es una utilidad del cliente (los datos ya visibles en la página, en
        CSV) y no queda auditada por sí misma. Una exportación auditada de todo el listado es
        una ruta de backend aparte, fuera del alcance de esta tarea.
      </p>
    </div>
  );
}
