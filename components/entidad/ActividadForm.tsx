"use client";

/**
 * Alta/edición de una actividad desde el panel (encargo del propietario:
 * «una asociación tiene que poder crear sus actividades desde el panel,
 * no solo desde el móvil»). Mismo patrón `editing: X | "new"` que
 * `ProgramaForm.tsx`, con dos diferencias por cómo es el contrato de
 * `events/`:
 *
 * - `editing` es un **id de actividad** (`string`), no el objeto
 *   completo: `EntityEventRow` (la fila del listado,
 *   `hooks/useEntityEvents.ts`) no trae `description`/`ends_at`/
 *   `latitude`/`longitude`, así que hace falta `useEvent(eventId)`
 *   (`GET /api/events/{id}/`) para tener con qué rellenar el
 *   formulario. `ActividadForm` (este componente) resuelve esa carga y
 *   delega el formulario real en `ActividadFormFields`, que solo se
 *   monta —con `key={editing}`, mismo remedio que el hallazgo A3 de
 *   `ResourceForm.tsx`— cuando el detalle ya está disponible.
 * - Al editar, `audience`/`community` se pintan de solo lectura: el
 *   backend los rechaza en un `PATCH` (`EventUpdateSerializer` los
 *   excluye a propósito, `lib/api/types.ts::EventUpdateFields`) porque
 *   cambiar el espacio a mitad de camino dejaría dentro a gente que ya
 *   no puede estar.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useEntityCommunities } from "@/hooks/useEntityCommunities";
import { useEvent, type EventErrorKind } from "@/hooks/useEvent";
import {
  useCreateEvent,
  useUpdateEvent,
  type EventMutationErrorKind,
} from "@/hooks/useEventMutations";
import { useSearchPlaces } from "@/hooks/usePlaces";
import type { EventAudience, EventDetail } from "@/lib/api/types";
import { isoToLocalInput, localInputToIso } from "@/lib/events/datetimeLocal";
import {
  validateEventCapacity,
  validateEventCommunity,
  validateEventEndsAt,
  validateEventStartsAt,
} from "@/lib/events/validation";
import { errorKindText } from "@/lib/i18n/errorKindText";

export interface ActividadFormProps {
  orgId: number | string;
  /** `"new"` para crear, o el id de la actividad a editar. */
  editing: "new" | string;
  onDone: () => void;
  onPendingChange?: (pending: boolean) => void;
}

const EVENT_ERROR_KEYS: Record<EventErrorKind, string> = {
  sin_acceso: "errors.event.sinAcceso",
  desconocido: "errors.event.desconocido",
};

/** Carga el detalle a editar (si hace falta) antes de montar el formulario real. */
export function ActividadForm({ orgId, editing, onDone, onPendingChange }: ActividadFormProps) {
  const t = useTranslations();
  const eventQuery = useEvent(editing !== "new" ? editing : "", editing !== "new");

  if (editing === "new") {
    return (
      <ActividadFormFields
        key="new"
        orgId={orgId}
        editing="new"
        onDone={onDone}
        onPendingChange={onPendingChange}
      />
    );
  }

  if (eventQuery.isError) {
    return (
      <ErrorState
        title={t("entidad.actividadForm.loadError")}
        description={errorKindText(eventQuery.error, EVENT_ERROR_KEYS, t, "errors.event.desconocido")}
      />
    );
  }
  if (!eventQuery.data) {
    return <p className="text-sm text-text-secondary">{t("entidad.actividadForm.loading")}</p>;
  }

  return (
    <ActividadFormFields
      key={editing}
      orgId={orgId}
      editing={eventQuery.data}
      onDone={onDone}
      onPendingChange={onPendingChange}
    />
  );
}

interface ActividadFormFieldsProps {
  orgId: number | string;
  editing: "new" | EventDetail;
  onDone: () => void;
  onPendingChange?: (pending: boolean) => void;
}

const CREATE_EVENT_ERROR_KEYS: Record<EventMutationErrorKind, string> = {
  invalido: "errors.eventMutation.invalido",
  sin_permiso: "errors.eventMutation.sinPermiso",
  no_encontrado: "errors.eventMutation.noEncontrado",
  desconocido: "errors.eventMutation.desconocidoCrear",
};

const UPDATE_EVENT_ERROR_KEYS: Record<EventMutationErrorKind, string> = {
  ...CREATE_EVENT_ERROR_KEYS,
  desconocido: "errors.eventMutation.desconocidoGuardar",
};

const AUDIENCE_KEYS: Record<EventAudience, string> = {
  anyone: "entidad.actividadForm.audienceAnyone",
  community: "entidad.actividadForm.audienceCommunity",
  organization: "entidad.actividadForm.audienceOrganization",
};

interface SelectedPlace {
  ine_code: string;
  name: string;
  prov_name: string;
  latitude: number | null;
  longitude: number | null;
}

function initialSelectedPlace(editing: "new" | EventDetail): SelectedPlace | null {
  if (editing === "new" || !editing.place) return null;
  return {
    ine_code: editing.place.ine_code,
    name: editing.place.name,
    prov_name: editing.place.prov_name,
    latitude: editing.latitude !== null ? Number(editing.latitude) : null,
    longitude: editing.longitude !== null ? Number(editing.longitude) : null,
  };
}

function ActividadFormFields({ orgId, editing, onDone, onPendingChange }: ActividadFormFieldsProps) {
  const t = useTranslations();
  const createEvent = useCreateEvent(orgId);
  const updateEvent = useUpdateEvent(orgId);
  const communities = useEntityCommunities(orgId);

  const isEditing = editing !== "new";
  const originalStartsAtIso = isEditing ? editing.starts_at : undefined;

  const [title, setTitle] = useState(isEditing ? editing.title : "");
  const [description, setDescription] = useState(isEditing ? editing.description : "");
  const [startsAtLocal, setStartsAtLocal] = useState(
    isEditing ? isoToLocalInput(editing.starts_at) : "",
  );
  const [endsAtLocal, setEndsAtLocal] = useState(
    isEditing && editing.ends_at ? isoToLocalInput(editing.ends_at) : "",
  );
  const [audience, setAudience] = useState<EventAudience>(isEditing ? editing.audience : "anyone");
  const [community, setCommunity] = useState(
    isEditing && editing.community ? editing.community.id : "",
  );
  const [capacity, setCapacity] = useState(
    isEditing && editing.capacity !== null ? String(editing.capacity) : "",
  );
  const [placeSearch, setPlaceSearch] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(
    initialSelectedPlace(editing),
  );

  const debouncedPlaceSearch = useDebouncedValue(placeSearch);
  const places = useSearchPlaces(debouncedPlaceSearch);

  const mutation = isEditing ? updateEvent : createEvent;
  const isPending = mutation.isPending;

  useEffect(() => {
    onPendingChange?.(isPending);
    return () => onPendingChange?.(false);
  }, [isPending, onPendingChange]);

  const startsAtIso = localInputToIso(startsAtLocal);
  const endsAtIso = localInputToIso(endsAtLocal);

  const startsAtError = validateEventStartsAt(startsAtIso, originalStartsAtIso);
  const endsAtError = validateEventEndsAt(startsAtIso, endsAtIso);
  const capacityError = validateEventCapacity(capacity);
  const communityError = isEditing ? null : validateEventCommunity(audience, community);

  const canSubmit =
    title.trim().length > 0 &&
    startsAtLocal.length > 0 &&
    !startsAtError &&
    !endsAtError &&
    !capacityError &&
    !communityError;

  function placeOptions(): SelectedPlace[] {
    const fromSearch: SelectedPlace[] = (places.data ?? []).map((place) => ({
      ine_code: place.ine_code,
      name: place.name,
      prov_name: place.prov_name,
      latitude: place.latitude,
      longitude: place.longitude,
    }));
    const hasSelected = selectedPlace && fromSearch.some((p) => p.ine_code === selectedPlace.ine_code);
    if (selectedPlace && !hasSelected) return [selectedPlace, ...fromSearch];
    return fromSearch;
  }

  function handlePlaceChange(ineCode: string) {
    if (!ineCode) {
      setSelectedPlace(null);
      return;
    }
    const found = (places.data ?? []).find((place) => place.ine_code === ineCode);
    if (found) {
      setSelectedPlace({
        ine_code: found.ine_code,
        name: found.name,
        prov_name: found.prov_name,
        latitude: found.latitude,
        longitude: found.longitude,
      });
    }
    // Si no está en la búsqueda actual, es la opción de reserva (el
    // municipio ya guardado): no hay nada que cambiar.
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    if (!isEditing) {
      createEvent.mutate(
        {
          title,
          description,
          starts_at: startsAtIso,
          ends_at: endsAtIso || null,
          audience,
          community: audience === "community" ? community || null : null,
          capacity: capacity.trim() ? Number(capacity) : null,
          latitude: selectedPlace?.latitude ?? null,
          longitude: selectedPlace?.longitude ?? null,
        },
        { onSuccess: onDone },
      );
      return;
    }

    const fields: Record<string, unknown> = {
      title,
      description,
      ends_at: endsAtIso || null,
      capacity: capacity.trim() ? Number(capacity) : null,
      latitude: selectedPlace?.latitude ?? null,
      longitude: selectedPlace?.longitude ?? null,
    };
    // Nunca reenviar `starts_at` si no cambió: el backend lo valida como
    // futuro también al editar (`lib/api/types.ts::EventUpdateFields`).
    if (startsAtIso !== originalStartsAtIso) {
      fields.starts_at = startsAtIso;
    }
    updateEvent.mutate({ eventId: editing.id, ...fields }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="actividad-title" className="mb-1 block text-sm font-medium text-text-form">
          {t("entidad.actividadForm.titleLabel")}
        </label>
        <input
          id="actividad-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        />
      </div>

      <div>
        <label htmlFor="actividad-description" className="mb-1 block text-sm font-medium text-text-form">
          {t("entidad.actividadForm.descriptionLabel")}
        </label>
        <textarea
          id="actividad-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="actividad-starts-at" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.actividadForm.startsAtLabel")}
          </label>
          <input
            id="actividad-starts-at"
            type="datetime-local"
            value={startsAtLocal}
            onChange={(event) => setStartsAtLocal(event.target.value)}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="actividad-ends-at" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.actividadForm.endsAtLabel")}
          </label>
          <input
            id="actividad-ends-at"
            type="datetime-local"
            value={endsAtLocal}
            onChange={(event) => setEndsAtLocal(event.target.value)}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="actividad-capacity" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.actividadForm.capacityLabel")}
          </label>
          <input
            id="actividad-capacity"
            type="number"
            min="1"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            className="w-28 rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
      </div>

      {startsAtError ? (
        <p role="alert" className="text-sm text-error">
          {t(startsAtError)}
        </p>
      ) : null}
      {endsAtError ? (
        <p role="alert" className="text-sm text-error">
          {t(endsAtError)}
        </p>
      ) : null}
      {capacityError ? (
        <p role="alert" className="text-sm text-error">
          {t(capacityError)}
        </p>
      ) : null}

      {isEditing ? (
        <div className="text-sm text-text-secondary">
          <p>
            {t("entidad.actividadForm.audienceLabel")}: {t(AUDIENCE_KEYS[editing.audience])}
          </p>
          {editing.community ? (
            <p>
              {t("entidad.actividadForm.communityLabel")}: {editing.community.name}
            </p>
          ) : null}
          <p className="text-xs">{t("entidad.actividadForm.audienceLockedHint")}</p>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="actividad-audience" className="mb-1 block text-sm font-medium text-text-form">
              {t("entidad.actividadForm.audienceLabel")}
            </label>
            <select
              id="actividad-audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value as EventAudience)}
              className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            >
              <option value="anyone">{t(AUDIENCE_KEYS.anyone)}</option>
              <option value="community">{t(AUDIENCE_KEYS.community)}</option>
              <option value="organization">{t(AUDIENCE_KEYS.organization)}</option>
            </select>
          </div>

          {audience === "community" ? (
            <div>
              <label htmlFor="actividad-community" className="mb-1 block text-sm font-medium text-text-form">
                {t("entidad.actividadForm.communityLabel")}
              </label>
              <select
                id="actividad-community"
                value={community}
                onChange={(event) => setCommunity(event.target.value)}
                aria-describedby={communities.isError ? "actividad-community-error" : undefined}
                className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
              >
                <option value="">{t("entidad.actividadForm.communityNone")}</option>
                {(communities.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {communities.isError ? (
                <p id="actividad-community-error" role="alert" className="mt-1 text-xs text-error">
                  {t("entidad.actividadForm.communitiesError")}
                </p>
              ) : null}
              {communityError ? (
                <p role="alert" className="mt-1 text-xs text-error">
                  {t(communityError)}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <div>
        <label htmlFor="actividad-place" className="mb-1 block text-sm font-medium text-text-form">
          {t("entidad.actividadForm.placeLabel")}
        </label>
        <input
          type="search"
          value={placeSearch}
          onChange={(event) => setPlaceSearch(event.target.value)}
          aria-label={t("entidad.actividadForm.placeSearchLabel")}
          className="mb-2 w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        />
        <select
          id="actividad-place"
          value={selectedPlace?.ine_code ?? ""}
          onChange={(event) => handlePlaceChange(event.target.value)}
          aria-describedby={places.isError ? "actividad-place-error" : undefined}
          className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        >
          <option value="">{t("entidad.actividadForm.placeNone")}</option>
          {placeOptions().map((place) => (
            <option key={place.ine_code} value={place.ine_code}>
              {t("entidad.actividadForm.placeOption", { name: place.name, province: place.prov_name })}
            </option>
          ))}
        </select>
        {places.isError ? (
          <p id="actividad-place-error" role="alert" className="mt-1 text-xs text-error">
            {t("entidad.actividadForm.placeSearchError")}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit || isPending}>
          {t("common.save")}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={isPending}>
          {t("common.cancel")}
        </Button>
      </div>
      {mutation.isError ? (
        <p role="alert" className="text-sm text-error">
          {isEditing
            ? errorKindText(
                updateEvent.error,
                UPDATE_EVENT_ERROR_KEYS,
                t,
                "errors.eventMutation.desconocidoGuardar",
              )
            : errorKindText(
                createEvent.error,
                CREATE_EVENT_ERROR_KEYS,
                t,
                "errors.eventMutation.desconocidoCrear",
              )}
        </p>
      ) : null}
    </form>
  );
}
