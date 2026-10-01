"use client";

/**
 * Roles de plataforma (tarea W5, `docs/SEGURIDAD_Y_MODERACION.md` §1):
 * listado (solo `superadmin`), conceder (buscador de cuentas por email/
 * username vía `GET /api/users/users/?search=` — ver
 * `components/plataforma/AccountPicker.tsx`; el id ya no se teclea) y
 * revocar (con confirmación, es una acción de alto impacto: quita acceso
 * a la plataforma). Una cuenta tiene un solo rol de plataforma: conceder
 * otro distinto sustituye al que tenía, así que antes se pide confirmación
 * diciendo qué rol se pierde (informe del panel, error 54).
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { AccountPicker } from "@/components/plataforma/AccountPicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import type { PickerOption } from "@/components/ui/SearchPicker";
import {
  useGrantPlatformRole,
  usePlatformRoles,
  useRevokePlatformRole,
  type PlatformRolesErrorKind,
} from "@/hooks/usePlatformRoles";
import type { PlatformRoleName } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

const ROLE_OPTIONS: PlatformRoleName[] = [
  "superadmin",
  "verifier",
  "moderator",
  "support",
  "sales_lead",
  "sales",
];
const ROLE_LABEL_KEYS: Record<PlatformRoleName, string> = {
  superadmin: "plataforma.roles.roleSuperadmin",
  verifier: "plataforma.roles.roleVerifier",
  moderator: "plataforma.roles.roleModerator",
  support: "plataforma.roles.roleSupport",
  sales_lead: "plataforma.roles.roleSalesLead",
  sales: "plataforma.roles.roleSales",
};

const ROLES_ERROR_KEYS: Record<PlatformRolesErrorKind, string> = {
  sin_acceso: "errors.platformRoles.sinAcceso",
  invalido: "errors.platformRoles.invalido",
  sin_permiso: "errors.platformRoles.sinPermiso",
  no_encontrado: "errors.platformRoles.noEncontrado",
  conflicto: "errors.platformRoles.conflicto",
  desconocido: "errors.platformRoles.desconocido",
};

const GRANT_ERROR_KEYS: Record<PlatformRolesErrorKind, string> = {
  ...ROLES_ERROR_KEYS,
  sin_permiso: "errors.platformRoles.sinPermisoConceder",
  desconocido: "errors.platformRoles.desconocidoConceder",
};

const REVOKE_ERROR_KEYS: Record<PlatformRolesErrorKind, string> = {
  ...ROLES_ERROR_KEYS,
  sin_permiso: "errors.platformRoles.sinPermisoRevocar",
  desconocido: "errors.platformRoles.desconocidoRevocar",
};

function GrantRoleForm() {
  const t = useTranslations();
  const grant = useGrantPlatformRole();
  const currentRoles = usePlatformRoles();
  const [replacing, setReplacing] = useState<{ account: string; current: PlatformRoleName } | null>(null);
  const [account, setAccount] = useState<PickerOption | null>(null);
  const [role, setRole] = useState<PlatformRoleName>("moderator");

  function doGrant() {
    if (!account) return;
    grant.mutate(
      { user: account.id, role },
      {
        onSuccess: () => {
          setAccount(null);
          setReplacing(null);
        },
        onError: () => setReplacing(null),
      },
    );
  }

  return (
    <Card title={t("plataforma.roles.grantTitle")}>
      <div className="mb-3 max-w-md">
        <AccountPicker
          id="roles-search"
          label={t("plataforma.roles.searchLabel")}
          value={account}
          onChange={setAccount}
        />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!account) return;
          // Un solo rol por cuenta: si ya tiene otro distinto, se avisa de
          // cuál se pierde antes de sustituirlo.
          const current = currentRoles.data?.find((entry) => entry.user === account.id)?.role;
          if (current && current !== role) {
            grant.reset();
            setReplacing({ account: account.label, current });
            return;
          }
          doGrant();
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div>
          <label htmlFor="roles-role" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.roles.roleLabel")}
          </label>
          <select
            id="roles-role"
            value={role}
            onChange={(event) => setRole(event.target.value as PlatformRoleName)}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          >
            {ROLE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(ROLE_LABEL_KEYS[value])}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={!account || grant.isPending}>
          {t("plataforma.roles.grantAction")}
        </Button>
      </form>
      {grant.isError ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {errorKindText(grant.error, GRANT_ERROR_KEYS, t, "errors.platformRoles.desconocidoConceder")}
        </p>
      ) : null}
      {grant.isSuccess ? <p className="mt-2 text-sm text-success">{t("plataforma.roles.grantSuccess")}</p> : null}
      <ConfirmDialog
        open={replacing !== null}
        title={t("plataforma.roles.replaceConfirmTitle")}
        description={
          replacing ? (
            <>
              {t("plataforma.roles.replaceConfirmDescription", {
                user: replacing.account,
                current: t(ROLE_LABEL_KEYS[replacing.current]),
                next: t(ROLE_LABEL_KEYS[role]),
              })}
            </>
          ) : null
        }
        confirmLabel={t("plataforma.roles.replaceConfirmAction")}
        pending={grant.isPending}
        onCancel={() => setReplacing(null)}
        onConfirm={doGrant}
      />
    </Card>
  );
}

export interface RolesPanelProps {
  /** Id de la cuenta que mira: revocarse a una misma lleva aviso propio. */
  currentUserId?: number;
}

export function RolesPanel({ currentUserId }: RolesPanelProps = {}) {
  const t = useTranslations();
  const roles = usePlatformRoles();
  const revoke = useRevokePlatformRole();
  const [toRevoke, setToRevoke] = useState<number | null>(null);
  const revokingSelf = toRevoke !== null && toRevoke === currentUserId;

  return (
    <div className="flex flex-col gap-4">
      <GrantRoleForm />

      <Card title={t("plataforma.roles.currentTitle")}>
        {roles.isError ? (
          <ErrorState
            title={t("plataforma.roles.loadError")}
            description={errorKindText(roles.error, ROLES_ERROR_KEYS, t, "errors.platformRoles.desconocido")}
          />
        ) : !roles.data ? (
          <p className="text-sm text-text-secondary">{t("common.loading")}</p>
        ) : roles.data.length === 0 ? (
          <EmptyState title={t("plataforma.roles.emptyTitle")} />
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {roles.data.map((entry) => (
              <li key={entry.user} className="flex items-center justify-between gap-2">
                <span>
                  {entry.username} (#{entry.user}) — {t(ROLE_LABEL_KEYS[entry.role])}
                </span>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    revoke.reset();
                    setToRevoke(entry.user);
                  }}
                >
                  {t("plataforma.roles.revokeAction")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={toRevoke !== null}
        title={t("plataforma.roles.revokeConfirmTitle")}
        description={
          <>
            {revokingSelf ? (
              <strong className="block">{t("plataforma.roles.revokeSelfWarning")}</strong>
            ) : null}
            {t("plataforma.roles.revokeConfirmDescription")}
            {revoke.isError ? (
              <p role="alert" className="mt-2 text-sm text-error">
                {errorKindText(revoke.error, REVOKE_ERROR_KEYS, t, "errors.platformRoles.desconocidoRevocar")}
              </p>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.roles.revokeAction")}
        pending={revoke.isPending}
        onCancel={() => {
          revoke.reset();
          setToRevoke(null);
        }}
        onConfirm={() => {
          if (toRevoke === null) return;
          revoke.mutate(toRevoke, { onSuccess: () => setToRevoke(null) });
        }}
      />
    </div>
  );
}
