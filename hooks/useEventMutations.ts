"use client";

/**
 * Alta, edición y cancelación de actividades desde el panel (encargo del
 * propietario: «una asociación tiene que poder crear sus actividades
 * desde el panel, no solo desde el móvil»). Reutiliza la API general de
 * `/api/events/` (`events/viewsets.py::EventViewSet`) — no hay una ruta
 * de `panel/` para escribir, solo para leer (`PANEL.EVENTS`,
 * `hooks/useEntityEvents.ts`).
 *
 * **Toda actividad creada desde el panel nace sellada por la entidad**
 * (`owner_org: orgId`, invariante 2): el formulario nunca decide el
 * sello, lo añade `toCreateEventBody` a partir del `orgId` con el que se
 * instancia `useCreateEvent`. `community` solo viaja si `audience ===
 * 'community'` (mandarlo con otra audiencia validaría de más,
 * `events/services.py::create_event`); con `audience === 'organization'`
 * basta el sello ya presente (`owner_org`), así que no hace falta ningún
 * campo adicional del formulario para esa validación
 * (`create_event`: «Una actividad solo para la entidad necesita el sello
 * de la entidad.», imposible aquí porque `owner_org` siempre está).
 *
 * **Edición**: `EventUpdateSerializer` (backend) excluye `audience`,
 * `community`, `owner_org` y `recurrence_rule` — cambiar el espacio de
 * una actividad a mitad de camino dejaría dentro a gente que ya no puede
 * estar (se cancela y se crea otra). `EventUpdateFields` (`lib/api/
 * types.ts`) ya los excluye por tipo. Es `ActividadForm.tsx` quien decide
 * qué claves incluir en el `PATCH` (p. ej. omitir `starts_at` si no
 * cambió, para no toparse con la validación «tiene que ser futuro» al
 * guardar una actividad ya empezada) — este hook solo traduce lo que
 * recibe, sin inventar ninguna lógica de «solo lo que cambió».
 *
 * **Errores**: a diferencia de Programas, aquí no hay un 409 de
 * transición de estado (cancelar/editar una actividad ya cancelada o
 * celebrada no está bloqueado por el backend, `events/services.py` no lo
 * valida) — los tres `kind` reales son 400 (validación), 403 (no eres
 * organizador ni tienes `publicar_actividades` en la entidad que sella
 * la actividad, `events/permissions.py::IsOrganizerOrReadOnly`) y 404 (la
 * actividad no existe, o el bloqueo la esconde). El mensaje del backend
 * viaja literal cuando lo trae (`detailOf`), mismo patrón que
 * `useProgramMutations.ts`.
 */
import { useMutation, useQueryClient, type QueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { EVENTS } from "@/lib/api/endpoints";
import type { EventDetail, EventUpdateFields, EventWriteFields } from "@/lib/api/types";
import { formatCoordinateForApi } from "@/lib/events/coords";

export type EventMutationErrorKind = "invalido" | "sin_permiso" | "no_encontrado" | "desconocido";

export class EventMutationError extends Error {
  readonly kind: EventMutationErrorKind;
  readonly detail?: string;

  constructor(kind: EventMutationErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "EventMutationError";
    this.kind = kind;
    this.detail = detail;
  }
}

function toEventMutationError(error: unknown, fallback: string): EventMutationError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      const detail = detailOf(error);
      return new EventMutationError("invalido", detail ?? "Revisa los datos: alguno no es válido.", detail);
    }
    if (error.status === 403) {
      const detail = detailOf(error);
      return new EventMutationError(
        "sin_permiso",
        detail ?? "No tienes permiso para gestionar esta actividad.",
        detail,
      );
    }
    if (error.status === 404) {
      return new EventMutationError("no_encontrado", "Esta actividad no existe.");
    }
  }
  return new EventMutationError("desconocido", fallback);
}

function invalidateEvents(queryClient: QueryClient, orgId: number | string): void {
  queryClient.invalidateQueries({ queryKey: ["panel-entity-events", orgId] });
}

/** Cuerpo real de `POST /api/events/`: título/inicio/audiencia siempre, el resto solo si hay valor. */
function toCreateEventBody(orgId: number | string, fields: EventWriteFields): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: fields.title,
    starts_at: fields.starts_at,
    audience: fields.audience,
    owner_org: Number(orgId),
  };
  if (fields.description) body.description = fields.description;
  if (fields.ends_at) body.ends_at = fields.ends_at;
  if (fields.capacity !== null) body.capacity = fields.capacity;
  if (fields.audience === "community" && fields.community) body.community = fields.community;
  if (fields.level) body.level = fields.level;
  if (fields.latitude !== null && fields.longitude !== null) {
    body.latitude = formatCoordinateForApi(fields.latitude);
    body.longitude = formatCoordinateForApi(fields.longitude);
  }
  return body;
}

/** Cuerpo de `PATCH /api/events/{id}/`: solo las claves que `fields` trae explícitas. */
function toUpdateEventBody(fields: EventUpdateFields): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (fields.title !== undefined) body.title = fields.title;
  if (fields.description !== undefined) body.description = fields.description;
  if (fields.starts_at !== undefined) body.starts_at = fields.starts_at;
  if (fields.ends_at !== undefined) body.ends_at = fields.ends_at;
  if (fields.capacity !== undefined) body.capacity = fields.capacity;
  if (fields.level !== undefined) body.level = fields.level;
  if (fields.latitude !== undefined && fields.longitude !== undefined) {
    body.latitude = fields.latitude !== null ? formatCoordinateForApi(fields.latitude) : null;
    body.longitude = fields.longitude !== null ? formatCoordinateForApi(fields.longitude) : null;
  }
  return body;
}

/** `POST /api/events/`: nace `scheduled`, con quien llama ya inscrito. */
export function useCreateEvent(
  orgId: number | string,
): UseMutationResult<EventDetail, EventMutationError, EventWriteFields> {
  const queryClient = useQueryClient();

  return useMutation<EventDetail, EventMutationError, EventWriteFields>({
    mutationFn: async (fields) => {
      try {
        return await apiFetch<EventDetail>(EVENTS.LIST(), {
          method: "POST",
          body: toCreateEventBody(orgId, fields),
        });
      } catch (error) {
        throw toEventMutationError(error, "No se pudo crear la actividad.");
      }
    },
    onSuccess: () => invalidateEvents(queryClient, orgId),
  });
}

export interface UpdateEventInput extends EventUpdateFields {
  eventId: string;
}

/** `PATCH /api/events/{id}/`: parcial, nunca toca el espacio (`audience`/`community`/`owner_org`). */
export function useUpdateEvent(
  orgId: number | string,
): UseMutationResult<EventDetail, EventMutationError, UpdateEventInput> {
  const queryClient = useQueryClient();

  return useMutation<EventDetail, EventMutationError, UpdateEventInput>({
    mutationFn: async ({ eventId, ...fields }) => {
      try {
        return await apiFetch<EventDetail>(EVENTS.DETAIL(eventId), {
          method: "PATCH",
          body: toUpdateEventBody(fields),
        });
      } catch (error) {
        throw toEventMutationError(error, "No se pudo guardar la actividad.");
      }
    },
    onSuccess: () => invalidateEvents(queryClient, orgId),
  });
}

/** `POST /api/events/{id}/cancel/`: avisa a inscritos y espera; sin cuerpo. */
export function useCancelEvent(
  orgId: number | string,
): UseMutationResult<EventDetail, EventMutationError, string> {
  const queryClient = useQueryClient();

  return useMutation<EventDetail, EventMutationError, string>({
    mutationFn: async (eventId) => {
      try {
        return await apiFetch<EventDetail>(EVENTS.CANCEL(eventId), { method: "POST" });
      } catch (error) {
        throw toEventMutationError(error, "No se pudo cancelar la actividad.");
      }
    },
    onSuccess: () => invalidateEvents(queryClient, orgId),
  });
}
