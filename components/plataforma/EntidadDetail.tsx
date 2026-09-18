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

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { useOrgMembers, useAddOrgMember, useRemoveOrgMember } from "@/hooks/useOrgMembers";
import { useOrgReferences, useCreateOrgReference, useRemoveOrgReference } from "@/hooks/useOrgReferences";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrganizations, useSetOrganizationParent, useVerifyOrganization } from "@/hooks/useOrganizations";
import { useOrgScope } from "@/hooks/useOrgScope";
import { useEntityCommunities } from "@/hooks/useEntityCommunities";
import { useEntityEvents } from "@/hooks/useEntityEvents";
import { useContracts, useInvoices } from "@/hooks/useBilling";
import { useMetrics } from "@/hooks/useMetrics";
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

const SECTION_LABELS: Record<Section, string> = {
  datos: "Datos",
  paraguas: "Paraguas",
  ambito: "Ámbito",
  equipo: "Equipo",
  metricas: "Métricas",
  comunidades: "Comunidades y actividades",
  contrato: "Contrato",
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  active: "Vigente",
  ended: "Finalizado",
};

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  paid: "Pagada",
  pending: "Pendiente",
  overdue: "Vencida",
};

const ROLE_OPTIONS: OrgMembershipRole[] = [
  "titular",
  "moderador",
  "dinamizador",
  "analista",
  "referente",
  "voluntario",
];

function DatosTab({ orgId, role }: { orgId: number | string; role: string | null }) {
  const organization = useOrganization(orgId);
  const verify = useVerifyOrganization();
  const canVerify = role === "verifier" || role === "superadmin";

  if (organization.isError) {
    return <ErrorState title="No se pudo cargar la ficha" description={organization.error.message} />;
  }
  if (!organization.data) {
    return <p className="text-sm text-text-secondary">Cargando…</p>;
  }

  const org = organization.data;

  return (
    <Card title="Datos de la entidad">
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-text-secondary">Nombre</dt>
        <dd className="text-text-base">{org.name}</dd>
        <dt className="text-text-secondary">Slug</dt>
        <dd className="text-text-base">{org.slug}</dd>
        <dt className="text-text-secondary">Tipo</dt>
        <dd className="text-text-base">{org.org_type}</dd>
        <dt className="text-text-secondary">Verificación</dt>
        <dd className="text-text-base">
          <Badge tone={org.is_verified ? "success" : "neutral"}>
            {org.is_verified ? "Verificada" : "Pendiente"}
          </Badge>
        </dd>
        <dt className="text-text-secondary">Descripción</dt>
        <dd className="text-text-base">{org.description || "—"}</dd>
        <dt className="text-text-secondary">Contacto</dt>
        <dd className="text-text-base">{org.contact_email || "—"}</dd>
      </dl>
      {!org.is_verified && canVerify ? (
        <div className="mt-3">
          <Button type="button" disabled={verify.isPending} onClick={() => verify.mutate(orgId)}>
            Verificar entidad
          </Button>
          {verify.isError ? (
            <p role="alert" className="mt-1 text-sm text-error">
              {verify.error.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function ParaguasTab({ orgId, role }: { orgId: number | string; role: string | null }) {
  const organization = useOrganization(orgId);
  const children = useOrganizations({ parent: orgId });
  const setParent = useSetOrganizationParent();
  const [newParent, setNewParent] = useState("");
  const canSetParent = role === "superadmin";

  return (
    <div className="flex flex-col gap-4">
      <Card title="Entidad paraguas">
        <p className="text-sm text-text-base">
          Paraguas actual: {organization.data?.parent ?? "sin asignar"}
        </p>
        {canSetParent ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="paraguas-new-parent" className="mb-1 block text-sm font-medium text-text-form">
                Nuevo paraguas (id, vacío para quitar)
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
              Guardar
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-text-secondary">Solo superadmin cambia la entidad paraguas.</p>
        )}
        {setParent.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {setParent.error.message}
          </p>
        ) : null}
        {setParent.isSuccess ? <p className="mt-2 text-sm text-success">Guardado.</p> : null}
      </Card>

      <Card title="Entidades hijas">
        {children.isError ? (
          <ErrorState title="No se pudieron cargar las hijas" description={children.error.message} />
        ) : !children.data ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : children.data.results.length === 0 ? (
          <EmptyState title="Sin entidades hijas" />
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
  const scope = useOrgScope(orgId);
  const [kind, setKind] = useState<"places" | "comarca" | "province">("places");
  const [value, setValue] = useState("");
  const canManage = role === "superadmin";

  if (!canManage) {
    return (
      <EmptyState
        title="Sin acceso"
        description="Solo superadmin amplía el ámbito de una entidad desde plataforma (el titular lo hace desde su propia entidad)."
      />
    );
  }

  return (
    <Card title="Ámbito">
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
            Tipo
          </label>
          <select
            id="plataforma-ambito-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            <option value="places">Municipios (códigos INE)</option>
            <option value="comarca">Comarca</option>
            <option value="province">Provincia</option>
          </select>
        </div>
        <div>
          <label htmlFor="plataforma-ambito-value" className="mb-1 block text-sm font-medium text-text-form">
            {kind === "places" ? "Códigos INE, separados por coma" : "Código"}
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
          Ampliar ámbito
        </Button>
      </form>
      {scope.isError ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {scope.error.message}
        </p>
      ) : null}
      {scope.isSuccess ? (
        <p className="mt-2 text-sm text-success">
          Añadidos {scope.data.added} municipios (ámbito total: {scope.data.total}).
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
          ? "El equipo y las referencias los gestiona normalmente el titular de la entidad; desde plataforma también puedes cambiarlos tú."
          : "El equipo y las referencias los gestiona el titular de la entidad. Tu rol de plataforma no gestiona el equipo desde aquí: puedes consultarlo, no cambiarlo."}
      </p>

      <Card title="Equipo">
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
                Id de usuario
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
                Rol
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
              Añadir
            </Button>
          </form>
        ) : null}
        {addMember.isError ? (
          <p role="alert" className="mb-2 text-sm text-error">
            {addMember.error.message}
          </p>
        ) : null}

        {members.isError ? (
          <EmptyState title="Sin acceso" description={members.error.message} />
        ) : !members.data ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : members.data.length === 0 ? (
          <EmptyState title="Sin equipo todavía" />
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
                    Quitar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Referencias">
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
                Persona (id)
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
                Referente (id)
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
              Asignar
            </Button>
          </form>
        ) : null}
        {createReference.isError ? (
          <p role="alert" className="mb-2 text-sm text-error">
            {createReference.error.message}
          </p>
        ) : null}

        {references.isError ? (
          <EmptyState title="Sin acceso" description={references.error.message} />
        ) : !references.data ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : references.data.length === 0 ? (
          <EmptyState title="Sin referencias todavía" />
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {references.data.map((reference) => (
              <li key={reference.id} className="flex items-center justify-between gap-2">
                <span>
                  {reference.public_name} — referente #{reference.referent}
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
                    Quitar
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
        title="Quitar del equipo"
        description={
          <div className="flex flex-col gap-2">
            <p>
              {removingMember
                ? `¿Quitar a «${removingMember.public_name}» del equipo de la entidad? Dejará de tener rol en el panel.`
                : ""}
            </p>
            {removeMember.isError ? (
              <p role="alert" className="text-error">
                {removeMember.error.message}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Quitar"
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
        title="Quitar la referencia"
        description={
          <div className="flex flex-col gap-2">
            <p>
              {removingReference
                ? `¿Quitar el referente asignado a «${removingReference.public_name}»?`
                : ""}
            </p>
            {removeReference.isError ? (
              <p role="alert" className="text-error">
                {removeReference.error.message}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Quitar"
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
  const period = presetPeriod("mes");
  const metrics = useMetrics("entidad", orgId, period);

  if (metrics.isError) {
    if (metrics.error.kind === "sin_acceso") {
      return (
        <EmptyState
          title="Sin acceso"
          description="Tu rol de plataforma no da acceso a las métricas de esta entidad. Usa el menú «Métricas» de plataforma, agrupado por entidad, para ver sus cifras agregadas."
        />
      );
    }
    return <ErrorState title="No se pudieron cargar las métricas" description={metrics.error.message} />;
  }
  if (!metrics.data) {
    return <p className="text-sm text-text-secondary">Cargando métricas…</p>;
  }

  return (
    <Card title="Métricas del mes en curso">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-sm text-text-secondary">Personas activas</dt>
          <dd className="text-2xl font-semibold text-text-base">
            {formatCount(metrics.data.people.active, metrics.data.people.suppressed)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-text-secondary">Actividades celebradas</dt>
          <dd className="text-2xl font-semibold text-text-base">{metrics.data.events.held}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-secondary">Asistencia</dt>
          <dd className="text-2xl font-semibold text-text-base">
            {formatPct(metrics.data.attendance.rate, metrics.data.attendance.suppressed)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function ComunidadesTab({ orgId }: { orgId: number | string }) {
  const communities = useEntityCommunities(orgId);
  const period = presetPeriod("mes");
  const events = useEntityEvents(orgId, period);

  return (
    <div className="flex flex-col gap-4">
      <Card title="Comunidades">
        {communities.isError ? (
          <ErrorState title="No se pudieron cargar las comunidades" description={communities.error.message} />
        ) : !communities.data ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : (
          <p className="text-sm text-text-base">{communities.data.length} comunidades visibles.</p>
        )}
      </Card>
      <Card title="Actividades del mes en curso">
        {events.isError ? (
          events.error.kind === "sin_acceso" ? (
            <EmptyState title="Sin acceso" description="La plataforma no tiene rol en esta entidad." />
          ) : (
            <ErrorState title="No se pudieron cargar las actividades" description={events.error.message} />
          )
        ) : !events.data ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : (
          <p className="text-sm text-text-base">{events.data.length} actividades este mes.</p>
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
          title="Sin acceso"
          description="Tu rol de plataforma no da acceso a la facturación de las entidades."
        />
      );
    }
    return <ErrorState title="No se pudo cargar el contrato" description={contracts.error.message} />;
  }
  if (!contracts.data) {
    return <p className="text-sm text-text-secondary">Cargando…</p>;
  }
  if (!contract) {
    return <EmptyState title="Sin contrato" description="Esta entidad no tiene ningún contrato registrado." />;
  }

  return (
    <Card title="Contrato">
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-text-secondary">Tramo</dt>
        <dd className="text-text-base">{contract.tier.name}</dd>
        <dt className="text-text-secondary">Vigencia</dt>
        <dd className="text-text-base">
          {formatContractDate(contract.starts_on)} – {formatContractDate(contract.ends_on)}
        </dd>
        <dt className="text-text-secondary">Estado</dt>
        <dd className="text-text-base">
          <Badge tone={contract.status === "active" ? "success" : contract.status === "ended" ? "info" : "neutral"}>
            {CONTRACT_STATUS_LABELS[contract.status] ?? contract.status}
          </Badge>
        </dd>
        <dt className="text-text-secondary">Última factura</dt>
        <dd className="text-text-base">
          {lastInvoice ? (
            <>
              {formatEuros(lastInvoice.amount_cents)} —{" "}
              <Badge
                tone={
                  lastInvoice.status === "paid" ? "success" : lastInvoice.status === "overdue" ? "error" : "neutral"
                }
              >
                {INVOICE_STATUS_LABELS[(lastInvoice.status as InvoiceStatus) ?? "pending"] ?? lastInvoice.status}
              </Badge>
            </>
          ) : (
            "Sin facturas"
          )}
        </dd>
      </dl>
    </Card>
  );
}

export function EntidadDetail({ orgId, role }: EntidadDetailProps) {
  const [section, setSection] = useState<Section>("datos");

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Secciones de la entidad</legend>
        {SECTIONS.map((value) => (
          <Button
            key={value}
            type="button"
            variant={section === value ? "primary" : "secondary"}
            aria-pressed={section === value}
            onClick={() => setSection(value)}
          >
            {SECTION_LABELS[value]}
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
