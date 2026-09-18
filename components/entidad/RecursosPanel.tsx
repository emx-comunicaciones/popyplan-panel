"use client";

/**
 * Biblioteca de recursos de la entidad (tarea W4b, `docs/PANEL.md` §7):
 * lista agrupada por categoría con destacados primero (el orden ya llega
 * así del backend — `is_featured` descendente y luego `created_at`
 * descendente — agrupar en el cliente conserva ese orden relativo dentro
 * de cada categoría), crear/editar con fichero (multipart cuando hay
 * fichero, `hooks/useCreateResource.ts`/`useUpdateResource.ts`) y borrar
 * con confirmación. Solo titular/moderador gestionan (`canManage`); el
 * resto de roles con acceso a esta página (dinamizador) solo ve la lista.
 *
 * **Ronda final de Fase 5** (P6 cerrado en el backend, `docs/PANEL.md`
 * §7.2/§8.2): la opción «Familias» ya no va deshabilitada a fuego —
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
import { useCreateResource } from "@/hooks/useCreateResource";
import { useDeleteResource } from "@/hooks/useDeleteResource";
import { useEntityCommunities } from "@/hooks/useEntityCommunities";
import { useResources } from "@/hooks/useResources";
import { useUpdateResource } from "@/hooks/useUpdateResource";
import type { EntityResource, ResourceAudience, ResourceCategory, ResourceKind } from "@/lib/api/types";
import { validateResourceFile } from "@/lib/resources/validateFile";

export interface RecursosPanelProps {
  orgId: number | string;
  canManage: boolean;
}

const CATEGORY_ORDER: ResourceCategory[] = [
  "help",
  "training",
  "families",
  "habits",
  "activities",
  "about",
];

const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  help: "Ayuda",
  training: "Formación",
  families: "Familias",
  habits: "Hábitos",
  activities: "Actividades",
  about: "Sobre la entidad",
};

const KIND_LABELS: Record<ResourceKind, string> = {
  text: "Texto",
  pdf: "PDF",
  video: "Vídeo",
  audio: "Audio",
  link: "Enlace",
  document: "Documento",
};

const AUDIENCE_LABELS: Record<ResourceAudience, string> = {
  members: "Miembros",
  families: "Familias",
  public: "Público",
};

const FILE_KINDS: ResourceKind[] = ["pdf", "video", "audio", "document"];

interface ResourceFormState {
  title: string;
  category: ResourceCategory;
  kind: ResourceKind;
  body: string;
  url: string;
  audience: ResourceAudience;
  isFeatured: boolean;
  file: File | null;
}

function emptyForm(): ResourceFormState {
  return {
    title: "",
    category: "help",
    kind: "text",
    body: "",
    url: "",
    audience: "members",
    isFeatured: false,
    file: null,
  };
}

function formFromResource(resource: EntityResource): ResourceFormState {
  return {
    title: resource.title,
    category: resource.category,
    kind: resource.kind,
    body: resource.body ?? "",
    url: resource.url ?? "",
    audience: resource.audience ?? "members",
    isFeatured: resource.is_featured ?? false,
    file: null,
  };
}

function ResourceForm({
  orgId,
  editing,
  onDone,
}: {
  orgId: number | string;
  editing: EntityResource | "new";
  onDone: () => void;
}) {
  const createResource = useCreateResource(orgId);
  const updateResource = useUpdateResource(orgId);
  const communities = useEntityCommunities(orgId);
  const hasFamilies = (communities.data ?? []).some((community) => community.space === "families");
  const [form, setForm] = useState<ResourceFormState>(
    editing === "new" ? emptyForm() : formFromResource(editing),
  );
  const [fileError, setFileError] = useState<string | null>(null);

  const mutation = editing === "new" ? createResource : updateResource;
  const requiresFile = FILE_KINDS.includes(form.kind);

  function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0] ?? null;
    if (file) {
      const error = validateResourceFile(file);
      setFileError(error);
      if (error) {
        setForm((prev) => ({ ...prev, file: null }));
        return;
      }
    } else {
      setFileError(null);
    }
    setForm((prev) => ({ ...prev, file }));
  }

  // Un enlace sin URL o un PDF/vídeo/audio/documento sin fichero nunca
  // pasan la validación del backend (400): se bloquea antes de enviar.
  // Editando, el fichero solo es obligatorio si el recurso no tenía uno
  // («deja vacío para conservar el fichero actual»).
  const hasStoredFile = editing !== "new" && Boolean(editing.file);
  const missingUrl = form.kind === "link" && form.url.trim().length === 0;
  const missingFile = requiresFile && !form.file && !hasStoredFile;
  const canSubmit = form.title.trim().length > 0 && !fileError && !missingUrl && !missingFile;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const fields = {
      title: form.title,
      category: form.category,
      kind: form.kind,
      audience: form.audience,
      is_featured: form.isFeatured,
      // `body`/`url` solo se limpian (cadena vacía explícita) cuando el
      // recurso guardado era de ese tipo y deja de serlo: `EntityResource`
      // los lleva para cualquier `kind`, así que mandar `""` en toda
      // edición no-texto borraría el `body` de un PDF por editarle el
      // título. Fuera de ese caso van `undefined` y `buildResourcePayload`
      // los descarta del PATCH (la cadena vacía sí viaja, ver
      // `lib/resources/resourceFormData.ts`).
      body: form.kind === "text" ? form.body : editing !== "new" && editing.kind === "text" ? "" : undefined,
      url: form.kind === "link" ? form.url : editing !== "new" && editing.kind === "link" ? "" : undefined,
      file: form.file ?? undefined,
    };

    if (editing === "new") {
      createResource.mutate(
        { ...fields, category: form.category, kind: form.kind, audience: form.audience },
        { onSuccess: onDone },
      );
    } else {
      updateResource.mutate({ resourceId: editing.id, ...fields }, { onSuccess: onDone });
    }
  }

  return (
    <Card title={editing === "new" ? "Nuevo recurso" : "Editar recurso"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="resource-title" className="mb-1 block text-sm font-medium text-text-form">
            Título
          </label>
          <input
            id="resource-title"
            type="text"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            required
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="resource-category" className="mb-1 block text-sm font-medium text-text-form">
              Categoría
            </label>
            <select
              id="resource-category"
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, category: event.target.value as ResourceCategory }))
              }
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            >
              {CATEGORY_ORDER.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="resource-kind" className="mb-1 block text-sm font-medium text-text-form">
              Tipo
            </label>
            <select
              id="resource-kind"
              value={form.kind}
              onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value as ResourceKind }))}
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            >
              {(Object.keys(KIND_LABELS) as ResourceKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {form.kind === "text" ? (
          <div>
            <label htmlFor="resource-body" className="mb-1 block text-sm font-medium text-text-form">
              Texto
            </label>
            <textarea
              id="resource-body"
              value={form.body}
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
              rows={4}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            />
          </div>
        ) : null}

        {form.kind === "link" ? (
          <div>
            <label htmlFor="resource-url" className="mb-1 block text-sm font-medium text-text-form">
              Enlace
            </label>
            <input
              id="resource-url"
              type="url"
              value={form.url}
              onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            />
          </div>
        ) : null}

        {requiresFile ? (
          <div>
            <label htmlFor="resource-file" className="mb-1 block text-sm font-medium text-text-form">
              Fichero
            </label>
            <input
              id="resource-file"
              type="file"
              onChange={(event) => handleFileChange(event.target.files)}
              className="block text-sm"
            />
            {fileError ? (
              <p role="alert" className="mt-1 text-xs text-error">
                {fileError}
              </p>
            ) : null}
            {editing !== "new" && !form.file ? (
              <p className="mt-1 text-xs text-text-secondary">
                Deja vacío para conservar el fichero actual.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="resource-audience" className="mb-1 block text-sm font-medium text-text-form">
              Audiencia
            </label>
            <select
              id="resource-audience"
              value={form.audience}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, audience: event.target.value as ResourceAudience }))
              }
              aria-describedby={communities.isError ? "resource-audience-error" : undefined}
              className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
            >
              <option value="members">Miembros</option>
              <option value="public">Público</option>
              <option value="families" disabled={!hasFamilies}>
                Familias
              </option>
            </select>
            {communities.isError ? (
              // Igual que en `ComunicacionesPanel`: sin comunidades
              // cargadas no se sabe si hay espacio de familias.
              <p id="resource-audience-error" role="alert" className="mt-1 text-xs text-error">
                No se pudieron cargar las comunidades.
              </p>
            ) : !hasFamilies ? (
              <p className="mt-1 text-xs text-text-secondary">
                «Familias» estará disponible cuando exista el espacio de familias.
              </p>
            ) : null}
          </div>
          <label className="flex items-end gap-2 text-sm text-text-base">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(event) => setForm((prev) => ({ ...prev, isFeatured: event.target.checked }))}
            />
            Destacado
          </label>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit || mutation.isPending}>
            Guardar
          </Button>
          <Button type="button" variant="secondary" onClick={onDone} disabled={mutation.isPending}>
            Cancelar
          </Button>
        </div>
        {mutation.isError ? (
          <p role="alert" className="text-sm text-error">
            {mutation.error.message}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

function ResourceCard({
  resource,
  canManage,
  onEdit,
  onDelete,
}: {
  resource: EntityResource;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-text-base">{resource.title}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge tone="info">{KIND_LABELS[resource.kind]}</Badge>
            {resource.is_featured ? <Badge tone="success">Destacado</Badge> : null}
            <Badge tone="neutral">{AUDIENCE_LABELS[resource.audience ?? "members"]}</Badge>
          </div>
          {resource.kind === "text" && resource.body ? (
            <p className="mt-2 text-sm text-text-secondary">{resource.body}</p>
          ) : null}
          {resource.kind === "link" && resource.url ? (
            <a
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-primary-700 underline-offset-2 hover:underline"
            >
              Abrir enlace
            </a>
          ) : null}
          {resource.file ? (
            <a
              href={resource.file}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-primary-700 underline-offset-2 hover:underline"
            >
              Descargar fichero
            </a>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onEdit}>
              Editar
            </Button>
            <Button type="button" variant="danger" onClick={onDelete}>
              Eliminar
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function RecursosPanel({ orgId, canManage }: RecursosPanelProps) {
  const resources = useResources(orgId);
  const deleteResource = useDeleteResource(orgId);
  const [editing, setEditing] = useState<EntityResource | "new" | null>(null);
  const [deleting, setDeleting] = useState<EntityResource | null>(null);

  if (resources.isError) {
    return <ErrorState title="No se pudieron cargar los recursos" description={resources.error.message} />;
  }
  if (!resources.data) {
    return <p className="text-sm text-text-secondary">Cargando recursos…</p>;
  }

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: resources.data!.filter((resource) => resource.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        editing ? (
          // `key`: el estado del formulario nace de `editing` en el
          // `useState` inicial, así que sin remontar, pasar de editar A a
          // editar B (o de «Nuevo recurso» a editar A) conservaría los
          // campos del anterior y el `PATCH` de B mandaría los datos de A.
          <ResourceForm
            key={editing === "new" ? "new" : editing.id}
            orgId={orgId}
            editing={editing}
            onDone={() => setEditing(null)}
          />
        ) : (
          <div>
            <Button type="button" onClick={() => setEditing("new")}>
              Nuevo recurso
            </Button>
          </div>
        )
      ) : null}

      {byCategory.length === 0 ? (
        <EmptyState title="Sin recursos todavía" />
      ) : (
        byCategory.map(({ category, items }) => (
          <section key={category} aria-labelledby={`categoria-${category}-heading`}>
            <h2 id={`categoria-${category}-heading`} className="mb-2 text-lg font-semibold text-text-base">
              {CATEGORY_LABELS[category]}
            </h2>
            <ul className="flex flex-col gap-3">
              {items.map((resource) => (
                <li key={resource.id}>
                  <ResourceCard
                    resource={resource}
                    canManage={canManage}
                    onEdit={() => setEditing(resource)}
                    onDelete={() => {
                      deleteResource.reset();
                      setDeleting(resource);
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar recurso"
        description={
          // El error del borrado se pinta aquí dentro, no bajo la lista:
          // el diálogo sigue abierto tras un fallo (solo se cierra en
          // caso de éxito) y quien acaba de pulsar «Eliminar» lee el
          // motivo sin perder el contexto de lo que iba a borrar.
          <div className="flex flex-col gap-2">
            <p>{deleting ? `¿Eliminar «${deleting.title}»? Esta acción no se puede deshacer.` : ""}</p>
            {deleteResource.isError ? (
              <p role="alert" className="text-error">
                {deleteResource.error.message}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Eliminar"
        pending={deleteResource.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteResource.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
        onCancel={() => {
          deleteResource.reset();
          setDeleting(null);
        }}
      />
    </div>
  );
}
