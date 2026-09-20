"use client";

/**
 * Listado de entidades de plataforma (tarea W5, `docs/SEGURIDAD_Y_MODERACION.md`
 * §8): filtros `verified`/`parent`/`search`, paginado de verdad. «Nueva
 * entidad» solo para `verifier`/`superadmin` (`canCreate`, calculado por
 * la página desde el rol de la sesión — el propio backend también lo
 * exige, esto es solo para no mostrar un botón que va a dar 403).
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
import { useOrganizations } from "@/hooks/useOrganizations";
import { usePlacesByIne } from "@/hooks/usePlaces";
import type { Organization } from "@/lib/api/types";
import { placeLabelState } from "@/lib/places/placeLabel";

import { NuevaEntidadDialog } from "./NuevaEntidadDialog";

export interface EntidadesTableProps {
  canCreate: boolean;
}

export function EntidadesTable({ canCreate }: EntidadesTableProps) {
  const t = useTranslations();
  const [verified, setVerified] = useState<"" | "true" | "false">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  /**
   * La búsqueda se aplica con retardo (`useDebouncedValue`, 300 ms): el
   * `<input>` es inmediato, pero el listado solo se vuelve a pedir
   * cuando se para de escribir — si no, «ana» disparaba tres
   * peticiones. «Verificación» es un `<select>`, se aplica tal cual.
   */
  const debouncedSearch = useDebouncedValue(search);

  const organizations = useOrganizations({
    verified: verified === "" ? undefined : verified === "true",
    search: debouncedSearch || undefined,
    page,
  });

  /**
   * La página vuelve a 1 cuando la búsqueda **se aplica** (cuando cambia
   * el valor con retardo), no con cada tecla; «Verificación», que no
   * lleva retardo, la devuelve a 1 en su propio `onChange`.
   */
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // I1 de la revisión final de rama: una sola petición por página con
  // los códigos INE distintos de las filas cargadas, no una por fila —
  // `placeLabelState` decide, por fila, si ya se resolvió, sigue
  // cargando o hay que caer al código crudo (fallo o municipio no
  // encontrado).
  const placeCodes = Array.from(
    new Set(
      (organizations.data?.results ?? [])
        .map((org) => org.place)
        .filter((place): place is string => Boolean(place)),
    ),
  );
  const places = usePlacesByIne(placeCodes);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="entidades-verified" className="mb-1 block text-sm font-medium text-text-form">
              {t("plataforma.entidades.verifiedLabel")}
            </label>
            <select
              id="entidades-verified"
              value={verified}
              onChange={(event) => {
                setVerified(event.target.value as typeof verified);
                setPage(1);
              }}
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            >
              <option value="">{t("plataforma.entidades.verifiedFilterAll")}</option>
              <option value="true">{t("plataforma.entidades.verifiedFilterTrue")}</option>
              <option value="false">{t("plataforma.entidades.verifiedFilterFalse")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="entidades-search" className="mb-1 block text-sm font-medium text-text-form">
              {t("plataforma.entidades.searchLabel")}
            </label>
            <input
              id="entidades-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            />
          </div>
        </div>
        {canCreate ? (
          <Button type="button" onClick={() => setShowCreate(true)}>
            {t("plataforma.entidades.newEntity")}
          </Button>
        ) : null}
      </div>

      {organizations.isError ? (
        <ErrorState
          title={t("plataforma.entidades.loadError")}
          description={t("errors.organizations.desconocido")}
        />
      ) : !organizations.data ? (
        <p className="text-sm text-text-secondary">{t("plataforma.entidades.loading")}</p>
      ) : organizations.data.results.length === 0 ? (
        <EmptyState title={t("plataforma.entidades.emptyTitle")} />
      ) : (
        <>
          <Table<Organization>
            caption={t("plataforma.entidades.tableCaption")}
            rows={organizations.data.results}
            getRowKey={(org) => String(org.id)}
            columns={[
              {
                key: "name",
                header: t("plataforma.entidades.nameHeader"),
                render: (org) => (
                  <Link href={`/plataforma/entidades/${org.id}`} className="font-medium text-primary-700 underline">
                    {org.name}
                  </Link>
                ),
              },
              { key: "org_type", header: t("plataforma.entidades.typeHeader"), render: (org) => org.org_type },
              {
                key: "place",
                header: t("plataforma.sede.header"),
                render: (org) => {
                  const state = placeLabelState(org.place, places);
                  if (state.kind === "empty") {
                    return <Badge tone="neutral">{t("plataforma.sede.missing")}</Badge>;
                  }
                  if (state.kind === "loading") return "…";
                  if (state.kind === "resolved") {
                    return t("plataforma.sede.resolved", { name: state.name, province: state.province });
                  }
                  return org.place;
                },
              },
              {
                key: "verified",
                header: t("plataforma.entidades.verifiedLabel"),
                render: (org) => (
                  <Badge tone={org.is_verified ? "success" : "neutral"}>
                    {org.is_verified ? t("plataforma.entidades.verifiedTrue") : t("plataforma.entidades.verifiedFalse")}
                  </Badge>
                ),
              },
              { key: "parent", header: t("plataforma.entidades.parentHeader"), render: (org) => org.parent ?? "—" },
            ]}
          />

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={!organizations.data.previous}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {t("plataforma.entidades.previous")}
            </Button>
            <span className="text-sm text-text-secondary">
              {t("plataforma.entidades.count", { count: organizations.data.count })}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={!organizations.data.next}
              onClick={() => setPage((prev) => prev + 1)}
            >
              {t("plataforma.entidades.next")}
            </Button>
          </div>
        </>
      )}

      {showCreate ? <NuevaEntidadDialog onClose={() => setShowCreate(false)} /> : null}
    </div>
  );
}
