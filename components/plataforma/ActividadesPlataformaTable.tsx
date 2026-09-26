"use client";

/**
 * Actividades del admin de plataforma (bloque 3, 2026-09-26). El backend
 * **no tiene un listado global** (`hooks/usePlatformEvents.ts`), así que
 * la pantalla ofrece las dos fuentes que sí existen:
 * - **Agenda** (por defecto): actividades programadas desde hoy (o desde
 *   «Desde»), solo las abiertas y las «solo entidad» de entidades a las
 *   que pertenezca la cuenta — la pista visible lo dice.
 * - **Por comunidad**: todas las de una comunidad, pasadas y canceladas
 *   incluidas. Se elige con el buscador o llega por `?community=` desde
 *   la ficha de una comunidad.
 *
 * «Ver» abre el detalle (`hooks/useEvent.ts`) en un diálogo; «Cancelar
 * actividad» solo con `status === 'scheduled'` (el backend no lo impide,
 * pero cancelar lo ya cancelado o celebrado solo reenvía avisos), con
 * `ConfirmDialog` y el error dentro.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useCommunity } from "@/hooks/useCommunity";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useEvent, type EventErrorKind } from "@/hooks/useEvent";
import {
  useCancelPlatformEvent,
  useCommunitySearch,
  usePlatformEvents,
  type PlatformEventsErrorKind,
} from "@/hooks/usePlatformEvents";
import type { PlatformEventRow } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { activeLanguage, localeFor } from "@/lib/i18n/locale";

const EVENTS_ERROR_KEYS: Record<PlatformEventsErrorKind, string> = {
  invalido: "errors.platformEvents.invalido",
  sin_acceso: "errors.platformEvents.sinAcceso",
  no_encontrado: "errors.platformEvents.noEncontrado",
  desconocido: "errors.platformEvents.desconocido",
};

const CANCEL_ERROR_KEYS: Record<PlatformEventsErrorKind, string> = {
  invalido: "errors.platformEvents.cancelDesconocido",
  sin_acceso: "errors.platformEvents.cancelSinAcceso",
  no_encontrado: "errors.platformEvents.cancelNoEncontrado",
  desconocido: "errors.platformEvents.cancelDesconocido",
};

const EVENT_ERROR_KEYS: Record<EventErrorKind, string> = {
  sin_acceso: "errors.platformEvents.detailSinAcceso",
  desconocido: "errors.platformEvents.detailDesconocido",
};

export const EVENT_STATUS_KEYS: Record<PlatformEventRow["status"], string> = {
  scheduled: "plataforma.actividades.statusScheduled",
  cancelled: "plataforma.actividades.statusCancelled",
  completed: "plataforma.actividades.statusCompleted",
};

const STATUS_TONES: Record<PlatformEventRow["status"], BadgeTone> = {
  scheduled: "info",
  cancelled: "error",
  completed: "success",
};

export const EVENT_AUDIENCE_KEYS: Record<PlatformEventRow["audience"], string> = {
  anyone: "plataforma.actividades.audienceAnyone",
  community: "plataforma.actividades.audienceCommunity",
  organization: "plataforma.actividades.audienceOrganization",
};

export function formatEventDateTime(iso: string): string {
  return new Date(iso).toLocaleString(localeFor(activeLanguage()), {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function labelOf(key: string | undefined, raw: string, t: (key: string) => string): string {
  return key ? t(key) : raw;
}

export interface ActividadesPlataformaTableProps {
  /** `?community=` de la URL (viene de la ficha de una comunidad). */
  initialCommunityId: string | null;
}

export function ActividadesPlataformaTable({ initialCommunityId }: ActividadesPlataformaTableProps) {
  const t = useTranslations();
  const [communityId, setCommunityId] = useState<string | null>(initialCommunityId);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<PlatformEventRow | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const matches = useCommunitySearch(debouncedSearch);
  // Con `?community=` no se sabe el nombre: se pide la ficha, solo entonces.
  const community = useCommunity(communityId ?? "", { enabled: communityId !== null && pickedName === null });
  const communityName = pickedName ?? community.data?.name ?? null;

  const events = usePlatformEvents(
    communityId ? { kind: "community", communityId } : { kind: "agenda", from: from || undefined, to: to || undefined },
    page,
  );
  const cancel = useCancelPlatformEvent();

  useEffect(() => {
    if (events.error?.kind === "no_encontrado" && page > 1) setPage(1);
  }, [events.error, page]);

  function pickCommunity(id: string, name: string) {
    setCommunityId(id);
    setPickedName(name);
    setSearch("");
    setPage(1);
  }

  function backToAgenda() {
    setCommunityId(null);
    setPickedName(null);
    setPage(1);
  }

  const field = "rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700";
  const label = "mb-1 block text-sm font-medium text-text-form";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <label htmlFor="actividades-community-search" className={label}>
            {t("plataforma.actividades.communitySearchLabel")}
          </label>
          <input
            id="actividades-community-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={field}
          />
          {debouncedSearch.trim().length >= 2 && search ? (
            <ul className="mt-1 flex flex-col gap-1">
              {matches.isError ? (
                <li role="alert" className="text-sm text-error">
                  {t("errors.platformEvents.communitySearch")}
                </li>
              ) : !matches.data ? (
                <li className="text-sm text-text-secondary">{t("common.loading")}</li>
              ) : matches.data.length === 0 ? (
                <li className="text-sm text-text-secondary">{t("plataforma.actividades.noCommunityMatches")}</li>
              ) : (
                matches.data.map((row) => (
                  <li key={row.id}>
                    <Button type="button" variant="secondary" onClick={() => pickCommunity(row.id, row.name)}>
                      {row.name}
                    </Button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
        {communityId ? null : (
          <>
            <div>
              <label htmlFor="actividades-from" className={label}>
                {t("plataforma.actividades.fromLabel")}
              </label>
              <input
                id="actividades-from"
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
                className={field}
              />
            </div>
            <div>
              <label htmlFor="actividades-to" className={label}>
                {t("plataforma.actividades.toLabel")}
              </label>
              <input
                id="actividades-to"
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
                className={field}
              />
            </div>
          </>
        )}
      </div>

      {communityId ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-text-base">
            {communityName
              ? t("plataforma.actividades.communityMode", { name: communityName })
              : t("plataforma.actividades.communityModeUnnamed")}
          </p>
          <Button type="button" variant="secondary" onClick={backToAgenda}>
            {t("plataforma.actividades.backToAgenda")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">{t("plataforma.actividades.agendaHint")}</p>
      )}

      {events.isError ? (
        <ErrorState
          title={t("plataforma.actividades.loadError")}
          description={errorKindText(events.error, EVENTS_ERROR_KEYS, t, "errors.platformEvents.desconocido")}
        />
      ) : !events.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : events.data.results.length === 0 ? (
        <EmptyState title={t("plataforma.actividades.emptyTitle")} />
      ) : (
        <>
          <Table<PlatformEventRow>
            caption={t("plataforma.actividades.tableCaption")}
            rows={events.data.results}
            getRowKey={(row) => row.id}
            columns={[
              { key: "title", header: t("plataforma.actividades.titleHeader"), render: (row) => row.title },
              {
                key: "starts_at",
                header: t("plataforma.actividades.startsHeader"),
                render: (row) => formatEventDateTime(row.starts_at),
              },
              {
                key: "status",
                header: t("plataforma.actividades.statusHeader"),
                render: (row) => (
                  <Badge tone={STATUS_TONES[row.status] ?? "neutral"}>
                    {labelOf(EVENT_STATUS_KEYS[row.status], row.status, t)}
                  </Badge>
                ),
              },
              {
                key: "audience",
                header: t("plataforma.actividades.audienceHeader"),
                render: (row) => labelOf(EVENT_AUDIENCE_KEYS[row.audience], row.audience, t),
              },
              {
                key: "owner",
                header: t("plataforma.actividades.ownerHeader"),
                render: (row) => row.owner?.name ?? row.organizer?.public_name ?? "—",
              },
              {
                key: "community",
                header: t("plataforma.actividades.communityHeader"),
                render: (row) => row.community?.name ?? "—",
              },
              {
                key: "place",
                header: t("plataforma.actividades.placeHeader"),
                render: (row) => row.place?.name ?? "—",
              },
              {
                key: "seats",
                header: t("plataforma.actividades.seatsHeader"),
                render: (row) =>
                  row.capacity === null
                    ? String(row.seats_taken)
                    : t("plataforma.actividades.seats", { taken: row.seats_taken, capacity: row.capacity }),
              },
              {
                key: "actions",
                header: <span className="sr-only">{t("plataforma.actividades.actionsHeader")}</span>,
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => setViewingId(row.id)}>
                      {t("plataforma.actividades.view")}
                    </Button>
                    {row.status === "scheduled" ? (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => {
                          cancel.reset();
                          setCancelling(row);
                        }}
                      >
                        {t("plataforma.actividades.cancel")}
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={!events.data.previous}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {t("plataforma.actividades.previous")}
            </Button>
            <span className="text-sm text-text-secondary">
              {t("plataforma.actividades.count", { count: events.data.count })}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={!events.data.next}
              onClick={() => setPage((prev) => prev + 1)}
            >
              {t("plataforma.actividades.next")}
            </Button>
          </div>
        </>
      )}

      {viewingId ? <EventDetailDialog eventId={viewingId} onClose={() => setViewingId(null)} /> : null}

      <ConfirmDialog
        open={cancelling !== null}
        title={t("plataforma.actividades.cancelTitle")}
        description={
          <>
            <span>{t("plataforma.actividades.cancelDescription", { title: cancelling?.title ?? "" })}</span>
            {cancel.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(cancel.error, CANCEL_ERROR_KEYS, t, "errors.platformEvents.cancelDesconocido")}
              </span>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.actividades.cancel")}
        cancelLabel={t("plataforma.actividades.keep")}
        pending={cancel.isPending}
        onCancel={() => {
          cancel.reset();
          setCancelling(null);
        }}
        onConfirm={() => {
          if (cancelling) cancel.mutate(cancelling.id, { onSuccess: () => setCancelling(null) });
        }}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-medium text-text-form">{label}</dt>
      <dd className="text-text-base">{children}</dd>
    </div>
  );
}

function EventDetailDialog({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const t = useTranslations();
  const detail = useEvent(eventId);
  const data = detail.data;

  return (
    <Dialog
      open
      titleId="actividad-detalle-title"
      title={data?.title ?? t("plataforma.actividades.detailTitle")}
      onClose={onClose}
    >
      {detail.isError ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(detail.error, EVENT_ERROR_KEYS, t, "errors.platformEvents.detailDesconocido")}
        </p>
      ) : !data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : (
        <dl className="flex flex-col gap-1 text-sm">
          <Row label={t("plataforma.actividades.statusHeader")}>
            {labelOf(EVENT_STATUS_KEYS[data.status as PlatformEventRow["status"]], data.status, t)}
          </Row>
          <Row label={t("plataforma.actividades.startsHeader")}>{formatEventDateTime(data.starts_at)}</Row>
          <Row label={t("plataforma.actividades.endsHeader")}>
            {data.ends_at ? formatEventDateTime(data.ends_at) : "—"}
          </Row>
          <Row label={t("plataforma.actividades.audienceHeader")}>
            {labelOf(EVENT_AUDIENCE_KEYS[data.audience as PlatformEventRow["audience"]], data.audience, t)}
          </Row>
          <Row label={t("plataforma.actividades.organizerHeader")}>{data.organizer?.public_name ?? "—"}</Row>
          <Row label={t("plataforma.actividades.ownerHeader")}>
            {(data.owner as { name?: string } | null)?.name ?? "—"}
          </Row>
          <Row label={t("plataforma.actividades.communityHeader")}>{data.community?.name ?? "—"}</Row>
          <Row label={t("plataforma.actividades.categoryHeader")}>{data.category?.name ?? "—"}</Row>
          <Row label={t("plataforma.actividades.placeHeader")}>{data.place?.name ?? "—"}</Row>
          <Row label={t("plataforma.actividades.addressHeader")}>{data.address || "—"}</Row>
          <Row label={t("plataforma.actividades.seatsHeader")}>
            {data.capacity === null
              ? String(data.seats_taken)
              : t("plataforma.actividades.seats", { taken: data.seats_taken, capacity: data.capacity })}
          </Row>
          <Row label={t("plataforma.actividades.descriptionHeader")}>{data.description || "—"}</Row>
        </dl>
      )}
    </Dialog>
  );
}
