"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAssignReferent } from "@/hooks/useAssignReferent";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { usePerson } from "@/hooks/usePerson";
import { usePersonSupport } from "@/hooks/usePersonSupport";
import { isAllowedImageSrc } from "@/lib/config/imagePatterns";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeForUseLocale } from "@/lib/i18n/locale";
import { presetPeriod } from "@/lib/metrics/period";
import { relationshipLabelKey } from "@/lib/support/relationshipLabel";

export interface PersonSheetProps {
  orgId: number | string;
  userId: number | string;
  /** Solo `titular`/`moderador` (`docs/PANEL.md` §1.1, matriz de `entities/permissions.py`). */
  canAssignReferent: boolean;
  /**
   * Solo `referente` (`docs/PANEL.md` §14.5): quien no lo es nunca dispara
   * la petición (`enabled: isReferent`). El rol `referente` es condición
   * necesaria en las dos puntas — una `OrgMembership` tiene un solo rol, y
   * un `titular`/`moderador` que además tuviera la `Reference` hacia esta
   * persona tampoco vería la sección: el backend también exige el rol
   * vigente, así que ni siquiera llegaría a un 404/403 de esa ruta.
   */
  isReferent: boolean;
}

const PERSON_SUPPORT_ERROR_KEYS = {
  sin_acceso: "errors.personSupport.sinAcceso",
  desconocido: "errors.personSupport.desconocido",
} as const;

const ASSIGN_REFERENT_ERROR_KEYS = {
  invalido: "errors.assignReferent.invalido",
  sin_permiso: "errors.assignReferent.sinPermiso",
  desconocido: "errors.assignReferent.desconocido",
} as const;

const PERSON_ERROR_KEYS = {
  periodo_invalido: "errors.person.periodoInvalido",
  sin_acceso: "errors.person.sinAcceso",
  desconocido: "errors.person.desconocido",
} as const;

/**
 * Sección «Red de apoyo» (`docs/PANEL.md` §14.5), visible solo para el
 * referente asignado. Invariante 9: solo `public_name`, `relationship` y
 * el flag de avisos — nunca contacto.
 */
function SupportNetworkSection({
  orgId,
  userId,
  isReferent,
}: {
  orgId: number | string;
  userId: number | string;
  isReferent: boolean;
}) {
  const support = usePersonSupport(Number(orgId), String(userId), isReferent);
  const t = useTranslations("entidad.personaFicha");
  const tAll = useTranslations();

  if (!isReferent) return null;

  // Mientras la consulta está en vuelo no se pinta nada, ni la propia
  // cabecera: spec §7 / decisión 1 exigen que un 404 no dé ningún
  // parpadeo visible (montar la sección y retirarla al llegar el 404).
  if (support.isPending) return null;

  // 404/403 (`kind: 'sin_acceso'`): quien mira no es el referente real de
  // esta persona (o el backend lo trata como si no existiera). La
  // sección no se pinta en absoluto, ni con un mensaje: revelar que
  // existe una red de apoyo sería en sí mismo un dato.
  if (support.isError && support.error.kind === "sin_acceso") {
    return null;
  }

  return (
    <section aria-labelledby="red-apoyo-heading">
      <h2 id="red-apoyo-heading" className="mb-2 text-lg font-semibold text-text-base">
        {t("supportHeading")}
      </h2>
      {support.isError ? (
        <ErrorState
          title={t("supportLoadErrorTitle")}
          description={errorKindText(
            support.error,
            PERSON_SUPPORT_ERROR_KEYS,
            tAll,
            "errors.personSupport.desconocido",
          )}
        />
      ) : support.data.length === 0 ? (
        <EmptyState title={t("noSupportNetwork")} />
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {support.data.map((row) => {
              const key = relationshipLabelKey(row.relationship);
              const relationship = key ? tAll(key) : row.relationship;
              return (
                <li key={row.supporter.id} className="text-sm text-text-base">
                  {row.supporter.public_name} · {relationship} ·{" "}
                  {row.notify_on_help ? t("notifyYes") : t("notifyNo")}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-sm text-text-secondary">{t("supportFooter")}</p>
        </>
      )}
    </section>
  );
}

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(localeForUseLocale(locale), { dateStyle: "short", timeStyle: "short" });
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(localeForUseLocale(locale));
}

/**
 * `PersonDetail.verification_level` es un entero, no una cadena
 * (`docs/PANEL.md` §3.3): los niveles son los de `LevelEnum` en
 * `lib/api/types.generated.ts` (`1` teléfono verificado, `2` mayoría de
 * edad, `3` identidad completa), y `0` es «sin verificar» (ninguna
 * `VerificationReference`). Un nivel que el panel no conozca se pinta
 * como número en vez de quedarse en blanco.
 */
const VERIFICATION_LEVEL_KEYS: Record<number, string> = {
  0: "entidad.personaFicha.verificationLevel.unverified",
  1: "entidad.personaFicha.verificationLevel.phoneVerified",
  2: "entidad.personaFicha.verificationLevel.adult",
  3: "entidad.personaFicha.verificationLevel.fullIdentity",
};

const ATTENDANCE_STATUS_KEYS: Record<string, string> = {
  registered: "entidad.attendanceStatus.registered",
  waitlisted: "entidad.attendanceStatus.waitlisted",
  cancelled: "entidad.attendanceStatus.cancelled",
  attended: "entidad.attendanceStatus.attended",
  no_show: "entidad.attendanceStatus.noShow",
};

/**
 * Carry-over de la tarea W3 cerrado en W6 (pregunta 13 de
 * `docs/preguntas-diseno.md`): antes pedía el id de usuario a mano
 * porque no había forma de nombrar al equipo con rol `referente`; ahora
 * `useOrgMembers` (`GET /api/organizations/{id}/members/`) lleva
 * `public_name` (`docs/PANEL.md` §10.3, tarea backend P7), así que el
 * formulario es un desplegable con nombre, igual que
 * `components/people/AddPersonDialog.tsx`.
 */
function AssignReferentForm({
  orgId,
  userId,
}: {
  orgId: number | string;
  userId: number | string;
}) {
  const [referentUserId, setReferentUserId] = useState("");
  const members = useOrgMembers(orgId);
  const assignReferent = useAssignReferent(orgId);
  const t = useTranslations("entidad.personaFicha");
  const tPeople = useTranslations("people");
  const tAll = useTranslations();

  const referentes = (members.data ?? []).filter((member) => member.role === "referente");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(referentUserId);
    if (!referentUserId || Number.isNaN(parsed)) return;
    assignReferent.mutate({ userId: Number(userId), referentUserId: parsed });
  }

  return (
    <Card title={t("assignReferentTitle")}>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="referent-user-id" className="mb-1 block text-sm font-medium text-text-form">
            {t("referentSelectLabel")}
          </label>
          <select
            id="referent-user-id"
            value={referentUserId}
            onChange={(event) => setReferentUserId(event.target.value)}
            aria-describedby={members.isError ? "referent-user-id-error" : undefined}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          >
            <option value="">{t("selectAPerson")}</option>
            {referentes.map((member) => (
              <option key={member.user} value={member.user}>
                {member.public_name}
              </option>
            ))}
          </select>
          {members.isError ? (
            <p id="referent-user-id-error" role="alert" className="mt-1 text-xs text-error">
              {tPeople("referentsLoadError")}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={assignReferent.isPending}>
          {assignReferent.isPending ? t("assigning") : t("assignReferentTitle")}
        </Button>
      </form>
      {assignReferent.isSuccess ? <p className="mt-2 text-sm text-success">{t("assigned")}</p> : null}
      {assignReferent.isError ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {errorKindText(
            assignReferent.error,
            ASSIGN_REFERENT_ERROR_KEYS,
            tAll,
            "errors.assignReferent.desconocido",
          )}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * Ficha operativa de persona (`docs/PANEL.md` §3.3): alias, foto, alta,
 * referente, comunidades de la entidad, actividades del periodo con su
 * estado de asistencia y próxima actividad. **Nunca** email, teléfono,
 * documentos ni notas — no están en `PersonDetail` (invariante 9).
 */
export function PersonSheet({ orgId, userId, canAssignReferent, isReferent }: PersonSheetProps) {
  const period = presetPeriod("mes");
  const person = usePerson(orgId, userId, period);
  const t = useTranslations("entidad.personaFicha");
  const tCommon = useTranslations("common");
  const tPersonas = useTranslations("entidad.personas");
  const tAll = useTranslations();
  const locale = useLocale();

  if (person.isError && person.error.kind === "sin_acceso") {
    return <EmptyState title={tCommon("noAccess")} description={t("sinAccesoDescription")} />;
  }

  if (person.isError) {
    return (
      <ErrorState
        title={t("loadErrorTitle")}
        description={errorKindText(person.error, PERSON_ERROR_KEYS, tAll, "errors.person.desconocido")}
      />
    );
  }

  if (!person.data) {
    return <p className="text-sm text-text-secondary">{t("loading")}</p>;
  }

  const data = person.data;
  const verificationLevelKey = VERIFICATION_LEVEL_KEYS[data.verification_level];
  const verificationLevelText = verificationLevelKey ? tAll(verificationLevelKey) : data.verification_level;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-4">
          {/* Mismo guard que las cabeceras de entidad/paraguas: una foto
              servida desde un host que no está en `images.remotePatterns`
              haría lanzar a `next/image` y tumbaría la ficha entera
              (`lib/config/imagePatterns.ts::isAllowedImageSrc`). */}
          {data.photo && isAllowedImageSrc(data.photo) ? (
            <Image
              src={data.photo}
              alt=""
              width={56}
              height={56}
              className="rounded-full bg-border-light object-cover"
            />
          ) : null}
          <div>
            <p className="text-lg font-semibold text-text-base">{data.public_name}</p>
            <p className="text-sm text-text-secondary">
              {t("headerInfo", { date: formatDate(data.joined_at, locale), level: verificationLevelText })}
            </p>
            <p className="text-sm text-text-secondary">
              {t("referentLine", { name: data.referent ? data.referent.public_name : tPersonas("noReferent") })}
            </p>
          </div>
        </div>
      </Card>

      {canAssignReferent ? <AssignReferentForm orgId={orgId} userId={userId} /> : null}

      <section aria-labelledby="comunidades-persona-heading">
        <h2 id="comunidades-persona-heading" className="mb-2 text-lg font-semibold text-text-base">
          {t("communitiesHeading")}
        </h2>
        {data.communities.length === 0 ? (
          <EmptyState title={t("noCommunities")} />
        ) : (
          <ul className="flex flex-col gap-1">
            {data.communities.map((community) => (
              <li key={community.id} className="text-sm text-text-base">
                {community.name} <Badge>{community.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="actividades-persona-heading">
        <h2 id="actividades-persona-heading" className="mb-2 text-lg font-semibold text-text-base">
          {t("eventsHeading")}
        </h2>
        {data.events.length === 0 ? (
          <EmptyState title={t("noEvents")} />
        ) : (
          <ul className="flex flex-col gap-1">
            {data.events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-2 text-sm text-text-base">
                <span>
                  {event.title} · {formatDateTime(event.starts_at, locale)}
                </span>
                <Badge>
                  {ATTENDANCE_STATUS_KEYS[event.attendance_status]
                    ? tAll(ATTENDANCE_STATUS_KEYS[event.attendance_status])
                    : event.attendance_status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="proxima-actividad-heading">
        <h2 id="proxima-actividad-heading" className="mb-2 text-lg font-semibold text-text-base">
          {t("nextEventHeading")}
        </h2>
        {data.next_event ? (
          <p className="text-sm text-text-base">
            {data.next_event.title} · {formatDateTime(data.next_event.starts_at, locale)}
          </p>
        ) : (
          <EmptyState title={t("noNextEvent")} />
        )}
      </section>

      <SupportNetworkSection orgId={orgId} userId={userId} isReferent={isReferent} />
    </div>
  );
}
