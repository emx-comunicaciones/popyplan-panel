"use client";

/**
 * Listado de chats del soporte (admin de plataforma, bloque 3,
 * 2026-09-26): `GET /api/admin/chats/` (`hooks/useAdminChats.ts`) con
 * tipo y búsqueda (con retardo; el backend solo busca en el nombre de la
 * sala, que un chat individual no suele tener — la pista lo dice). No se
 * pinta el último mensaje: en el listado siempre llega `null`.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useAdminChats, type AdminChatsErrorKind } from "@/hooks/useAdminChats";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { PlatformChatRoom } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

export const ADMIN_CHATS_ERROR_KEYS: Record<AdminChatsErrorKind, string> = {
  invalido: "errors.adminChats.desconocido",
  sin_acceso: "errors.adminChats.sinAcceso",
  no_encontrado: "errors.adminChats.noEncontrado",
  desconocido: "errors.adminChats.desconocido",
};

export const CHAT_TYPE_KEYS: Record<PlatformChatRoom["chat_type"], string> = {
  individual: "plataforma.chats.typeIndividual",
  group: "plataforma.chats.typeGroup",
};

/**
 * Origen de una sala de grupo (`ChatRoomSerializer.get_group_source`):
 * `event`, `community` o las tres variantes de la búsqueda del tesoro.
 * Un valor nuevo del backend se pinta tal cual.
 */
const GROUP_SOURCE_KEYS: Record<string, string> = {
  event: "plataforma.chats.sourceEvent",
  community: "plataforma.chats.sourceCommunity",
  treasure_hunt_team: "plataforma.chats.sourceTreasureHunt",
  treasure_hunt_pair: "plataforma.chats.sourceTreasureHunt",
  treasure_hunt_individual: "plataforma.chats.sourceTreasureHunt",
};

/** Clave de traducción del origen, o `null` si no se conoce. */
export function groupSourceKey(source: string | null): string | null {
  return source ? (GROUP_SOURCE_KEYS[source] ?? null) : null;
}

/** Nombre de la sala o, si no tiene, los alias de sus participantes. */
export function roomLabel(room: PlatformChatRoom): string {
  if (room.name) return room.name;
  const names = room.participants.map((person) => person.public_name).filter(Boolean);
  return names.length > 0 ? names.join(", ") : "—";
}

type ChatTypeFilter = "" | PlatformChatRoom["chat_type"];

export function ChatsTable() {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [chatType, setChatType] = useState<ChatTypeFilter>("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const rooms = useAdminChats({ chatType: chatType || undefined, search: debouncedSearch || undefined, page });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (rooms.error?.kind === "no_encontrado" && page > 1) setPage(1);
  }, [rooms.error, page]);

  const field = "rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700";
  const label = "mb-1 block text-sm font-medium text-text-form";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="chats-search" className={label}>
            {t("plataforma.chats.searchLabel")}
          </label>
          <input
            id="chats-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-describedby="chats-search-hint"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="chats-type" className={label}>
            {t("plataforma.chats.typeLabel")}
          </label>
          <select
            id="chats-type"
            value={chatType}
            onChange={(event) => {
              setChatType(event.target.value as ChatTypeFilter);
              setPage(1);
            }}
            className={field}
          >
            <option value="">{t("plataforma.chats.typeAll")}</option>
            <option value="individual">{t("plataforma.chats.typeIndividual")}</option>
            <option value="group">{t("plataforma.chats.typeGroup")}</option>
          </select>
        </div>
      </div>
      <p id="chats-search-hint" className="text-xs text-text-secondary">
        {t("plataforma.chats.searchHint")}
      </p>

      {rooms.isError ? (
        <ErrorState
          title={t("plataforma.chats.loadError")}
          description={errorKindText(rooms.error, ADMIN_CHATS_ERROR_KEYS, t, "errors.adminChats.desconocido")}
        />
      ) : !rooms.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : rooms.data.results.length === 0 ? (
        <EmptyState title={t("plataforma.chats.emptyTitle")} />
      ) : (
        <>
          <Table<PlatformChatRoom>
            caption={t("plataforma.chats.tableCaption")}
            rows={rooms.data.results}
            getRowKey={(room) => room.id}
            columns={[
              {
                key: "name",
                header: t("plataforma.chats.nameHeader"),
                render: (room) => (
                  <Link href={`/plataforma/chats/${room.id}`} className="font-medium text-primary-700 underline">
                    {roomLabel(room)}
                  </Link>
                ),
              },
              {
                key: "type",
                header: t("plataforma.chats.typeLabel"),
                render: (room) => (CHAT_TYPE_KEYS[room.chat_type] ? t(CHAT_TYPE_KEYS[room.chat_type]) : room.chat_type),
              },
              {
                key: "source",
                header: t("plataforma.chats.sourceHeader"),
                render: (room) => {
                  const key = groupSourceKey(room.group_source);
                  return key ? t(key) : room.group_source || "—";
                },
              },
              {
                key: "participants",
                header: t("plataforma.chats.participantsHeader"),
                render: (room) => String(room.participants.length),
              },
            ]}
          />
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={!rooms.data.previous}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {t("plataforma.chats.previous")}
            </Button>
            <span className="text-sm text-text-secondary">
              {t("plataforma.chats.count", { count: rooms.data.count })}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={!rooms.data.next}
              onClick={() => setPage((prev) => prev + 1)}
            >
              {t("plataforma.chats.next")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
