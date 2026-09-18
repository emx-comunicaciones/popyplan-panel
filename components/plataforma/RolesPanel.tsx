"use client";

/**
 * Roles de plataforma (tarea W5, `docs/SEGURIDAD_Y_MODERACION.md` §1):
 * listado (solo `superadmin`), conceder (buscador de cuentas por email/
 * username vía `GET /api/users/users/?search=` cuando esté disponible —
 * ver `hooks/useUserSearch.ts` —, con un id manual como alternativa) y
 * revocar (con confirmación, es una acción de alto impacto: quita acceso
 * a la plataforma).
 */
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useGrantPlatformRole, usePlatformRoles, useRevokePlatformRole } from "@/hooks/usePlatformRoles";
import { useUserSearch } from "@/hooks/useUserSearch";
import type { PlatformRoleName } from "@/lib/api/types";

const ROLE_OPTIONS: PlatformRoleName[] = ["superadmin", "verifier", "moderator", "support"];
const ROLE_LABELS: Record<PlatformRoleName, string> = {
  superadmin: "Superadmin",
  verifier: "Verificador",
  moderator: "Moderador",
  support: "Soporte",
};

function GrantRoleForm() {
  const grant = useGrantPlatformRole();
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<PlatformRoleName>("moderator");
  /**
   * El `<input>` es inmediato, pero la búsqueda de cuentas se lanza con
   * retardo (`useDebouncedValue`, 300 ms): `useUserSearch` ya se
   * contiene hasta los dos caracteres, y aun así teclear «ana» pedía
   * «an» y «ana».
   */
  const debouncedSearch = useDebouncedValue(search);
  const results = useUserSearch(debouncedSearch);

  return (
    <Card title="Conceder rol">
      <div className="mb-3">
        <label htmlFor="roles-search" className="mb-1 block text-sm font-medium text-text-form">
          Buscar cuenta (email o usuario)
        </label>
        <input
          id="roles-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
        />
        {results.data && results.data.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-1 rounded-md border border-border p-2 text-sm">
            {results.data.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className="text-left text-primary-700 underline"
                  onClick={() => setUserId(String(user.id))}
                >
                  #{user.id} — {user.username} ({user.email})
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!userId) return;
          grant.mutate(
            { user: Number(userId), role },
            {
              onSuccess: () => {
                setUserId("");
                setSearch("");
              },
            },
          );
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div>
          <label htmlFor="roles-user-id" className="mb-1 block text-sm font-medium text-text-form">
            Id de usuario
          </label>
          <input
            id="roles-user-id"
            type="number"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="roles-role" className="mb-1 block text-sm font-medium text-text-form">
            Rol
          </label>
          <select
            id="roles-role"
            value={role}
            onChange={(event) => setRole(event.target.value as PlatformRoleName)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            {ROLE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={!userId || grant.isPending}>
          Conceder
        </Button>
      </form>
      {grant.isError ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {grant.error.message}
        </p>
      ) : null}
      {grant.isSuccess ? <p className="mt-2 text-sm text-success">Rol concedido.</p> : null}
    </Card>
  );
}

export function RolesPanel() {
  const roles = usePlatformRoles();
  const revoke = useRevokePlatformRole();
  const [toRevoke, setToRevoke] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <GrantRoleForm />

      <Card title="Roles vigentes">
        {roles.isError ? (
          <ErrorState title="No se pudieron cargar los roles" description={roles.error.message} />
        ) : !roles.data ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : roles.data.length === 0 ? (
          <EmptyState title="Sin roles concedidos" />
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {roles.data.map((entry) => (
              <li key={entry.user} className="flex items-center justify-between gap-2">
                <span>
                  {entry.username} (#{entry.user}) — {ROLE_LABELS[entry.role]}
                </span>
                <Button type="button" variant="danger" onClick={() => setToRevoke(entry.user)}>
                  Revocar
                </Button>
              </li>
            ))}
          </ul>
        )}
        {revoke.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {revoke.error.message}
          </p>
        ) : null}
      </Card>

      <ConfirmDialog
        open={toRevoke !== null}
        title="Revocar rol de plataforma"
        description="Esta persona perderá el acceso al panel de plataforma."
        confirmLabel="Revocar"
        pending={revoke.isPending}
        onCancel={() => setToRevoke(null)}
        onConfirm={() => {
          if (toRevoke === null) return;
          revoke.mutate(toRevoke, { onSuccess: () => setToRevoke(null) });
        }}
      />
    </div>
  );
}
