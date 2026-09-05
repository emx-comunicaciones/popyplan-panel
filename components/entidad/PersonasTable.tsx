"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { usePeople } from "@/hooks/usePeople";
import { presetPeriod } from "@/lib/metrics/period";

export interface PersonasTableProps {
  orgId: number | string;
  slug: string;
}

interface PersonasFilters {
  search: string;
  community: string;
  referent: string;
  activeSince: string;
  joinedSince: string;
}

const EMPTY_FILTERS: PersonasFilters = {
  search: "",
  community: "",
  referent: "",
  activeSince: "",
  joinedSince: "",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES");
}

/**
 * Tabla de personas de la entidad (`docs/PANEL.md` §3.2): filtros
 * comunidad/referente/participación (`active_since`)/alta (`joined_since`)
 * más búsqueda, y paginación estándar de DRF. Cada fila enlaza a la ficha
 * operativa (`personas/[userId]`).
 */
export function PersonasTable({ orgId, slug }: PersonasTableProps) {
  const [filters, setFilters] = useState<PersonasFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const period = presetPeriod("mes");

  const people = usePeople(orgId, period, {
    search: filters.search || undefined,
    community: filters.community || undefined,
    referent: filters.referent ? Number(filters.referent) : undefined,
    activeSince: filters.activeSince || undefined,
    joinedSince: filters.joinedSince || undefined,
    page,
  });

  function updateFilter<K extends keyof PersonasFilters>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <form aria-label="Filtros de personas" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="personas-search" className="mb-1 block text-sm font-medium text-text-form">
            Buscar
          </label>
          <input
            id="personas-search"
            type="text"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
          />
        </div>
        <div>
          <label htmlFor="personas-community" className="mb-1 block text-sm font-medium text-text-form">
            Comunidad
          </label>
          <input
            id="personas-community"
            type="text"
            value={filters.community}
            onChange={(event) => updateFilter("community", event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
          />
        </div>
        <div>
          <label htmlFor="personas-referent" className="mb-1 block text-sm font-medium text-text-form">
            Referente
          </label>
          <input
            id="personas-referent"
            type="number"
            value={filters.referent}
            onChange={(event) => updateFilter("referent", event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
          />
        </div>
        <div>
          <label htmlFor="personas-active-since" className="mb-1 block text-sm font-medium text-text-form">
            Participación desde
          </label>
          <input
            id="personas-active-since"
            type="date"
            value={filters.activeSince}
            onChange={(event) => updateFilter("activeSince", event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
          />
        </div>
        <div>
          <label htmlFor="personas-joined-since" className="mb-1 block text-sm font-medium text-text-form">
            De alta desde
          </label>
          <input
            id="personas-joined-since"
            type="date"
            value={filters.joinedSince}
            onChange={(event) => updateFilter("joinedSince", event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
          />
        </div>
      </form>

      {people.isError ? (
        <ErrorState title="No se pudieron cargar las personas" description={people.error.message} />
      ) : !people.data ? (
        <p className="text-sm text-text-secondary">Cargando personas…</p>
      ) : people.data.results.length === 0 ? (
        <EmptyState title="Sin personas con estos filtros" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Personas de la entidad</caption>
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th scope="col" className="px-3 py-2 font-semibold">Nombre</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Comunidades</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Actividades (periodo)</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Asistió (periodo)</th>
                  <th scope="col" className="px-3 py-2 font-semibold">De alta</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Referente</th>
                </tr>
              </thead>
              <tbody>
                {people.data.results.map((person) => (
                  <tr key={person.user_id} className="border-b border-border-light">
                    <td className="px-3 py-2 text-text-base">
                      <Link
                        href={`/entidad/${slug}/personas/${person.user_id}`}
                        className="font-medium text-primary underline"
                      >
                        {person.public_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-text-base">{person.communities_count}</td>
                    <td className="px-3 py-2 text-text-base">{person.events_period}</td>
                    <td className="px-3 py-2 text-text-base">{person.attended_period}</td>
                    <td className="px-3 py-2 text-text-base">{formatDate(person.joined_at)}</td>
                    <td className="px-3 py-2 text-text-base">
                      {person.referent ? person.referent.public_name : "Sin referente"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={!people.data.previous}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Anterior
            </Button>
            <span className="text-sm text-text-secondary">{people.data.count} personas</span>
            <Button
              type="button"
              variant="secondary"
              disabled={!people.data.next}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Siguiente
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
