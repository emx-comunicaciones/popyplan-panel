"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  useAcknowledgeHelpRequest,
  type AcknowledgeHelpRequestErrorKind,
} from "@/hooks/useAcknowledgeHelpRequest";
import { usePendingHelpRequests } from "@/hooks/usePendingHelpRequests";
import { useOrganization } from "@/hooks/useOrganization";
import { useUpdateOrganization, type UpdateOrganizationErrorKind } from "@/hooks/useUpdateOrganization";
import type { HelpRequestRow } from "@/lib/api/types";
import { NO_PHONE_NOTICE_KEY } from "@/lib/help/noPhoneNotice";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeFor, activeLanguage } from "@/lib/i18n/locale";

export interface GuardiaPanelProps {
  orgId: number | string;
  /** Slug de la entidad, para enlazar a la ficha de la persona cuando es miembro. */
  slug: string;
}

const ACKNOWLEDGE_ERROR_KEYS: Record<AcknowledgeHelpRequestErrorKind, string> = {
  sin_permiso: "errors.acknowledgeHelpRequest.sinPermiso",
  desconocido: "errors.acknowledgeHelpRequest.desconocido",
};

// Mismas claves que `ConfiguracionPanel.tsx::DatosEntidad` (comparten el
// hook `useUpdateOrganization`, así que el 403/400/genérico dicen lo
// mismo en las dos pantallas).
const UPDATE_ORGANIZATION_ERROR_KEYS: Record<UpdateOrganizationErrorKind, string> = {
  invalido: "errors.updateOrganization.invalido",
  sin_permiso: "errors.updateOrganization.sinPermiso",
  desconocido: "errors.updateOrganization.desconocido",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(localeFor(activeLanguage()), {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Aviso «no lo llevo mal» al día: no se puede saber si la persona
 * pertenece a la entidad ni cómo contactarla solo con el nombre. Con
 * `is_member`, el nombre enlaza a la ficha (`/entidad/{slug}/personas/
 * {userId}`, invariante 9 — la ficha nunca lleva contacto); sin
 * membresía, un badge explícito («No pertenece a la entidad») en vez de
 * un enlace que daría 404/«Sin acceso». `referent` (si lo hay) se pinta
 * aparte, tal cual llega (`{id, public_name}`, mismo patrón que
 * `ReferentRef`).
 */
function HelpRequestCard({
  request,
  orgId,
  slug,
}: {
  request: HelpRequestRow;
  orgId: number | string;
  slug: string;
}) {
  const t = useTranslations();
  const acknowledge = useAcknowledgeHelpRequest(orgId);
  const { is_member: isMember, public_name: publicName, referent } = request.user_display;

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {isMember ? (
                <Link
                  href={`/entidad/${slug}/personas/${request.user_display.id}`}
                  className="font-medium text-primary-700 hover:underline"
                >
                  {publicName}
                </Link>
              ) : (
                <p className="font-medium text-text-base">{publicName}</p>
              )}
              {isMember ? null : <Badge tone="info">{t("entidad.guardia.notMember")}</Badge>}
            </div>
            {isMember ? null : (
              <p className="text-sm text-text-secondary">{t("entidad.guardia.joinedWithoutMembership")}</p>
            )}
            {referent ? (
              <p className="text-sm text-text-secondary">
                {t("entidad.guardia.referent", { name: referent.public_name })}
              </p>
            ) : null}
            <p className="text-sm text-text-secondary">
              {request.community_display ? request.community_display.name : t("entidad.guardia.noCommunity")}
              {request.event_display ? ` · ${request.event_display.title}` : ""}
            </p>
            <p className="text-xs text-text-secondary">{formatDateTime(request.created_at)}</p>
          </div>
          {request.acknowledged_at ? (
            <Badge tone="success">{t("entidad.guardia.acknowledged")}</Badge>
          ) : (
            <Button
              type="button"
              disabled={acknowledge.isPending}
              onClick={() => acknowledge.mutate(request.id)}
            >
              {t("entidad.guardia.acknowledgeAction")}
            </Button>
          )}
        </div>
        {acknowledge.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {errorKindText(
              acknowledge.error,
              ACKNOWLEDGE_ERROR_KEYS,
              t,
              "errors.acknowledgeHelpRequest.desconocido",
            )}
          </p>
        ) : null}
      </Card>
    </li>
  );
}

function GuardiaSettings({ orgId }: { orgId: number | string }) {
  const t = useTranslations();
  const organization = useOrganization(orgId);
  const updateOrganization = useUpdateOrganization(orgId);
  const [helpPhone, setHelpPhone] = useState<string | null>(null);

  // Un fallo de la ficha dejaba la sección entera en blanco, sin decir
  // nada: quien entra no sabe si la entidad no tiene teléfono de guardia
  // o si la petición se ha caído.
  if (organization.isError) {
    return (
      <Card title={t("entidad.guardia.settingsTitle")}>
        <ErrorState
          title={t("entidad.guardia.settingsError")}
          description={t("entidad.guardia.settingsErrorDescription")}
        />
      </Card>
    );
  }
  if (!organization.data) return null;

  const currentHelpPhone = helpPhone ?? organization.data.help_phone ?? "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Cadena vacía (no `null`) es el valor que limpia el campo: el modelo
    // real es `CharField(blank=True, default='')` (`entities/models.py`,
    // migración 0003) y `docs/schema.yaml` lo tipa `type: string`, sin
    // nullable — DRF rechaza `null` con 400. Verificado contra el backend.
    updateOrganization.mutate({ help_phone: currentHelpPhone });
  }

  return (
    <Card title={t("entidad.guardia.settingsTitle")}>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="guardia-help-phone" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.guardia.helpPhoneLabel")}
          </label>
          <input
            id="guardia-help-phone"
            type="tel"
            value={currentHelpPhone}
            onChange={(event) => setHelpPhone(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <Button type="submit" disabled={updateOrganization.isPending}>
          {t("common.save")}
        </Button>
      </form>
      <p className="mt-2 text-xs text-text-secondary">
        {t("entidad.guardia.onCallHint", {
          onCall: organization.data.on_call_user ?? t("entidad.guardia.onCallUnassigned"),
        })}
      </p>
      {updateOrganization.isError ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {errorKindText(
            updateOrganization.error,
            UPDATE_ORGANIZATION_ERROR_KEYS,
            t,
            "errors.updateOrganization.desconocido",
          )}
        </p>
      ) : null}
      {updateOrganization.isSuccess ? (
        <p className="mt-2 text-sm text-success">{t("entidad.guardia.saved")}</p>
      ) : null}
    </Card>
  );
}

/**
 * Guardia de la entidad (tarea W4a, `docs/SEGURIDAD_Y_MODERACION.md` §5):
 * avisos de «hoy lo llevo mal» pendientes, con «He contactado»
 * (`acknowledge`), y el teléfono de ayuda de la entidad
 * (`PATCH .../organizations/{id}/ {help_phone}`). Fijar `on_call_user`
 * (persona de guardia) exige un id de usuario que hoy no hay forma de
 * buscar desde el panel (`GET /api/users/users/` es solo para
 * `IsAdminUser`) — ver «Desviaciones» del informe. Cada aviso enlaza a la
 * ficha de la persona (`/entidad/{slug}/personas/{userId}`) solo si
 * `user_display.is_member`; si no, un badge «No pertenece a la entidad»
 * (ver `HelpRequestCard`).
 */
export function GuardiaPanel({ orgId, slug }: GuardiaPanelProps) {
  const t = useTranslations();
  const requests = usePendingHelpRequests(orgId);

  return (
    <div className="flex flex-col gap-6">
      <GuardiaSettings orgId={orgId} />

      <section aria-labelledby="avisos-heading">
        <h2 id="avisos-heading" className="mb-2 text-lg font-semibold text-text-base">
          {t("entidad.guardia.pendingHeading")}
        </h2>
        {requests.isError ? (
          requests.error.kind === "sin_acceso" ? (
            <EmptyState
              title={t("common.noAccess")}
              description={t("entidad.guardia.pendingNoAccessDescription")}
            />
          ) : (
            <ErrorState
              title={t("entidad.guardia.pendingError")}
              description={t("entidad.guardia.pendingErrorDescription")}
            />
          )
        ) : !requests.data ? (
          <p className="text-sm text-text-secondary">{t("entidad.guardia.pendingLoading")}</p>
        ) : requests.data.length === 0 ? (
          <EmptyState title={t("entidad.guardia.pendingEmpty")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.data.map((request) => (
              <HelpRequestCard key={request.id} request={request} orgId={orgId} slug={slug} />
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-text-secondary">{t(NO_PHONE_NOTICE_KEY)}</p>
      </section>
    </div>
  );
}
