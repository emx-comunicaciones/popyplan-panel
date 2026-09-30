"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

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
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useResendInvitation } from "@/hooks/useResendInvitation";
import { useRevokeInvitation } from "@/hooks/useRevokeInvitation";
import type { InvitedPersonRow } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeForUseLocale } from "@/lib/i18n/locale";
import { isInvitedPersonRow } from "@/lib/people/invitedRow";
import { presetPeriod } from "@/lib/metrics/period";
import { buildPersonasQuery, parsePersonasQuery } from "@/lib/people/personasQuery";

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

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(localeForUseLocale(locale));
}

const RESEND_INVITATION_ERROR_KEYS = {
  invalido: "errors.resendInvitation.invalido",
  sin_permiso: "errors.resendInvitation.sinPermiso",
  no_encontrada: "errors.resendInvitation.noEncontrada",
  desconocido: "errors.resendInvitation.desconocido",
} as const;

const REVOKE_INVITATION_ERROR_KEYS = {
  invalido: "errors.revokeInvitation.invalido",
  sin_permiso: "errors.revokeInvitation.sinPermiso",
  no_encontrada: "errors.revokeInvitation.noEncontrada",
  desconocido: "errors.revokeInvitation.desconocido",
} as const;

const PEOPLE_ERROR_KEYS = {
  periodo_invalido: "errors.people.periodoInvalido",
  sin_acceso: "errors.people.sinAcceso",
  pagina_inexistente: "errors.people.paginaInexistente",
  desconocido: "errors.people.desconocido",
} as const;

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
  const t = useTranslations("entidad.personas");
  if (invitations.isError) {
    return (
      <span role="status" className="text-xs text-error">
        {t("invitationsCountError")}
      </span>
    );
  }
  if (!invitations.data) return null;
  const count = invitations.data.length;
  return <span className="text-xs text-text-secondary">{t("pendingInvitations", { count })}</span>;
}

/**
 * Tabla de personas de la entidad (`docs/PANEL.md` §3.2): filtros
 * comunidad (select de `useEntityCommunities` — el backend solo acepta el
 * UUID, un texto libre daba 400 a toda la tabla)/referente/participación
 * (`active_since`)/alta (`joined_since`)
 * más búsqueda, y paginación estándar de DRF. «Referente» es un select de
 * los referentes del equipo por nombre (`useOrgMembers`); «Comunidad» solo
 * ofrece las del espacio de miembros (las de Familias tienen su propia
 * pantalla y Personas nunca las cuenta). Los filtros y la página viven en
 * la URL (`lib/people/personasQuery.ts`): al volver de una ficha la tabla
 * reaparece como se dejó. Cada fila enlaza a la ficha
 * operativa (`personas/[userId]`). Tarea W3b: botones «Añadir persona» e
 * «Importar Excel/CSV» (solo `canManage`) y checkbox «Incluir invitadas»
 * (`include_invited=true`, §3b.7) que mezcla filas `InvitedPersonRow`
 * («Invitada (pendiente)») al final de la página, con «Reenviar»/
 * «Revocar» (solo `canManage`).
 */
export function PersonasTable({ orgId, slug, canManage }: PersonasTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Solo se lee al montar: a partir de ahí manda el estado local y la URL
  // se limita a reflejarlo.
  const [initial] = useState(() => parsePersonasQuery(searchParams));
  const [filters, setFilters] = useState<PersonasFilters>({
    search: initial.search,
    community: initial.community,
    referent: initial.referent,
    activeSince: initial.activeSince,
    joinedSince: initial.joinedSince,
  });
  const [page, setPage] = useState(initial.page);
  const [includeInvited, setIncludeInvited] = useState(initial.includeInvited);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [revoking, setRevoking] = useState<InvitedPersonRow | null>(null);
  const [resentTo, setResentTo] = useState<string | null>(null);
  const period = presetPeriod("mes");
  const communities = useEntityCommunities(orgId);
  // El referente ve solo a sus personas: para él el filtro no tiene sentido
  // y el equipo (solo titular) ni se pide.
  const members = useOrgMembers(orgId, { enabled: canManage });
  const referentes = (members.data ?? []).filter((member) => member.role === "referente");
  const communityOptions = (communities.data ?? []).filter((community) => community.space !== "families");
  const t = useTranslations("entidad.personas");
  const tAll = useTranslations();
  const locale = useLocale();

  /**
   * Los campos que se teclean (búsqueda y las dos fechas) se
   * aplican con retardo (`useDebouncedValue`, 300 ms): el `<input>` es
   * inmediato, pero la query solo cambia cuando se para de escribir —
   * si no, «ana» disparaba tres peticiones y las respuestas podían
   * llegar desordenadas. «Comunidad» y «Referente» son `<select>` (un único
   * evento por elección), así que se aplican tal cual.
   */
  const search = useDebouncedValue(filters.search);
  const activeSince = useDebouncedValue(filters.activeSince);
  const joinedSince = useDebouncedValue(filters.joinedSince);

  const people = usePeople(orgId, period, {
    search: search || undefined,
    community: filters.community || undefined,
    referent: filters.referent ? Number(filters.referent) : undefined,
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
  const firstRun = useRef(true);
  useEffect(() => {
    // Al montar, la página viene de la URL: no se pisa con la 1.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setPage(1);
  }, [search, activeSince, joinedSince]);

  /**
   * Refleja en la URL lo que se está aplicando (búsqueda y fechas ya con
   * su retardo), con `replace` para no llenar el historial de una entrada
   * por filtro. Si la URL ya dice lo mismo no se toca.
   */
  const appliedQuery = buildPersonasQuery({
    search,
    community: filters.community,
    referent: filters.referent,
    activeSince,
    joinedSince,
    includeInvited,
    page,
  });
  useEffect(() => {
    if (appliedQuery === buildPersonasQuery(parsePersonasQuery(searchParams))) return;
    router.replace(appliedQuery ? `${pathname}?${appliedQuery}` : pathname, { scroll: false });
    // `searchParams` no entra: cambia como consecuencia de este `replace`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQuery]);

  function updateFilter<K extends keyof PersonasFilters>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setAddOpen(true)}>
            {t("addPerson")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
            {t("importExcelCsv")}
          </Button>
        </div>
      ) : null}

      <form aria-label={t("filtersLabel")} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="personas-search" className="mb-1 block text-sm font-medium text-text-form">
            {t("searchLabel")}
          </label>
          <input
            id="personas-search"
            type="text"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="personas-community" className="mb-1 block text-sm font-medium text-text-form">
            {t("communityLabel")}
          </label>
          <select
            id="personas-community"
            value={filters.community}
            onChange={(event) => {
              updateFilter("community", event.target.value);
              setPage(1);
            }}
            aria-describedby={communities.isError ? "personas-community-error" : undefined}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          >
            <option value="">{t("communityAll")}</option>
            {communityOptions.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </select>
          {communities.isError ? (
            <p id="personas-community-error" role="alert" className="mt-1 text-xs text-error">
              {t("communitiesError")}
            </p>
          ) : null}
        </div>
        {canManage ? (
          <div>
            <label htmlFor="personas-referent" className="mb-1 block text-sm font-medium text-text-form">
              {t("referentLabel")}
            </label>
            <select
              id="personas-referent"
              value={filters.referent}
              onChange={(event) => {
                updateFilter("referent", event.target.value);
                setPage(1);
              }}
              aria-describedby={members.isError ? "personas-referent-error" : undefined}
              className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            >
              <option value="">{t("referentAll")}</option>
              {referentes.map((member) => (
                <option key={member.user} value={member.user}>
                  {member.public_name}
                </option>
              ))}
            </select>
            {members.isError ? (
              <p id="personas-referent-error" role="alert" className="mt-1 text-xs text-error">
                {tAll("people.referentsLoadError")}
              </p>
            ) : null}
          </div>
        ) : null}
        <div>
          <label htmlFor="personas-active-since" className="mb-1 block text-sm font-medium text-text-form">
            {t("activeSinceLabel")}
          </label>
          <input
            id="personas-active-since"
            type="date"
            value={filters.activeSince}
            onChange={(event) => updateFilter("activeSince", event.target.value)}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="personas-joined-since" className="mb-1 block text-sm font-medium text-text-form">
            {t("joinedSinceLabel")}
          </label>
          <input
            id="personas-joined-since"
            type="date"
            value={filters.joinedSince}
            onChange={(event) => updateFilter("joinedSince", event.target.value)}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
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
            {t("includeInvited")}
          </label>
          {includeInvited ? <PendingInvitationsHint orgId={orgId} /> : null}
        </div>
      </form>

      {resendInvitation.isError ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(
            resendInvitation.error,
            RESEND_INVITATION_ERROR_KEYS,
            tAll,
            "errors.resendInvitation.desconocido",
          )}
        </p>
      ) : null}
      {resentTo ? (
        <p role="status" className="text-sm text-success">
          {t("resentTo", { email: resentTo })}
        </p>
      ) : null}

      {people.isError ? (
        <ErrorState
          title={t("loadError")}
          description={errorKindText(people.error, PEOPLE_ERROR_KEYS, tAll, "errors.people.desconocido")}
        />
      ) : !people.data ? (
        <p className="text-sm text-text-secondary">{t("loadingPeople")}</p>
      ) : people.data.results.length === 0 ? (
        <EmptyState title={t("emptyFiltered")} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t("tableCaption")}</caption>
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th scope="col" className="px-3 py-1.5 font-semibold">{t("colName")}</th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">{t("colCommunities")}</th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">{t("colEventsPeriod")}</th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">{t("colAttendedPeriod")}</th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">{t("colJoined")}</th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">{t("colReferent")}</th>
                  {canManage ? (
                    <th scope="col" className="px-3 py-1.5 font-semibold">{t("colActions")}</th>
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
                        <td className="px-3 py-1.5 text-text-base">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="info">{t("invitedBadge")}</Badge>
                            <span className="font-medium">{row.display_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-text-secondary">—</td>
                        <td className="px-3 py-1.5 text-text-secondary">—</td>
                        <td className="px-3 py-1.5 text-text-secondary">—</td>
                        <td className="px-3 py-1.5 text-text-base">{formatDate(row.invited_at, locale)}</td>
                        <td className="px-3 py-1.5 text-text-secondary">—</td>
                        {canManage ? (
                          <td className="px-3 py-1.5">
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
                                {t("resend")}
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                onClick={() => {
                                  revokeInvitation.reset();
                                  setRevoking(row);
                                }}
                              >
                                {t("revoke")}
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.user_id} className="border-b border-border-light">
                      <td className="px-3 py-1.5 text-text-base">
                        <Link
                          href={`/entidad/${slug}/personas/${row.user_id}${appliedQuery ? `?volver=${encodeURIComponent(appliedQuery)}` : ""}`}
                          className="font-medium text-primary-700 underline"
                        >
                          {row.public_name}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 text-text-base">{row.communities_count}</td>
                      <td className="px-3 py-1.5 text-text-base">{row.events_period}</td>
                      <td className="px-3 py-1.5 text-text-base">{row.attended_period}</td>
                      <td className="px-3 py-1.5 text-text-base">{formatDate(row.joined_at, locale)}</td>
                      <td className="px-3 py-1.5 text-text-base">
                        {row.referent ? row.referent.public_name : t("noReferent")}
                      </td>
                      {canManage ? <td className="px-3 py-1.5 text-text-secondary">—</td> : null}
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
              {t("previous")}
            </Button>
            <span className="text-sm text-text-secondary">{t("countLabel", { count: people.data.count })}</span>
            <Button
              type="button"
              variant="secondary"
              disabled={!people.data.next}
              onClick={() => {
                setResentTo(null);
                setPage((prev) => prev + 1);
              }}
            >
              {t("next")}
            </Button>
          </div>
        </>
      )}

      {addOpen ? <AddPersonDialog orgId={orgId} onClose={() => setAddOpen(false)} /> : null}
      {importOpen ? <ImportPeopleDialog orgId={orgId} onClose={() => setImportOpen(false)} /> : null}

      <ConfirmDialog
        open={revoking !== null}
        title={t("revokeTitle")}
        description={
          // El error de la revocación se lee aquí dentro: el diálogo solo
          // se cierra si la llamada sale bien, así que quien acaba de
          // pulsar «Revocar» ve el motivo sin perder el contexto.
          <div className="flex flex-col gap-2">
            <p>{revoking ? t("revokeConfirm", { name: revoking.display_name }) : ""}</p>
            {revokeInvitation.isError ? (
              <p role="alert" className="text-error">
                {errorKindText(
                  revokeInvitation.error,
                  REVOKE_INVITATION_ERROR_KEYS,
                  tAll,
                  "errors.revokeInvitation.desconocido",
                )}
              </p>
            ) : null}
          </div>
        }
        confirmLabel={t("revoke")}
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
