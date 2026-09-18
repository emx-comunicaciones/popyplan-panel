"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useEntityEvents, type EntityEventStatus } from "@/hooks/useEntityEvents";
import { presetPeriod } from "@/lib/metrics/period";

export interface ActividadesTableProps {
  orgId: number | string;
  slug: string;
  /**
   * Si quien mira tiene la sección «Asistencia» en su menú
   * (`lib/auth/entidadMenu.ts::entidadMenuFor`). Con `false` el título de
   * cada actividad se pinta como texto: `referente` no tiene `asistencia`
   * en `REFERENTE_VISIBLE` (decisión de producto), así que el enlace le
   * llevaba a la pantalla «Sin acceso» de
   * `asistencia/[eventId]/page.tsx`. Lo calcula el Server Component que
   * monta la tabla, que ya tiene `membership.role`.
   */
  canOpenAttendance: boolean;
}

const STATUS_LABELS: Record<EntityEventStatus, string> = {
  scheduled: "Programada",
  cancelled: "Cancelada",
  completed: "Celebrada",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Lista de actividades de la entidad por periodo (`docs/PANEL.md` §3.4),
 * con inscritos/asistencia/ausencias y el responsable cuando quien mira
 * tiene lista nominal. Cada fila enlaza a `asistencia/{eventId}` cuando
 * el rol de quien mira tiene esa sección (`canOpenAttendance`).
 */
export function ActividadesTable({ orgId, slug, canOpenAttendance }: ActividadesTableProps) {
  const [status, setStatus] = useState<EntityEventStatus | "">("");
  const period = presetPeriod("mes");

  const events = useEntityEvents(orgId, period, status || undefined);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="actividades-status" className="mb-1 block text-sm font-medium text-text-form">
          Estado
        </label>
        <select
          id="actividades-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as EntityEventStatus | "")}
          className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
        >
          <option value="">Todas</option>
          <option value="scheduled">Programada</option>
          <option value="cancelled">Cancelada</option>
          <option value="completed">Celebrada</option>
        </select>
      </div>

      {events.isError ? (
        <ErrorState title="No se pudieron cargar las actividades" description={events.error.message} />
      ) : !events.data ? (
        <p className="text-sm text-text-secondary">Cargando actividades…</p>
      ) : events.data.length === 0 ? (
        <EmptyState title="Sin actividades en este periodo" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Actividades de la entidad</caption>
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th scope="col" className="px-3 py-2 font-semibold">Actividad</th>
                <th scope="col" className="px-3 py-2 font-semibold">Estado</th>
                <th scope="col" className="px-3 py-2 font-semibold">Responsable</th>
                <th scope="col" className="px-3 py-2 font-semibold">Inscritos</th>
                <th scope="col" className="px-3 py-2 font-semibold">Asistió</th>
                <th scope="col" className="px-3 py-2 font-semibold">No asistió</th>
              </tr>
            </thead>
            <tbody>
              {events.data.map((event) => (
                <tr key={event.id} className="border-b border-border-light">
                  <td className="px-3 py-2 text-text-base">
                    {canOpenAttendance ? (
                      <Link
                        href={`/entidad/${slug}/asistencia/${event.id}`}
                        className="font-medium text-primary-700 underline"
                      >
                        {event.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{event.title}</span>
                    )}
                    <div className="text-xs text-text-secondary">{formatDateTime(event.starts_at)}</div>
                  </td>
                  <td className="px-3 py-2 text-text-base">{STATUS_LABELS[event.status as EntityEventStatus] ?? event.status}</td>
                  <td className="px-3 py-2 text-text-base">
                    {event.organizer ? event.organizer.public_name : "—"}
                  </td>
                  <td className="px-3 py-2 text-text-base">{event.registered}</td>
                  <td className="px-3 py-2 text-text-base">{event.attended}</td>
                  <td className="px-3 py-2 text-text-base">{event.no_show}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
