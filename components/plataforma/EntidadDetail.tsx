"use client";

/**
 * Ficha de una entidad desde plataforma (tarea W5): Datos, Paraguas,
 * Ámbito, Equipo, Métricas, Comunidades y actividades. Carry-over
 * cerrado en la tarea W6: hasta la tarea backend P7, Equipo y Métricas
 * daban 403 para la plataforma sin membresía real en la entidad
 * (`entities/permissions.py::puede`/`PuedeEnEntidad('ver_panel')` no
 * reconocían ningún rol de plataforma). Desde P7, `panel/permissions.py
 * ::PuedeEnEntidad` tiene un atajo (`docs/PANEL.md` §10.2): `superadmin`
 * y `moderator` pasan las cinco comprobaciones del panel (incluidas
 * `equipo` y `ver_panel`) sin membresía real; `support` solo `ver_panel`
 * (ve Métricas, no Equipo); `verifier` (o sin rol de plataforma) sigue
 * dependiendo solo de su membresía real. Los errores «Sin acceso» de
 * abajo, por tanto, solo deberían verse hoy con `verifier` o con una
 * membresía real insuficiente — no es ya el caso general.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  useOrgMembers,
  useAddOrgMember,
  useRemoveOrgMember,
  type OrgMembersErrorKind,
} from "@/hooks/useOrgMembers";
import {
  useOrgReferences,
  useCreateOrgReference,
  useRemoveOrgReference,
  type OrgReferencesErrorKind,
} from "@/hooks/useOrgReferences";
import { useOrganization } from "@/hooks/useOrganization";
import {
  useOrganizations,
  useSetOrganizationParent,
  useVerifyOrganization,
  type OrganizationsErrorKind,
} from "@/hooks/useOrganizations";
import { useOrgScope, type OrgScopeErrorKind } from "@/hooks/useOrgScope";
import { useEntityCommunities, type EntityCommunitiesErrorKind } from "@/hooks/useEntityCommunities";
import { useEntityEvents, type EntityEventsErrorKind } from "@/hooks/useEntityEvents";
import { useContracts, useInvoices, type BillingErrorKind } from "@/hooks/useBilling";
import { useMetrics, type MetricsErrorKind } from "@/hooks/useMetrics";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { presetPeriod } from "@/lib/metrics/period";
import { formatEuros } from "@/lib/programs/money";
import { canManageTeamFromPlatform } from "@/lib/auth/plataformaMenu";
import type {
  InvoiceStatus,
  OrgMembershipFull,
  OrgMembershipRole,
  Reference,
} from "@/lib/api/types";

export interface EntidadDetailProps {
  orgId: number | string;
  /** `null` si no hay sesión de plataforma (no debería pasar: la página redirige antes). */
  role: string | null;
}

const SECTIONS = [
  "datos",
  "paraguas",
  "ambito",
  "equipo",
  "metricas",
  "comunidades",
  "contrato",
] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_LABEL_KEYS: Record<Section, string> = {
  datos: "plataforma.entidadFicha.tabDatos",
  paraguas: "plataforma.entidadFicha.tabParaguas",
  ambito: "plataforma.entidadFicha.tabAmbito",
  equipo: "plataforma.entidadFicha.tabEquipo",
  metricas: "plataforma.metricas.heading",
  comunidades: "plataforma.entidadFicha.tabComunidades",
  contrato: "plataforma.entidadFicha.tabContrato",
};

const CONTRACT_STATUS_LABEL_KEYS: Record<string, string> = {
  draft: "plataforma.contratos.statusDraft",
  active: "plataforma.contratos.statusActive",
  ended: "plataforma.contratos.statusEnded",
};

const INVOICE_STATUS_LABEL_KEYS: Record<InvoiceStatus, string> = {
  paid: "plataforma.contratos.invoiceStatusPaid",
  pending: "plataforma.contratos.invoiceStatusPending",
  overdue: "plataforma.contratos.invoiceStatusOverdue",
};

const ROLE_OPTIONS: OrgMembershipRole[] = [
  "titular",
  "moderador",
  "dinamizador",
  "analista",
  "referente",
  "voluntario",
];

// Reutiliza exactamente las mismas claves que `ConfiguracionPanel.tsx`
// (entidad): los hooks son los mismos y el backend no varía el mensaje
// según quien llama, solo cambia quién puede llegar a disparar cada
// mutación.
const ADD_ORG_MEMBER_ERROR_KEYS: Record<OrgMembersErrorKind, string> = {
  invalido: "errors.addOrgMember.invalido",
  sin_acceso: "errors.addOrgMember.sinAcceso",
  desconocido: "errors.addOrgMember.desconocido",
};

const REMOVE_ORG_MEMBER_ERROR_KEYS: Record<OrgMembersErrorKind, string> = {
  invalido: "errors.removeOrgMember.invalido",
  sin_acceso: "errors.removeOrgMember.sinAcceso",
  desconocido: "errors.removeOrgMember.desconocido",
};

const ORG_MEMBERS_QUERY_ERROR_KEYS: Record<OrgMembersErrorKind, string> = {
  invalido: "errors.orgMembers.desconocido",
  sin_acceso: "errors.orgMembers.sinAcceso",
  desconocido: "errors.orgMembers.desconocido",
};

const CREATE_ORG_REFERENCE_ERROR_KEYS: Record<OrgReferencesErrorKind, string> = {
  invalido: "errors.createOrgReference.invalido",
  desconocido: "errors.createOrgReference.desconocido",
};

const REMOVE_ORG_REFERENCE_ERROR_KEYS: Record<OrgReferencesErrorKind, string> = {
  invalido: "errors.removeOrgReference.invalido",
  desconocido: "errors.removeOrgReference.desconocido",
};

const ORG_SCOPE_ERROR_KEYS: Record<OrgScopeErrorKind, string> = {
  invalido: "errors.orgScope.invalido",
  sin_permiso: "errors.orgScope.sinPermiso",
  desconocido: "errors.orgScope.desconocido",
};

const VERIFY_ORGANIZATION_ERROR_KEYS: Record<OrganizationsErrorKind, string> = {
  invalido: "errors.createOrganization.invalido",
  sin_permiso: "errors.verifyOrganization.sinPermiso",
  desconocido: "errors.verifyOrganization.desconocido",
};

const SET_PARENT_ERROR_KEYS: Record<OrganizationsErrorKind, string> = {
  invalido: "errors.setOrganizationParent.invalido",
  sin_permiso: "errors.setOrganizationParent.sinPermiso",
  desconocido: "errors.setOrganizationParent.desconocido",
};

const ENTITY_COMMUNITIES_ERROR_KEYS: Record<EntityCommunitiesErrorKind, string> = {
  demasiadas_paginas: "errors.entityCommunities.demasiadasPaginas",
  desconocido: "errors.entityCommunities.desconocido",
};

const ENTITY_EVENTS_ERROR_KEYS: Record<EntityEventsErrorKind, string> = {
  periodo_invalido: "errors.entityEvents.periodoInvalido",
  sin_acceso: "errors.entityEvents.sinAcceso",
  desconocido: "errors.entityEvents.desconocido",
};

const METRICS_ERROR_KEYS: Record<MetricsErrorKind, string> = {
  periodo_invalido: "errors.metrics.periodoInvalido",
  sin_acceso: "errors.metrics.sinAcceso",
  desconocido: "errors.metrics.desconocido",
};

// `useContracts({organization: orgId})` e `useInvoices` reutilizan
// `BillingError` (mismo hook que `ContratosPanel.tsx`); su
// «desconocido» es el mismo texto genérico de la consulta de listado
// (esta ficha no distingue «contrato de esta entidad» de «contratos» a
// nivel de mensaje, porque el hook no lo hace).
const CONTRACTS_ERROR_KEYS: Record<BillingErrorKind, string> = {
  sin_acceso: "errors.contractMutation.sinAcceso",
  invalido: "errors.contractMutation.invalido",
  conflicto: "errors.contractMutation.conflicto",
  no_encontrado: "errors.contractMutation.noEncontrado",
  desconocido: "errors.contractsQuery.desconocido",
};

function DatosTab({ orgId, role }: { orgId: number | string; role: string | null }) {
  const t = useTranslations();
  const organization = useOrganization(orgId);
  const verify = useVerifyOrganization();
  const canVerify = role === "verifier" || role === "superadmin";

  if (organization.isError) {
    return (
      <ErrorState
        title={t("plataforma.entidadFicha.loadError")}
        description={t("entidad.configuracion.dataLoadErrorDescription")}
      />
    );
  }
  if (!organization.data) {
    return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  }

  const org = organization.data;

  return (
    <Card title={t("plataforma.entidadFicha.dataCardTitle")}>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-text-secondary">{t("plataforma.entidades.nameHeader")}</dt>
        <dd className="text-text-base">{org.name}</dd>
        <dt className="text-text-secondary">{t("plataforma.entidades.slugLabel")}</dt>
        <dd className="text-text-base">{org.slug}</dd>
        <dt className="text-text-secondary">{t("plataforma.entidades.typeHeader")}</dt>
        <dd className="text-text-base">{org.org_type}</dd>
        <dt className="text-text-secondary">{t("plataforma.entidades.verifiedLabel")}</dt>
        <dd className="text-text-base">
          <Badge tone={org.is_verified ? "success" : "neutral"}>
            {org.is_verified ? t("plataforma.entidades.verifiedTrue") : t("plataforma.entidades.verifiedFalse")}
          </Badge>
        </dd>
        <dt className="text-text-secondary">{t("plataforma.entidades.descriptionLabel")}</dt>
        <dd className="text-text-base">{org.description || "—"}</dd>
        <dt className="text-text-secondary">{t("plataforma.entidadFicha.contactLabel")}</dt>
        <dd className="text-text-base">{org.contact_email || "—"}</dd>
      </dl>
      {!org.is_verified && canVerify ? (
        <div className="mt-3">
          <Button type="button" disabled={verify.isPending} onClick={() => verify.mutate(orgId)}>
            {t("plataforma.entidadFicha.verifyAction")}
          </Button>
          {verify.isError ? (
            <p role="alert" className="mt-1 text-sm text-error">
              {errorKindText(verify.error, VERIFY_ORGANIZATION_ERROR_KEYS, t, "errors.verifyOrganization.desconocido")}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function ParaguasTab({ orgId, role }: { orgId: number | string; role: string | null }) {
  const t = useTranslations();
  const organization = useOrganization(orgId);
  const children = useOrganizations({ parent: orgId });
  const setParent = useSetOrganizationParent();
  const [newParent, setNewParent] = useState("");
  const canSetParent = role === "superadmin";

  return (
    <div className="flex flex-col gap-4">
      <Card title={t("plataforma.entidadFicha.umbrellaCardTitle")}>
        <p className="text-sm text-text-base">
          {t("plataforma.entidadFicha.currentParent", {
            parent: organization.data?.parent ?? t("plataforma.entidadFicha.noParent"),
          })}
        </p>
        {canSetParent ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="paraguas-new-parent" className="mb-1 block text-sm font-medium text-text-form">
                {t("plataforma.entidadFicha.newParentLabel")}
              </label>
              <input
                id="paraguas-new-parent"
                type="number"
                value={newParent}
                onChange={(event) => setNewParent(event.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
              />
            </div>
            <Button
              type="button"
              disabled={setParent.isPending}
              onClick={() =>
                setParent.mutate({ orgId, parent: newParent ? Number(newParent) : null })
              }
            >
              {t("common.save")}
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-text-secondary">{t("errors.setOrganizationParent.sinPermiso")}</p>
        )}
        {setParent.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {errorKindText(setParent.error, SET_PARENT_ERROR_KEYS, t, "errors.setOrganizationParent.desconocido")}
          </p>
        ) : null}
        {setParent.isSuccess ? <p className="mt-2 text-sm text-success">{t("plataforma.entidadFicha.saved")}</p> : null}
      </Card>

      <Card title={t("plataforma.entidadFicha.childrenCardTitle")}>
        {children.isError ? (
          <ErrorState
            title={t("plataforma.entidadFicha.childrenLoadError")}
            description={t("errors.organizations.desconocido")}
          />
        ) : !children.data ? (
          <p className="text-sm text-text-secondary">{t("common.loading")}</p>
        ) : children.data.results.length === 0 ? (
          <EmptyState title={t("plataforma.entidadFicha.childrenEmpty")} />
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {children.data.results.map((child) => (
              <li key={child.id}>{child.name}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AmbitoTab({ orgId, role }: { orgId: number | string; role: string | null }) {
  const t = useTranslations();
  const scope = useOrgScope(orgId);
  const [kind, setKind] = useState<"places" | "comarca" | "province">("places");
  const [value, setValue] = useState("");
  const canManage = role === "superadmin";

  if (!canManage) {
    return (
      <EmptyState
        title={t("common.noAccess")}
        description={t("plataforma.entidadFicha.scopeNoAccessDescription")}
      />
    );
  }

  return (
    <Card title={t("plataforma.entidadFicha.scopeCardTitle")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!value) return;
          if (kind === "places") {
            scope.mutate({ places: value.split(",").map((v) => v.trim()).filter(Boolean) });
          } else if (kind === "comarca") {
            scope.mutate({ comarca: value.trim() });
          } else {
            scope.mutate({ province: value.trim() });
          }
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div>
          <label htmlFor="plataforma-ambito-kind" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.entidades.typeHeader")}
          </label>
          <select
            id="plataforma-ambito-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            <option value="places">{t("plataforma.entidadFicha.scopeKindPlaces")}</option>
            <option value="comarca">{t("metrics.groupBy.comarca")}</option>
            <option value="province">{t("metrics.groupBy.province")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="plataforma-ambito-value" className="mb-1 block text-sm font-medium text-text-form">
            {kind === "places"
              ? t("plataforma.entidadFicha.scopeValuePlaces")
              : t("plataforma.entidadFicha.scopeValueCode")}
          </label>
          <input
            id="plataforma-ambito-value"
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <Button type="submit" disabled={scope.isPending}>
          {t("plataforma.entidadFicha.expandScopeAction")}
        </Button>
      </form>
      {scope.isError ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {errorKindText(scope.error, ORG_SCOPE_ERROR_KEYS, t, "errors.orgScope.desconocido")}
        </p>
      ) : null}
      {scope.isSuccess ? (
        <p className="mt-2 text-sm text-success">
          {t("plataforma.entidadFicha.scopeSuccess", { added: scope.data.added, total: scope.data.total })}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * Pestaña «Equipo»: el listado lo ve cualquier rol que llegue a la ficha;
 * los formularios y los botones «Quitar» solo los roles que el backend
 * deja gestionar el equipo de una entidad sin membresía propia
 * (`TEAM_MANAGER_ROLES`, `lib/auth/plataformaMenu.ts`). Un `verifier` los
 * veía y recibía un 403 al usarlos. Ocultos, nunca deshabilitados, como
 * en el resto del panel.
 */
function EquipoTab({ orgId, role: platformRole }: { orgId: number | string; role: string | null }) {
  const t = useTranslations();
  const canManage = canManageTeamFromPlatform(platformRole);
  const members = useOrgMembers(orgId);
  const addMember = useAddOrgMember(orgId);
  const removeMember = useRemoveOrgMember(orgId);
  const references = useOrgReferences(orgId);
  const createReference = useCreateOrgReference(orgId);
  const removeReference = useRemoveOrgReference(orgId);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<OrgMembershipRole>("dinamizador");
  const [refUser, setRefUser] = useState("");
  const [refReferent, setRefReferent] = useState("");
  const [removingMember, setRemovingMember] = useState<OrgMembershipFull | null>(null);
  const [removingReference, setRemovingReference] = useState<Reference | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text-secondary">
        {canManage
          ? t("plataforma.entidadFicha.teamManageableNotice")
          : t("plataforma.entidadFicha.teamReadOnlyNotice")}
      </p>

      <Card title={t("plataforma.entidadFicha.teamCardTitle")}>
        {canManage ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!userId) return;
              // El campo se vacía solo si el alta sale bien: si falla, el id
              // sigue ahí para corregirlo sin volver a teclearlo.
              addMember.mutate({ user: Number(userId), role }, { onSuccess: () => setUserId("") });
            }}
            className="mb-4 flex flex-wrap items-end gap-3"
          >
            <div>
              <label htmlFor="plataforma-equipo-user" className="mb-1 block text-sm font-medium text-text-form">
                {t("plataforma.roles.userIdLabel")}
              </label>
              <input
                id="plataforma-equipo-user"
                type="number"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
              />
            </div>
            <div>
              <label htmlFor="plataforma-equipo-role" className="mb-1 block text-sm font-medium text-text-form">
                {t("plataforma.roles.roleLabel")}
              </label>
              <select
                id="plataforma-equipo-role"
                value={role}
                onChange={(event) => setRole(event.target.value as OrgMembershipRole)}
                className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
              >
                {ROLE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={addMember.isPending}>
              {t("plataforma.entidadFicha.addAction")}
            </Button>
          </form>
        ) : null}
        {/* Dentro de `canManage`: sin el formulario no hay manera de
            disparar la mutación, así que fuera era una rama muerta. */}
        {canManage && addMember.isError ? (
          <p role="alert" className="mb-2 text-sm text-error">
            {errorKindText(addMember.error, ADD_ORG_MEMBER_ERROR_KEYS, t, "errors.addOrgMember.desconocido")}
          </p>
        ) : null}

        {members.isError ? (
          <EmptyState
            title={t("common.noAccess")}
            description={errorKindText(members.error, ORG_MEMBERS_QUERY_ERROR_KEYS, t, "errors.orgMembers.desconocido")}
          />
        ) : !members.data ? (
          <p className="text-sm text-text-secondary">{t("common.loading")}</p>
        ) : members.data.length === 0 ? (
          <EmptyState title={t("plataforma.entidadFicha.teamEmpty")} />
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {members.data.map((member) => (
              <li key={member.user} className="flex items-center justify-between gap-2">
                <span>
                  {member.public_name} — {member.role}
                </span>
                {canManage ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      removeMember.reset();
                      setRemovingMember(member);
                    }}
                  >
                    {t("plataforma.entidadFicha.removeAction")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("plataforma.entidadFicha.referencesCardTitle")}>
        {canManage ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!refUser || !refReferent) return;
              createReference.mutate(
                { user: Number(refUser), referent_user: Number(refReferent) },
                {
                  onSuccess: () => {
                    setRefUser("");
                    setRefReferent("");
                  },
                },
              );
            }}
            className="mb-4 flex flex-wrap items-end gap-3"
          >
            <div>
              <label htmlFor="plataforma-ref-user" className="mb-1 block text-sm font-medium text-text-form">
                {t("plataforma.entidadFicha.personIdLabel")}
              </label>
              <input
                id="plataforma-ref-user"
                type="number"
                value={refUser}
                onChange={(event) => setRefUser(event.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
              />
            </div>
            <div>
              <label htmlFor="plataforma-ref-referent" className="mb-1 block text-sm font-medium text-text-form">
                {t("plataforma.entidadFicha.referentIdLabel")}
              </label>
              <input
                id="plataforma-ref-referent"
                type="number"
                value={refReferent}
                onChange={(event) => setRefReferent(event.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
              />
            </div>
            <Button type="submit" disabled={createReference.isPending}>
              {t("plataforma.entidadFicha.assignAction")}
            </Button>
          </form>
        ) : null}
        {/* Igual que arriba: rama muerta fuera de `canManage`. */}
        {canManage && createReference.isError ? (
          <p role="alert" className="mb-2 text-sm text-error">
            {errorKindText(createReference.error, CREATE_ORG_REFERENCE_ERROR_KEYS, t, "errors.createOrgReference.desconocido")}
          </p>
        ) : null}

        {references.isError ? (
          <EmptyState
            title={t("common.noAccess")}
            description={t("entidad.configuracion.referencesLoadErrorDescription")}
          />
        ) : !references.data ? (
          <p className="text-sm text-text-secondary">{t("common.loading")}</p>
        ) : references.data.length === 0 ? (
          <EmptyState title={t("plataforma.entidadFicha.referencesEmpty")} />
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {references.data.map((reference) => (
              <li key={reference.id} className="flex items-center justify-between gap-2">
                <span>
                  {t("plataforma.entidadFicha.referenceRow", {
                    name: reference.public_name,
                    referentId: reference.referent,
                  })}
                </span>
                {canManage ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      removeReference.reset();
                      setRemovingReference(reference);
                    }}
                  >
                    {t("plataforma.entidadFicha.removeAction")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Dar de baja a alguien del equipo o quitarle su referente son
          acciones irreversibles desde el panel: confirmación primero, y el
          error de la llamada dentro del propio diálogo, que solo se cierra
          si la baja sale bien. */}
      <ConfirmDialog
        open={removingMember !== null}
        title={t("plataforma.entidadFicha.removeMemberConfirmTitle")}
        description={
          <div className="flex flex-col gap-2">
            <p>
              {removingMember
                ? t("plataforma.entidadFicha.removeMemberConfirmDescription", {
                    name: removingMember.public_name,
                  })
                : ""}
            </p>
            {removeMember.isError ? (
              <p role="alert" className="text-error">
                {errorKindText(removeMember.error, REMOVE_ORG_MEMBER_ERROR_KEYS, t, "errors.removeOrgMember.desconocido")}
              </p>
            ) : null}
          </div>
        }
        confirmLabel={t("plataforma.entidadFicha.removeAction")}
        pending={removeMember.isPending}
        onConfirm={() => {
          if (!removingMember) return;
          removeMember.mutate(removingMember.user, { onSuccess: () => setRemovingMember(null) });
        }}
        onCancel={() => {
          removeMember.reset();
          setRemovingMember(null);
        }}
      />

      <ConfirmDialog
        open={removingReference !== null}
        title={t("plataforma.entidadFicha.removeReferenceConfirmTitle")}
        description={
          <div className="flex flex-col gap-2">
            <p>
              {removingReference
                ? t("plataforma.entidadFicha.removeReferenceConfirmDescription", {
                    name: removingReference.public_name,
                  })
                : ""}
            </p>
            {removeReference.isError ? (
              <p role="alert" className="text-error">
                {errorKindText(removeReference.error, REMOVE_ORG_REFERENCE_ERROR_KEYS, t, "errors.removeOrgReference.desconocido")}
              </p>
            ) : null}
          </div>
        }
        confirmLabel={t("plataforma.entidadFicha.removeAction")}
        pending={removeReference.isPending}
        onConfirm={() => {
          if (!removingReference) return;
          removeReference.mutate(removingReference.user, {
            onSuccess: () => setRemovingReference(null),
          });
        }}
        onCancel={() => {
          removeReference.reset();
          setRemovingReference(null);
        }}
      />
    </div>
  );
}

function MetricasTab({ orgId }: { orgId: number | string }) {
  const t = useTranslations();
  const period = presetPeriod("mes");
  const metrics = useMetrics("entidad", orgId, period);

  if (metrics.isError) {
    if (metrics.error.kind === "sin_acceso") {
      return (
        <EmptyState
          title={t("common.noAccess")}
          description={t("plataforma.entidadFicha.metricsNoAccessDescription")}
        />
      );
    }
    return (
      <ErrorState
        title={t("metrics.dashboard.loadError")}
        description={errorKindText(metrics.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
      />
    );
  }
  if (!metrics.data) {
    return <p className="text-sm text-text-secondary">{t("metrics.dashboard.loading")}</p>;
  }

  return (
    <Card title={t("plataforma.entidadFicha.metricsCardTitle")}>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-sm text-text-secondary">{t("metrics.stats.activePeople")}</dt>
          <dd className="text-2xl font-semibold text-text-base">
            {formatCount(metrics.data.people.active, metrics.data.people.suppressed)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-text-secondary">{t("metrics.stats.eventsHeld")}</dt>
          <dd className="text-2xl font-semibold text-text-base">{metrics.data.events.held}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-secondary">{t("metrics.stats.attendanceRate")}</dt>
          <dd className="text-2xl font-semibold text-text-base">
            {formatPct(metrics.data.attendance.rate, metrics.data.attendance.suppressed)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function ComunidadesTab({ orgId }: { orgId: number | string }) {
  const t = useTranslations();
  const communities = useEntityCommunities(orgId);
  const period = presetPeriod("mes");
  const events = useEntityEvents(orgId, period);

  return (
    <div className="flex flex-col gap-4">
      <Card title={t("menu.entidad.comunidades")}>
        {communities.isError ? (
          <ErrorState
            title={t("plataforma.entidadFicha.communitiesLoadError")}
            description={errorKindText(communities.error, ENTITY_COMMUNITIES_ERROR_KEYS, t, "errors.entityCommunities.desconocido")}
          />
        ) : !communities.data ? (
          <p className="text-sm text-text-secondary">{t("common.loading")}</p>
        ) : (
          <p className="text-sm text-text-base">
            {t("plataforma.entidadFicha.communitiesVisibleCount", { count: communities.data.length })}
          </p>
        )}
      </Card>
      <Card title={t("plataforma.entidadFicha.activitiesCardTitle")}>
        {events.isError ? (
          events.error.kind === "sin_acceso" ? (
            <EmptyState
              title={t("common.noAccess")}
              description={t("plataforma.entidadFicha.activitiesNoAccessDescription")}
            />
          ) : (
            <ErrorState
              title={t("plataforma.entidadFicha.activitiesLoadError")}
              description={errorKindText(events.error, ENTITY_EVENTS_ERROR_KEYS, t, "errors.entityEvents.desconocido")}
            />
          )
        ) : !events.data ? (
          <p className="text-sm text-text-secondary">{t("common.loading")}</p>
        ) : (
          <p className="text-sm text-text-base">
            {t("plataforma.entidadFicha.activitiesThisMonthCount", { count: events.data.length })}
          </p>
        )}
      </Card>
    </div>
  );
}

function formatContractDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES");
}

/**
 * Bloque «Contrato» (tarea W4, `docs/PANEL.md` §13): tramo, vigencia y
 * último estado de factura, de solo lectura (la gestión completa vive en
 * `/plataforma/contratos`, `ContratosPanel.tsx`). Lectura acotada a
 * `superadmin`/`support` (mismo permiso que el resto de `billing`): un
 * `verifier` sin esa lectura ve «Sin acceso», igual que Equipo/Métricas
 * más arriba en este mismo fichero para roles insuficientes. Con varios
 * contratos históricos, prioriza el `active`; si no hay ninguno activo,
 * el más reciente por `starts_on`.
 */
function ContratoTab({ orgId }: { orgId: number | string }) {
  const t = useTranslations();
  const contracts = useContracts({ organization: orgId });
  const contract = contracts.data
    ? [...contracts.data].sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        return b.starts_on.localeCompare(a.starts_on);
      })[0]
    : undefined;
  const invoices = useInvoices(contract?.id);
  const lastInvoice = invoices.data
    ? [...invoices.data].sort((a, b) => b.issued_on.localeCompare(a.issued_on))[0]
    : undefined;

  if (contracts.isError) {
    if (contracts.error.kind === "sin_acceso") {
      return (
        <EmptyState
          title={t("common.noAccess")}
          description={t("plataforma.entidadFicha.billingNoAccessDescription")}
        />
      );
    }
    return (
      <ErrorState
        title={t("plataforma.entidadFicha.contractLoadError")}
        description={errorKindText(contracts.error, CONTRACTS_ERROR_KEYS, t, "errors.contractsQuery.desconocido")}
      />
    );
  }
  if (!contracts.data) {
    return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  }
  if (!contract) {
    return (
      <EmptyState
        title={t("plataforma.entidadFicha.noContractTitle")}
        description={t("plataforma.entidadFicha.noContractDescription")}
      />
    );
  }

  return (
    <Card title={t("plataforma.entidadFicha.tabContrato")}>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-text-secondary">{t("plataforma.contratos.tierLabel")}</dt>
        <dd className="text-text-base">{contract.tier.name}</dd>
        <dt className="text-text-secondary">{t("plataforma.contratos.validityHeader")}</dt>
        <dd className="text-text-base">
          {formatContractDate(contract.starts_on)} – {formatContractDate(contract.ends_on)}
        </dd>
        <dt className="text-text-secondary">{t("plataforma.reportes.statusLabel")}</dt>
        <dd className="text-text-base">
          <Badge tone={contract.status === "active" ? "success" : contract.status === "ended" ? "info" : "neutral"}>
            {t(CONTRACT_STATUS_LABEL_KEYS[contract.status] ?? "plataforma.contratos.statusDraft")}
          </Badge>
        </dd>
        <dt className="text-text-secondary">{t("plataforma.entidadFicha.lastInvoiceLabel")}</dt>
        <dd className="text-text-base">
          {lastInvoice ? (
            <>
              {formatEuros(lastInvoice.amount_cents)} —{" "}
              <Badge
                tone={
                  lastInvoice.status === "paid" ? "success" : lastInvoice.status === "overdue" ? "error" : "neutral"
                }
              >
                {t(INVOICE_STATUS_LABEL_KEYS[(lastInvoice.status as InvoiceStatus) ?? "pending"])}
              </Badge>
            </>
          ) : (
            t("plataforma.entidadFicha.noInvoices")
          )}
        </dd>
      </dl>
    </Card>
  );
}

export function EntidadDetail({ orgId, role }: EntidadDetailProps) {
  const t = useTranslations();
  const [section, setSection] = useState<Section>("datos");

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">{t("plataforma.entidadFicha.sectionsLegend")}</legend>
        {SECTIONS.map((value) => (
          <Button
            key={value}
            type="button"
            variant={section === value ? "primary" : "secondary"}
            aria-pressed={section === value}
            onClick={() => setSection(value)}
          >
            {t(SECTION_LABEL_KEYS[value])}
          </Button>
        ))}
      </fieldset>

      {section === "datos" ? <DatosTab orgId={orgId} role={role} /> : null}
      {section === "paraguas" ? <ParaguasTab orgId={orgId} role={role} /> : null}
      {section === "ambito" ? <AmbitoTab orgId={orgId} role={role} /> : null}
      {section === "equipo" ? <EquipoTab orgId={orgId} role={role} /> : null}
      {section === "metricas" ? <MetricasTab orgId={orgId} /> : null}
      {section === "comunidades" ? <ComunidadesTab orgId={orgId} /> : null}
      {section === "contrato" ? <ContratoTab orgId={orgId} /> : null}
    </div>
  );
}
