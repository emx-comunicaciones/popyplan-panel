"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EditarComunidadDialog } from "@/components/entidad/EditarComunidadDialog";
import { NuevaComunidadDialog } from "@/components/entidad/NuevaComunidadDialog";
import {
  useApproveCommunityMember,
  useChangeCommunityMemberRole,
  useKickCommunityMember,
  useRejectCommunityMember,
} from "@/hooks/useCommunityMemberActions";
import { useCommunityMembers, useCommunityPendingRequests } from "@/hooks/useCommunityMembers";
import { useEntityCommunities } from "@/hooks/useEntityCommunities";
import type { CommunityMember, EntityCommunityRow } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

export interface ComunidadesPanelProps {
  orgId: number | string;
  /** Titular/moderador: ven «Nueva comunidad» (`space: 'members'`, mismo diálogo que Familias). */
  canManage: boolean;
}

const MEMBER_ACTION_ERROR_KEYS = {
  approve: "errors.communityMemberAction.approve",
  reject: "errors.communityMemberAction.reject",
  kick: "errors.communityMemberAction.kick",
  changeRole: "errors.communityMemberAction.changeRole",
} as const;

const ENTITY_COMMUNITIES_ERROR_KEYS = {
  demasiadas_paginas: "errors.entityCommunities.demasiadasPaginas",
  desconocido: "errors.entityCommunities.desconocido",
} as const;

function CommunityCard({
  community,
  selected,
  onSelect,
}: {
  community: EntityCommunityRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("entidad.comunidades");

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
            ? t("visibilityOpen")
            : community.visibility === "on_request"
              ? t("visibilityOnRequest")
              : t("visibilityPrivate")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="info">{t("membersBadge", { count: community.members_count })}</Badge>
          <Badge tone="neutral">{t("activeMembersBadge", { count: community.active_members_count })}</Badge>
          <Badge tone="neutral">{t("upcomingEventsBadge", { count: community.upcoming_events_count })}</Badge>
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
  const [confirmingKick, setConfirmingKick] = useState(false);
  const t = useTranslations("entidad.comunidades");
  const tAll = useTranslations();

  return (
    <tr className="border-b border-border-light">
      <td className="px-3 py-1.5 text-text-base">{member.full_name}</td>
      <td className="px-3 py-1.5 text-text-base">{member.role}</td>
      <td className="px-3 py-1.5 text-text-base">
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
                  {t("makeModerator")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={changeRole.isPending}
                  onClick={() => changeRole.mutate({ communityId, memberId: member.id, role: "member" })}
                >
                  {t("removeModeration")}
                </Button>
              )}
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  kick.reset();
                  setConfirmingKick(true);
                }}
              >
                {t("kick")}
              </Button>
            </>
          ) : (
            <span className="text-xs text-text-secondary">{t("owner")}</span>
          )}
        </div>
        {changeRole.isError ? (
          <p role="alert" className="mt-1 text-xs text-error">
            {errorKindText(changeRole.error, MEMBER_ACTION_ERROR_KEYS, tAll, "errors.communityMemberAction.changeRole")}
          </p>
        ) : null}

        <ConfirmDialog
          open={confirmingKick}
          title={t("kickTitle")}
          description={
            // Mismo patrón que «Revocar» en `PersonasTable`: el error se
            // lee dentro del diálogo, que solo se cierra si la expulsión
            // llega a hacerse.
            <div className="flex flex-col gap-2">
              <p>{t("kickConfirm", { name: member.full_name })}</p>
              {kick.isError ? (
                <p role="alert" className="text-error">
                  {errorKindText(kick.error, MEMBER_ACTION_ERROR_KEYS, tAll, "errors.communityMemberAction.kick")}
                </p>
              ) : null}
            </div>
          }
          confirmLabel={t("kick")}
          pending={kick.isPending}
          onConfirm={() =>
            kick.mutate(
              { communityId, memberId: member.id },
              { onSuccess: () => setConfirmingKick(false) },
            )
          }
          onCancel={() => {
            kick.reset();
            setConfirmingKick(false);
          }}
        />
      </td>
    </tr>
  );
}

function PendingRow({ member, communityId }: { member: CommunityMember; communityId: string }) {
  const approve = useApproveCommunityMember();
  const reject = useRejectCommunityMember();
  const t = useTranslations("entidad.comunidades");
  const tAll = useTranslations();

  return (
    <tr className="border-b border-border-light">
      <td className="px-3 py-1.5 text-text-base">{member.full_name}</td>
      <td className="px-3 py-1.5 text-text-base">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={approve.isPending}
            onClick={() => approve.mutate({ communityId, memberId: member.id })}
          >
            {t("approve")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={reject.isPending}
            onClick={() => reject.mutate({ communityId, memberId: member.id })}
          >
            {t("reject")}
          </Button>
        </div>
        {approve.isError ? (
          <p role="alert" className="mt-1 text-xs text-error">
            {errorKindText(approve.error, MEMBER_ACTION_ERROR_KEYS, tAll, "errors.communityMemberAction.approve")}
          </p>
        ) : null}
        {reject.isError ? (
          <p role="alert" className="mt-1 text-xs text-error">
            {errorKindText(reject.error, MEMBER_ACTION_ERROR_KEYS, tAll, "errors.communityMemberAction.reject")}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

function CommunityDetail({ communityId }: { communityId: string }) {
  const members = useCommunityMembers(communityId);
  const pending = useCommunityPendingRequests(communityId);
  const t = useTranslations("entidad.comunidades");
  const tAll = useTranslations();

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="pendientes-heading">
        <h2 id="pendientes-heading" className="mb-2 text-base font-semibold text-text-base">
          {t("pendingHeading")}
        </h2>
        {pending.isError ? (
          <ErrorState title={t("pendingError")} description={tAll("errors.communityPendingRequests.desconocido")} />
        ) : !pending.data ? (
          <p className="text-sm text-text-secondary">{t("loading")}</p>
        ) : pending.data.length === 0 ? (
          <EmptyState title={t("noPending")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t("pendingTableCaption")}</caption>
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th scope="col" className="px-3 py-1.5 font-semibold">{t("colPerson")}</th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">{t("colActions")}</th>
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
        <h2 id="miembros-heading" className="mb-2 text-base font-semibold text-text-base">
          {t("membersHeading")}
        </h2>
        {members.isError ? (
          <ErrorState title={t("membersError")} description={tAll("errors.communityMembers.desconocido")} />
        ) : !members.data ? (
          <p className="text-sm text-text-secondary">{t("loading")}</p>
        ) : members.data.length === 0 ? (
          <EmptyState title={t("noMembers")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t("membersTableCaption")}</caption>
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th scope="col" className="px-3 py-1.5 font-semibold">{t("colPerson")}</th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">{t("colRole")}</th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">{t("colActions")}</th>
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
 * **«Nueva comunidad» (encargo del propietario, 2026-09-20)**: solo
 * `canManage` (titular/moderador, calculado en el Server Component igual
 * que en Familias/Recursos) ve el botón, que abre el mismo
 * `NuevaComunidadDialog` que usa `FamiliasPanel.tsx` con `space:
 * 'members'` en vez de `'families'` (`hooks/useCreateCommunity.ts`,
 * mismo endpoint `POST /api/communities/`). El botón vive también en el
 * estado vacío (sin él, una entidad sin comunidades no tendría forma de
 * crear la primera desde aquí). Al crearla con éxito, se selecciona sola
 * (`onCreated`) para no obligar a buscarla en la lista recién
 * refrescada.
 *
 * **«Editar» (encargo del propietario: «no puedo editar la comunidad que
 * he creado»)**: mismo `canManage`, botón junto al nombre de la
 * comunidad seleccionada que abre `EditarComunidadDialog.tsx`
 * (`hooks/useUpdateCommunity.ts`, `PATCH /api/communities/{id}/` con
 * `name`/`description`/`visibility`/`code_of_conduct` — `space` nunca se
 * edita, el backend lo rechaza tras crear la comunidad). El diálogo solo
 * se monta mientras hay una comunidad en edición (`editingCommunity`),
 * con `key={editingCommunity.id}` para que cambiar de comunidad sin
 * cerrar antes (imposible por el propio overlay modal, pero por si
 * acaso) siempre remonte el formulario en vez de reutilizar estado de la
 * anterior — mismo motivo que el bug A3 de `ResourceForm` documentado en
 * `CLAUDE.md`.
 *
 * **Hueco conocido** (ver informe): el listado sale de `GET
 * /api/communities/`, que no admite filtrar por entidad ni salta la
 * visibilidad de las comunidades `private` — una comunidad privada de
 * esta entidad de la que quien mira no sea miembro no aparecerá aquí.
 */
export function ComunidadesPanel({ orgId, canManage }: ComunidadesPanelProps) {
  const communities = useEntityCommunities(orgId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<EntityCommunityRow | null>(null);
  const t = useTranslations("entidad.comunidades");
  const tAll = useTranslations();

  const newCommunityButton = canManage ? (
    <div className="flex justify-end">
      <Button type="button" onClick={() => setCreating(true)}>
        {t("newCommunityTitle")}
      </Button>
    </div>
  ) : null;

  const dialog = canManage ? (
    <NuevaComunidadDialog
      orgId={orgId}
      space="members"
      open={creating}
      onClose={() => setCreating(false)}
      onCreated={(community) => setSelectedId(community.id)}
    />
  ) : null;

  const editDialog = editingCommunity ? (
    <EditarComunidadDialog
      key={editingCommunity.id}
      orgId={orgId}
      community={editingCommunity}
      onClose={() => setEditingCommunity(null)}
    />
  ) : null;

  if (communities.isError) {
    return (
      <>
        <ErrorState
          title={t("loadError")}
          description={errorKindText(
            communities.error,
            ENTITY_COMMUNITIES_ERROR_KEYS,
            tAll,
            "errors.entityCommunities.desconocido",
          )}
        />
        {dialog}
        {editDialog}
      </>
    );
  }

  if (!communities.data) {
    return <p className="text-sm text-text-secondary">{t("loadingCommunities")}</p>;
  }

  if (communities.data.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {newCommunityButton}
        <EmptyState title={t("empty")} description={t("emptyDescription")} />
        {dialog}
        {editDialog}
      </div>
    );
  }

  const selectedCommunity = communities.data.find((community) => community.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {newCommunityButton}
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
          {selectedCommunity ? (
            <Card>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-text-base">{selectedCommunity.name}</h2>
                {canManage ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditingCommunity(selectedCommunity)}
                  >
                    {t("edit")}
                  </Button>
                ) : null}
              </div>
              <CommunityDetail communityId={selectedCommunity.id} />
            </Card>
          ) : (
            <EmptyState title={t("choose")} description={t("chooseDescription")} />
          )}
        </div>
      </div>
      {dialog}
      {editDialog}
    </div>
  );
}
