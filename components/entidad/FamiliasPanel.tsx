"use client";

/**
 * Espacio POP Familias de la entidad (tarea de cierre, ronda final de
 * Fase 5: reemplaza el «Próximamente» de W4a, `docs/PANEL.md` §8).
 * Resumen (`useFamiliesSummary`, §8.3) con tarjetas de actividad,
 * listado de comunidades `space='families'` con el interruptor de cruce
 * de espacios (`allow_cross_space`, solo titular/moderador —
 * `useToggleCrossSpace`, §8.1) y «Nueva comunidad de familias»
 * (`useCreateFamiliesCommunity`, `space:'families'` + `owner_org`).
 * Comunicaciones y recursos recientes con enlace a sus propias
 * secciones. Banner explícito de separación de espacios (invariante 1:
 * nadie declara ser familiar de nadie, `communities/services/visibility
 * .py::espacio_bloqueado_para`).
 *
 * **Regla de supresión** (`members_count`, mismo patrón que
 * `lib/metrics/format.ts`): el fix de backend que suprime el recuento de
 * personas para quien no tiene `ver_lista_nominal` llega en paralelo a
 * esta tarea — se trata cualquier `members_count: null` como suprimido
 * (`<5`), lleve o no un `suppressed` explícito (ver
 * `lib/api/types.ts::FamiliesSummary`).
 */
import { useState, type FormEvent } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatCard } from "@/components/metrics/StatCard";
import { useCreateFamiliesCommunity } from "@/hooks/useCreateFamiliesCommunity";
import { useFamiliesSummary } from "@/hooks/useFamiliesSummary";
import { useToggleCrossSpace } from "@/hooks/useToggleCrossSpace";
import type { FamiliesSummaryCommunityRow } from "@/lib/api/types";
import { formatCount } from "@/lib/metrics/format";

export interface FamiliasPanelProps {
  orgId: number | string;
  slug: string;
  canManage: boolean;
}

function isSuppressed(row: { members_count: number | null; suppressed?: boolean }): boolean {
  return row.suppressed ?? row.members_count === null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function NuevaComunidadDialog({
  orgId,
  open,
  onClose,
}: {
  orgId: number | string;
  open: boolean;
  onClose: () => void;
}) {
  const createCommunity = useCreateFamiliesCommunity();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"open" | "on_request" | "private">("open");
  const [codeOfConduct, setCodeOfConduct] = useState("");

  const canSubmit = name.trim().length > 0;

  function resetForm() {
    setName("");
    setDescription("");
    setVisibility("open");
    setCodeOfConduct("");
    createCommunity.reset();
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    createCommunity.mutate(
      {
        orgId,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        codeOfConduct: codeOfConduct.trim() || undefined,
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <Dialog
      open={open}
      titleId="nueva-comunidad-familias-title"
      title="Nueva comunidad de familias"
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="familias-nombre" className="mb-1 block text-sm font-medium text-text-form">
            Nombre
          </label>
          <input
            id="familias-nombre"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
          />
        </div>
        <div>
          <label htmlFor="familias-descripcion" className="mb-1 block text-sm font-medium text-text-form">
            Descripción
          </label>
          <textarea
            id="familias-descripcion"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
          />
        </div>
        <div>
          <label htmlFor="familias-visibilidad" className="mb-1 block text-sm font-medium text-text-form">
            Visibilidad
          </label>
          <select
            id="familias-visibilidad"
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value as "open" | "on_request" | "private")
            }
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
          >
            <option value="open">Abierta</option>
            <option value="on_request">Con solicitud</option>
            <option value="private">Privada</option>
          </select>
        </div>
        <div>
          <label htmlFor="familias-codigo" className="mb-1 block text-sm font-medium text-text-form">
            Código de conducta
          </label>
          <textarea
            id="familias-codigo"
            value={codeOfConduct}
            onChange={(event) => setCodeOfConduct(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit || createCommunity.isPending}>
            Crear comunidad
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
        </div>
        {createCommunity.isError ? (
          <p role="alert" className="text-sm text-error">
            {createCommunity.error.message}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function CommunityRow({
  orgId,
  community,
  canManage,
}: {
  orgId: number | string;
  community: FamiliesSummaryCommunityRow;
  canManage: boolean;
}) {
  const toggle = useToggleCrossSpace();
  const [confirmingValue, setConfirmingValue] = useState<boolean | null>(null);

  function requestToggle(next: boolean) {
    setConfirmingValue(next);
  }

  function handleConfirm() {
    if (confirmingValue === null) return;
    toggle.mutate(
      { orgId, communityId: community.id, allowCrossSpace: confirmingValue },
      { onSettled: () => setConfirmingValue(null) },
    );
  }

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-text-base">{community.name}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge tone="info">
                {formatCount(community.members_count, isSuppressed(community))} personas
              </Badge>
              <Badge tone={community.allow_cross_space ? "success" : "neutral"}>
                {community.allow_cross_space ? "Cruce de espacios activado" : "Espacios separados"}
              </Badge>
            </div>
          </div>
          {canManage ? (
            <label className="flex items-center gap-2 text-sm text-text-base">
              <input
                type="checkbox"
                checked={community.allow_cross_space}
                disabled={toggle.isPending}
                onChange={(event) => requestToggle(event.target.checked)}
              />
              Permitir cruce de espacios
            </label>
          ) : null}
        </div>
        {toggle.isError ? (
          <p role="alert" className="mt-2 text-xs text-error">
            {toggle.error.message}
          </p>
        ) : null}
      </Card>
      <ConfirmDialog
        open={confirmingValue !== null}
        title="Cambiar la separación de espacios"
        description={
          confirmingValue
            ? `«${community.name}» pasará a verse también desde el espacio de miembros de la entidad (y viceversa), rompiendo la separación por defecto entre familias y miembros. ¿Continuar?`
            : `«${community.name}» dejará de verse desde el otro espacio: volverá a la separación por defecto (nadie declara ser familiar de nadie). ¿Continuar?`
        }
        confirmLabel="Confirmar"
        pending={toggle.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmingValue(null)}
      />
    </li>
  );
}

export function FamiliasPanel({ orgId, slug, canManage }: FamiliasPanelProps) {
  const summary = useFamiliesSummary(orgId);
  const [creating, setCreating] = useState(false);

  if (summary.isError) {
    return (
      <ErrorState
        title="No se pudo cargar el espacio de Familias"
        description={summary.error.message}
      />
    );
  }

  if (!summary.data) {
    return <p className="text-sm text-text-secondary">Cargando el espacio de Familias…</p>;
  }

  const data = summary.data;

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-md border border-border bg-category-light p-3 text-sm text-text-form">
        Las comunidades de familias están separadas de las de miembros; nadie declara ser familiar
        de nadie.
      </p>

      <section aria-labelledby="familias-resumen-heading">
        <h2 id="familias-resumen-heading" className="sr-only">
          Resumen de Familias
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Comunidades de familias" value={formatCount(data.communities.length)} />
          <StatCard label="Personas" value={formatCount(data.members_count, isSuppressed(data))} />
          <StatCard label="Próximas actividades" value={formatCount(data.upcoming_events.length)} />
        </div>
      </section>

      <section aria-labelledby="familias-comunidades-heading">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="familias-comunidades-heading" className="text-lg font-semibold text-text-base">
            Comunidades de familias
          </h2>
          {canManage ? (
            <Button type="button" onClick={() => setCreating(true)}>
              Nueva comunidad de familias
            </Button>
          ) : null}
        </div>
        {data.communities.length === 0 ? (
          <EmptyState
            title="Sin comunidades de familias todavía"
            description="Esta entidad todavía no tiene ninguna comunidad marcada como espacio de familias."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.communities.map((community) => (
              <CommunityRow
                key={community.id}
                orgId={orgId}
                community={community}
                canManage={canManage}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="familias-actividades-heading">
        <h2 id="familias-actividades-heading" className="mb-2 text-lg font-semibold text-text-base">
          Próximas actividades
        </h2>
        {data.upcoming_events.length === 0 ? (
          <EmptyState title="Sin actividades próximas" />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.upcoming_events.map((event) => (
              <li key={event.id}>
                <Card>
                  <p className="font-medium text-text-base">{event.title}</p>
                  <p className="text-sm text-text-secondary">
                    {formatDateTime(event.starts_at)} · {event.community.name}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/entidad/${slug}/actividades`}
          className="mt-2 inline-block text-sm font-medium text-primary underline"
        >
          Ver todas las actividades
        </Link>
      </section>

      <section aria-labelledby="familias-comunicaciones-heading">
        <h2 id="familias-comunicaciones-heading" className="mb-2 text-lg font-semibold text-text-base">
          Comunicaciones recientes
        </h2>
        {data.announcements.length === 0 ? (
          <EmptyState title="Sin comunicaciones para familias todavía" />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.announcements.map((announcement) => (
              <li key={announcement.id}>
                <Card>
                  <p className="font-medium text-text-base">{announcement.title}</p>
                  <p className="text-sm text-text-secondary">
                    {formatDateTime(announcement.sent_at)} · {announcement.recipients_count}{" "}
                    {announcement.recipients_count === 1 ? "destinatario" : "destinatarios"}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/entidad/${slug}/comunicaciones`}
          className="mt-2 inline-block text-sm font-medium text-primary underline"
        >
          Ir a Comunicaciones
        </Link>
      </section>

      <section aria-labelledby="familias-recursos-heading">
        <h2 id="familias-recursos-heading" className="mb-2 text-lg font-semibold text-text-base">
          Recursos recientes
        </h2>
        {data.resources.length === 0 ? (
          <EmptyState title="Sin recursos para familias todavía" />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.resources.map((resource) => (
              <li key={resource.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-text-base">{resource.title}</p>
                    {resource.is_featured ? <Badge tone="success">Destacado</Badge> : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/entidad/${slug}/recursos`}
          className="mt-2 inline-block text-sm font-medium text-primary underline"
        >
          Ir a Recursos
        </Link>
      </section>

      {canManage ? (
        <NuevaComunidadDialog orgId={orgId} open={creating} onClose={() => setCreating(false)} />
      ) : null}
    </div>
  );
}
