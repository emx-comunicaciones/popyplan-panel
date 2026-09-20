"use client";

/**
 * Diálogo «Nueva comunidad», extraído de `FamiliasPanel.tsx` (donde
 * nació como `NuevaComunidadDialog` local, solo para `space: 'families'`)
 * para que `ComunidadesPanel.tsx` lo reutilice con `space: 'members'` —
 * mismo endpoint (`hooks/useCreateCommunity.ts`), mismo formulario,
 * mismo patrón de error dentro del propio diálogo. Lo único que cambia
 * según `space` es el título del diálogo y, solo para `members`, una
 * frase de ayuda debajo del título (`entidad.comunidades.newCommunityHint`)
 * — una comunidad de familias no la lleva, porque su banner de
 * separación de espacios ya explica qué es ese espacio en la propia
 * página de Familias.
 *
 * **Las etiquetas de los campos y las tres opciones de visibilidad
 * siguen leyéndose de `entidad.familias.*`** (`nameLabel`,
 * `descriptionLabel`, `visibilityLabel`, `visibilityOpen/OnRequest/
 * Private`, `codeOfConductLabel`, `createCommunity`) a propósito: son
 * genéricas de cualquier comunidad (nunca mencionan familias en su
 * texto) y ya existían con esos nombres antes de esta extracción: mover
 * esas nueve claves a un namespace neutro solo para renombrarlas habría
 * tocado los cuatro catálogos sin cambiar ni una palabra visible.
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useCreateCommunity, type CreateCommunityErrorKind } from "@/hooks/useCreateCommunity";
import type { CreateCommunityRequest, EntityCommunityRow } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

export interface NuevaComunidadDialogProps {
  orgId: number | string;
  space: CreateCommunityRequest["space"];
  open: boolean;
  onClose: () => void;
  /** Se llama con la comunidad creada, además de cerrar el diálogo. */
  onCreated?: (community: EntityCommunityRow) => void;
}

const CREATE_COMMUNITY_ERROR_KEYS: Record<CreateCommunityErrorKind, string> = {
  invalido: "errors.createCommunity.invalido",
  sin_permiso: "errors.createCommunity.sinPermiso",
  desconocido: "errors.createCommunity.desconocido",
};

export function NuevaComunidadDialog({ orgId, space, open, onClose, onCreated }: NuevaComunidadDialogProps) {
  const t = useTranslations();
  const createCommunity = useCreateCommunity();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"open" | "on_request" | "private">("open");
  const [codeOfConduct, setCodeOfConduct] = useState("");

  const canSubmit = name.trim().length > 0;
  const titleKey =
    space === "families" ? "entidad.familias.newCommunityTitle" : "entidad.comunidades.newCommunityTitle";

  function resetForm() {
    setName("");
    setDescription("");
    setVisibility("open");
    setCodeOfConduct("");
    createCommunity.reset();
  }

  function handleClose() {
    if (createCommunity.isPending) return;
    resetForm();
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    createCommunity.mutate(
      {
        orgId,
        space,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        codeOfConduct: codeOfConduct.trim() || undefined,
      },
      {
        onSuccess: (community) => {
          onCreated?.(community);
          handleClose();
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      titleId="nueva-comunidad-title"
      title={t(titleKey)}
      pending={createCommunity.isPending}
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {space === "members" ? (
          <p className="text-sm text-text-secondary">{t("entidad.comunidades.newCommunityHint")}</p>
        ) : null}
        <div>
          <label htmlFor="nueva-comunidad-nombre" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.familias.nameLabel")}
          </label>
          <input
            id="nueva-comunidad-nombre"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label
            htmlFor="nueva-comunidad-descripcion"
            className="mb-1 block text-sm font-medium text-text-form"
          >
            {t("entidad.familias.descriptionLabel")}
          </label>
          <textarea
            id="nueva-comunidad-descripcion"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label
            htmlFor="nueva-comunidad-visibilidad"
            className="mb-1 block text-sm font-medium text-text-form"
          >
            {t("entidad.familias.visibilityLabel")}
          </label>
          <select
            id="nueva-comunidad-visibilidad"
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value as "open" | "on_request" | "private")
            }
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          >
            <option value="open">{t("entidad.familias.visibilityOpen")}</option>
            <option value="on_request">{t("entidad.familias.visibilityOnRequest")}</option>
            <option value="private">{t("entidad.familias.visibilityPrivate")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="nueva-comunidad-codigo" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.familias.codeOfConductLabel")}
          </label>
          <textarea
            id="nueva-comunidad-codigo"
            value={codeOfConduct}
            onChange={(event) => setCodeOfConduct(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit || createCommunity.isPending}>
            {t("entidad.familias.createCommunity")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={createCommunity.isPending}
          >
            {t("common.cancel")}
          </Button>
        </div>
        {createCommunity.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(
              createCommunity.error,
              CREATE_COMMUNITY_ERROR_KEYS,
              t,
              "errors.createCommunity.desconocido",
            )}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
