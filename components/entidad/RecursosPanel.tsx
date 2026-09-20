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
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCreateResource, type CreateResourceErrorKind } from "@/hooks/useCreateResource";
import { useDeleteResource, type DeleteResourceErrorKind } from "@/hooks/useDeleteResource";
import { useEntityCommunities } from "@/hooks/useEntityCommunities";
import { useResources } from "@/hooks/useResources";
import { useUpdateResource, type UpdateResourceErrorKind } from "@/hooks/useUpdateResource";
import type { EntityResource, ResourceAudience, ResourceCategory, ResourceKind } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import {
  RESOURCE_ALLOWED_EXTENSIONS,
  RESOURCE_MAX_MB,
  validateResourceFile,
  type ResourceFileErrorKind,
} from "@/lib/resources/validateFile";

// `ResourceForm` reutiliza el mismo componente para crear y editar
// (`editing: EntityResource | "new"`), pero el backend distingue el
// mensaje de «sin permiso» según la acción («crear»/«editar recursos») y
// solo `editar` puede dar 404 (`no_encontrado`) — dos mapas completos en
// vez de uno solo para no perder esa distinción real del contrato.
const CREATE_RESOURCE_ERROR_KEYS: Record<CreateResourceErrorKind, string> = {
  invalido: "errors.createResource.invalido",
  sin_permiso: "errors.createResource.sinPermiso",
  desconocido: "errors.createResource.desconocido",
};

const UPDATE_RESOURCE_ERROR_KEYS: Record<UpdateResourceErrorKind, string> = {
  invalido: "errors.updateResource.invalido",
  sin_permiso: "errors.updateResource.sinPermiso",
  no_encontrado: "errors.updateResource.noEncontrado",
  desconocido: "errors.updateResource.desconocido",
};

const DELETE_RESOURCE_ERROR_KEYS: Record<DeleteResourceErrorKind, string> = {
  sin_permiso: "errors.deleteResource.sinPermiso",
  no_encontrado: "errors.deleteResource.noEncontrado",
  desconocido: "errors.deleteResource.desconocido",
};

export interface RecursosPanelProps {
  orgId: number | string;
  canManage: boolean;
}

const CATEGORY_ORDER: ResourceCategory[] = [
  "help",
  "training",
  "families",
  "accompany",
  "habits",
  "activities",
  "about",
];

const CATEGORY_KEYS: Record<ResourceCategory, string> = {
  help: "entidad.recursos.category.help",
  training: "entidad.recursos.category.training",
  families: "entidad.recursos.category.families",
  accompany: "entidad.recursos.category.accompany",
  habits: "entidad.recursos.category.habits",
  activities: "entidad.recursos.category.activities",
  about: "entidad.recursos.category.about",
};

const KIND_KEYS: Record<ResourceKind, string> = {
  text: "entidad.recursos.kind.text",
  pdf: "entidad.recursos.kind.pdf",
  video: "entidad.recursos.kind.video",
  audio: "entidad.recursos.kind.audio",
  link: "entidad.recursos.kind.link",
  document: "entidad.recursos.kind.document",
};

const AUDIENCE_KEYS: Record<ResourceAudience, string> = {
  members: "entidad.recursos.audience.members",
  families: "entidad.recursos.audience.families",
  public: "entidad.recursos.audience.public",
};

const FILE_ERROR_KEYS: Record<ResourceFileErrorKind, string> = {
  tipo_no_permitido: "entidad.recursos.fileErrors.tipoNoPermitido",
  demasiado_grande: "entidad.recursos.fileErrors.demasiadoGrande",
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
  const t = useTranslations();
  const createResource = useCreateResource(orgId);
  const updateResource = useUpdateResource(orgId);
  const communities = useEntityCommunities(orgId);
  const hasFamilies = (communities.data ?? []).some((community) => community.space === "families");
  const [form, setForm] = useState<ResourceFormState>(
    editing === "new" ? emptyForm() : formFromResource(editing),
  );
  const [fileError, setFileError] = useState<ResourceFileErrorKind | null>(null);

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
    <Card
      title={
        editing === "new" ? t("entidad.recursos.newResource") : t("entidad.recursos.editResource")
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="resource-title" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.recursos.titleLabel")}
          </label>
          <input
            id="resource-title"
            type="text"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            required
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="resource-category" className="mb-1 block text-sm font-medium text-text-form">
              {t("entidad.recursos.categoryLabel")}
            </label>
            <select
              id="resource-category"
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, category: event.target.value as ResourceCategory }))
              }
              className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            >
              {CATEGORY_ORDER.map((category) => (
                <option key={category} value={category}>
                  {t(CATEGORY_KEYS[category])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="resource-kind" className="mb-1 block text-sm font-medium text-text-form">
              {t("entidad.recursos.kindLabel")}
            </label>
            <select
              id="resource-kind"
              value={form.kind}
              onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value as ResourceKind }))}
              className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            >
              {(Object.keys(KIND_KEYS) as ResourceKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {t(KIND_KEYS[kind])}
                </option>
              ))}
            </select>
          </div>
        </div>

        {form.kind === "text" ? (
          <div>
            <label htmlFor="resource-body" className="mb-1 block text-sm font-medium text-text-form">
              {t("entidad.recursos.bodyLabel")}
            </label>
            <textarea
              id="resource-body"
              value={form.body}
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
              rows={4}
              className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            />
          </div>
        ) : null}

        {form.kind === "link" ? (
          <div>
            <label htmlFor="resource-url" className="mb-1 block text-sm font-medium text-text-form">
              {t("entidad.recursos.urlLabel")}
            </label>
            <input
              id="resource-url"
              type="url"
              value={form.url}
              onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
              className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            />
          </div>
        ) : null}

        {requiresFile ? (
          <div>
            <label htmlFor="resource-file" className="mb-1 block text-sm font-medium text-text-form">
              {t("entidad.recursos.fileLabel")}
            </label>
            <input
              id="resource-file"
              type="file"
              onChange={(event) => handleFileChange(event.target.files)}
              className="block text-sm"
            />
            {fileError ? (
              <p role="alert" className="mt-1 text-xs text-error">
                {t(FILE_ERROR_KEYS[fileError], {
                  extensions: RESOURCE_ALLOWED_EXTENSIONS.join(", "),
                  max: RESOURCE_MAX_MB,
                })}
              </p>
            ) : null}
            {editing !== "new" && !form.file ? (
              <p className="mt-1 text-xs text-text-secondary">{t("entidad.recursos.keepCurrentFile")}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="resource-audience" className="mb-1 block text-sm font-medium text-text-form">
              {t("entidad.recursos.audienceLabel")}
            </label>
            <select
              id="resource-audience"
              value={form.audience}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, audience: event.target.value as ResourceAudience }))
              }
              aria-describedby={communities.isError ? "resource-audience-error" : undefined}
              className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            >
              <option value="members">{t(AUDIENCE_KEYS.members)}</option>
              <option value="public">{t(AUDIENCE_KEYS.public)}</option>
              <option value="families" disabled={!hasFamilies}>
                {t(AUDIENCE_KEYS.families)}
              </option>
            </select>
            {communities.isError ? (
              // Igual que en `ComunicacionesPanel`: sin comunidades
              // cargadas no se sabe si hay espacio de familias.
              <p id="resource-audience-error" role="alert" className="mt-1 text-xs text-error">
                {t("entidad.recursos.communitiesError")}
              </p>
            ) : !hasFamilies ? (
              <p className="mt-1 text-xs text-text-secondary">{t("entidad.recursos.familiesHint")}</p>
            ) : null}
          </div>
          <label className="flex items-end gap-2 text-sm text-text-base">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(event) => setForm((prev) => ({ ...prev, isFeatured: event.target.checked }))}
            />
            {t("entidad.recursos.featured")}
          </label>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit || mutation.isPending}>
            {t("common.save")}
          </Button>
          <Button type="button" variant="secondary" onClick={onDone} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
        </div>
        {mutation.isError ? (
          <p role="alert" className="text-sm text-error">
            {editing === "new"
              ? errorKindText(
                  createResource.error,
                  CREATE_RESOURCE_ERROR_KEYS,
                  t,
                  "errors.createResource.desconocido",
                )
              : errorKindText(
                  updateResource.error,
                  UPDATE_RESOURCE_ERROR_KEYS,
                  t,
                  "errors.updateResource.desconocido",
                )}
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
  const t = useTranslations();
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-text-base">{resource.title}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge tone="info">{t(KIND_KEYS[resource.kind])}</Badge>
            {resource.is_featured ? (
              <Badge tone="success">{t("entidad.recursos.featured")}</Badge>
            ) : null}
            <Badge tone="neutral">{t(AUDIENCE_KEYS[resource.audience ?? "members"])}</Badge>
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
              {t("entidad.recursos.openLink")}
            </a>
          ) : null}
          {resource.file ? (
            <a
              href={resource.file}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-primary-700 underline-offset-2 hover:underline"
            >
              {t("entidad.recursos.downloadFile")}
            </a>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onEdit}>
              {t("entidad.recursos.edit")}
            </Button>
            <Button type="button" variant="danger" onClick={onDelete}>
              {t("entidad.recursos.delete")}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function RecursosPanel({ orgId, canManage }: RecursosPanelProps) {
  const t = useTranslations();
  const resources = useResources(orgId);
  const deleteResource = useDeleteResource(orgId);
  const [editing, setEditing] = useState<EntityResource | "new" | null>(null);
  const [deleting, setDeleting] = useState<EntityResource | null>(null);

  if (resources.isError) {
    return (
      <ErrorState
        title={t("entidad.recursos.loadError")}
        description={t("entidad.recursos.loadErrorDescription")}
      />
    );
  }
  if (!resources.data) {
    return <p className="text-sm text-text-secondary">{t("entidad.recursos.loading")}</p>;
  }

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: resources.data!.filter((resource) => resource.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
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
              {t("entidad.recursos.newResource")}
            </Button>
          </div>
        )
      ) : null}

      {byCategory.length === 0 ? (
        <EmptyState title={t("entidad.recursos.empty")} />
      ) : (
        byCategory.map(({ category, items }) => (
          <section key={category} aria-labelledby={`categoria-${category}-heading`}>
            <h2 id={`categoria-${category}-heading`} className="mb-2 text-lg font-semibold text-text-base">
              {t(CATEGORY_KEYS[category])}
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
        title={t("entidad.recursos.deleteTitle")}
        description={
          // El error del borrado se pinta aquí dentro, no bajo la lista:
          // el diálogo sigue abierto tras un fallo (solo se cierra en
          // caso de éxito) y quien acaba de pulsar «Eliminar» lee el
          // motivo sin perder el contexto de lo que iba a borrar.
          <div className="flex flex-col gap-2">
            <p>
              {deleting
                ? t("entidad.recursos.deleteConfirmDescription", { title: deleting.title })
                : ""}
            </p>
            {deleteResource.isError ? (
              <p role="alert" className="text-error">
                {errorKindText(
                  deleteResource.error,
                  DELETE_RESOURCE_ERROR_KEYS,
                  t,
                  "errors.deleteResource.desconocido",
                )}
              </p>
            ) : null}
          </div>
        }
        confirmLabel={t("entidad.recursos.delete")}
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
