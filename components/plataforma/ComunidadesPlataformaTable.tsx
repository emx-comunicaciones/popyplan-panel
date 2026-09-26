"use client";

/**
 * Listado global de comunidades del admin de plataforma (bloque 3,
 * 2026-09-26): `GET /api/communities/?search=&page=` con búsqueda con
 * retardo (el backend mira nombre y descripción), 20 por página.
 *
 * A `is_staff` el backend le da todas las comunidades —privadas, de
 * entidad, de los dos espacios e inactivas—, salvo las de entidades que
 * esa cuenta haya ocultado a título personal. La fila no dice si está
 * activa: eso solo lo trae la ficha, y la pista de debajo lo explica.
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
import { usePlatformCommunities, type PlatformCommunitiesErrorKind } from "@/hooks/usePlatformCommunities";
import type { EntityCommunityRow } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { formatAccountDate } from "./UsuariosTable";

export const PLATFORM_COMMUNITIES_ERROR_KEYS: Record<PlatformCommunitiesErrorKind, string> = {
  invalido: "errors.platformCommunities.invalido",
  sin_acceso: "errors.platformCommunities.sinAcceso",
  no_encontrado: "errors.platformCommunities.noEncontrado",
  pagina_inexistente: "errors.platformCommunities.paginaInexistente",
  desconocido: "errors.platformCommunities.desconocido",
};

export const COMMUNITY_VISIBILITY_KEYS: Record<string, string> = {
  open: "plataforma.comunidades.visibilityOpen",
  on_request: "plataforma.comunidades.visibilityOnRequest",
  private_listed: "plataforma.comunidades.visibilityPrivateListed",
  private: "plataforma.comunidades.visibilityPrivate",
};

export const COMMUNITY_SPACE_KEYS: Record<string, string> = {
  members: "plataforma.comunidades.spaceMembers",
  families: "plataforma.comunidades.spaceFamilies",
};

/** Etiqueta traducida de un valor del contrato, con reserva al valor crudo si el backend añade uno nuevo. */
export function labelOf(keys: Record<string, string>, value: string, t: (key: string) => string): string {
  const key = keys[value];
  return key ? t(key) : value;
}

export function ComunidadesPlataformaTable() {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const communities = usePlatformCommunities({ search: debouncedSearch || undefined, page });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (communities.error?.kind === "pagina_inexistente" && page > 1) setPage(1);
  }, [communities.error, page]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="comunidades-search" className="mb-1 block text-sm font-medium text-text-form">
          {t("plataforma.comunidades.searchLabel")}
        </label>
        <input
          id="comunidades-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        />
      </div>
      <p className="text-xs text-text-secondary">{t("plataforma.comunidades.listHint")}</p>

      {communities.isError ? (
        <ErrorState
          title={t("plataforma.comunidades.loadError")}
          description={errorKindText(
            communities.error,
            PLATFORM_COMMUNITIES_ERROR_KEYS,
            t,
            "errors.platformCommunities.desconocido",
          )}
        />
      ) : !communities.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : communities.data.results.length === 0 ? (
        <EmptyState title={t("plataforma.comunidades.emptyTitle")} />
      ) : (
        <>
          <Table<EntityCommunityRow>
            caption={t("plataforma.comunidades.tableCaption")}
            rows={communities.data.results}
            getRowKey={(community) => community.id}
            columns={[
              {
                key: "name",
                header: t("plataforma.comunidades.nameHeader"),
                render: (community) => (
                  <Link
                    href={`/plataforma/comunidades/${community.id}`}
                    className="font-medium text-primary-700 underline"
                  >
                    {community.name}
                  </Link>
                ),
              },
              {
                key: "owner",
                header: t("plataforma.comunidades.ownerHeader"),
                render: (community) => (
                  <span className="flex flex-wrap items-center gap-1">
                    <span>{community.owner.name}</span>
                    <Badge tone={community.owner.type === "organization" ? "info" : "neutral"}>
                      {community.owner.type === "organization"
                        ? t("plataforma.comunidades.ownerOrganization")
                        : t("plataforma.comunidades.ownerProfile")}
                    </Badge>
                  </span>
                ),
              },
              {
                key: "visibility",
                header: t("plataforma.comunidades.visibilityHeader"),
                render: (community) => labelOf(COMMUNITY_VISIBILITY_KEYS, community.visibility, t),
              },
              {
                key: "space",
                header: t("plataforma.comunidades.spaceHeader"),
                render: (community) => labelOf(COMMUNITY_SPACE_KEYS, community.space, t),
              },
              {
                key: "members",
                header: t("plataforma.comunidades.membersHeader"),
                render: (community) => community.members_count,
              },
              {
                key: "created",
                header: t("plataforma.comunidades.createdHeader"),
                render: (community) => formatAccountDate(community.created_at),
              },
            ]}
          />
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={!communities.data.previous}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {t("plataforma.usuarios.previous")}
            </Button>
            <span className="text-sm text-text-secondary">
              {t("plataforma.comunidades.count", { count: communities.data.count })}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={!communities.data.next}
              onClick={() => setPage((prev) => prev + 1)}
            >
              {t("plataforma.usuarios.next")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
