"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SupportResponses } from "@/components/help/SupportResponses";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  useAcknowledgeHelpRequest,
  type AcknowledgeHelpRequestErrorKind,
} from "@/hooks/useAcknowledgeHelpRequest";
import { usePendingHelpRequests } from "@/hooks/usePendingHelpRequests";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgMembers, type OrgMembersErrorKind } from "@/hooks/useOrgMembers";
import { useUpdateOrganization, type UpdateOrganizationErrorKind } from "@/hooks/useUpdateOrganization";
import type { HelpRequestRow } from "@/lib/api/types";
import { NO_PHONE_NOTICE_KEY } from "@/lib/help/noPhoneNotice";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeFor, activeLanguage } from "@/lib/i18n/locale";

export interface GuardiaPanelProps {
  orgId: number | string;
  /** Slug de la entidad, para enlazar a la ficha de la persona cuando es miembro. */
  slug: string;
  /**
   * Si quien mira tiene la sección «Personas» en su menú
   * (`lib/auth/entidadMenu.ts::entidadMenuFor`). Hallazgo I1 de la
   * revisión de esta rama, misma clase que el F1 ya documentado para
   * `ActividadesTable`: desde que la guardia se abre a la persona de
   * guardia **sea cual sea su rol**, una `analista` o un `dinamizador`
   * de guardia ven los avisos sin tener Personas, y el enlace al nombre
   * les aterrizaba en el «Sin acceso» a página completa de
   * `personas/[userId]/page.tsx`. Lo calcula el Server Component, que ya
   * tiene el rol y el `isOnCall`.
   */
  canOpenPersonSheet: boolean;
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

// El equipo (`GET /api/organizations/{id}/members/`) es solo-titular
// (`entities/permissions.py`, `'equipo': {'titular'}`), igual que el
// `PATCH` que fija la guardia: un `moderador` recibe 403 en las dos
// cosas. El 403 no se pinta como error de página — se dice quién puede
// hacerlo, igual que `ConfiguracionPanel` con la pestaña Equipo.
const ORG_MEMBERS_ERROR_KEYS: Record<OrgMembersErrorKind, string> = {
  // `invalido` solo lo producen el alta y la baja de equipo, nunca la
  // lectura que usa esta pantalla: cae al genérico a propósito, sin
  // inventar una clave de catálogo sin uso real.
  invalido: "errors.orgMembers.desconocido",
  sin_acceso: "entidad.guardia.onCallOnlyTitular",
  desconocido: "errors.orgMembers.desconocido",
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
 * `is_member` **y** `canOpenPersonSheet`, el nombre enlaza a la ficha
 * (`/entidad/{slug}/personas/{userId}`, invariante 9 — la ficha nunca
 * lleva contacto); sin membresía, un badge explícito («No pertenece a la
 * entidad») en vez de un enlace que daría 404/«Sin acceso»; sin la
 * sección Personas en el menú de quien mira (I1), el nombre se pinta
 * como texto, sin `<a>`. `referent` (si lo hay) se pinta
 * aparte, tal cual llega (`{id, public_name}`, mismo patrón que
 * `ReferentRef`).
 */
function HelpRequestCard({
  request,
  orgId,
  slug,
  canOpenPersonSheet,
}: {
  request: HelpRequestRow;
  orgId: number | string;
  slug: string;
  canOpenPersonSheet: boolean;
}) {
  const t = useTranslations();
  const acknowledge = useAcknowledgeHelpRequest(orgId);
  const { is_member: isMember, public_name: publicName, referent } = request.user_display;
  // Las dos condiciones del enlace: que la persona pertenezca a la
  // entidad (si no, la ficha da 404) y que quien mira pueda abrir la
  // sección Personas (si no, «Sin acceso»).
  const linkToSheet = isMember && canOpenPersonSheet;

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {linkToSheet ? (
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
            {/* D-I4: quién de su red ya dijo «me encargo». Sin esto, la
                guardia llama sin saber que alguien está ya con ella. */}
            <SupportResponses responses={request.support_responses} />
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

/**
 * Ajustes de guardia: teléfono de ayuda y **persona de guardia**
 * (`on_call_user`).
 *
 * **Hallazgo D-I8 de la auditoría de integración (2026-09-21)**: el
 * campo era escribible desde la API pero ninguna pantalla lo fijaba, y
 * la pista de aquí abajo imprimía el **id de cuenta** en crudo
 * («Persona de guardia actual: 8»), contra la regla del panel de no
 * pintar ids de cuenta. Ahora es un `<select>` de `useOrgMembers` con
 * `public_name`, mismo patrón que el select de referente de
 * `components/people/AddPersonDialog.tsx`, y se guarda junto al teléfono
 * en el mismo `PATCH` (los dos campos van por la misma lista blanca
 * solo-titular, así que no tiene sentido separarlos en dos peticiones).
 */
function GuardiaSettings({ orgId }: { orgId: number | string }) {
  const t = useTranslations();
  const organization = useOrganization(orgId);
  const members = useOrgMembers(orgId);
  const updateOrganization = useUpdateOrganization(orgId);
  const [helpPhone, setHelpPhone] = useState<string | null>(null);
  const [onCall, setOnCall] = useState<string | null>(null);

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
  // `on_call_user` es el id de **cuenta** (`entities/models.py`:
  // `ForeignKey(AUTH_USER_MODEL)`, validado contra las membresías de la
  // entidad), así que el `value` de cada opción es `membership.user`.
  const currentOnCall =
    onCall ?? (organization.data.on_call_user != null ? String(organization.data.on_call_user) : "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Cadena vacía (no `null`) es el valor que limpia el teléfono: el
    // modelo real es `CharField(blank=True, default='')`
    // (`entities/models.py`, migración 0003) y `docs/schema.yaml` lo tipa
    // `type: string`, sin nullable — DRF rechaza `null` con 400.
    // Verificado contra el backend. `on_call_user` sí es nullable
    // (`null=True`, `SET_NULL`): vaciarlo es `null`, no cadena vacía.
    updateOrganization.mutate({
      help_phone: currentHelpPhone,
      on_call_user: currentOnCall ? Number(currentOnCall) : null,
    });
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
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        {members.data ? (
          <div>
            <label htmlFor="guardia-on-call" className="mb-1 block text-sm font-medium text-text-form">
              {t("entidad.guardia.onCallLabel")}
            </label>
            <select
              id="guardia-on-call"
              value={currentOnCall}
              onChange={(event) => setOnCall(event.target.value)}
              className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            >
              <option value="">{t("entidad.guardia.onCallUnassigned")}</option>
              {members.data.map((member) => (
                <option key={member.id} value={member.user}>
                  {member.public_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <Button type="submit" disabled={updateOrganization.isPending}>
          {t("common.save")}
        </Button>
      </form>
      {/* Sin el equipo cargado no se puede ofrecer el selector ni
          resolver el nombre de quien está de guardia — y el id crudo no
          se pinta nunca (invariante 1/9). Se dice qué pasa, que es lo que
          hace el resto del panel con una consulta auxiliar caída (B15). */}
      {members.isError ? (
        <p role="alert" className="mt-2 text-sm text-text-secondary">
          {errorKindText(members.error, ORG_MEMBERS_ERROR_KEYS, t, "errors.orgMembers.desconocido")}
        </p>
      ) : !members.data ? (
        <p className="mt-2 text-sm text-text-secondary">{t("entidad.guardia.onCallLoading")}</p>
      ) : null}
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
 * (`acknowledge`), y los ajustes de la entidad: teléfono de ayuda y
 * persona de guardia (`PATCH .../organizations/{id}/ {help_phone,
 * on_call_user}`, los dos de la misma lista blanca solo-titular). Cada
 * aviso enlaza a la ficha de la persona
 * (`/entidad/{slug}/personas/{userId}`) solo si
 * `user_display.is_member` y quien mira tiene la sección Personas
 * (`canOpenPersonSheet`); si no, un badge «No pertenece a la entidad» o
 * el nombre como texto (ver `HelpRequestCard`).
 */
export function GuardiaPanel({ orgId, slug, canOpenPersonSheet }: GuardiaPanelProps) {
  const t = useTranslations();
  const requests = usePendingHelpRequests(orgId);

  return (
    <div className="flex flex-col gap-4">
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
              <HelpRequestCard
                key={request.id}
                request={request}
                orgId={orgId}
                slug={slug}
                canOpenPersonSheet={canOpenPersonSheet}
              />
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-text-secondary">{t(NO_PHONE_NOTICE_KEY)}</p>
      </section>
    </div>
  );
}
