"use client";

/**
 * «Nueva entidad» (tarea W5, `docs/SEGURIDAD_Y_MODERACION.md` §8):
 * `POST /api/organizations/ {name, slug, org_type, cif, parent?,
 * description?}`, `verifier`/`superadmin`. Nace sin verificar
 * (`is_verified=false`): verificar es un paso aparte, desde la ficha de
 * la entidad.
 */
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useCreateOrganization } from "@/hooks/useOrganizations";
import type { OrgTypeEnum } from "@/lib/api/types";

export interface NuevaEntidadDialogProps {
  onClose: () => void;
}

const ORG_TYPE_LABELS: Record<OrgTypeEnum, string> = {
  asociacion: "Asociación",
  ong: "ONG",
  administracion: "Administración",
};

export function NuevaEntidadDialog({ onClose }: NuevaEntidadDialogProps) {
  const create = useCreateOrganization();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [orgType, setOrgType] = useState<OrgTypeEnum>("asociacion");
  const [cif, setCif] = useState("");
  const [parent, setParent] = useState("");
  const [description, setDescription] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && slug.trim().length > 0 && cif.trim().length > 0;

  function handleClose() {
    create.reset();
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    create.mutate(
      {
        name: name.trim(),
        slug: slug.trim(),
        org_type: orgType,
        cif: cif.trim(),
        parent: parent ? Number(parent) : null,
        description: description.trim() || undefined,
      },
      {
        onSuccess: (org) => {
          setCreated(org.name);
          setName("");
          setSlug("");
          setCif("");
          setParent("");
          setDescription("");
        },
      },
    );
  }

  return (
    <Dialog open titleId="nueva-entidad-title" title="Nueva entidad" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="nueva-entidad-name" className="mb-1 block text-sm font-medium text-text-form">
            Nombre
          </label>
          <input
            id="nueva-entidad-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="nueva-entidad-slug" className="mb-1 block text-sm font-medium text-text-form">
            Slug
          </label>
          <input
            id="nueva-entidad-slug"
            type="text"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="nueva-entidad-tipo" className="mb-1 block text-sm font-medium text-text-form">
            Tipo
          </label>
          <select
            id="nueva-entidad-tipo"
            value={orgType}
            onChange={(event) => setOrgType(event.target.value as OrgTypeEnum)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            {(Object.keys(ORG_TYPE_LABELS) as OrgTypeEnum[]).map((value) => (
              <option key={value} value={value}>
                {ORG_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="nueva-entidad-cif" className="mb-1 block text-sm font-medium text-text-form">
            CIF
          </label>
          <input
            id="nueva-entidad-cif"
            type="text"
            value={cif}
            onChange={(event) => setCif(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="nueva-entidad-parent" className="mb-1 block text-sm font-medium text-text-form">
            Entidad paraguas (id, opcional)
          </label>
          <input
            id="nueva-entidad-parent"
            type="number"
            value={parent}
            onChange={(event) => setParent(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="nueva-entidad-description" className="mb-1 block text-sm font-medium text-text-form">
            Descripción
          </label>
          <textarea
            id="nueva-entidad-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit || create.isPending}>
            Crear entidad
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cerrar
          </Button>
        </div>

        {create.isError ? (
          <p role="alert" className="text-sm text-error">
            {create.error.message}
          </p>
        ) : null}
        {created ? <p className="text-sm text-success">Entidad «{created}» creada, sin verificar.</p> : null}
      </form>
    </Dialog>
  );
}
