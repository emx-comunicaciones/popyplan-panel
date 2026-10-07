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
 * - Categoría (del catálogo o «Otra», escrita a mano), coste, edades y, en
 *   un viaje, fechas por días y paradas: lo mismo que ofrece la app
 *   (petición del propietario, 2026-10-07). Reglas y envío en
 *   `lib/events/activityExtras.ts`; las paradas, en `ActividadParadas.tsx`.
 *   Al editar viajan siempre (vacías para quitarlas), y las paradas solo si
 *   es un viaje.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { ActividadParadas } from "@/components/entidad/ActividadParadas";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCatalog } from "@/hooks/useCatalogs";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useEntityCommunities } from "@/hooks/useEntityCommunities";
import { useEvent, type EventErrorKind } from "@/hooks/useEvent";
import {
  useCreateEvent,
  useUpdateEvent,
  type EventMutationErrorKind,
} from "@/hooks/useEventMutations";
import { useSearchPlaces } from "@/hooks/usePlaces";
import type { EventAudience, EventDetail, EventLevel } from "@/lib/api/types";
import {
  OTHER_CATEGORY,
  TRAVEL_CATEGORY_TYPE,
  ageToApi,
  categoryToApi,
  costFromApi,
  costToApi,
  isoToDateInput,
  normalizeCustomCategory,
  stopsFromApi,
  stopsToApi,
  tripEndIso,
  tripStartIso,
  validateCustomCategory,
  validateEventAges,
  validateEventCost,
  validateStops,
  validateTripEnd,
  type StopDraft,
} from "@/lib/events/activityExtras";
import { isoToLocalInput, localInputToIso } from "@/lib/events/datetimeLocal";
import { EVENT_LEVELS, levelLabelKey, toEventLevel } from "@/lib/events/level";
import {
  sameMinute,
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
  /**
   * Se llama al cerrar el formulario. Al guardar con éxito recibe el
   * `starts_at` de la actividad, para que quien lo monta pueda asegurarse
   * de que la fila queda a la vista: una actividad nueva es siempre
   * futura y el periodo de la tabla llega hasta hoy, así que sin esto se
   * creaba y desaparecía (auditoría del panel, 2026-09-24).
   */
  onDone: (startsAt?: string) => void;
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
  onDone: (startsAt?: string) => void;
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

function initialCategory(editing: "new" | EventDetail): string {
  if (editing === "new") return "";
  if (editing.category) return String(editing.category.id);
  return editing.custom_category ? OTHER_CATEGORY : "";
}

function ActividadFormFields({ orgId, editing, onDone, onPendingChange }: ActividadFormFieldsProps) {
  const t = useTranslations();
  const createEvent = useCreateEvent(orgId);
  const updateEvent = useUpdateEvent(orgId);
  const communities = useEntityCommunities(orgId);
  const categories = useCatalog("eventCategories");

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
  const originalLevel = isEditing ? toEventLevel(editing.level) : "";
  const [level, setLevel] = useState<EventLevel>(originalLevel);
  const originalCategory = initialCategory(editing);
  const [category, setCategory] = useState(originalCategory);
  const [customCategory, setCustomCategory] = useState(isEditing ? editing.custom_category : "");
  const originalCost = costFromApi(isEditing ? editing.estimated_cost : null);
  const [hasCost, setHasCost] = useState(originalCost.hasCost);
  const [cost, setCost] = useState(originalCost.text);
  const [minAge, setMinAge] = useState(
    isEditing && editing.min_age !== null ? String(editing.min_age) : "",
  );
  const [maxAge, setMaxAge] = useState(
    isEditing && editing.max_age !== null ? String(editing.max_age) : "",
  );
  const wasTrip = isEditing && editing.is_trip;
  const originalStartDay = wasTrip ? isoToDateInput(editing.starts_at) : "";
  const originalEndDay = wasTrip ? isoToDateInput(editing.ends_at) : "";
  const [startDay, setStartDay] = useState(originalStartDay);
  const [endDay, setEndDay] = useState(originalEndDay);
  const [stops, setStops] = useState<StopDraft[]>(isEditing ? stopsFromApi(editing.stops) : []);
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

  // Categorías activas, más la que ya tuviera la actividad aunque se desactivara.
  const categoryOptions = (categories.data ?? []).filter(
    (item) => item.isActive || item.id === originalCategory,
  );
  const selectedCategory = categoryOptions.find((item) => item.id === category);
  // Es viaje si la categoría es de viaje; mientras el catálogo carga, lo que
  // dijo el detalle (si no se ha tocado la categoría).
  const isTrip = selectedCategory
    ? selectedCategory.categoryType === TRAVEL_CATEGORY_TYPE
    : category === originalCategory && wasTrip;

  // Un viaje va por días (00:00 del primero, 23:59:59 del último). Si el
  // día no se tocó se conserva el instante guardado, para no moverlo por la
  // zona horaria de quien edita.
  const startsAtIso = isTrip
    ? wasTrip && startDay === originalStartDay && originalStartsAtIso
      ? originalStartsAtIso
      : tripStartIso(startDay)
    : localInputToIso(startsAtLocal);
  const endsAtIso = isTrip
    ? wasTrip && endDay === originalEndDay && isEditing && editing.ends_at
      ? editing.ends_at
      : tripEndIso(endDay)
    : localInputToIso(endsAtLocal);

  const startsAtError = validateEventStartsAt(startsAtIso, originalStartsAtIso);
  const endsAtError = validateEventEndsAt(startsAtIso, endsAtIso);
  const capacityError = validateEventCapacity(capacity);
  const communityError = isEditing ? null : validateEventCommunity(audience, community);

  const customCategoryError = validateCustomCategory(category, customCategory);
  const costError = validateEventCost(hasCost, cost);
  const agesError = validateEventAges(minAge, maxAge);
  const tripEndError = validateTripEnd(isTrip, endDay);
  const stopsError = isTrip ? validateStops(stops) : null;

  const canSubmit =
    title.trim().length > 0 &&
    (isTrip ? startDay.length > 0 : startsAtLocal.length > 0) &&
    !startsAtError &&
    !endsAtError &&
    !capacityError &&
    !communityError &&
    !customCategoryError &&
    !costError &&
    !agesError &&
    !tripEndError &&
    !stopsError;

  function handleCategoryChange(value: string) {
    setCategory(value);
    const item = categoryOptions.find((option) => option.id === value);
    const nextIsTrip = item?.categoryType === TRAVEL_CATEGORY_TYPE;
    if (nextIsTrip === isTrip) return;
    // Las fechas pasan de un modo al otro cada vez, para no enseñar unas
    // vacías o las de la vez anterior: a viaje, el día de lo escrito; a
    // actividad normal, ese día con la hora que hubiera (o las 10:00).
    if (nextIsTrip) {
      if (startsAtLocal) setStartDay(startsAtLocal.slice(0, 10));
      if (endsAtLocal) setEndDay(endsAtLocal.slice(0, 10));
    } else {
      if (startDay) setStartsAtLocal(`${startDay}T${startsAtLocal.slice(11) || "10:00"}`);
      if (endDay) setEndsAtLocal(`${endDay}T${endsAtLocal.slice(11) || startsAtLocal.slice(11) || "10:00"}`);
    }
  }

  /** Lo que viaja igual al crear y al editar (al crear, `toCreateEventBody` quita lo vacío). */
  function extraFields() {
    return {
      category: categoryToApi(category),
      custom_category: category ? normalizeCustomCategory(customCategory) : "",
      estimated_cost: costToApi(hasCost, cost),
      min_age: ageToApi(minAge),
      max_age: ageToApi(maxAge),
    };
  }

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
          level,
          ...extraFields(),
          ...(isTrip ? { stops: stopsToApi(stops) } : {}),
        },
        { onSuccess: () => onDone(startsAtIso) },
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
      ...extraFields(),
    };
    // Las paradas solo en un viaje: la lista sustituye a la guardada.
    if (isTrip) fields.stops = stopsToApi(stops);
    // Nunca reenviar `starts_at` si no cambió: el backend lo valida como
    // futuro también al editar (`lib/api/types.ts::EventUpdateFields`).
    // La comparación va **por minuto**: el input no rehidrata los
    // segundos que sí guarda el backend, así que comparando cadenas
    // «siempre había cambiado» y se reenviaba una fecha pasada que el
    // backend rechaza con 400 (auditoría del panel, 2026-09-24).
    if (!originalStartsAtIso || !sameMinute(startsAtIso, originalStartsAtIso)) {
      fields.starts_at = startsAtIso;
    }
    // El nivel solo viaja si cambió (`""` para volver a «todos los niveles»).
    if (level !== originalLevel) fields.level = level;
    updateEvent.mutate(
      { eventId: editing.id, ...fields },
      { onSuccess: () => onDone(startsAtIso) },
    );
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

      <div>
        <label htmlFor="actividad-category" className="mb-1 block text-sm font-medium text-text-form">
          {t("entidad.actividadForm.categoryLabel")}
        </label>
        <select
          id="actividad-category"
          value={category}
          onChange={(event) => handleCategoryChange(event.target.value)}
          aria-describedby={categories.isError ? "actividad-category-error" : undefined}
          // Mientras llega el catálogo solo estarían «Sin categoría» y «Otra»:
          // no se deja elegir hasta tener la lista entera.
          disabled={categories.isPending}
          aria-busy={categories.isPending || undefined}
          className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        >
          <option value="">
            {categories.isPending
              ? t("entidad.actividadForm.categoriesLoading")
              : t("entidad.actividadForm.categoryNone")}
          </option>
          {categoryOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
          <option value={OTHER_CATEGORY}>{t("entidad.actividadForm.categoryOther")}</option>
        </select>
        {categories.isError ? (
          <p id="actividad-category-error" role="alert" className="mt-1 text-xs text-error">
            {t("entidad.actividadForm.categoriesError")}
          </p>
        ) : null}
      </div>

      {category ? (
        <div>
          <label htmlFor="actividad-custom-category" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.actividadForm.customCategoryLabel")}
          </label>
          <input
            id="actividad-custom-category"
            type="text"
            value={customCategory}
            onChange={(event) => setCustomCategory(event.target.value)}
            placeholder={t("entidad.actividadForm.customCategoryPlaceholder")}
            aria-describedby="actividad-custom-category-help"
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
          <p id="actividad-custom-category-help" className="mt-1 text-xs text-text-secondary">
            {category === OTHER_CATEGORY
              ? t("entidad.actividadForm.customCategoryHelpOther")
              : t("entidad.actividadForm.customCategoryHelpExtra")}
          </p>
          {customCategoryError ? (
            <p role="alert" className="mt-1 text-xs text-error">
              {t(customCategoryError)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {isTrip ? (
          <>
            <div>
              <label htmlFor="actividad-trip-start" className="mb-1 block text-sm font-medium text-text-form">
                {t("entidad.actividadForm.tripStartLabel")}
              </label>
              <input
                id="actividad-trip-start"
                type="date"
                value={startDay}
                onChange={(event) => setStartDay(event.target.value)}
                className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
              />
            </div>
            <div>
              <label htmlFor="actividad-trip-end" className="mb-1 block text-sm font-medium text-text-form">
                {t("entidad.actividadForm.tripEndLabel")}
              </label>
              <input
                id="actividad-trip-end"
                type="date"
                value={endDay}
                onChange={(event) => setEndDay(event.target.value)}
                className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
              />
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
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

      <div>
        <label htmlFor="actividad-level" className="mb-1 block text-sm font-medium text-text-form">
          {t("entidad.actividadForm.levelLabel")}
        </label>
        <select
          id="actividad-level"
          value={level}
          onChange={(event) => setLevel(event.target.value as EventLevel)}
          className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        >
          {EVENT_LEVELS.map((value) => (
            <option key={value || "all"} value={value}>
              {t(levelLabelKey(value) as string)}
            </option>
          ))}
        </select>
      </div>

      {isTrip ? (
        <p className="text-xs text-text-secondary">{t("entidad.actividadForm.tripDatesHelp")}</p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 pb-1.5">
          <input
            id="actividad-has-cost"
            type="checkbox"
            checked={hasCost}
            onChange={(event) => setHasCost(event.target.checked)}
          />
          <label htmlFor="actividad-has-cost" className="text-sm text-text-form">
            {t("entidad.actividadForm.hasCostLabel")}
          </label>
        </div>
        {hasCost ? (
          <div>
            <label htmlFor="actividad-cost" className="mb-1 block text-sm font-medium text-text-form">
              {t("entidad.actividadForm.costLabel")}
            </label>
            <input
              id="actividad-cost"
              type="text"
              inputMode="decimal"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              className="w-32 rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            />
          </div>
        ) : null}
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-text-form">{t("entidad.actividadForm.ageTitle")}</legend>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="actividad-min-age" className="mb-1 block text-xs text-text-form">
              {t("entidad.actividadForm.ageMinLabel")}
            </label>
            <input
              id="actividad-min-age"
              type="number"
              min="18"
              max="120"
              value={minAge}
              onChange={(event) => setMinAge(event.target.value)}
              className="w-24 rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            />
          </div>
          <div>
            <label htmlFor="actividad-max-age" className="mb-1 block text-xs text-text-form">
              {t("entidad.actividadForm.ageMaxLabel")}
            </label>
            <input
              id="actividad-max-age"
              type="number"
              min="18"
              max="120"
              value={maxAge}
              onChange={(event) => setMaxAge(event.target.value)}
              className="w-24 rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-text-secondary">{t("entidad.actividadForm.ageHelp")}</p>
      </fieldset>

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
      {[tripEndError, costError, agesError].map((error) =>
        error ? (
          <p key={error} role="alert" className="text-sm text-error">
            {t(error)}
          </p>
        ) : null,
      )}

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

      {isTrip ? (
        <div>
          <ActividadParadas stops={stops} onChange={setStops} />
          {stopsError ? (
            <p role="alert" className="mt-1 text-xs text-error">
              {t(stopsError)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit || isPending}>
          {t("common.save")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onDone()} disabled={isPending}>
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
