"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ActividadForm } from "@/components/entidad/ActividadForm";
import { PeriodSelector } from "@/components/metrics/PeriodSelector";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useEntityEvents, type EntityEventStatus } from "@/hooks/useEntityEvents";
import { useCancelEvent, type EventMutationErrorKind } from "@/hooks/useEventMutations";
import type { EntityEventRow } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeForUseLocale } from "@/lib/i18n/locale";
import { presetPeriod, type Period, type PeriodPreset } from "@/lib/metrics/period";

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
  /**
   * Si quien mira tiene `publicar_actividades` en esta entidad
   * (`entities/permissions.py`: titular, moderador, dinamizador,
   * referente — nunca analista). Con `true` se ofrecen «Nueva
   * actividad», «Editar» y «Cancelar»; `asistencia/page.tsx` reutiliza
   * esta misma tabla solo como selector de actividad y siempre pasa
   * `false` (gestionar actividades no es su propósito en esa pantalla).
   */
  canManage: boolean;
}

const ENTITY_EVENTS_ERROR_KEYS = {
  periodo_invalido: "errors.entityEvents.periodoInvalido",
  sin_acceso: "errors.entityEvents.sinAcceso",
  desconocido: "errors.entityEvents.desconocido",
} as const;

const STATUS_KEYS: Record<EntityEventStatus, string> = {
  scheduled: "entidad.actividades.statusScheduled",
  cancelled: "entidad.actividades.statusCancelled",
  completed: "entidad.actividades.statusCompleted",
};

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(localeForUseLocale(locale), { dateStyle: "short", timeStyle: "short" });
}

/**
 * Lista de actividades de la entidad por periodo (`docs/PANEL.md` §3.4),
 * con inscritos/asistencia/ausencias y el responsable cuando quien mira
 * tiene lista nominal. Cada fila enlaza a `asistencia/{eventId}` cuando
 * el rol de quien mira tiene esa sección (`canOpenAttendance`).
 *
 * **Hallazgo C-I8 de la auditoría de integración (2026-09-21)**: el
 * periodo estaba clavado a `presetPeriod("mes")` (del día 1 del mes en
 * curso **hasta hoy**) y no había selector, así que las actividades
 * **futuras** no aparecían nunca, ningún mes anterior se podía
 * consultar, y el día 1 de cada mes la sección estaba casi vacía — y con
 * ella la de Asistencia, que reutiliza esta tabla como selector de
 * actividad, de modo que el check-in solo era alcanzable para
 * actividades de este mes ya empezadas. Ahora monta el mismo
 * `components/metrics/PeriodSelector.tsx` que los dashboards de
 * métricas: arranca en «Este mes» y el rango personalizado admite un
 * `until` **futuro** (ni `customPeriod` ni `panel/viewsets.py::_periodo`
 * ponen tope por arriba, solo la diferencia de 1461 días), que es cómo
 * se llega a lo que viene.
 */
const CANCEL_EVENT_ERROR_KEYS: Record<EventMutationErrorKind, string> = {
  invalido: "errors.eventMutation.invalido",
  sin_permiso: "errors.eventMutation.sinPermiso",
  no_encontrado: "errors.eventMutation.noEncontrado",
  desconocido: "errors.eventMutation.desconocidoCancelar",
};

export function ActividadesTable({ orgId, slug, canOpenAttendance, canManage }: ActividadesTableProps) {
  const [status, setStatus] = useState<EntityEventStatus | "">("");
  const [preset, setPreset] = useState<PeriodPreset>("mes");
  // El periodo inicial se calcula una vez (no en cada render): `useQuery`
  // lo lleva en su clave de caché y un objeto nuevo por render la
  // invalidaría sin motivo.
  const [period, setPeriod] = useState<Period>(() => presetPeriod("mes"));
  const t = useTranslations("entidad.actividades");
  const tAll = useTranslations();
  const locale = useLocale();

  const events = useEntityEvents(orgId, period, status || undefined);
  const cancelEvent = useCancelEvent(orgId);

  const [creating, setCreating] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [cancelling, setCancelling] = useState<EntityEventRow | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div>
          <Button type="button" onClick={() => setCreating(true)}>
            {t("newActivity")}
          </Button>
        </div>
      ) : null}
      <PeriodSelector
        value={period}
        preset={preset}
        onChange={(nextPeriod, nextPreset) => {
          setPeriod(nextPeriod);
          setPreset(nextPreset);
        }}
      />
      <div>
        <label htmlFor="actividades-status" className="mb-1 block text-sm font-medium text-text-form">
          {t("statusLabel")}
        </label>
        <select
          id="actividades-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as EntityEventStatus | "")}
          className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        >
          <option value="">{t("statusAll")}</option>
          <option value="scheduled">{t("statusScheduled")}</option>
          <option value="cancelled">{t("statusCancelled")}</option>
          <option value="completed">{t("statusCompleted")}</option>
        </select>
      </div>

      {events.isError ? (
        <ErrorState
          title={t("loadError")}
          description={errorKindText(
            events.error,
            ENTITY_EVENTS_ERROR_KEYS,
            tAll,
            "errors.entityEvents.desconocido",
          )}
        />
      ) : !events.data ? (
        <p className="text-sm text-text-secondary">{t("loading")}</p>
      ) : events.data.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("tableCaption")}</caption>
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th scope="col" className="px-3 py-1.5 font-semibold">{t("colActivity")}</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">{t("colStatus")}</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">{t("colResponsible")}</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">{t("colRegistered")}</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">{t("colAttended")}</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">{t("colNoShow")}</th>
                {canManage ? (
                  <th scope="col" className="px-3 py-1.5 font-semibold">{t("colActions")}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {events.data.map((event) => (
                <tr key={event.id} className="border-b border-border-light">
                  <td className="px-3 py-1.5 text-text-base">
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
                    <div className="text-xs text-text-secondary">{formatDateTime(event.starts_at, locale)}</div>
                  </td>
                  <td className="px-3 py-1.5 text-text-base">
                    {(() => {
                      const key = STATUS_KEYS[event.status as EntityEventStatus];
                      return key ? tAll(key) : event.status;
                    })()}
                  </td>
                  <td className="px-3 py-1.5 text-text-base">
                    {event.organizer ? event.organizer.public_name : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-text-base">{event.registered}</td>
                  <td className="px-3 py-1.5 text-text-base">{event.attended}</td>
                  <td className="px-3 py-1.5 text-text-base">{event.no_show}</td>
                  {canManage ? (
                    <td className="px-3 py-1.5 text-text-base">
                      <div className="flex gap-2">
                        <Button type="button" variant="secondary" onClick={() => setEditingId(event.id)}>
                          {t("edit")}
                        </Button>
                        {event.status === "scheduled" ? (
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => {
                              cancelEvent.reset();
                              setCancelling(event);
                            }}
                          >
                            {t("cancelActivity")}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <>
          <Dialog
            open={creating}
            titleId="nueva-actividad-title"
            title={t("newActivity")}
            pending={createPending}
            onClose={() => setCreating(false)}
          >
            <ActividadForm
              orgId={orgId}
              editing="new"
              onDone={() => setCreating(false)}
              onPendingChange={setCreatePending}
            />
          </Dialog>

          <Dialog
            open={editingId !== null}
            titleId="editar-actividad-title"
            title={t("editActivity")}
            pending={editPending}
            onClose={() => setEditingId(null)}
          >
            {editingId !== null ? (
              <ActividadForm
                orgId={orgId}
                editing={editingId}
                onDone={() => setEditingId(null)}
                onPendingChange={setEditPending}
              />
            ) : null}
          </Dialog>

          <ConfirmDialog
            open={cancelling !== null}
            title={t("cancelConfirmTitle")}
            description={
              <div className="flex flex-col gap-2">
                <p>
                  {cancelling ? t("cancelConfirmDescription", { title: cancelling.title }) : ""}
                </p>
                {cancelEvent.isError ? (
                  <p role="alert" className="text-error">
                    {errorKindText(
                      cancelEvent.error,
                      CANCEL_EVENT_ERROR_KEYS,
                      tAll,
                      "errors.eventMutation.desconocidoCancelar",
                    )}
                  </p>
                ) : null}
              </div>
            }
            confirmLabel={t("cancelActivity")}
            pending={cancelEvent.isPending}
            onConfirm={() => {
              if (!cancelling) return;
              cancelEvent.mutate(cancelling.id, { onSuccess: () => setCancelling(null) });
            }}
            onCancel={() => {
              if (cancelEvent.isPending) return;
              cancelEvent.reset();
              setCancelling(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
