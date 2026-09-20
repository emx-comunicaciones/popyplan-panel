"use client";

/**
 * Diálogo «Editar comunidad» (encargo del propietario: «no puedo editar
 * la comunidad que he creado»). Solo `canManage` (titular/moderador,
 * calculado en `ComunidadesPanel.tsx` igual que para «Nueva comunidad»)
 * ve el botón «Editar» junto a la comunidad seleccionada.
 *
 * `EntityCommunityRow` (la fila del listado, `useEntityCommunities`) ya
 * trae `name`/`description`/`visibility`, pero no `code_of_conduct`
 * (`CommunityList` no lo expone) — este diálogo pide siempre la ficha
 * completa (`hooks/useCommunity.ts`, `GET /api/communities/{id}/`) y
 * solo monta el formulario cuando llega, así el formulario nace ya con
 * los cuatro campos reales (nunca una mezcla de la fila del listado más
 * un `code_of_conduct` que se rellena solo después, que habría abierto
 * una carrera si la persona empieza a escribir antes de que la ficha
 * llegue). `ComunidadesPanel.tsx` solo monta este diálogo mientras hay
 * una comunidad en edición (`key` por `community.id`), así que no hace
 * falta un `reset()` explícito al cerrar: cerrar desmonta el componente
 * entero y el próximo «Editar» arranca de cero.
 *
 * **`space` no se puede editar**: el backend lo rechaza tras crear la
 * comunidad (`validate_space`), así que el formulario ni lo pinta ni lo
 * manda — `hooks/useUpdateCommunity.ts` solo lo recibe para decidir qué
 * invalidar, nunca lo incluye en el cuerpo del `PATCH`.
 *
 * `PATCH /api/communities/{id}/ {allow_cross_space}` (cruce de espacios)
 * es un control aparte (`FamiliasPanel.tsx`, `useToggleCrossSpace.ts`):
 * este diálogo nunca toca `allow_cross_space`.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCommunity } from "@/hooks/useCommunity";
import { useUpdateCommunity, type UpdateCommunityErrorKind } from "@/hooks/useUpdateCommunity";
import type { CommunityDetail, EntityCommunityRow } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

export interface EditarComunidadDialogProps {
  orgId: number | string;
  community: EntityCommunityRow;
  onClose: () => void;
  /** Se llama con la comunidad actualizada, además de cerrar el diálogo. */
  onUpdated?: (community: EntityCommunityRow) => void;
}

const UPDATE_COMMUNITY_ERROR_KEYS: Record<UpdateCommunityErrorKind, string> = {
  invalido: "errors.updateCommunity.invalido",
  sin_permiso: "errors.updateCommunity.sinPermiso",
  desconocido: "errors.updateCommunity.desconocido",
};

function EditarComunidadForm({
  orgId,
  communityId,
  space,
  detail,
  onClose,
  onUpdated,
  onPendingChange,
}: {
  orgId: number | string;
  communityId: string;
  space: EntityCommunityRow["space"];
  detail: CommunityDetail;
  onClose: () => void;
  onUpdated?: (community: EntityCommunityRow) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const t = useTranslations();
  const updateCommunity = useUpdateCommunity();
  // Valores de partida capturados una sola vez, al montar (este
  // componente solo existe una vez `detail` ha llegado — ver el
  // docstring del fichero): sirven para saber si algo ha cambiado, sin
  // volver a pedir la ficha.
  const [initial] = useState({
    name: detail.name,
    description: detail.description ?? "",
    visibility: detail.visibility ?? "open",
    codeOfConduct: detail.code_of_conduct ?? "",
  });
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [visibility, setVisibility] = useState<"open" | "on_request" | "private">(initial.visibility);
  const [codeOfConduct, setCodeOfConduct] = useState(initial.codeOfConduct);

  useEffect(() => {
    onPendingChange(updateCommunity.isPending);
    // Al desmontar (el diálogo se cierra tras guardar o al cancelar) el
    // padre no puede quedarse con `pending` a `true` para siempre.
    return () => onPendingChange(false);
  }, [updateCommunity.isPending, onPendingChange]);

  const hasChanges =
    name !== initial.name ||
    description !== initial.description ||
    visibility !== initial.visibility ||
    codeOfConduct !== initial.codeOfConduct;
  const canSubmit = name.trim().length > 0 && hasChanges;

  function handleClose() {
    if (updateCommunity.isPending) return;
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    updateCommunity.mutate(
      {
        orgId,
        communityId,
        space,
        name: name.trim(),
        // A diferencia de «Nueva comunidad», aquí una descripción o un
        // código de conducta vacíos se mandan tal cual (no `undefined`):
        // es una edición, y la persona puede querer borrar un texto que
        // ya existía — omitir el campo dejaría el valor antiguo intacto
        // en el backend (mismo fallo de clase que `ResourceForm`, A3).
        description: description.trim(),
        visibility,
        codeOfConduct: codeOfConduct.trim(),
      },
      {
        onSuccess: (community) => {
          onUpdated?.(community);
          handleClose();
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="editar-comunidad-nombre" className="mb-1 block text-sm font-medium text-text-form">
          {t("entidad.familias.nameLabel")}
        </label>
        <input
          id="editar-comunidad-nombre"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        />
      </div>
      <div>
        <label
          htmlFor="editar-comunidad-descripcion"
          className="mb-1 block text-sm font-medium text-text-form"
        >
          {t("entidad.familias.descriptionLabel")}
        </label>
        <textarea
          id="editar-comunidad-descripcion"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        />
      </div>
      <div>
        <label
          htmlFor="editar-comunidad-visibilidad"
          className="mb-1 block text-sm font-medium text-text-form"
        >
          {t("entidad.familias.visibilityLabel")}
        </label>
        <select
          id="editar-comunidad-visibilidad"
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
        <label htmlFor="editar-comunidad-codigo" className="mb-1 block text-sm font-medium text-text-form">
          {t("entidad.familias.codeOfConductLabel")}
        </label>
        <textarea
          id="editar-comunidad-codigo"
          value={codeOfConduct}
          onChange={(event) => setCodeOfConduct(event.target.value)}
          rows={3}
          className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit || updateCommunity.isPending}>
          {t("entidad.comunidades.editSave")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleClose}
          disabled={updateCommunity.isPending}
        >
          {t("common.cancel")}
        </Button>
      </div>
      {updateCommunity.isError ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(
            updateCommunity.error,
            UPDATE_COMMUNITY_ERROR_KEYS,
            t,
            "errors.updateCommunity.desconocido",
          )}
        </p>
      ) : null}
    </form>
  );
}

export function EditarComunidadDialog({ orgId, community, onClose, onUpdated }: EditarComunidadDialogProps) {
  const t = useTranslations();
  const detail = useCommunity(community.id);
  const [pending, setPending] = useState(false);

  function handleClose() {
    if (pending) return;
    onClose();
  }

  return (
    <Dialog
      open
      titleId="editar-comunidad-title"
      title={t("entidad.comunidades.editTitle")}
      pending={pending}
      onClose={handleClose}
    >
      {detail.isError ? (
        <ErrorState
          title={t("entidad.comunidades.editLoadError")}
          description={t("entidad.comunidades.editLoadErrorDescription")}
        />
      ) : !detail.data ? (
        <p className="text-sm text-text-secondary">{t("entidad.comunidades.editLoading")}</p>
      ) : (
        <EditarComunidadForm
          orgId={orgId}
          communityId={community.id}
          space={community.space}
          detail={detail.data}
          onClose={handleClose}
          onUpdated={onUpdated}
          onPendingChange={setPending}
        />
      )}
    </Dialog>
  );
}
