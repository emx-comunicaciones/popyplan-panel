"use client";

/**
 * Bloqueos entre personas (admin de plataforma, bloque 1, 2026-09-26).
 *
 * El backend no tiene un listado global de bloqueos: se consultan los de
 * **una cuenta** (hechos por ella o contra ella, `hooks/useBlocksAdmin.ts`).
 * La cuenta se elige con el mismo buscador por correo/usuario que Roles
 * (`useUserSearch`, con retardo) o llega ya elegida desde la ficha de la
 * cuenta (`/plataforma/bloqueos?user=<id>`). Revocar pide un motivo
 * obligatorio (queda en Auditoría) dentro del propio `ConfirmDialog`, con
 * el error también dentro.
 *
 * Las personas se nombran por **nombre de usuario**: es lo único que trae
 * `BlockAdminSerializer` (ni alias público ni foto). Un bloqueo preventivo
 * por teléfono se dice como tal, nunca con el número (el backend no lo
 * manda).
 */
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useBlocksAdmin, useRevokeBlock, type BlocksAdminErrorKind } from "@/hooks/useBlocksAdmin";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useUserSearch } from "@/hooks/useUserSearch";
import type { BlockAdmin } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { accountHref, formatAccountDate } from "./UsuariosTable";

const BLOCKS_ERROR_KEYS: Record<BlocksAdminErrorKind, string> = {
  invalido: "errors.blocksAdmin.invalido",
  sin_acceso: "errors.blocksAdmin.sinAcceso",
  no_encontrado: "errors.blocksAdmin.noEncontrado",
  desconocido: "errors.blocksAdmin.desconocido",
};

const REVOKE_ERROR_KEYS: Record<BlocksAdminErrorKind, string> = {
  ...BLOCKS_ERROR_KEYS,
  no_encontrado: "errors.blocksAdmin.revokeNoEncontrado",
  desconocido: "errors.blocksAdmin.revokeDesconocido",
};

const REASON_MAX = 300;

interface SelectedUser {
  id: string;
  label: string | null;
  /** Correo de la cuenta, para que «Abrir su ficha» lleve los datos de cuenta (ver `UsuarioDetail`). */
  email: string | null;
}

export interface BloqueosPanelProps {
  /** Cuenta ya elegida (`?user=` de la URL), o `null`. */
  initialUserId: string | null;
  /** Su correo, si el enlace lo trae (`?email=`, desde la ficha de la cuenta). */
  initialEmail?: string | null;
}

export function BloqueosPanel({ initialUserId, initialEmail = null }: BloqueosPanelProps) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedUser | null>(
    initialUserId ? { id: initialUserId, label: initialEmail, email: initialEmail } : null,
  );
  const [toRevoke, setToRevoke] = useState<BlockAdmin | null>(null);
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);

  const debouncedSearch = useDebouncedValue(search);
  const results = useUserSearch(debouncedSearch);
  const blocks = useBlocksAdmin(selected?.id ?? null);
  const revoke = useRevokeBlock();

  function closeRevoke() {
    revoke.reset();
    setReason("");
    setReasonMissing(false);
    setToRevoke(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title={t("plataforma.bloqueos.pickTitle")}>
        <label htmlFor="bloqueos-search" className="mb-1 block text-sm font-medium text-text-form">
          {t("plataforma.bloqueos.searchLabel")}
        </label>
        <input
          id="bloqueos-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        />
        {results.data && results.data.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-1 rounded-md border border-border p-2 text-sm">
            {results.data.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className="text-left text-primary-700 underline"
                  onClick={() => {
                    setSelected({ id: String(user.id), label: user.username || user.email, email: user.email });
                    setSearch("");
                  }}
                >
                  {t("plataforma.bloqueos.searchResult", { username: user.username || "—", email: user.email })}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {selected ? (
          <p className="mt-2 text-sm text-text-base">
            {selected.label
              ? t("plataforma.bloqueos.selectedLabel", { name: selected.label })
              : t("plataforma.bloqueos.selectedById", { id: selected.id })}{" "}
            <Link
              href={
                selected.email
                  ? accountHref({ id: Number(selected.id), email: selected.email })
                  : `/plataforma/usuarios/${selected.id}`
              }
              className="text-primary-700 underline"
            >
              {t("plataforma.bloqueos.openAccount")}
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-secondary">{t("plataforma.bloqueos.pickHint")}</p>
        )}
      </Card>

      {selected ? (
        blocks.isError ? (
          <ErrorState
            title={t("plataforma.bloqueos.loadError")}
            description={errorKindText(blocks.error, BLOCKS_ERROR_KEYS, t, "errors.blocksAdmin.desconocido")}
          />
        ) : !blocks.data ? (
          <p className="text-sm text-text-secondary">{t("common.loading")}</p>
        ) : blocks.data.length === 0 ? (
          <EmptyState title={t("plataforma.bloqueos.emptyTitle")} />
        ) : (
          <Table<BlockAdmin>
            caption={t("plataforma.bloqueos.tableCaption")}
            rows={blocks.data}
            getRowKey={(block) => block.id}
            columns={[
              { key: "blocker", header: t("plataforma.bloqueos.blockerHeader"), render: (block) => block.blocker_username },
              {
                key: "blocked",
                header: t("plataforma.bloqueos.blockedHeader"),
                render: (block) =>
                  block.blocked_username ?? (block.phone_blocked ? t("plataforma.bloqueos.phoneBlock") : "—"),
              },
              {
                key: "created_at",
                header: t("plataforma.bloqueos.dateHeader"),
                render: (block) => formatAccountDate(block.created_at),
              },
              {
                key: "actions",
                header: <span className="sr-only">{t("common.actions")}</span>,
                render: (block) => (
                  <Button type="button" variant="danger" onClick={() => setToRevoke(block)}>
                    {t("plataforma.bloqueos.revoke")}
                  </Button>
                ),
              },
            ]}
          />
        )
      ) : null}

      <ConfirmDialog
        open={toRevoke !== null}
        title={t("plataforma.bloqueos.revokeTitle")}
        description={
          <div className="flex flex-col gap-2">
            <p>{t("plataforma.bloqueos.revokeDescription")}</p>
            <label htmlFor="bloqueos-reason" className="block text-sm font-medium text-text-form">
              {t("plataforma.bloqueos.reasonLabel")}
            </label>
            <textarea
              id="bloqueos-reason"
              value={reason}
              maxLength={REASON_MAX}
              rows={3}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonMissing(false);
              }}
              className="w-full rounded-md border border-border px-3 py-1.5 text-sm text-text-base focus-visible:outline-primary-700"
            />
            {reasonMissing ? (
              <p role="alert" className="text-error">
                {t("plataforma.bloqueos.reasonRequired")}
              </p>
            ) : null}
            {revoke.isError ? (
              <p role="alert" className="text-error">
                {errorKindText(revoke.error, REVOKE_ERROR_KEYS, t, "errors.blocksAdmin.revokeDesconocido")}
              </p>
            ) : null}
          </div>
        }
        confirmLabel={t("plataforma.bloqueos.revoke")}
        pending={revoke.isPending}
        onCancel={closeRevoke}
        onConfirm={() => {
          if (!toRevoke) return;
          if (reason.trim().length === 0) {
            setReasonMissing(true);
            return;
          }
          revoke.mutate({ blockId: toRevoke.id, reason: reason.trim() }, { onSuccess: closeRevoke });
        }}
      />
    </div>
  );
}
