"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  useApproveCommunityMember,
  useChangeCommunityMemberRole,
  useKickCommunityMember,
  useRejectCommunityMember,
} from "@/hooks/useCommunityMemberActions";
import { useCommunityMembers, useCommunityPendingRequests } from "@/hooks/useCommunityMembers";
import { useEntityCommunities } from "@/hooks/useEntityCommunities";
import type { CommunityMember, EntityCommunityRow } from "@/lib/api/types";

export interface ComunidadesPanelProps {
  orgId: number | string;
}

function CommunityCard({
  community,
  selected,
  onSelect,
}: {
  community: EntityCommunityRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`w-full rounded-lg border p-4 text-left transition-colors ${
          selected ? "border-primary-700 bg-category-light" : "border-border bg-white hover:bg-border-light"
        }`}
      >
        <p className="font-medium text-text-base">{community.name}</p>
        <p className="mt-1 text-xs text-text-secondary">
          {community.visibility === "open"
            ? "Abierta"
            : community.visibility === "on_request"
              ? "Con solicitud"
              : "Privada"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="info">{community.members_count} miembros</Badge>
          <Badge tone="neutral">{community.active_members_count} activos</Badge>
          <Badge tone="neutral">{community.upcoming_events_count} actividades próximas</Badge>
        </div>
      </button>
    </li>
  );
}

function MemberRow({
  member,
  communityId,
}: {
  member: CommunityMember;
  communityId: string;
}) {
  const changeRole = useChangeCommunityMemberRole();
  const kick = useKickCommunityMember();

  return (
    <tr className="border-b border-border-light">
      <td className="px-3 py-2 text-text-base">{member.full_name}</td>
      <td className="px-3 py-2 text-text-base">{member.role}</td>
      <td className="px-3 py-2 text-text-base">
        <div className="flex flex-wrap gap-2">
          {member.role !== "owner" ? (
            <>
              {member.role !== "moderator" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={changeRole.isPending}
                  onClick={() =>
                    changeRole.mutate({ communityId, memberId: member.id, role: "moderator" })
                  }
                >
                  Hacer moderador
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={changeRole.isPending}
                  onClick={() => changeRole.mutate({ communityId, memberId: member.id, role: "member" })}
                >
                  Quitar moderación
                </Button>
              )}
              <Button
                type="button"
                variant="danger"
                disabled={kick.isPending}
                onClick={() => kick.mutate({ communityId, memberId: member.id })}
              >
                Expulsar
              </Button>
            </>
          ) : (
            <span className="text-xs text-text-secondary">Propietario</span>
          )}
        </div>
        {changeRole.isError ? (
          <p role="alert" className="mt-1 text-xs text-error">
            {changeRole.error.message}
          </p>
        ) : null}
        {kick.isError ? (
          <p role="alert" className="mt-1 text-xs text-error">
            {kick.error.message}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

function PendingRow({ member, communityId }: { member: CommunityMember; communityId: string }) {
  const approve = useApproveCommunityMember();
  const reject = useRejectCommunityMember();

  return (
    <tr className="border-b border-border-light">
      <td className="px-3 py-2 text-text-base">{member.full_name}</td>
      <td className="px-3 py-2 text-text-base">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={approve.isPending}
            onClick={() => approve.mutate({ communityId, memberId: member.id })}
          >
            Aprobar
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={reject.isPending}
            onClick={() => reject.mutate({ communityId, memberId: member.id })}
          >
            Rechazar
          </Button>
        </div>
        {approve.isError ? (
          <p role="alert" className="mt-1 text-xs text-error">
            {approve.error.message}
          </p>
        ) : null}
        {reject.isError ? (
          <p role="alert" className="mt-1 text-xs text-error">
            {reject.error.message}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

function CommunityDetail({ communityId }: { communityId: string }) {
  const members = useCommunityMembers(communityId);
  const pending = useCommunityPendingRequests(communityId);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="pendientes-heading">
        <h3 id="pendientes-heading" className="mb-2 text-base font-semibold text-text-base">
          Solicitudes pendientes
        </h3>
        {pending.isError ? (
          <ErrorState title="No se pudieron cargar las solicitudes" description={pending.error.message} />
        ) : !pending.data ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : pending.data.length === 0 ? (
          <EmptyState title="Sin solicitudes pendientes" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Solicitudes pendientes de la comunidad</caption>
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th scope="col" className="px-3 py-2 font-semibold">Persona</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pending.data.map((member) => (
                  <PendingRow key={member.id} member={member} communityId={communityId} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="miembros-heading">
        <h3 id="miembros-heading" className="mb-2 text-base font-semibold text-text-base">
          Miembros
        </h3>
        {members.isError ? (
          <ErrorState title="No se pudieron cargar los miembros" description={members.error.message} />
        ) : !members.data ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : members.data.length === 0 ? (
          <EmptyState title="Sin miembros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Miembros de la comunidad</caption>
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th scope="col" className="px-3 py-2 font-semibold">Persona</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Rol</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {members.data.map((member) => (
                  <MemberRow key={member.id} member={member} communityId={communityId} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Comunidades de la entidad (tarea W4a): lista con actividad
 * (`members_count`/`active_members_count`/`upcoming_events_count`, ya en
 * `CommunityListSerializer`) y, al elegir una, sus solicitudes pendientes
 * y miembros con aprobar/rechazar/cambiar rol/expulsar — todo contra la
 * API general de comunidades (`lib/api/endpoints.ts::COMMUNITIES`), que el
 * panel reutiliza porque no existe una ruta de `panel` propia para esto.
 *
 * **Hueco conocido** (ver informe): el listado sale de `GET
 * /api/communities/`, que no admite filtrar por entidad ni salta la
 * visibilidad de las comunidades `private` — una comunidad privada de
 * esta entidad de la que quien mira no sea miembro no aparecerá aquí.
 */
export function ComunidadesPanel({ orgId }: ComunidadesPanelProps) {
  const communities = useEntityCommunities(orgId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (communities.isError) {
    return (
      <ErrorState
        title="No se pudieron cargar las comunidades"
        description={communities.error.message}
      />
    );
  }

  if (!communities.data) {
    return <p className="text-sm text-text-secondary">Cargando comunidades…</p>;
  }

  if (communities.data.length === 0) {
    return (
      <EmptyState
        title="Sin comunidades"
        description="Esta entidad todavía no tiene comunidades con su sello."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <ul className="flex flex-col gap-3 md:w-80 md:shrink-0">
        {communities.data.map((community) => (
          <CommunityCard
            key={community.id}
            community={community}
            selected={community.id === selectedId}
            onSelect={() => setSelectedId(community.id)}
          />
        ))}
      </ul>
      <div className="flex-1">
        {selectedId ? (
          <Card>
            <CommunityDetail communityId={selectedId} />
          </Card>
        ) : (
          <EmptyState title="Elige una comunidad" description="Selecciona una comunidad de la lista para ver sus miembros y solicitudes." />
        )}
      </div>
    </div>
  );
}
