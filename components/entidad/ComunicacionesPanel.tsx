"use client";

/**
 * Comunicaciones oficiales de la entidad (tarea W4b, `docs/PANEL.md` §5):
 * redactar un anuncio (título, cuerpo, audiencia) e historial con
 * `recipients_count`. El backend no ofrece una vista previa del número de
 * destinatarios antes de enviar (no hay endpoint para ello, ver informe de
 * esta tarea): el diálogo de confirmación describe la audiencia elegida,
 * y tras el envío se muestra `recipients_count` real de la respuesta.
 * Solo titular/moderador pueden componer (`canCompose`); el resto de
 * roles con acceso a esta página (dinamizador, ver `entidadMenu.ts`) solo
 * ve el historial.
 *
 * **Ronda final de Fase 5** (P6 cerrado en el backend, `docs/PANEL.md`
 * §5.2/§8.2): la opción «Familias» ya no va deshabilitada a fuego —
 * `hasFamilies` (`useEntityCommunities`, filtrando `space === 'families'`)
 * decide si se puede elegir. Sin ninguna comunidad de familias en la
 * entidad, se queda deshabilitada con la misma pista de siempre.
 */
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useEntityCommunities } from "@/hooks/useEntityCommunities";
import { useSendAnnouncement } from "@/hooks/useSendAnnouncement";
import { SUPPORT_WELCOME_TEMPLATE, applyTemplate } from "@/lib/communications/templates";
import type { Announcement, EntityCommunityRow } from "@/lib/api/types";

export interface ComunicacionesPanelProps {
  orgId: number | string;
  canCompose: boolean;
}

type AudienceKind = "members" | "community" | "families";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

export function describeAudience(audience: string, communities: EntityCommunityRow[]): string {
  if (audience === "members") return "Todos los miembros";
  if (audience === "families") return "Familias";
  if (audience.startsWith("community:")) {
    const communityId = audience.slice("community:".length);
    const community = communities.find((c) => c.id === communityId);
    return community ? `Comunidad: ${community.name}` : "Una comunidad";
  }
  return audience;
}

function ComposeForm({ orgId }: { orgId: number | string }) {
  const communities = useEntityCommunities(orgId);
  const sendAnnouncement = useSendAnnouncement(orgId);
  const hasFamilies = (communities.data ?? []).some((community) => community.space === "families");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceKind, setAudienceKind] = useState<AudienceKind>("members");
  const [communityId, setCommunityId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastSent, setLastSent] = useState<Announcement | null>(null);
  const [templateConfirmOpen, setTemplateConfirmOpen] = useState(false);
  // Resultado de `applyTemplate` calculado en el clic que abrió el
  // `ConfirmDialog`: `handleConfirmTemplate` lo reutiliza tal cual en vez
  // de volver a derivarlo de la constante, para no divergir en silencio
  // si `applyTemplate` alguna vez transforma el texto (recortar,
  // interpolar el nombre de la entidad…).
  const [pendingTemplate, setPendingTemplate] = useState<{ title: string; body: string } | null>(
    null,
  );

  const audienceValue =
    audienceKind === "members"
      ? "members"
      : audienceKind === "families"
        ? "families"
        : (`community:${communityId}` as const);

  const audienceLabel = describeAudience(audienceValue, communities.data ?? []);
  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (audienceKind !== "community" || communityId.length > 0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setConfirmOpen(true);
  }

  function handleUseTemplateClick() {
    const result = applyTemplate({ title, body }, SUPPORT_WELCOME_TEMPLATE);
    if (result.overwritten) {
      setPendingTemplate({ title: result.title, body: result.body });
      setTemplateConfirmOpen(true);
      return;
    }
    setTitle(result.title);
    setBody(result.body);
    setAudienceKind("families");
  }

  function handleConfirmTemplate() {
    if (pendingTemplate) {
      setTitle(pendingTemplate.title);
      setBody(pendingTemplate.body);
    }
    setAudienceKind("families");
    setTemplateConfirmOpen(false);
    setPendingTemplate(null);
  }

  function handleConfirm() {
    sendAnnouncement.mutate(
      { title, body, audience: audienceValue },
      {
        onSuccess: (announcement) => {
          setLastSent(announcement);
          setTitle("");
          setBody("");
          setAudienceKind("members");
          setCommunityId("");
          setConfirmOpen(false);
        },
        onError: () => setConfirmOpen(false),
      },
    );
  }

  return (
    <Card title="Redactar comunicación">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="comunicacion-title" className="mb-1 block text-sm font-medium text-text-form">
            Título
          </label>
          <input
            id="comunicacion-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            required
          />
        </div>
        <div>
          <label htmlFor="comunicacion-body" className="mb-1 block text-sm font-medium text-text-form">
            Cuerpo
          </label>
          <textarea
            id="comunicacion-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            required
          />
        </div>
        {hasFamilies ? (
          <div>
            <Button type="button" variant="secondary" onClick={handleUseTemplateClick}>
              Usar plantilla: Bienvenida a la red de apoyo
            </Button>
          </div>
        ) : null}
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-text-form">Audiencia</legend>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-text-base">
              <input
                type="radio"
                name="audience-kind"
                value="members"
                checked={audienceKind === "members"}
                onChange={() => setAudienceKind("members")}
              />
              Todos los miembros
            </label>
            <label className="flex items-center gap-2 text-sm text-text-base">
              <input
                type="radio"
                name="audience-kind"
                value="community"
                checked={audienceKind === "community"}
                onChange={() => setAudienceKind("community")}
              />
              Una comunidad
            </label>
            {audienceKind === "community" ? (
              <select
                aria-label="Comunidad"
                value={communityId}
                onChange={(event) => setCommunityId(event.target.value)}
                aria-describedby={communities.isError ? "comunicacion-comunidades-error" : undefined}
                className="ml-6 rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
              >
                <option value="">Elige una comunidad</option>
                {(communities.data ?? []).map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            ) : null}
            <label
              className={`flex items-center gap-2 text-sm ${hasFamilies ? "text-text-base" : "text-text-secondary"}`}
            >
              <input
                type="radio"
                name="audience-kind"
                value="families"
                disabled={!hasFamilies}
                checked={audienceKind === "families"}
                onChange={() => setAudienceKind("families")}
                aria-describedby={communities.isError ? "comunicacion-comunidades-error" : undefined}
              />
              Familias
            </label>
            {communities.isError ? (
              // Sin el listado no se puede saber si la entidad tiene
              // espacio de familias: la pista de siempre sería engañosa.
              // El mismo aviso describe los dos controles afectados (el
              // select de comunidad y la opción «Familias»).
              <p id="comunicacion-comunidades-error" role="alert" className="ml-6 text-xs text-error">
                No se pudieron cargar las comunidades.
              </p>
            ) : !hasFamilies ? (
              <p className="ml-6 text-xs text-text-secondary">
                Disponible cuando exista el espacio de familias.
              </p>
            ) : null}
          </div>
        </fieldset>
        <div>
          <Button type="submit" disabled={!canSubmit || sendAnnouncement.isPending}>
            Enviar comunicación
          </Button>
        </div>
        {sendAnnouncement.isError ? (
          <p role="alert" className="text-sm text-error">
            {sendAnnouncement.error.message}
          </p>
        ) : null}
        {lastSent ? (
          <p className="text-sm text-success">
            Enviada a {lastSent.recipients_count}{" "}
            {lastSent.recipients_count === 1 ? "persona" : "personas"}.
          </p>
        ) : null}
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="Enviar comunicación"
        description={`¿Enviar esta comunicación a: ${audienceLabel}?`}
        confirmLabel="Enviar"
        pending={sendAnnouncement.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={templateConfirmOpen}
        title="Usar la plantilla"
        description="Se reemplazará el texto actual del título y del cuerpo."
        confirmLabel="Usar plantilla"
        onConfirm={handleConfirmTemplate}
        onCancel={() => {
          setTemplateConfirmOpen(false);
          setPendingTemplate(null);
        }}
      />
    </Card>
  );
}

function Historial({ orgId }: { orgId: number | string }) {
  const announcements = useAnnouncements(orgId);
  const communities = useEntityCommunities(orgId);

  if (announcements.isError) {
    return <ErrorState title="No se pudo cargar el historial" description={announcements.error.message} />;
  }
  if (!announcements.data) {
    return <p className="text-sm text-text-secondary">Cargando comunicaciones…</p>;
  }
  if (announcements.data.length === 0) {
    return <EmptyState title="Sin comunicaciones todavía" />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {announcements.data.map((announcement) => (
        <li key={announcement.id}>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-text-base">{announcement.title}</p>
                <p className="mt-1 text-sm text-text-secondary">{announcement.body}</p>
              </div>
              <Badge tone="info">{describeAudience(announcement.audience, communities.data ?? [])}</Badge>
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              Enviada el {formatDateTime(announcement.sent_at)} · {announcement.recipients_count}{" "}
              {announcement.recipients_count === 1 ? "destinatario" : "destinatarios"}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function ComunicacionesPanel({ orgId, canCompose }: ComunicacionesPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {canCompose ? (
        <ComposeForm orgId={orgId} />
      ) : (
        <p className="text-sm text-text-secondary">
          Solo titular o moderador pueden redactar comunicaciones. Aquí puedes ver el historial.
        </p>
      )}
      <section aria-labelledby="historial-heading">
        <h2 id="historial-heading" className="mb-2 text-lg font-semibold text-text-base">
          Historial
        </h2>
        <Historial orgId={orgId} />
      </section>
    </div>
  );
}
