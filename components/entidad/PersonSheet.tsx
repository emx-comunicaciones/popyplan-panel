"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAssignReferent } from "@/hooks/useAssignReferent";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { usePerson } from "@/hooks/usePerson";
import { presetPeriod } from "@/lib/metrics/period";

export interface PersonSheetProps {
  orgId: number | string;
  userId: number | string;
  /** Solo `titular`/`moderador` (`docs/PANEL.md` §1.1, matriz de `entities/permissions.py`). */
  canAssignReferent: boolean;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES");
}

const ATTENDANCE_LABELS: Record<string, string> = {
  registered: "Inscrito",
  waitlisted: "Lista de espera",
  cancelled: "Cancelada",
  attended: "Asistió",
  no_show: "No asistió",
};

/**
 * Carry-over de la tarea W3 cerrado en W6 (pregunta 13 de
 * `docs/preguntas-diseno.md`): antes pedía el id de usuario a mano
 * porque no había forma de nombrar al equipo con rol `referente`; ahora
 * `useOrgMembers` (`GET /api/organizations/{id}/members/`) lleva
 * `public_name` (`docs/PANEL.md` §10.3, tarea backend P7), así que el
 * formulario es un desplegable con nombre, igual que
 * `components/people/AddPersonDialog.tsx`.
 */
function AssignReferentForm({
  orgId,
  userId,
}: {
  orgId: number | string;
  userId: number | string;
}) {
  const [referentUserId, setReferentUserId] = useState("");
  const members = useOrgMembers(orgId);
  const assignReferent = useAssignReferent(orgId);

  const referentes = (members.data ?? []).filter((member) => member.role === "referente");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(referentUserId);
    if (!referentUserId || Number.isNaN(parsed)) return;
    assignReferent.mutate({ userId: Number(userId), referentUserId: parsed });
  }

  return (
    <Card title="Asignar referente">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="referent-user-id" className="mb-1 block text-sm font-medium text-text-form">
            Persona referente
          </label>
          <select
            id="referent-user-id"
            value={referentUserId}
            onChange={(event) => setReferentUserId(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            <option value="">Selecciona una persona</option>
            {referentes.map((member) => (
              <option key={member.user} value={member.user}>
                {member.public_name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={assignReferent.isPending}>
          {assignReferent.isPending ? "Asignando…" : "Asignar referente"}
        </Button>
      </form>
      {assignReferent.isSuccess ? (
        <p className="mt-2 text-sm text-success">Referente asignado.</p>
      ) : null}
      {assignReferent.isError ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {assignReferent.error.message}
        </p>
      ) : null}
    </Card>
  );
}

/**
 * Ficha operativa de persona (`docs/PANEL.md` §3.3): alias, foto, alta,
 * referente, comunidades de la entidad, actividades del periodo con su
 * estado de asistencia y próxima actividad. **Nunca** email, teléfono,
 * documentos ni notas — no están en `PersonDetail` (invariante 9).
 */
export function PersonSheet({ orgId, userId, canAssignReferent }: PersonSheetProps) {
  const period = presetPeriod("mes");
  const person = usePerson(orgId, userId, period);

  if (person.isError && person.error.kind === "sin_acceso") {
    return <EmptyState title="Sin acceso" description="No tienes acceso a la ficha de esta persona." />;
  }

  if (person.isError) {
    return (
      <ErrorState title="No se pudo cargar la ficha de esta persona" description={person.error.message} />
    );
  }

  if (!person.data) {
    return <p className="text-sm text-text-secondary">Cargando ficha…</p>;
  }

  const data = person.data;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center gap-4">
          {data.photo ? (
            <Image
              src={data.photo}
              alt=""
              width={56}
              height={56}
              className="rounded-full bg-border-light object-cover"
            />
          ) : null}
          <div>
            <p className="text-lg font-semibold text-text-base">{data.public_name}</p>
            <p className="text-sm text-text-secondary">
              De alta desde {formatDate(data.joined_at)} · Nivel de verificación {data.verification_level}
            </p>
            <p className="text-sm text-text-secondary">
              Referente: {data.referent ? data.referent.public_name : "Sin referente"}
            </p>
          </div>
        </div>
      </Card>

      {canAssignReferent ? <AssignReferentForm orgId={orgId} userId={userId} /> : null}

      <section aria-labelledby="comunidades-persona-heading">
        <h2 id="comunidades-persona-heading" className="mb-2 text-lg font-semibold text-text-base">
          Comunidades
        </h2>
        {data.communities.length === 0 ? (
          <EmptyState title="Sin comunidades en esta entidad" />
        ) : (
          <ul className="flex flex-col gap-1">
            {data.communities.map((community) => (
              <li key={community.id} className="text-sm text-text-base">
                {community.name} <Badge>{community.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="actividades-persona-heading">
        <h2 id="actividades-persona-heading" className="mb-2 text-lg font-semibold text-text-base">
          Actividades del periodo
        </h2>
        {data.events.length === 0 ? (
          <EmptyState title="Sin actividades en este periodo" />
        ) : (
          <ul className="flex flex-col gap-1">
            {data.events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-2 text-sm text-text-base">
                <span>
                  {event.title} · {formatDateTime(event.starts_at)}
                </span>
                <Badge>{ATTENDANCE_LABELS[event.attendance_status] ?? event.attendance_status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="proxima-actividad-heading">
        <h2 id="proxima-actividad-heading" className="mb-2 text-lg font-semibold text-text-base">
          Próxima actividad
        </h2>
        {data.next_event ? (
          <p className="text-sm text-text-base">
            {data.next_event.title} · {formatDateTime(data.next_event.starts_at)}
          </p>
        ) : (
          <EmptyState title="Sin próxima actividad" />
        )}
      </section>
    </div>
  );
}
