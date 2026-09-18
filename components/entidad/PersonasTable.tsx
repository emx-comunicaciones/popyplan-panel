"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AddPersonDialog } from "@/components/people/AddPersonDialog";
import { ImportPeopleDialog } from "@/components/people/ImportPeopleDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInvitations } from "@/hooks/useInvitations";
import { usePeople } from "@/hooks/usePeople";
import { useEntityCommunities } from "@/hooks/useEntityCommunities";
import { useResendInvitation } from "@/hooks/useResendInvitation";
import { useRevokeInvitation } from "@/hooks/useRevokeInvitation";
import type { InvitedPersonRow } from "@/lib/api/types";
import { isInvitedPersonRow } from "@/lib/people/invitedRow";
import { presetPeriod } from "@/lib/metrics/period";

export interface PersonasTableProps {
  orgId: number | string;
  slug: string;
  /** Solo titular/moderador dan de alta personas (`docs/PANEL.md` §3b.1). */
  canManage: boolean;
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
 * Recuento de invitaciones `pending` junto al checkbox «Incluir
 * invitadas» (tarea W3b): componente aparte para que `useInvitations`
 * (`docs/PANEL.md` §3b.1) solo se llame mientras el checkbox está
 * activo, igual que `ResourceForm` dentro de
 * `components/entidad/RecursosPanel.tsx` solo llama a sus mutaciones
 * mientras el formulario está montado.
 */
function PendingInvitationsHint({ orgId }: { orgId: number | string }) {
  const invitations = useInvitations(orgId, "pending");
  if (invitations.isError) {
    return (
      <span role="status" className="text-xs text-error">
        No se pudo cargar el recuento de invitaciones.
      </span>
    );
  }
  if (!invitations.data) return null;
  const count = invitations.data.length;
  return (
    <span className="text-xs text-text-secondary">
      {count} invitación{count === 1 ? "" : "es"} pendiente{count === 1 ? "" : "s"}
    </span>
  );
}

/**
 * Tabla de personas de la entidad (`docs/PANEL.md` §3.2): filtros
 * comunidad (select de `useEntityCommunities` — el backend solo acepta el
 * UUID, un texto libre daba 400 a toda la tabla)/referente/participación
 * (`active_since`)/alta (`joined_since`)
 * más búsqueda, y paginación estándar de DRF. Cada fila enlaza a la ficha
 * operativa (`personas/[userId]`). Tarea W3b: botones «Añadir persona» e
 * «Importar Excel/CSV» (solo `canManage`) y checkbox «Incluir invitadas»
 * (`include_invited=true`, §3b.7) que mezcla filas `InvitedPersonRow`
 * («Invitada (pendiente)») al final de la página, con «Reenviar»/
 * «Revocar» (solo `canManage`).
 */
export function PersonasTable({ orgId, slug, canManage }: PersonasTableProps) {
  const [filters, setFilters] = useState<PersonasFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [includeInvited, setIncludeInvited] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [revoking, setRevoking] = useState<InvitedPersonRow | null>(null);
  const [resentTo, setResentTo] = useState<string | null>(null);
  const period = presetPeriod("mes");
  const communities = useEntityCommunities(orgId);

  /**
   * Los campos que se teclean (búsqueda, referente y las dos fechas) se
   * aplican con retardo (`useDebouncedValue`, 300 ms): el `<input>` es
   * inmediato, pero la query solo cambia cuando se para de escribir —
   * si no, «ana» disparaba tres peticiones y las respuestas podían
   * llegar desordenadas. «Comunidad» es un `<select>` (un único evento
   * por elección), así que se aplica tal cual.
   */
  const search = useDebouncedValue(filters.search);
  const referent = useDebouncedValue(filters.referent);
  const activeSince = useDebouncedValue(filters.activeSince);
  const joinedSince = useDebouncedValue(filters.joinedSince);

  const people = usePeople(orgId, period, {
    search: search || undefined,
    community: filters.community || undefined,
    referent: referent ? Number(referent) : undefined,
    activeSince: activeSince || undefined,
    joinedSince: joinedSince || undefined,
    includeInvited,
    page,
  });

  const resendInvitation = useResendInvitation(orgId);
  const revokeInvitation = useRevokeInvitation(orgId);

  /**
   * El paginador de DRF responde 404 cuando la página pedida ya no
   * existe (se revoca una invitación, o alguien cambia los filtros desde
   * otra pestaña, y el listado encoge mientras se mira la página 3). Sin
   * esto la tabla se quedaba en un `ErrorState` del que no se sale, con
   * los botones de paginación fuera de la vista.
   */
  useEffect(() => {
    if (page > 1 && people.error?.kind === "pagina_inexistente") {
      setPage(1);
      setResentTo(null);
    }
  }, [page, people.error]);

  /**
   * La página vuelve a 1 cuando el filtro **se aplica** (cuando cambia
   * el valor con retardo), no con cada tecla: si no, la primera letra
   * del buscador ya pedía la página 1 del listado viejo. «Comunidad»,
   * que no lleva retardo, la devuelve a 1 en su propio `onChange`.
   */
  useEffect(() => {
    setPage(1);
  }, [search, referent, activeSince, joinedSince]);

  function updateFilter<K extends keyof PersonasFilters>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setAddOpen(true)}>
            Añadir persona
          </Button>
          <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
            Importar Excel/CSV
          </Button>
        </div>
      ) : null}

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
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="personas-community" className="mb-1 block text-sm font-medium text-text-form">
            Comunidad
          </label>
          <select
            id="personas-community"
            value={filters.community}
            onChange={(event) => {
              updateFilter("community", event.target.value);
              setPage(1);
            }}
            aria-describedby={communities.isError ? "personas-community-error" : undefined}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            <option value="">Todas</option>
            {(communities.data ?? []).map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </select>
          {communities.isError ? (
            <p id="personas-community-error" role="alert" className="mt-1 text-xs text-error">
              No se pudieron cargar las comunidades.
            </p>
          ) : null}
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
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
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
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
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
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <label className="flex items-center gap-2 text-sm text-text-base">
            <input
              type="checkbox"
              checked={includeInvited}
              onChange={(event) => {
                setIncludeInvited(event.target.checked);
                setPage(1);
              }}
            />
            Incluir invitadas
          </label>
          {includeInvited ? <PendingInvitationsHint orgId={orgId} /> : null}
        </div>
      </form>

      {resendInvitation.isError ? (
        <p role="alert" className="text-sm text-error">
          {resendInvitation.error.message}
        </p>
      ) : null}
      {resentTo ? (
        <p role="status" className="text-sm text-success">
          Invitación reenviada a {resentTo}.
        </p>
      ) : null}

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
                  {canManage ? (
                    <th scope="col" className="px-3 py-2 font-semibold">Acciones</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {people.data.results.map((row) => {
                  if (isInvitedPersonRow(row)) {
                    return (
                      <tr
                        key={`invitation-${row.invitation_id}`}
                        className="border-b border-border-light bg-card-light/40"
                      >
                        <td className="px-3 py-2 text-text-base">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="info">Invitada (pendiente)</Badge>
                            <span className="font-medium">{row.display_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-text-secondary">—</td>
                        <td className="px-3 py-2 text-text-secondary">—</td>
                        <td className="px-3 py-2 text-text-secondary">—</td>
                        <td className="px-3 py-2 text-text-base">{formatDate(row.invited_at)}</td>
                        <td className="px-3 py-2 text-text-secondary">—</td>
                        {canManage ? (
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={resendInvitation.isPending}
                                onClick={() => {
                                  setResentTo(null);
                                  resendInvitation.mutate(row.invitation_id, {
                                    onSuccess: () => setResentTo(row.display_name),
                                  });
                                }}
                              >
                                Reenviar
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                onClick={() => {
                                  revokeInvitation.reset();
                                  setRevoking(row);
                                }}
                              >
                                Revocar
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.user_id} className="border-b border-border-light">
                      <td className="px-3 py-2 text-text-base">
                        <Link
                          href={`/entidad/${slug}/personas/${row.user_id}`}
                          className="font-medium text-primary-700 underline"
                        >
                          {row.public_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-text-base">{row.communities_count}</td>
                      <td className="px-3 py-2 text-text-base">{row.events_period}</td>
                      <td className="px-3 py-2 text-text-base">{row.attended_period}</td>
                      <td className="px-3 py-2 text-text-base">{formatDate(row.joined_at)}</td>
                      <td className="px-3 py-2 text-text-base">
                        {row.referent ? row.referent.public_name : "Sin referente"}
                      </td>
                      {canManage ? <td className="px-3 py-2 text-text-secondary">—</td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={!people.data.previous}
              onClick={() => {
                setResentTo(null);
                setPage((prev) => Math.max(1, prev - 1));
              }}
            >
              Anterior
            </Button>
            <span className="text-sm text-text-secondary">{people.data.count} personas</span>
            <Button
              type="button"
              variant="secondary"
              disabled={!people.data.next}
              onClick={() => {
                setResentTo(null);
                setPage((prev) => prev + 1);
              }}
            >
              Siguiente
            </Button>
          </div>
        </>
      )}

      {addOpen ? <AddPersonDialog orgId={orgId} onClose={() => setAddOpen(false)} /> : null}
      {importOpen ? <ImportPeopleDialog orgId={orgId} onClose={() => setImportOpen(false)} /> : null}

      <ConfirmDialog
        open={revoking !== null}
        title="Revocar invitación"
        description={
          // El error de la revocación se lee aquí dentro: el diálogo solo
          // se cierra si la llamada sale bien, así que quien acaba de
          // pulsar «Revocar» ve el motivo sin perder el contexto.
          <div className="flex flex-col gap-2">
            <p>
              {revoking
                ? `¿Revocar la invitación a «${revoking.display_name}»? Esta acción no se puede deshacer.`
                : ""}
            </p>
            {revokeInvitation.isError ? (
              <p role="alert" className="text-error">
                {revokeInvitation.error.message}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Revocar"
        pending={revokeInvitation.isPending}
        onConfirm={() => {
          if (!revoking) return;
          revokeInvitation.mutate(revoking.invitation_id, { onSuccess: () => setRevoking(null) });
        }}
        onCancel={() => {
          revokeInvitation.reset();
          setRevoking(null);
        }}
      />
    </div>
  );
}
