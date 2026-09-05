"use client";

/**
 * Listado de entidades de plataforma (tarea W5, `docs/SEGURIDAD_Y_MODERACION.md`
 * §8): filtros `verified`/`parent`/`search`, paginado de verdad. «Nueva
 * entidad» solo para `verifier`/`superadmin` (`canCreate`, calculado por
 * la página desde el rol de la sesión — el propio backend también lo
 * exige, esto es solo para no mostrar un botón que va a dar 403).
 */
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useOrganizations } from "@/hooks/useOrganizations";
import type { Organization } from "@/lib/api/types";

import { NuevaEntidadDialog } from "./NuevaEntidadDialog";

export interface EntidadesTableProps {
  canCreate: boolean;
}

export function EntidadesTable({ canCreate }: EntidadesTableProps) {
  const [verified, setVerified] = useState<"" | "true" | "false">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const organizations = useOrganizations({
    verified: verified === "" ? undefined : verified === "true",
    search: search || undefined,
    page,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="entidades-verified" className="mb-1 block text-sm font-medium text-text-form">
              Verificación
            </label>
            <select
              id="entidades-verified"
              value={verified}
              onChange={(event) => {
                setVerified(event.target.value as typeof verified);
                setPage(1);
              }}
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
            >
              <option value="">Todas</option>
              <option value="true">Verificadas</option>
              <option value="false">Pendientes</option>
            </select>
          </div>
          <div>
            <label htmlFor="entidades-search" className="mb-1 block text-sm font-medium text-text-form">
              Buscar por nombre
            </label>
            <input
              id="entidades-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
            />
          </div>
        </div>
        {canCreate ? <Button type="button" onClick={() => setShowCreate(true)}>Nueva entidad</Button> : null}
      </div>

      {organizations.isError ? (
        <ErrorState title="No se pudo cargar el listado de entidades" description={organizations.error.message} />
      ) : !organizations.data ? (
        <p className="text-sm text-text-secondary">Cargando entidades…</p>
      ) : organizations.data.results.length === 0 ? (
        <EmptyState title="Sin entidades con este filtro" />
      ) : (
        <>
          <Table<Organization>
            caption="Entidades"
            rows={organizations.data.results}
            getRowKey={(org) => String(org.id)}
            columns={[
              {
                key: "name",
                header: "Nombre",
                render: (org) => (
                  <Link href={`/plataforma/entidades/${org.id}`} className="font-medium text-primary underline">
                    {org.name}
                  </Link>
                ),
              },
              { key: "org_type", header: "Tipo", render: (org) => org.org_type },
              {
                key: "verified",
                header: "Verificación",
                render: (org) => (
                  <Badge tone={org.is_verified ? "success" : "neutral"}>
                    {org.is_verified ? "Verificada" : "Pendiente"}
                  </Badge>
                ),
              },
              { key: "parent", header: "Paraguas", render: (org) => org.parent ?? "—" },
            ]}
          />

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={!organizations.data.previous}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Anterior
            </Button>
            <span className="text-sm text-text-secondary">{organizations.data.count} entidades</span>
            <Button
              type="button"
              variant="secondary"
              disabled={!organizations.data.next}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Siguiente
            </Button>
          </div>
        </>
      )}

      {showCreate ? <NuevaEntidadDialog onClose={() => setShowCreate(false)} /> : null}
    </div>
  );
}
