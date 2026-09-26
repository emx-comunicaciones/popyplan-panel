"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import {
  useCloseEnrollment,
  useCreateEnrollment,
  useEnrollments,
  useUpdateEnrollment,
} from "@/hooks/useProgramEnrollments";
import type { EnrollmentRow, EnrollmentUpdateInput, TrackingType } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeForUseLocale } from "@/lib/i18n/locale";
import {
  enrollmentStatusKey,
  isOpenEnrollment,
  labelOrRaw,
  trackingTypeKey,
  trackingTypeText,
} from "@/lib/tracking/labels";

const ENROLLMENTS_ERROR_KEYS = {
  sin_acceso: "errors.enrollments.sinAcceso",
  desconocido: "errors.enrollments.desconocido",
} as const;

const ENROLLMENT_MUTATION_ERROR_KEYS = {
  invalido: "errors.enrollmentMutation.invalido",
  no_encontrado: "errors.enrollmentMutation.noEncontrado",
  conflicto: "errors.enrollmentMutation.conflicto",
  desconocido: "errors.enrollmentMutation.desconocido",
} as const;

const TRACKING_TYPES: TrackingType[] = ["alcohol", "drugs", "gambling", "other"];

export interface TrackingEnrollmentSectionProps {
  orgId: number | string;
  userId: number | string;
  personName: string;
}

/**
 * Bloque «Programa de seguimiento» de la ficha de persona para
 * `titular`/`moderador` de una entidad con el servicio encendido
 * (`docs/PANEL.md` §18.3). Solo estado y configuración de la inscripción:
 * el backend no devuelve datos de seguimiento por esta vía, y titular y
 * moderador nunca los ven. Quien no es titular/moderador ni siquiera monta
 * el componente (lo decide la página), y con un 404 del backend (servicio
 * apagado mientras tanto) no se pinta nada.
 */
export function TrackingEnrollmentSection({ orgId, userId, personName }: TrackingEnrollmentSectionProps) {
  const enrollments = useEnrollments(orgId, { user: userId });
  const closeEnrollment = useCloseEnrollment(orgId);
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [closing, setClosing] = useState(false);
  const t = useTranslations("entidad.seguimiento");
  const tAll = useTranslations();
  const locale = useLocale();

  if (enrollments.isError && enrollments.error.kind === "sin_acceso") return null;

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(localeForUseLocale(locale));
  }

  let body: ReactNode;
  let open: EnrollmentRow | undefined;
  if (enrollments.isError) {
    body = (
      <ErrorState
        title={t("loadErrorTitle")}
        description={errorKindText(enrollments.error, ENROLLMENTS_ERROR_KEYS, tAll, "errors.enrollments.desconocido")}
      />
    );
  } else if (!enrollments.data) {
    body = <p className="text-sm text-text-secondary">{t("loading")}</p>;
  } else {
    open = enrollments.data.find((row) => isOpenEnrollment(row.status));
    // Sin inscripción abierta, la más reciente cerrada (si la hay) da contexto.
    const last = [...enrollments.data].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    body = open ? (
      <>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-text-secondary">{t("statusLabel")}</dt>
          <dd>
            <Badge tone={open.status === "active" ? "success" : "neutral"}>
              {labelOrRaw(enrollmentStatusKey(open.status), open.status, tAll)}
            </Badge>
          </dd>
          <dt className="text-text-secondary">{t("typeLabel")}</dt>
          <dd className="text-text-base">{trackingTypeText(open.tracking_type, open.tracking_label, tAll)}</dd>
          <dt className="text-text-secondary">{t("referentLabel")}</dt>
          <dd className="text-text-base">{open.referent?.public_name ?? t("noReferent")}</dd>
          <dt className="text-text-secondary">{t("createdLabel")}</dt>
          <dd className="text-text-base">{formatDate(open.created_at)}</dd>
          {open.accepted_at ? (
            <>
              <dt className="text-text-secondary">{t("acceptedLabel")}</dt>
              <dd className="text-text-base">{formatDate(open.accepted_at)}</dd>
            </>
          ) : null}
        </dl>
        {open.status === "pending" ? <p className="mt-2 text-sm text-text-secondary">{t("pendingHint")}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setDialog("edit")}>
            {t("editAction")}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              closeEnrollment.reset();
              setClosing(true);
            }}
          >
            {t("closeAction")}
          </Button>
        </div>
      </>
    ) : (
      <>
        <p className="text-sm text-text-base">{t("notEnrolled")}</p>
        {last ? (
          <p className="text-sm text-text-secondary">
            {t("lastEnrollment", {
              status: labelOrRaw(enrollmentStatusKey(last.status), last.status, tAll),
              date: formatDate(last.ended_at ?? last.created_at),
            })}
          </p>
        ) : null}
        <div className="mt-3">
          <Button type="button" onClick={() => setDialog("create")}>
            {t("enrollAction")}
          </Button>
        </div>
      </>
    );
  }

  return (
    <Card title={t("blockTitle")}>
      {body}
      {dialog ? (
        <EnrollmentDialog
          key={dialog === "edit" && open ? `edit-${open.id}` : "create"}
          orgId={orgId}
          userId={userId}
          editing={dialog === "edit" ? (open ?? null) : null}
          onClose={() => setDialog(null)}
        />
      ) : null}
      <ConfirmDialog
        open={closing && open !== undefined}
        title={t("closeConfirmTitle")}
        description={
          <div className="flex flex-col gap-2">
            <p>{t("closeConfirmDescription", { name: personName })}</p>
            {closeEnrollment.isError ? (
              <p role="alert" className="text-error">
                {errorKindText(
                  closeEnrollment.error,
                  ENROLLMENT_MUTATION_ERROR_KEYS,
                  tAll,
                  "errors.enrollmentMutation.desconocido",
                )}
              </p>
            ) : null}
          </div>
        }
        confirmLabel={t("closeAction")}
        pending={closeEnrollment.isPending}
        onConfirm={() => {
          if (!open) return;
          closeEnrollment.mutate(open.id, { onSuccess: () => setClosing(false) });
        }}
        onCancel={() => {
          closeEnrollment.reset();
          setClosing(false);
        }}
      />
    </Card>
  );
}

/**
 * Alta (`editing === null`) o cambio de tipo/referente de una inscripción
 * abierta. El referente es una **`OrgMembership`** con rol `referente`: se
 * manda `m.id`, no `m.user` (`EnrollmentRow.referent.id` es también el id
 * de la membresía). La lista sale de `useOrgMembers`, igual que «Asignar
 * referente»; es solo-titular en el backend, así que a un moderador le
 * llega vacía con aviso — puede dar de alta sin referente, y al editar se
 * conserva siempre el referente actual como opción.
 */
function EnrollmentDialog({
  orgId,
  userId,
  editing,
  onClose,
}: {
  orgId: number | string;
  userId: number | string;
  editing: EnrollmentRow | null;
  onClose: () => void;
}) {
  const t = useTranslations("entidad.seguimiento");
  const tPeople = useTranslations("people");
  const tAll = useTranslations();
  const members = useOrgMembers(orgId);
  const createEnrollment = useCreateEnrollment(orgId);
  const updateEnrollment = useUpdateEnrollment(orgId);
  const mutation = editing ? updateEnrollment : createEnrollment;

  const initialType = (editing?.tracking_type ?? "alcohol") as TrackingType;
  const initialLabel = editing?.tracking_label ?? "";
  const initialReferent = editing?.referent ? String(editing.referent.id) : "";
  const [trackingType, setTrackingType] = useState<TrackingType>(initialType);
  const [trackingLabel, setTrackingLabel] = useState(initialLabel);
  const [referent, setReferent] = useState(initialReferent);

  const referentes = (members.data ?? []).filter((member) => member.role === "referente");
  const currentMissing =
    editing?.referent && !referentes.some((member) => String(member.id) === initialReferent);
  const needsLabel = trackingType === "other";
  const canSubmit = !mutation.isPending && (!needsLabel || trackingLabel.trim() !== "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    const referentValue = referent ? Number(referent) : null;
    const label = needsLabel ? trackingLabel.trim() : "";
    if (editing) {
      const changes: EnrollmentUpdateInput = {};
      if (trackingType !== initialType || label !== initialLabel) {
        changes.tracking_type = trackingType;
        changes.tracking_label = label;
      }
      if (referent !== initialReferent) changes.referent = referentValue;
      updateEnrollment.mutate({ enrollmentId: editing.id, changes }, { onSuccess: onClose });
    } else {
      createEnrollment.mutate(
        {
          user_id: Number(userId),
          tracking_type: trackingType,
          ...(needsLabel ? { tracking_label: label } : {}),
          ...(referentValue !== null ? { referent: referentValue } : {}),
        },
        { onSuccess: onClose },
      );
    }
  }

  const titleId = "tracking-enrollment-dialog-title";
  return (
    <Dialog
      open
      titleId={titleId}
      title={editing ? t("editDialogTitle") : t("enrollDialogTitle")}
      onClose={onClose}
      pending={mutation.isPending}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {editing ? null : <p className="text-sm text-text-secondary">{t("enrollDialogHint")}</p>}
        <div>
          <label htmlFor="tracking-type" className="mb-1 block text-sm font-medium text-text-form">
            {t("typeFieldLabel")}
          </label>
          <select
            id="tracking-type"
            value={trackingType}
            onChange={(event) => setTrackingType(event.target.value as TrackingType)}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          >
            {TRACKING_TYPES.map((type) => (
              <option key={type} value={type}>
                {labelOrRaw(trackingTypeKey(type), type, tAll)}
              </option>
            ))}
          </select>
        </div>
        {needsLabel ? (
          <div>
            <label htmlFor="tracking-label" className="mb-1 block text-sm font-medium text-text-form">
              {t("labelFieldLabel")}
            </label>
            <input
              id="tracking-label"
              value={trackingLabel}
              maxLength={80}
              onChange={(event) => setTrackingLabel(event.target.value)}
              aria-describedby="tracking-label-hint"
              className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            />
            <p id="tracking-label-hint" className="mt-1 text-xs text-text-secondary">
              {t("labelFieldHint")}
            </p>
          </div>
        ) : null}
        <div>
          <label htmlFor="tracking-referent" className="mb-1 block text-sm font-medium text-text-form">
            {t("referentFieldLabel")}
          </label>
          <select
            id="tracking-referent"
            value={referent}
            onChange={(event) => setReferent(event.target.value)}
            aria-describedby={members.isError ? "tracking-referent-error" : undefined}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          >
            <option value="">{t("noReferentOption")}</option>
            {currentMissing && editing?.referent ? (
              <option value={String(editing.referent.id)}>{editing.referent.public_name}</option>
            ) : null}
            {referentes.map((member) => (
              <option key={member.id} value={String(member.id)}>
                {member.public_name}
              </option>
            ))}
          </select>
          {members.isError ? (
            <p id="tracking-referent-error" role="alert" className="mt-1 text-xs text-error">
              {tPeople("referentsLoadError")}
            </p>
          ) : null}
        </div>
        {mutation.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(mutation.error, ENROLLMENT_MUTATION_ERROR_KEYS, tAll, "errors.enrollmentMutation.desconocido")}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onClose}>
            {tAll("common.cancel")}
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {mutation.isPending ? t("saving") : editing ? tAll("common.save") : t("enrollSubmit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
