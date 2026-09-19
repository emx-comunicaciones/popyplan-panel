"use client";

/**
 * Espacio POP Familias de la entidad (tarea de cierre, ronda final de
 * Fase 5: reemplaza el «Próximamente» de W4a, `docs/PANEL.md` §8).
 * Resumen (`useFamiliesSummary`, §8.3) con tarjetas de actividad,
 * listado de comunidades `space='families'` con el interruptor de cruce
 * de espacios (`allow_cross_space`, solo titular/moderador —
 * `useToggleCrossSpace`, §8.1) y «Nueva comunidad de familias»
 * (`useCreateFamiliesCommunity`, `space:'families'` + `owner_org`).
 * Comunicaciones y recursos recientes con enlace a sus propias
 * secciones. Banner explícito de separación de espacios (invariante 1:
 * nadie declara ser familiar de nadie, `communities/services/visibility
 * .py::espacio_bloqueado_para`).
 *
 * **Cadena fija del contrato (i18n, tarea 4 del plan):** la clave
 * `entidad.familias.banner` es la única fuente del texto «Las
 * comunidades de familias están separadas…» — se pinta siempre, sea cual
 * sea el estado de la consulta con datos.
 *
 * **Regla de supresión** (`members_count`, mismo patrón que
 * `lib/metrics/format.ts`): el fix de backend que suprime el recuento de
 * personas para quien no tiene `ver_lista_nominal` llega en paralelo a
 * esta tarea — se trata cualquier `members_count: null` como suprimido
 * (`<5`), lleve o no un `suppressed` explícito (ver
 * `lib/api/types.ts::FamiliesSummary`).
 *
 * **Contadores de la red de apoyo** (`docs/PANEL.md` §14.5, tarea 3 del
 * plan de red de apoyo): tres tarjetas más (`people_with_support_network`/
 * `active_supporters`/`supporters_notified_on_help`, ya `SuppressibleCount`
 * en el esquema generado) pintadas con `formatCount(value, suppressed)`
 * como el resto del panel, y un aviso (`role="status"`) sobre
 * `missing_families_space_supporters` (entero sin umbral: cuenta apoyos
 * distintos a la espera de que la entidad cree su comunidad de familias,
 * nunca personas) — sin comunidad todavía, invita a crearla justo encima
 * del botón «Nueva comunidad de familias» ya existente (no se duplica el
 * diálogo); con comunidad ya creada, solo informa de que el alta se
 * completará sola. Nunca se lista quién acompaña a quién.
 */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatCard } from "@/components/metrics/StatCard";
import {
  useCreateFamiliesCommunity,
  type CreateFamiliesCommunityErrorKind,
} from "@/hooks/useCreateFamiliesCommunity";
import { useFamiliesSummary } from "@/hooks/useFamiliesSummary";
import { useToggleCrossSpace, type ToggleCrossSpaceErrorKind } from "@/hooks/useToggleCrossSpace";
import type { FamiliesSummaryCommunityRow } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeFor, activeLanguage } from "@/lib/i18n/locale";
import { formatCount } from "@/lib/metrics/format";

export interface FamiliasPanelProps {
  orgId: number | string;
  slug: string;
  canManage: boolean;
}

function isSuppressed(row: { members_count: number | null; suppressed?: boolean }): boolean {
  return row.members_count === null || row.suppressed === true;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(localeFor(activeLanguage()), {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const TOGGLE_CROSS_SPACE_ERROR_KEYS: Record<ToggleCrossSpaceErrorKind, string> = {
  sin_permiso: "errors.toggleCrossSpace.sinPermiso",
  desconocido: "errors.toggleCrossSpace.desconocido",
};

const CREATE_FAMILIES_COMMUNITY_ERROR_KEYS: Record<CreateFamiliesCommunityErrorKind, string> = {
  invalido: "errors.createFamiliesCommunity.invalido",
  sin_permiso: "errors.createFamiliesCommunity.sinPermiso",
  desconocido: "errors.createFamiliesCommunity.desconocido",
};

function NuevaComunidadDialog({
  orgId,
  open,
  onClose,
}: {
  orgId: number | string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const createCommunity = useCreateFamiliesCommunity();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"open" | "on_request" | "private">("open");
  const [codeOfConduct, setCodeOfConduct] = useState("");

  const canSubmit = name.trim().length > 0;

  function resetForm() {
    setName("");
    setDescription("");
    setVisibility("open");
    setCodeOfConduct("");
    createCommunity.reset();
  }

  function handleClose() {
    if (createCommunity.isPending) return;
    resetForm();
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    createCommunity.mutate(
      {
        orgId,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        codeOfConduct: codeOfConduct.trim() || undefined,
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <Dialog
      open={open}
      titleId="nueva-comunidad-familias-title"
      title={t("entidad.familias.newCommunityTitle")}
      pending={createCommunity.isPending}
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="familias-nombre" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.familias.nameLabel")}
          </label>
          <input
            id="familias-nombre"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="familias-descripcion" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.familias.descriptionLabel")}
          </label>
          <textarea
            id="familias-descripcion"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="familias-visibilidad" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.familias.visibilityLabel")}
          </label>
          <select
            id="familias-visibilidad"
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value as "open" | "on_request" | "private")
            }
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            <option value="open">{t("entidad.familias.visibilityOpen")}</option>
            <option value="on_request">{t("entidad.familias.visibilityOnRequest")}</option>
            <option value="private">{t("entidad.familias.visibilityPrivate")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="familias-codigo" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.familias.codeOfConductLabel")}
          </label>
          <textarea
            id="familias-codigo"
            value={codeOfConduct}
            onChange={(event) => setCodeOfConduct(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit || createCommunity.isPending}>
            {t("entidad.familias.createCommunity")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={createCommunity.isPending}
          >
            {t("common.cancel")}
          </Button>
        </div>
        {createCommunity.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(
              createCommunity.error,
              CREATE_FAMILIES_COMMUNITY_ERROR_KEYS,
              t,
              "errors.createFamiliesCommunity.desconocido",
            )}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function CommunityRow({
  orgId,
  community,
  canManage,
}: {
  orgId: number | string;
  community: FamiliesSummaryCommunityRow;
  canManage: boolean;
}) {
  const t = useTranslations();
  const toggle = useToggleCrossSpace();
  const [confirmingValue, setConfirmingValue] = useState<boolean | null>(null);

  function requestToggle(next: boolean) {
    setConfirmingValue(next);
  }

  function handleConfirm() {
    if (confirmingValue === null) return;
    toggle.mutate(
      { orgId, communityId: community.id, allowCrossSpace: confirmingValue },
      { onSettled: () => setConfirmingValue(null) },
    );
  }

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-text-base">{community.name}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge tone="info">
                {t("entidad.familias.peopleCount", {
                  count: formatCount(community.members_count, isSuppressed(community)),
                })}
              </Badge>
              <Badge tone={community.allow_cross_space ? "success" : "neutral"}>
                {community.allow_cross_space
                  ? t("entidad.familias.crossSpaceOn")
                  : t("entidad.familias.crossSpaceOff")}
              </Badge>
            </div>
          </div>
          {canManage ? (
            <label className="flex items-center gap-2 text-sm text-text-base">
              <input
                type="checkbox"
                checked={community.allow_cross_space}
                disabled={toggle.isPending}
                onChange={(event) => requestToggle(event.target.checked)}
              />
              {t("entidad.familias.allowCrossSpace")}
            </label>
          ) : null}
        </div>
        {toggle.isError ? (
          <p role="alert" className="mt-2 text-xs text-error">
            {errorKindText(
              toggle.error,
              TOGGLE_CROSS_SPACE_ERROR_KEYS,
              t,
              "errors.toggleCrossSpace.desconocido",
            )}
          </p>
        ) : null}
      </Card>
      <ConfirmDialog
        open={confirmingValue !== null}
        title={t("entidad.familias.toggleConfirmTitle")}
        description={
          confirmingValue
            ? t("entidad.familias.toggleOnDescription", { name: community.name })
            : t("entidad.familias.toggleOffDescription", { name: community.name })
        }
        confirmLabel={t("common.confirm")}
        pending={toggle.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmingValue(null)}
      />
    </li>
  );
}

export function FamiliasPanel({ orgId, slug, canManage }: FamiliasPanelProps) {
  const t = useTranslations();
  const summary = useFamiliesSummary(orgId);
  const [creating, setCreating] = useState(false);

  if (summary.isError) {
    return (
      <ErrorState
        title={t("entidad.familias.loadError")}
        description={t("entidad.familias.loadErrorDescription")}
      />
    );
  }

  if (!summary.data) {
    return <p className="text-sm text-text-secondary">{t("entidad.familias.loading")}</p>;
  }

  const data = summary.data;

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-md border border-border bg-category-light p-3 text-sm text-text-form">
        {t("entidad.familias.banner")}
      </p>

      <section aria-labelledby="familias-resumen-heading">
        <h2 id="familias-resumen-heading" className="sr-only">
          {t("entidad.familias.summaryHeading")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label={t("entidad.familias.communitiesCount")}
            value={formatCount(data.communities.length)}
          />
          <StatCard
            label={t("entidad.familias.people")}
            value={formatCount(data.members_count, isSuppressed(data))}
          />
          <StatCard
            label={t("entidad.familias.upcomingEvents")}
            value={formatCount(data.upcoming_events.length)}
          />
          <StatCard
            label={t("entidad.familias.peopleWithSupportNetwork")}
            value={formatCount(
              data.people_with_support_network.value,
              data.people_with_support_network.suppressed,
            )}
          />
          <StatCard
            label={t("entidad.familias.activeSupporters")}
            value={formatCount(data.active_supporters.value, data.active_supporters.suppressed)}
          />
          <StatCard
            label={t("entidad.familias.supportersNotified")}
            value={formatCount(
              data.supporters_notified_on_help.value,
              data.supporters_notified_on_help.suppressed,
            )}
          />
        </div>
      </section>

      <section aria-labelledby="familias-comunidades-heading">
        {data.missing_families_space_supporters > 0 ? (
          <p role="status" className="mb-3 rounded-md border border-border bg-category-light p-3 text-sm text-text-form">
            {data.communities.length === 0
              ? t("entidad.familias.missingSupportersNotice", {
                  count: data.missing_families_space_supporters,
                })
              : t("entidad.familias.pendingAutoJoinNotice")}
          </p>
        ) : null}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="familias-comunidades-heading" className="text-lg font-semibold text-text-base">
            {t("entidad.familias.communitiesHeading")}
          </h2>
          {canManage ? (
            <Button type="button" onClick={() => setCreating(true)}>
              {t("entidad.familias.newCommunityTitle")}
            </Button>
          ) : null}
        </div>
        {data.communities.length === 0 ? (
          <EmptyState
            title={t("entidad.familias.communitiesEmpty")}
            description={t("entidad.familias.communitiesEmptyDescription")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.communities.map((community) => (
              <CommunityRow
                key={community.id}
                orgId={orgId}
                community={community}
                canManage={canManage}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="familias-actividades-heading">
        <h2 id="familias-actividades-heading" className="mb-2 text-lg font-semibold text-text-base">
          {t("entidad.familias.upcomingEventsHeading")}
        </h2>
        {data.upcoming_events.length === 0 ? (
          <EmptyState title={t("entidad.familias.upcomingEventsEmpty")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.upcoming_events.map((event) => (
              <li key={event.id}>
                <Card>
                  <p className="font-medium text-text-base">{event.title}</p>
                  <p className="text-sm text-text-secondary">
                    {formatDateTime(event.starts_at)} · {event.community.name}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/entidad/${slug}/actividades`}
          className="mt-2 inline-block text-sm font-medium text-primary-700 underline"
        >
          {t("entidad.familias.viewAllActivities")}
        </Link>
      </section>

      <section aria-labelledby="familias-comunicaciones-heading">
        <h2 id="familias-comunicaciones-heading" className="mb-2 text-lg font-semibold text-text-base">
          {t("entidad.familias.recentAnnouncementsHeading")}
        </h2>
        {data.announcements.length === 0 ? (
          <EmptyState title={t("entidad.familias.recentAnnouncementsEmpty")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.announcements.map((announcement) => (
              <li key={announcement.id}>
                <Card>
                  <p className="font-medium text-text-base">{announcement.title}</p>
                  <p className="text-sm text-text-secondary">
                    {t("entidad.familias.announcementSentOn", {
                      date: formatDateTime(announcement.sent_at),
                      count: announcement.recipients_count,
                    })}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/entidad/${slug}/comunicaciones`}
          className="mt-2 inline-block text-sm font-medium text-primary-700 underline"
        >
          {t("entidad.familias.goToAnnouncements")}
        </Link>
      </section>

      <section aria-labelledby="familias-recursos-heading">
        <h2 id="familias-recursos-heading" className="mb-2 text-lg font-semibold text-text-base">
          {t("entidad.familias.recentResourcesHeading")}
        </h2>
        {data.resources.length === 0 ? (
          <EmptyState title={t("entidad.familias.recentResourcesEmpty")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.resources.map((resource) => (
              <li key={resource.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-text-base">{resource.title}</p>
                    {resource.is_featured ? (
                      <Badge tone="success">{t("entidad.recursos.featured")}</Badge>
                    ) : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/entidad/${slug}/recursos`}
          className="mt-2 inline-block text-sm font-medium text-primary-700 underline"
        >
          {t("entidad.familias.goToResources")}
        </Link>
      </section>

      {canManage ? (
        <NuevaComunidadDialog orgId={orgId} open={creating} onClose={() => setCreating(false)} />
      ) : null}
    </div>
  );
}
