"use client";

/**
 * Ficha de una cuenta del admin de plataforma (bloque 1, 2026-09-26).
 *
 * Dos fuentes, porque el backend no tiene una ficha de cuenta para staff:
 * - **Cuenta** (correo, usuario, alta, verificación, entidades, estado):
 *   `usePlatformAccount`, que la localiza en el listado por el correo que
 *   trae el enlace (`?email=`). Sin correo en la URL no hay forma de
 *   pedirla, y la ficha lo dice en vez de inventar un estado.
 * - **Perfil público** (alias, municipio, nivel de verificación):
 *   `usePlatformUserProfile`, `GET /api/users/{id}/`, que responde 404
 *   para una cuenta suspendida o borrada.
 *
 * Acciones (todas con `ConfirmDialog` y el error **dentro** del diálogo,
 * patrón M6-M10 del panel): desactivar/reactivar y borrar; más «Enviar
 * restablecimiento de contraseña» (necesita el correo). Ni desactivar ni
 * borrar se ofrecen sobre la propia cuenta: el backend rechaza el borrado
 * (400) y desactivarse a uno mismo cierra la sesión sin vuelta atrás desde
 * el panel. Nunca documentos, notas ni biografía (spec, bloque 1).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { usePlatformRoles } from "@/hooks/usePlatformRoles";
import {
  useDeletePlatformUser,
  usePlatformUserProfile,
  useSendPasswordReset,
  useSetPlatformUserActive,
  type PlatformProfileErrorKind,
} from "@/hooks/usePlatformUser";
import { usePlatformAccount, type PlatformUsersErrorKind } from "@/hooks/usePlatformUsers";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { PLATFORM_USER_MUTATION_ERROR_KEYS } from "./NuevaCuentaDialog";
import { PLATFORM_ROLE_LABEL_KEYS, accountDisplayName, formatAccountDate } from "./UsuariosTable";

const VERIFICATION_LEVEL_KEYS: Record<number, string> = {
  0: "entidad.personaFicha.verificationLevel.unverified",
  1: "entidad.personaFicha.verificationLevel.phoneVerified",
  2: "entidad.personaFicha.verificationLevel.adult",
  3: "entidad.personaFicha.verificationLevel.fullIdentity",
};

const ACCOUNT_ERROR_KEYS: Record<PlatformUsersErrorKind, string> = {
  sin_acceso: "errors.platformUsers.sinAcceso",
  pagina_inexistente: "errors.platformUsers.desconocido",
  desconocido: "errors.platformUsers.desconocido",
};

const PROFILE_ERROR_KEYS: Record<PlatformProfileErrorKind, string> = {
  no_encontrado: "errors.platformProfile.noEncontrado",
  desconocido: "errors.platformProfile.desconocido",
};

export interface UsuarioDetailProps {
  userId: string;
  /** Correo con el que se localiza la cuenta (`?email=` del enlace del listado). */
  email: string | null;
  /** La cuenta es la de quien mira. */
  isSelf: boolean;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-medium text-text-form">{label}</dt>
      <dd className="text-text-base">{children}</dd>
    </div>
  );
}

export function UsuarioDetail({ userId, email, isSelf }: UsuarioDetailProps) {
  const t = useTranslations();
  const router = useRouter();
  const account = usePlatformAccount(userId, email);
  const profile = usePlatformUserProfile(userId);
  const roles = usePlatformRoles();
  const setActive = useSetPlatformUserActive(userId);
  const remove = useDeletePlatformUser(userId);
  const passwordReset = useSendPasswordReset();
  const [confirming, setConfirming] = useState<"active" | "delete" | null>(null);

  const role = roles.data?.find((entry) => String(entry.user) === String(userId))?.role;
  const data = account.data?.account ?? null;
  const isActive = account.data?.isActive ?? null;

  function levelText(level: number): string {
    const key = VERIFICATION_LEVEL_KEYS[level];
    return key ? t(key) : String(level);
  }

  function closeConfirm() {
    setActive.reset();
    remove.reset();
    setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title={t("plataforma.usuarioFicha.accountTitle")}>
        {!email ? (
          <p className="text-sm text-text-secondary">{t("plataforma.usuarioFicha.noEmailHint")}</p>
        ) : account.isError ? (
          <ErrorState
            title={t("plataforma.usuarioFicha.accountLoadError")}
            description={errorKindText(account.error, ACCOUNT_ERROR_KEYS, t, "errors.platformUsers.desconocido")}
          />
        ) : !account.data ? (
          <p className="text-sm text-text-secondary">{t("common.loading")}</p>
        ) : !data ? (
          <EmptyState title={t("plataforma.usuarioFicha.accountNotFound")} />
        ) : (
          <dl className="flex flex-col gap-1 text-sm">
            <Row label={t("plataforma.usuarios.nameHeader")}>{accountDisplayName(data)}</Row>
            <Row label={t("plataforma.usuarios.emailHeader")}>{data.email}</Row>
            <Row label={t("plataforma.usuarios.usernameHeader")}>{data.username || "—"}</Row>
            <Row label={t("plataforma.usuarios.createdHeader")}>{formatAccountDate(data.created_at)}</Row>
            <Row label={t("plataforma.usuarios.stateHeader")}>
              <span className="flex flex-wrap gap-1">
                <Badge tone={isActive ? "success" : "error"}>
                  {isActive ? t("plataforma.usuarios.activeBadge") : t("plataforma.usuarios.inactiveBadge")}
                </Badge>
                <Badge tone={data.is_verified ? "success" : "neutral"}>
                  {data.is_verified ? t("plataforma.usuarios.verifiedBadge") : t("plataforma.usuarios.unverifiedBadge")}
                </Badge>
              </span>
            </Row>
            <Row label={t("plataforma.usuarios.roleHeader")}>{role ? t(PLATFORM_ROLE_LABEL_KEYS[role]) : "—"}</Row>
          </dl>
        )}
      </Card>

      <Card title={t("plataforma.usuarioFicha.profileTitle")}>
        {profile.isError ? (
          <p className="text-sm text-text-secondary">
            {errorKindText(profile.error, PROFILE_ERROR_KEYS, t, "errors.platformProfile.desconocido")}
          </p>
        ) : !profile.data ? (
          <p className="text-sm text-text-secondary">{t("common.loading")}</p>
        ) : (
          <dl className="flex flex-col gap-1 text-sm">
            <Row label={t("plataforma.usuarioFicha.publicNameLabel")}>{profile.data.public_name}</Row>
            <Row label={t("plataforma.usuarioFicha.placeLabel")}>
              {profile.data.place
                ? t("plataforma.sede.resolved", { name: profile.data.place.name, province: profile.data.place.prov_name })
                : "—"}
            </Row>
            <Row label={t("plataforma.usuarioFicha.verificationLabel")}>
              {levelText(profile.data.verification_level)}
            </Row>
          </dl>
        )}
      </Card>

      {data ? (
        <Card title={t("plataforma.usuarioFicha.membershipsTitle")}>
          {data.org_memberships.length === 0 ? (
            <p className="text-sm text-text-secondary">{t("plataforma.usuarioFicha.noMemberships")}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {data.org_memberships.map((membership) => (
                <li key={membership.organization_id}>
                  <Link
                    href={`/plataforma/entidades/${membership.organization_id}`}
                    className="font-medium text-primary-700 underline"
                  >
                    {membership.organization_name}
                  </Link>
                  {" · "}
                  {membership.role}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card title={t("plataforma.usuarioFicha.actionsTitle")}>
        <div className="flex flex-wrap gap-2">
          {data && isActive !== null && !isSelf ? (
            <Button type="button" variant="secondary" onClick={() => setConfirming("active")}>
              {isActive ? t("plataforma.usuarioFicha.deactivate") : t("plataforma.usuarioFicha.reactivate")}
            </Button>
          ) : null}
          {data ? (
            <Button
              type="button"
              variant="secondary"
              disabled={passwordReset.isPending}
              onClick={() => passwordReset.mutate(data.email)}
            >
              {t("plataforma.usuarioFicha.sendPasswordReset")}
            </Button>
          ) : null}
          <Link
            href={
              email
                ? `/plataforma/bloqueos?user=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}`
                : `/plataforma/bloqueos?user=${encodeURIComponent(userId)}`
            }
            className="inline-flex min-h-8 items-center rounded-md border border-border bg-white px-3 py-1 text-sm font-medium text-primary-700 underline"
          >
            {t("plataforma.usuarioFicha.viewBlocks")}
          </Link>
          {!isSelf ? (
            <Button type="button" variant="danger" onClick={() => setConfirming("delete")}>
              {t("plataforma.usuarioFicha.delete")}
            </Button>
          ) : null}
        </div>
        {isSelf ? <p className="mt-2 text-xs text-text-secondary">{t("plataforma.usuarioFicha.selfHint")}</p> : null}
        {passwordReset.isSuccess ? (
          <p role="status" className="mt-2 text-sm text-success">
            {t("plataforma.usuarioFicha.passwordResetSent", { email: data?.email ?? "" })}
          </p>
        ) : null}
        {passwordReset.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {errorKindText(
              passwordReset.error,
              PLATFORM_USER_MUTATION_ERROR_KEYS,
              t,
              "errors.platformUserMutation.desconocido",
            )}
          </p>
        ) : null}
      </Card>

      <ConfirmDialog
        open={confirming === "active"}
        title={isActive ? t("plataforma.usuarioFicha.deactivateTitle") : t("plataforma.usuarioFicha.reactivateTitle")}
        description={
          <>
            <span>
              {isActive
                ? t("plataforma.usuarioFicha.deactivateDescription")
                : t("plataforma.usuarioFicha.reactivateDescription")}
            </span>
            {setActive.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(setActive.error, PLATFORM_USER_MUTATION_ERROR_KEYS, t, "errors.platformUserMutation.desconocido")}
              </span>
            ) : null}
          </>
        }
        confirmLabel={isActive ? t("plataforma.usuarioFicha.deactivate") : t("plataforma.usuarioFicha.reactivate")}
        pending={setActive.isPending}
        onCancel={closeConfirm}
        onConfirm={() => setActive.mutate(!isActive, { onSuccess: () => setConfirming(null) })}
      />

      <ConfirmDialog
        open={confirming === "delete"}
        title={t("plataforma.usuarioFicha.deleteTitle")}
        description={
          <>
            <span>{t("plataforma.usuarioFicha.deleteDescription")}</span>
            {remove.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(remove.error, PLATFORM_USER_MUTATION_ERROR_KEYS, t, "errors.platformUserMutation.desconocido")}
              </span>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.usuarioFicha.delete")}
        pending={remove.isPending}
        onCancel={closeConfirm}
        onConfirm={() => remove.mutate(undefined, { onSuccess: () => router.push("/plataforma/usuarios") })}
      />
    </div>
  );
}
