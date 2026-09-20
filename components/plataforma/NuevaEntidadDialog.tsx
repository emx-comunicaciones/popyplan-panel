"use client";

/**
 * «Nueva entidad» (tarea W5, `docs/SEGURIDAD_Y_MODERACION.md` §8):
 * `POST /api/organizations/ {name, slug, org_type, cif, parent?,
 * description?}`, `verifier`/`superadmin`. Nace sin verificar
 * (`is_verified=false`): verificar es un paso aparte, desde la ficha de
 * la entidad.
 */
import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useCreateOrganization, type OrganizationsErrorKind } from "@/hooks/useOrganizations";
import type { OrgTypeEnum } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { SedeSelector } from "./SedeSelector";

export interface NuevaEntidadDialogProps {
  onClose: () => void;
}

const ORG_TYPE_LABEL_KEYS: Record<OrgTypeEnum, string> = {
  asociacion: "plataforma.entidades.orgTypeAsociacion",
  ong: "plataforma.entidades.orgTypeOng",
  administracion: "plataforma.entidades.orgTypeAdministracion",
};

const CREATE_ORGANIZATION_ERROR_KEYS: Record<OrganizationsErrorKind, string> = {
  invalido: "errors.createOrganization.invalido",
  sin_permiso: "errors.createOrganization.sinPermiso",
  desconocido: "errors.createOrganization.desconocido",
};

export function NuevaEntidadDialog({ onClose }: NuevaEntidadDialogProps) {
  const t = useTranslations();
  const create = useCreateOrganization();
  const sedeHintId = useId();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [orgType, setOrgType] = useState<OrgTypeEnum>("asociacion");
  const [cif, setCif] = useState("");
  const [parent, setParent] = useState("");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  // Sede obligatoria (spec §4.3, «Alta de entidad: sede obligatoria»):
  // `OrganizationCreateInput.place` no es opcional, así que el botón se
  // queda deshabilitado hasta que se elige un municipio, igual que con
  // el resto de campos obligatorios de este formulario.
  const canSubmit =
    name.trim().length > 0 && slug.trim().length > 0 && cif.trim().length > 0 && place !== null;

  function handleClose() {
    create.reset();
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || place === null) return;
    // El aviso de la última alta correcta se borra al empezar otra: si el
    // nuevo envío falla, quedarían en pantalla el error y un «creada» que
    // no corresponde a lo que se acaba de enviar.
    setCreated(null);
    create.mutate(
      {
        name: name.trim(),
        slug: slug.trim(),
        org_type: orgType,
        cif: cif.trim(),
        parent: parent ? Number(parent) : null,
        description: description.trim() || undefined,
        place,
      },
      {
        onSuccess: (org) => {
          setCreated(org.name);
          setName("");
          setSlug("");
          setCif("");
          setParent("");
          setDescription("");
          setPlace(null);
        },
      },
    );
  }

  return (
    <Dialog open titleId="nueva-entidad-title" title={t("plataforma.entidades.newEntity")} onClose={handleClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="nueva-entidad-name" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.entidades.nameHeader")}
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
            {t("plataforma.entidades.slugLabel")}
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
            {t("plataforma.entidades.typeHeader")}
          </label>
          <select
            id="nueva-entidad-tipo"
            value={orgType}
            onChange={(event) => setOrgType(event.target.value as OrgTypeEnum)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            {(Object.keys(ORG_TYPE_LABEL_KEYS) as OrgTypeEnum[]).map((value) => (
              <option key={value} value={value}>
                {t(ORG_TYPE_LABEL_KEYS[value])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <SedeSelector
            id="nueva-entidad-sede"
            value={place}
            onChange={setPlace}
            hintId={sedeHintId}
          />
          <p id={sedeHintId} className="mt-1 text-xs text-text-secondary">
            {t("plataforma.sede.requiredHint")}
          </p>
        </div>
        <div>
          <label htmlFor="nueva-entidad-cif" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.entidades.cifLabel")}
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
            {t("plataforma.entidades.parentIdLabel")}
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
            {t("plataforma.entidades.descriptionLabel")}
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
            {t("plataforma.entidades.createAction")}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t("common.close")}
          </Button>
        </div>

        {create.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(create.error, CREATE_ORGANIZATION_ERROR_KEYS, t, "errors.createOrganization.desconocido")}
          </p>
        ) : null}
        {created ? (
          <p className="text-sm text-success">{t("plataforma.entidades.created", { name: created })}</p>
        ) : null}
      </form>
    </Dialog>
  );
}
