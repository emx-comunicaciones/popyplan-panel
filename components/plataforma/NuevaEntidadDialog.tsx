"use client";

/**
 * «Nueva entidad» (tarea W5, `docs/SEGURIDAD_Y_MODERACION.md` §8):
 * `POST /api/organizations/ {name, slug, org_type, cif, parent?,
 * description?}`, `verifier`/`superadmin`. Nace ya verificada (la
 * plataforma es quien da de alta, error 2 de la QA de Jhoan); el botón
 * «Verificar» de la ficha queda para las que sigan sin verificar.
 */
import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { OrganizationPicker } from "@/components/plataforma/OrganizationPicker";
import { Button } from "@/components/ui/Button";
import type { PickerOption } from "@/components/ui/SearchPicker";
import { Dialog } from "@/components/ui/Dialog";
import { useCreateOrganization, type OrganizationsErrorKind } from "@/hooks/useOrganizations";
import type { OrgTypeEnum } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { SLUG_MAX_LENGTH, isValidSlug, slugify } from "@/lib/organizations/slug";

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
  // El slug se saca del nombre mientras nadie lo toque a mano (informe del
  // propietario, 2026-09-30: el botón quedaba gris sin decir que faltaba).
  const [slugEdited, setSlugEdited] = useState(false);
  const [orgType, setOrgType] = useState<OrgTypeEnum>("asociacion");
  const [cif, setCif] = useState("");
  const [parent, setParent] = useState<PickerOption | null>(null);
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; verified: boolean } | null>(null);

  // Sede obligatoria (spec §4.3, «Alta de entidad: sede obligatoria»):
  // `OrganizationCreateInput.place` no es opcional, así que el botón se
  // queda deshabilitado hasta que se elige un municipio, igual que con
  // el resto de campos obligatorios de este formulario.
  const slugValue = slugEdited ? slug : slugify(name);
  const slugOk = isValidSlug(slugValue);
  const missing = [
    name.trim().length === 0 ? t("plataforma.entidades.missing.name") : null,
    !slugOk ? t("plataforma.entidades.missing.slug") : null,
    place === null ? t("plataforma.entidades.missing.place") : null,
    cif.trim().length === 0 ? t("plataforma.entidades.missing.cif") : null,
  ].filter((item): item is string => item !== null);
  const canSubmit = missing.length === 0 && place !== null;

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
        slug: slugValue,
        org_type: orgType,
        cif: cif.trim(),
        parent: parent ? parent.id : null,
        description: description.trim() || undefined,
        place,
      },
      {
        onSuccess: (org) => {
          // El aviso dice lo que ha devuelto el backend: hoy el alta de
          // plataforma nace verificada, pero no se da por hecho.
          setCreated({ name: org.name, verified: org.is_verified });
          setName("");
          setSlug("");
          setSlugEdited(false);
          setCif("");
          setParent(null);
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
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="nueva-entidad-slug" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.entidades.slugLabel")}
          </label>
          <input
            id="nueva-entidad-slug"
            type="text"
            value={slugValue}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value);
            }}
            aria-describedby="nueva-entidad-slug-hint"
            aria-invalid={slugValue.length > 0 && !slugOk}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
          <p id="nueva-entidad-slug-hint" className="mt-1 text-xs text-text-secondary">
            {slugValue.length > SLUG_MAX_LENGTH
              ? t("plataforma.entidades.slugTooLong", { max: SLUG_MAX_LENGTH })
              : slugValue.length > 0 && !slugOk
                ? t("plataforma.entidades.slugInvalid")
                : t("plataforma.entidades.slugHint")}
          </p>
        </div>
        <div>
          <label htmlFor="nueva-entidad-tipo" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.entidades.typeHeader")}
          </label>
          <select
            id="nueva-entidad-tipo"
            value={orgType}
            onChange={(event) => setOrgType(event.target.value as OrgTypeEnum)}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
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
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <OrganizationPicker
          id="nueva-entidad-parent"
          label={t("plataforma.entidades.parentIdLabel")}
          value={parent}
          onChange={setParent}
        />
        <div>
          <label htmlFor="nueva-entidad-description" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.entidades.descriptionLabel")}
          </label>
          <textarea
            id="nueva-entidad-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>

        {missing.length > 0 ? (
          <p className="text-xs text-text-secondary">
            {t("plataforma.entidades.missing.intro", { fields: missing.join(", ") })}
          </p>
        ) : null}
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
          <p className="text-sm text-success">{t(created.verified ? "plataforma.entidades.created" : "plataforma.entidades.created_unverified", {
              name: created.name,
            })}</p>
        ) : null}
      </form>
    </Dialog>
  );
}
