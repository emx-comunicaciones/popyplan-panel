"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAcknowledgeHelpRequest } from "@/hooks/useAcknowledgeHelpRequest";
import { usePendingHelpRequests } from "@/hooks/usePendingHelpRequests";
import { useOrganization } from "@/hooks/useOrganization";
import { useUpdateOrganization } from "@/hooks/useUpdateOrganization";
import type { HelpRequestRow } from "@/lib/api/types";

export interface GuardiaPanelProps {
  orgId: number | string;
  /** Slug de la entidad, para enlazar a la ficha de la persona cuando es miembro. */
  slug: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Aviso «no lo llevo mal» al día: no se puede saber si la persona
 * pertenece a la entidad ni cómo contactarla solo con el nombre. Con
 * `is_member`, el nombre enlaza a la ficha (`/entidad/{slug}/personas/
 * {userId}`, invariante 9 — la ficha nunca lleva contacto); sin
 * membresía, un badge explícito («No pertenece a la entidad») en vez de
 * un enlace que daría 404/«Sin acceso». `referent` (si lo hay) se pinta
 * aparte, tal cual llega (`{id, public_name}`, mismo patrón que
 * `ReferentRef`).
 */
function HelpRequestCard({
  request,
  orgId,
  slug,
}: {
  request: HelpRequestRow;
  orgId: number | string;
  slug: string;
}) {
  const acknowledge = useAcknowledgeHelpRequest(orgId);
  const { is_member: isMember, public_name: publicName, referent } = request.user_display;

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {isMember ? (
                <Link
                  href={`/entidad/${slug}/personas/${request.user_display.id}`}
                  className="font-medium text-primary-700 hover:underline"
                >
                  {publicName}
                </Link>
              ) : (
                <p className="font-medium text-text-base">{publicName}</p>
              )}
              {isMember ? null : <Badge tone="info">No pertenece a la entidad</Badge>}
            </div>
            {isMember ? null : (
              <p className="text-sm text-text-secondary">Se apuntó a la actividad sin ser miembro.</p>
            )}
            {referent ? (
              <p className="text-sm text-text-secondary">Referente: {referent.public_name}</p>
            ) : null}
            <p className="text-sm text-text-secondary">
              {request.community_display ? request.community_display.name : "Sin comunidad"}
              {request.event_display ? ` · ${request.event_display.title}` : ""}
            </p>
            <p className="text-xs text-text-secondary">{formatDateTime(request.created_at)}</p>
          </div>
          {request.acknowledged_at ? (
            <Badge tone="success">Atendido</Badge>
          ) : (
            <Button
              type="button"
              disabled={acknowledge.isPending}
              onClick={() => acknowledge.mutate(request.id)}
            >
              He contactado
            </Button>
          )}
        </div>
        {acknowledge.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {acknowledge.error.message}
          </p>
        ) : null}
      </Card>
    </li>
  );
}

function GuardiaSettings({ orgId }: { orgId: number | string }) {
  const organization = useOrganization(orgId);
  const updateOrganization = useUpdateOrganization(orgId);
  const [helpPhone, setHelpPhone] = useState<string | null>(null);

  // Un fallo de la ficha dejaba la sección entera en blanco, sin decir
  // nada: quien entra no sabe si la entidad no tiene teléfono de guardia
  // o si la petición se ha caído.
  if (organization.isError) {
    return (
      <Card title="Ajustes de guardia">
        <ErrorState
          title="No se pudieron cargar los ajustes de guardia"
          description={organization.error.message}
        />
      </Card>
    );
  }
  if (!organization.data) return null;

  const currentHelpPhone = helpPhone ?? organization.data.help_phone ?? "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Cadena vacía (no `null`) es el valor que limpia el campo: el modelo
    // real es `CharField(blank=True, default='')` (`entities/models.py`,
    // migración 0003) y `docs/schema.yaml` lo tipa `type: string`, sin
    // nullable — DRF rechaza `null` con 400. Verificado contra el backend.
    updateOrganization.mutate({ help_phone: currentHelpPhone });
  }

  return (
    <Card title="Ajustes de guardia">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="guardia-help-phone" className="mb-1 block text-sm font-medium text-text-form">
            Teléfono de ayuda
          </label>
          <input
            id="guardia-help-phone"
            type="tel"
            value={currentHelpPhone}
            onChange={(event) => setHelpPhone(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <Button type="submit" disabled={updateOrganization.isPending}>
          Guardar
        </Button>
      </form>
      <p className="mt-2 text-xs text-text-secondary">
        Persona de guardia actual: {organization.data.on_call_user ?? "sin asignar"}. Fijarla exige el id
        de una persona con rol en esta entidad (`on_call_user`); todavía no hay un buscador de personas
        en el panel — ver el informe de esta tarea.
      </p>
      {updateOrganization.isError ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {updateOrganization.error.message}
        </p>
      ) : null}
      {updateOrganization.isSuccess ? (
        <p className="mt-2 text-sm text-success">Guardado.</p>
      ) : null}
    </Card>
  );
}

/**
 * Guardia de la entidad (tarea W4a, `docs/SEGURIDAD_Y_MODERACION.md` §5):
 * avisos de «hoy lo llevo mal» pendientes, con «He contactado»
 * (`acknowledge`), y el teléfono de ayuda de la entidad
 * (`PATCH .../organizations/{id}/ {help_phone}`). Fijar `on_call_user`
 * (persona de guardia) exige un id de usuario que hoy no hay forma de
 * buscar desde el panel (`GET /api/users/users/` es solo para
 * `IsAdminUser`) — ver «Desviaciones» del informe. Cada aviso enlaza a la
 * ficha de la persona (`/entidad/{slug}/personas/{userId}`) solo si
 * `user_display.is_member`; si no, un badge «No pertenece a la entidad»
 * (ver `HelpRequestCard`).
 */
export function GuardiaPanel({ orgId, slug }: GuardiaPanelProps) {
  const requests = usePendingHelpRequests(orgId);

  return (
    <div className="flex flex-col gap-6">
      <GuardiaSettings orgId={orgId} />

      <section aria-labelledby="avisos-heading">
        <h2 id="avisos-heading" className="mb-2 text-lg font-semibold text-text-base">
          Avisos pendientes
        </h2>
        {requests.isError ? (
          requests.error.kind === "sin_acceso" ? (
            <EmptyState title="Sin acceso" description="No tienes acceso a los avisos de ayuda." />
          ) : (
            <ErrorState title="No se pudieron cargar los avisos" description={requests.error.message} />
          )
        ) : !requests.data ? (
          <p className="text-sm text-text-secondary">Cargando avisos…</p>
        ) : requests.data.length === 0 ? (
          <EmptyState title="Sin avisos pendientes" />
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.data.map((request) => (
              <HelpRequestCard key={request.id} request={request} orgId={orgId} slug={slug} />
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-text-secondary">
          Popyplan no guarda teléfonos: contacta con la persona por el chat de la app o a través de su
          referente.
        </p>
      </section>
    </div>
  );
}
