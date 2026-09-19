"use client";

/**
 * Comunicaciones oficiales de la entidad (tarea W4b, `docs/PANEL.md` §5):
 * redactar un anuncio (título, cuerpo, audiencia) e historial con
 * `recipients_count`. El backend no ofrece una vista previa del número de
 * destinatarios antes de enviar (no hay endpoint para ello, ver informe de
 * esta tarea): el diálogo de confirmación describe la audiencia elegida,
 * y tras el envío se muestra `recipients_count` real de la respuesta.
 * Solo titular/moderador pueden componer (`canCompose`); el resto de
 * roles con acceso a esta página (dinamizador, ver `entidadMenu.ts`) solo
 * ve el historial.
 *
 * **Ronda final de Fase 5** (P6 cerrado en el backend, `docs/PANEL.md`
 * §5.2/§8.2): la opción «Familias» ya no va deshabilitada a fuego —
 * `hasFamilies` (`useEntityCommunities`, filtrando `space === 'families'`)
 * decide si se puede elegir. Sin ninguna comunidad de familias en la
 * entidad, se queda deshabilitada con la misma pista de siempre.
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAnnouncements, type AnnouncementsErrorKind } from "@/hooks/useAnnouncements";
import { useEntityCommunities } from "@/hooks/useEntityCommunities";
import { useSendAnnouncement, type SendAnnouncementErrorKind } from "@/hooks/useSendAnnouncement";
import { SUPPORT_WELCOME_TEMPLATE_KEYS, applyTemplate } from "@/lib/communications/templates";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeFor, activeLanguage } from "@/lib/i18n/locale";
import type { Announcement, EntityCommunityRow } from "@/lib/api/types";

export interface ComunicacionesPanelProps {
  orgId: number | string;
  canCompose: boolean;
}

type AudienceKind = "members" | "community" | "families";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(localeFor(activeLanguage()), {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function describeAudience(
  audience: string,
  communities: EntityCommunityRow[],
  t: (key: string, values?: Record<string, string>) => string,
): string {
  if (audience === "members") return t("entidad.comunicaciones.audienceMembers");
  if (audience === "families") return t("entidad.comunicaciones.audienceFamilies");
  if (audience.startsWith("community:")) {
    const communityId = audience.slice("community:".length);
    const community = communities.find((c) => c.id === communityId);
    return community
      ? t("entidad.comunicaciones.audienceCommunityNamed", { name: community.name })
      : t("entidad.comunicaciones.audienceCommunity");
  }
  return audience;
}

const ANNOUNCEMENTS_ERROR_KEYS: Record<AnnouncementsErrorKind, string> = {
  sin_acceso: "errors.announcements.sinAcceso",
  desconocido: "errors.announcements.desconocido",
};

const SEND_ANNOUNCEMENT_ERROR_KEYS: Record<SendAnnouncementErrorKind, string> = {
  invalido: "errors.sendAnnouncement.invalido",
  sin_permiso: "errors.sendAnnouncement.sinPermiso",
  desconocido: "errors.sendAnnouncement.desconocido",
};

function ComposeForm({ orgId }: { orgId: number | string }) {
  const t = useTranslations();
  const communities = useEntityCommunities(orgId);
  const sendAnnouncement = useSendAnnouncement(orgId);
  const hasFamilies = (communities.data ?? []).some((community) => community.space === "families");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceKind, setAudienceKind] = useState<AudienceKind>("members");
  const [communityId, setCommunityId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastSent, setLastSent] = useState<Announcement | null>(null);
  const [templateConfirmOpen, setTemplateConfirmOpen] = useState(false);
  // Resultado de `applyTemplate` calculado en el clic que abrió el
  // `ConfirmDialog`: `handleConfirmTemplate` lo reutiliza tal cual en vez
  // de volver a derivarlo de la constante, para no divergir en silencio
  // si `applyTemplate` alguna vez transforma el texto (recortar,
  // interpolar el nombre de la entidad…).
  const [pendingTemplate, setPendingTemplate] = useState<{ title: string; body: string } | null>(
    null,
  );

  const audienceValue =
    audienceKind === "members"
      ? "members"
      : audienceKind === "families"
        ? "families"
        : (`community:${communityId}` as const);

  const audienceLabel = describeAudience(audienceValue, communities.data ?? [], t);
  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (audienceKind !== "community" || communityId.length > 0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setConfirmOpen(true);
  }

  function handleUseTemplateClick() {
    const template = {
      title: t(SUPPORT_WELCOME_TEMPLATE_KEYS.title),
      body: t(SUPPORT_WELCOME_TEMPLATE_KEYS.body),
    };
    const result = applyTemplate({ title, body }, template);
    if (result.overwritten) {
      setPendingTemplate({ title: result.title, body: result.body });
      setTemplateConfirmOpen(true);
      return;
    }
    setTitle(result.title);
    setBody(result.body);
    setAudienceKind("families");
  }

  function handleConfirmTemplate() {
    if (pendingTemplate) {
      setTitle(pendingTemplate.title);
      setBody(pendingTemplate.body);
    }
    setAudienceKind("families");
    setTemplateConfirmOpen(false);
    setPendingTemplate(null);
  }

  function handleConfirm() {
    sendAnnouncement.mutate(
      { title, body, audience: audienceValue },
      {
        onSuccess: (announcement) => {
          setLastSent(announcement);
          setTitle("");
          setBody("");
          setAudienceKind("members");
          setCommunityId("");
          setConfirmOpen(false);
        },
        onError: () => setConfirmOpen(false),
      },
    );
  }

  return (
    <Card title={t("entidad.comunicaciones.composeTitle")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="comunicacion-title" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.comunicaciones.titleLabel")}
          </label>
          <input
            id="comunicacion-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            required
          />
        </div>
        <div>
          <label htmlFor="comunicacion-body" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.comunicaciones.bodyLabel")}
          </label>
          <textarea
            id="comunicacion-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            required
          />
        </div>
        {hasFamilies ? (
          <div>
            <Button type="button" variant="secondary" onClick={handleUseTemplateClick}>
              {t("entidad.comunicaciones.useTemplate")}
            </Button>
          </div>
        ) : null}
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-text-form">
            {t("entidad.comunicaciones.audienceLegend")}
          </legend>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-text-base">
              <input
                type="radio"
                name="audience-kind"
                value="members"
                checked={audienceKind === "members"}
                onChange={() => setAudienceKind("members")}
              />
              {t("entidad.comunicaciones.audienceMembers")}
            </label>
            <label className="flex items-center gap-2 text-sm text-text-base">
              <input
                type="radio"
                name="audience-kind"
                value="community"
                checked={audienceKind === "community"}
                onChange={() => setAudienceKind("community")}
              />
              {t("entidad.comunicaciones.audienceCommunity")}
            </label>
            {audienceKind === "community" ? (
              <select
                aria-label={t("entidad.comunicaciones.communitySelectLabel")}
                value={communityId}
                onChange={(event) => setCommunityId(event.target.value)}
                aria-describedby={communities.isError ? "comunicacion-comunidades-error" : undefined}
                className="ml-6 rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
              >
                <option value="">{t("entidad.comunicaciones.communitySelectPlaceholder")}</option>
                {(communities.data ?? []).map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            ) : null}
            <label
              className={`flex items-center gap-2 text-sm ${hasFamilies ? "text-text-base" : "text-text-secondary"}`}
            >
              <input
                type="radio"
                name="audience-kind"
                value="families"
                disabled={!hasFamilies}
                checked={audienceKind === "families"}
                onChange={() => setAudienceKind("families")}
                aria-describedby={communities.isError ? "comunicacion-comunidades-error" : undefined}
              />
              {t("entidad.comunicaciones.audienceFamilies")}
            </label>
            {communities.isError ? (
              // Sin el listado no se puede saber si la entidad tiene
              // espacio de familias: la pista de siempre sería engañosa.
              // El mismo aviso describe los dos controles afectados (el
              // select de comunidad y la opción «Familias»).
              <p id="comunicacion-comunidades-error" role="alert" className="ml-6 text-xs text-error">
                {t("entidad.comunicaciones.communitiesError")}
              </p>
            ) : !hasFamilies ? (
              <p className="ml-6 text-xs text-text-secondary">
                {t("entidad.comunicaciones.familiesHint")}
              </p>
            ) : null}
          </div>
        </fieldset>
        <div>
          <Button type="submit" disabled={!canSubmit || sendAnnouncement.isPending}>
            {t("entidad.comunicaciones.send")}
          </Button>
        </div>
        {sendAnnouncement.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(
              sendAnnouncement.error,
              SEND_ANNOUNCEMENT_ERROR_KEYS,
              t,
              "errors.sendAnnouncement.desconocido",
            )}
          </p>
        ) : null}
        {lastSent ? (
          <p className="text-sm text-success">
            {t("entidad.comunicaciones.sentTo", { count: lastSent.recipients_count })}
          </p>
        ) : null}
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title={t("entidad.comunicaciones.send")}
        description={t("entidad.comunicaciones.sendConfirmDescription", { audience: audienceLabel })}
        confirmLabel={t("entidad.comunicaciones.sendConfirmLabel")}
        pending={sendAnnouncement.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={templateConfirmOpen}
        title={t("entidad.comunicaciones.templateConfirmTitle")}
        description={t("entidad.comunicaciones.templateConfirmDescription")}
        confirmLabel={t("entidad.comunicaciones.templateConfirmLabel")}
        onConfirm={handleConfirmTemplate}
        onCancel={() => {
          setTemplateConfirmOpen(false);
          setPendingTemplate(null);
        }}
      />
    </Card>
  );
}

function Historial({ orgId }: { orgId: number | string }) {
  const t = useTranslations();
  const announcements = useAnnouncements(orgId);
  const communities = useEntityCommunities(orgId);

  if (announcements.isError) {
    return (
      <ErrorState
        title={t("entidad.comunicaciones.historyError")}
        description={errorKindText(
          announcements.error,
          ANNOUNCEMENTS_ERROR_KEYS,
          t,
          "errors.announcements.desconocido",
        )}
      />
    );
  }
  if (!announcements.data) {
    return <p className="text-sm text-text-secondary">{t("entidad.comunicaciones.historyLoading")}</p>;
  }
  if (announcements.data.length === 0) {
    return <EmptyState title={t("entidad.comunicaciones.historyEmpty")} />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {announcements.data.map((announcement) => (
        <li key={announcement.id}>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-text-base">{announcement.title}</p>
                <p className="mt-1 text-sm text-text-secondary">{announcement.body}</p>
              </div>
              <Badge tone="info">
                {describeAudience(announcement.audience, communities.data ?? [], t)}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              {t("entidad.comunicaciones.sentOn", {
                date: formatDateTime(announcement.sent_at),
                count: announcement.recipients_count,
              })}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function ComunicacionesPanel({ orgId, canCompose }: ComunicacionesPanelProps) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-6">
      {canCompose ? (
        <ComposeForm orgId={orgId} />
      ) : (
        <p className="text-sm text-text-secondary">{t("entidad.comunicaciones.readOnlyNotice")}</p>
      )}
      <section aria-labelledby="historial-heading">
        <h2 id="historial-heading" className="mb-2 text-lg font-semibold text-text-base">
          {t("entidad.comunicaciones.historyHeading")}
        </h2>
        <Historial orgId={orgId} />
      </section>
    </div>
  );
}
