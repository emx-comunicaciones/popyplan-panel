"use client";

/**
 * Listado de cuentas del admin de plataforma (bloque 1, 2026-09-26):
 * `GET /api/users/users/` con búsqueda (con retardo), estado y
 * verificación, paginado de verdad (20 por página, más recientes
 * primero). «Nueva cuenta» abre `NuevaCuentaDialog`.
 *
 * La columna «Estado» solo dice algo cuando el filtro «Estado» lo fija:
 * el backend no sirve `is_active` por fila (ver
 * `hooks/usePlatformUsers.ts`). El rol de plataforma sale del listado de
 * roles vigentes (`usePlatformRoles`, una sola petición sin paginar), no
 * de una petición por fila.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePlatformRoles } from "@/hooks/usePlatformRoles";
import { usePlatformUsers, type PlatformUsersErrorKind } from "@/hooks/usePlatformUsers";
import type { PlatformAccount, PlatformRoleName } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { activeLanguage, localeFor } from "@/lib/i18n/locale";

import { NuevaCuentaDialog } from "./NuevaCuentaDialog";

type TriState = "" | "true" | "false";

const USERS_ERROR_KEYS: Record<PlatformUsersErrorKind, string> = {
  sin_acceso: "errors.platformUsers.sinAcceso",
  pagina_inexistente: "errors.platformUsers.paginaInexistente",
  desconocido: "errors.platformUsers.desconocido",
};

export const PLATFORM_ROLE_LABEL_KEYS: Record<PlatformRoleName, string> = {
  superadmin: "plataforma.roles.roleSuperadmin",
  verifier: "plataforma.roles.roleVerifier",
  moderator: "plataforma.roles.roleModerator",
  support: "plataforma.roles.roleSupport",
};

export function accountDisplayName(account: PlatformAccount): string {
  const full = `${account.first_name} ${account.last_name}`.trim();
  return full || account.profile.public_name || account.username || account.email;
}

export function accountHref(account: Pick<PlatformAccount, "id" | "email">): string {
  return `/plataforma/usuarios/${account.id}?email=${encodeURIComponent(account.email)}`;
}

export function formatAccountDate(iso: string): string {
  return new Date(iso).toLocaleDateString(localeFor(activeLanguage()));
}

function triToBool(value: TriState): boolean | undefined {
  return value === "" ? undefined : value === "true";
}

export function UsuariosTable() {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<TriState>("");
  const [verified, setVerified] = useState<TriState>("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const debouncedSearch = useDebouncedValue(search);
  const users = usePlatformUsers({
    search: debouncedSearch || undefined,
    isActive: triToBool(active),
    isVerified: triToBool(verified),
    page,
  });
  const roles = usePlatformRoles();
  const roleByUser = new Map<number, PlatformRoleName>((roles.data ?? []).map((entry) => [entry.user, entry.role]));

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Una página que se queda vacía (borrar la última cuenta de ella) da 404:
  // se vuelve a la primera en vez de dejar un error sin salida.
  useEffect(() => {
    if (users.error?.kind === "pagina_inexistente" && page > 1) setPage(1);
  }, [users.error, page]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="usuarios-search" className="mb-1 block text-sm font-medium text-text-form">
              {t("plataforma.usuarios.searchLabel")}
            </label>
            <input
              id="usuarios-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            />
          </div>
          <div>
            <label htmlFor="usuarios-active" className="mb-1 block text-sm font-medium text-text-form">
              {t("plataforma.usuarios.activeLabel")}
            </label>
            <select
              id="usuarios-active"
              value={active}
              onChange={(event) => {
                setActive(event.target.value as TriState);
                setPage(1);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            >
              <option value="">{t("plataforma.usuarios.filterAll")}</option>
              <option value="true">{t("plataforma.usuarios.activeTrue")}</option>
              <option value="false">{t("plataforma.usuarios.activeFalse")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="usuarios-verified" className="mb-1 block text-sm font-medium text-text-form">
              {t("plataforma.usuarios.verifiedLabel")}
            </label>
            <select
              id="usuarios-verified"
              value={verified}
              onChange={(event) => {
                setVerified(event.target.value as TriState);
                setPage(1);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            >
              <option value="">{t("plataforma.usuarios.filterAll")}</option>
              <option value="true">{t("plataforma.usuarios.verifiedTrue")}</option>
              <option value="false">{t("plataforma.usuarios.verifiedFalse")}</option>
            </select>
          </div>
        </div>
        <Button type="button" onClick={() => setShowCreate(true)}>
          {t("plataforma.usuarios.newAccount")}
        </Button>
      </div>

      {users.isError ? (
        <ErrorState
          title={t("plataforma.usuarios.loadError")}
          description={errorKindText(users.error, USERS_ERROR_KEYS, t, "errors.platformUsers.desconocido")}
        />
      ) : !users.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : users.data.results.length === 0 ? (
        <EmptyState title={t("plataforma.usuarios.emptyTitle")} />
      ) : (
        <>
          <Table<PlatformAccount>
            caption={t("plataforma.usuarios.tableCaption")}
            rows={users.data.results}
            getRowKey={(account) => String(account.id)}
            columns={[
              {
                key: "name",
                header: t("plataforma.usuarios.nameHeader"),
                render: (account) => (
                  <Link href={accountHref(account)} className="font-medium text-primary-700 underline">
                    {accountDisplayName(account)}
                  </Link>
                ),
              },
              { key: "email", header: t("plataforma.usuarios.emailHeader"), render: (account) => account.email },
              {
                key: "username",
                header: t("plataforma.usuarios.usernameHeader"),
                render: (account) => account.username || "—",
              },
              {
                key: "created_at",
                header: t("plataforma.usuarios.createdHeader"),
                render: (account) => formatAccountDate(account.created_at),
              },
              {
                key: "state",
                header: t("plataforma.usuarios.stateHeader"),
                render: (account) => (
                  <span className="flex flex-wrap gap-1">
                    {users.data.knownActive === null ? null : users.data.knownActive ? (
                      <Badge tone="success">{t("plataforma.usuarios.activeBadge")}</Badge>
                    ) : (
                      <Badge tone="error">{t("plataforma.usuarios.inactiveBadge")}</Badge>
                    )}
                    <Badge tone={account.is_verified ? "success" : "neutral"}>
                      {account.is_verified
                        ? t("plataforma.usuarios.verifiedBadge")
                        : t("plataforma.usuarios.unverifiedBadge")}
                    </Badge>
                  </span>
                ),
              },
              {
                key: "role",
                header: t("plataforma.usuarios.roleHeader"),
                render: (account) => {
                  const role = roleByUser.get(account.id);
                  return role ? t(PLATFORM_ROLE_LABEL_KEYS[role]) : "—";
                },
              },
            ]}
          />
          {users.data.knownActive === null ? (
            <p className="text-xs text-text-secondary">{t("plataforma.usuarios.stateHint")}</p>
          ) : null}

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={!users.data.previous}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {t("plataforma.usuarios.previous")}
            </Button>
            <span className="text-sm text-text-secondary">
              {t("plataforma.usuarios.count", { count: users.data.count })}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={!users.data.next}
              onClick={() => setPage((prev) => prev + 1)}
            >
              {t("plataforma.usuarios.next")}
            </Button>
          </div>
        </>
      )}

      {showCreate ? <NuevaCuentaDialog onClose={() => setShowCreate(false)} /> : null}
    </div>
  );
}
