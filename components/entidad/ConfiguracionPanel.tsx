"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAddOrgMember, useOrgMembers, useRemoveOrgMember } from "@/hooks/useOrgMembers";
import { useCreateOrgReference, useOrgReferences, useRemoveOrgReference } from "@/hooks/useOrgReferences";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgScope } from "@/hooks/useOrgScope";
import { useUpdateOrganization } from "@/hooks/useUpdateOrganization";
import type { OrgMembershipFull, OrgMembershipRole, Reference } from "@/lib/api/types";

export interface ConfiguracionPanelProps {
  orgId: number | string;
  /**
   * Rol de la membresía con la que se mira la página: decide si se pinta
   * la sección Equipo (ver el docstring del componente).
   */
  role: OrgMembershipRole;
  /**
   * Id de la cuenta con la que se mira la página (`session.me.id`): el
   * equipo no lo puede saber por sí solo (`OrgMembership.user` es un id
   * suelto) y hace falta para avisar a quien va a quitarse a sí mismo.
   */
  currentUserId: number;
}

const ROLE_OPTIONS: OrgMembershipRole[] = [
  "titular",
  "moderador",
  "dinamizador",
  "analista",
  "referente",
  "voluntario",
];

function DatosEntidad({ orgId }: { orgId: number | string }) {
  const organization = useOrganization(orgId);
  const updateOrganization = useUpdateOrganization(orgId);
  const [form, setForm] = useState<{
    description: string;
    contact_email: string;
    contact_phone: string;
    website: string;
    primary_color: string;
    secondary_color: string;
  } | null>(null);

  if (organization.isError) {
    return <ErrorState title="No se pudo cargar la ficha de la entidad" description={organization.error.message} />;
  }
  if (!organization.data) {
    return <p className="text-sm text-text-secondary">Cargando…</p>;
  }

  const data = form ?? {
    description: organization.data.description ?? "",
    contact_email: organization.data.contact_email ?? "",
    contact_phone: organization.data.contact_phone ?? "",
    website: organization.data.website ?? "",
    primary_color: organization.data.primary_color ?? "#1FB3AE",
    secondary_color: organization.data.secondary_color ?? "#72C9EE",
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateOrganization.mutate(data);
  }

  return (
    <Card title="Datos de la entidad">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="config-description" className="mb-1 block text-sm font-medium text-text-form">
            Descripción
          </label>
          <textarea
            id="config-description"
            value={data.description}
            onChange={(event) => setForm({ ...data, description: event.target.value })}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            rows={3}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="config-email" className="mb-1 block text-sm font-medium text-text-form">
              Email de contacto
            </label>
            <input
              id="config-email"
              type="email"
              value={data.contact_email}
              onChange={(event) => setForm({ ...data, contact_email: event.target.value })}
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            />
          </div>
          <div>
            <label htmlFor="config-phone" className="mb-1 block text-sm font-medium text-text-form">
              Teléfono de contacto
            </label>
            <input
              id="config-phone"
              type="tel"
              value={data.contact_phone}
              onChange={(event) => setForm({ ...data, contact_phone: event.target.value })}
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            />
          </div>
          <div>
            <label htmlFor="config-website" className="mb-1 block text-sm font-medium text-text-form">
              Web
            </label>
            <input
              id="config-website"
              type="url"
              value={data.website}
              onChange={(event) => setForm({ ...data, website: event.target.value })}
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="config-primary-color" className="mb-1 block text-sm font-medium text-text-form">
              Color primario
            </label>
            <input
              id="config-primary-color"
              type="color"
              value={data.primary_color}
              onChange={(event) => setForm({ ...data, primary_color: event.target.value })}
              className="h-10 w-16 rounded-md border border-border"
            />
          </div>
          <div>
            <label htmlFor="config-secondary-color" className="mb-1 block text-sm font-medium text-text-form">
              Color secundario
            </label>
            <input
              id="config-secondary-color"
              type="color"
              value={data.secondary_color}
              onChange={(event) => setForm({ ...data, secondary_color: event.target.value })}
              className="h-10 w-16 rounded-md border border-border"
            />
          </div>
        </div>
        {organization.data.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo remoto de origen variable, ver Image en el layout
          <img src={organization.data.logo} alt="Logo de la entidad" className="h-16 w-16 rounded-full object-contain" />
        ) : null}
        <p className="text-xs text-text-secondary">
          Subir un logo nuevo todavía no está disponible en el panel: el contrato real espera un fichero
          (multipart), no una URL — ver el informe de esta tarea.
        </p>
        <div>
          <Button type="submit" disabled={updateOrganization.isPending}>
            Guardar
          </Button>
        </div>
        {updateOrganization.isError ? (
          <p role="alert" className="text-sm text-error">
            {updateOrganization.error.message}
          </p>
        ) : null}
        {updateOrganization.isSuccess ? <p className="text-sm text-success">Guardado.</p> : null}
      </form>
    </Card>
  );
}

function Equipo({ orgId, currentUserId }: { orgId: number | string; currentUserId: number }) {
  const members = useOrgMembers(orgId);
  const addMember = useAddOrgMember(orgId);
  const removeMember = useRemoveOrgMember(orgId);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<OrgMembershipRole>("dinamizador");
  const [removing, setRemoving] = useState<OrgMembershipFull | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    // El campo se limpia solo si el alta sale bien: con un 400 («esa
    // persona ya tiene un rol») el id escrito sigue ahí para corregirlo.
    addMember.mutate({ user: Number(userId), role }, { onSuccess: () => setUserId("") });
  }

  return (
    <Card title="Equipo">
      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="equipo-user-id" className="mb-1 block text-sm font-medium text-text-form">
            Id de usuario
          </label>
          <input
            id="equipo-user-id"
            type="number"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="equipo-role" className="mb-1 block text-sm font-medium text-text-form">
            Rol
          </label>
          <select
            id="equipo-role"
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
      {addMember.isError ? (
        <p role="alert" className="mb-2 text-sm text-error">
          {addMember.error.message}
        </p>
      ) : null}

      {members.isError ? (
        <ErrorState title="No se pudo cargar el equipo" description={members.error.message} />
      ) : !members.data ? (
        <p className="text-sm text-text-secondary">Cargando…</p>
      ) : members.data.length === 0 ? (
        <EmptyState title="Sin equipo todavía" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Equipo de la entidad</caption>
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th scope="col" className="px-3 py-2 font-semibold">Usuario</th>
                <th scope="col" className="px-3 py-2 font-semibold">Rol</th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.data.map((member) => (
                <tr key={member.id} className="border-b border-border-light">
                  <td className="px-3 py-2 text-text-base">{member.public_name}</td>
                  <td className="px-3 py-2 text-text-base">{member.role}</td>
                  <td className="px-3 py-2 text-text-base">
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => {
                        removeMember.reset();
                        setRemoving(member);
                      }}
                    >
                      Quitar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Quitar del equipo"
        description={
          // Mismo patrón que «Revocar» en `PersonasTable`: el error de la
          // baja se lee dentro del diálogo, que solo se cierra si la
          // llamada sale bien.
          <div className="flex flex-col gap-2">
            <p>
              {removing
                ? `¿Quitar a «${removing.public_name}» del equipo de la entidad? Dejará de tener rol en el panel.`
                : ""}
            </p>
            {removing && removing.user === currentUserId ? (
              <p className="font-medium text-text-base">
                Vas a quitarte a ti mismo del equipo y perderás el acceso al panel.
              </p>
            ) : null}
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
          if (!removing) return;
          removeMember.mutate(removing.user, { onSuccess: () => setRemoving(null) });
        }}
        onCancel={() => {
          removeMember.reset();
          setRemoving(null);
        }}
      />
    </Card>
  );
}

/**
 * Nombre del referente de una referencia: `Reference` trae el
 * `public_name` de la persona, pero del referente solo el id
 * (`referent`), así que se resuelve contra el equipo —la misma consulta
 * que ya pide la sección Equipo, compartida por clave de caché—. Es un
 * componente aparte para montarlo solo con rol `titular`: el `GET` de
 * equipo es solo-titular (`entities/permissions.py`) y un `moderador`
 * solo se ganaría un 403 por referencia. Sin nombre se dice «sin
 * nombre», nunca el id (el panel no pinta ids de cuenta, invariante 1/9).
 */
function ReferentName({
  orgId,
  referentUserId,
}: {
  orgId: number | string;
  referentUserId: number;
}) {
  const members = useOrgMembers(orgId);
  const member = (members.data ?? []).find((m) => m.user === referentUserId);
  return <>{member ? `: ${member.public_name}` : " sin nombre"}</>;
}

function Referencias({ orgId, canSeeTeam }: { orgId: number | string; canSeeTeam: boolean }) {
  const references = useOrgReferences(orgId);
  const createReference = useCreateOrgReference(orgId);
  const removeReference = useRemoveOrgReference(orgId);
  const [userId, setUserId] = useState("");
  const [referentUserId, setReferentUserId] = useState("");
  const [removing, setRemoving] = useState<Reference | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !referentUserId) return;
    // Igual que en Equipo: los campos solo se vacían con el alta hecha.
    createReference.mutate(
      { user: Number(userId), referent_user: Number(referentUserId) },
      {
        onSuccess: () => {
          setUserId("");
          setReferentUserId("");
        },
      },
    );
  }

  return (
    <Card title="Referencias">
      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="referencia-user-id" className="mb-1 block text-sm font-medium text-text-form">
            Persona (id)
          </label>
          <input
            id="referencia-user-id"
            type="number"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="referencia-referent-id" className="mb-1 block text-sm font-medium text-text-form">
            Referente (id)
          </label>
          <input
            id="referencia-referent-id"
            type="number"
            value={referentUserId}
            onChange={(event) => setReferentUserId(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <Button type="submit" disabled={createReference.isPending}>
          Asignar
        </Button>
      </form>
      {createReference.isError ? (
        <p role="alert" className="mb-2 text-sm text-error">
          {createReference.error.message}
        </p>
      ) : null}

      {references.isError ? (
        <ErrorState title="No se pudieron cargar los referentes" description={references.error.message} />
      ) : !references.data ? (
        <p className="text-sm text-text-secondary">Cargando…</p>
      ) : references.data.length === 0 ? (
        <EmptyState title="Sin referencias todavía" />
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {references.data.map((reference) => (
            <li key={reference.id} className="flex items-center justify-between gap-2">
              <span>
                {reference.public_name} — referente
                {canSeeTeam ? (
                  <ReferentName orgId={orgId} referentUserId={reference.referent} />
                ) : (
                  " sin nombre"
                )}
              </span>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  removeReference.reset();
                  setRemoving(reference);
                }}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Quitar referencia"
        description={
          <div className="flex flex-col gap-2">
            <p>
              {removing
                ? `¿Quitar el referente de «${removing.public_name}»? Esta persona se quedará sin referente en la entidad.`
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
          if (!removing) return;
          removeReference.mutate(removing.user, { onSuccess: () => setRemoving(null) });
        }}
        onCancel={() => {
          removeReference.reset();
          setRemoving(null);
        }}
      />
    </Card>
  );
}

function Ambito({ orgId }: { orgId: number | string }) {
  const scope = useOrgScope(orgId);
  const [kind, setKind] = useState<"places" | "comarca" | "province">("places");
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value) return;
    if (kind === "places") {
      scope.mutate({ places: value.split(",").map((v) => v.trim()).filter(Boolean) });
    } else if (kind === "comarca") {
      scope.mutate({ comarca: value.trim() });
    } else {
      scope.mutate({ province: value.trim() });
    }
  }

  return (
    <Card title="Ámbito">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="ambito-kind" className="mb-1 block text-sm font-medium text-text-form">
            Tipo
          </label>
          <select
            id="ambito-kind"
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
          <label htmlFor="ambito-value" className="mb-1 block text-sm font-medium text-text-form">
            {kind === "places" ? "Códigos INE, separados por coma" : "Código"}
          </label>
          <input
            id="ambito-value"
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
 * Configuración de la entidad (tarea W4a, `docs/SEGURIDAD_Y_MODERACION.md`
 * §8): datos/colores, equipo (alta/baja con rol), referencias
 * (persona ↔ referente) y ámbito INE. `post_event_survey_enabled` no está
 * en la lista blanca de `PATCH /api/organizations/{id}/`
 * (`OrganizationRequest` en `docs/schema.yaml`) aunque exista en el
 * modelo: se omite aquí (el brief lo permitía si el campo no existe en
 * el esquema).
 *
 * Matriz de secciones por rol (verificada contra
 * `entities/permissions.py:14`, `'equipo': {'titular'}`): GET de miembros
 * del equipo exige rol `titular`, así que un `moderador` vería la sección
 * siempre en error (403) — Equipo se pinta solo con rol `titular`.
 * `moderador` sigue viendo el resto (Datos, Referencias y Ámbito). Hueco
 * relacionado, no resuelto aquí: los selects de referente de
 * `AddPersonDialog.tsx`/`PersonSheet.tsx::AssignReferentForm` usan
 * `useOrgMembers` (que exige el mismo permiso de equipo), así que un
 * `moderador` los verá vacíos salvo «Sin referente».
 */
export function ConfiguracionPanel({ orgId, role, currentUserId }: ConfiguracionPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <DatosEntidad orgId={orgId} />
      {role === "titular" ? <Equipo orgId={orgId} currentUserId={currentUserId} /> : null}
      <Referencias orgId={orgId} canSeeTeam={role === "titular"} />
      <Ambito orgId={orgId} />
    </div>
  );
}
