"use client";

/**
 * Notificaciones del admin de plataforma (bloque 3, 2026-09-26).
 *
 * - `POST /api/notifications/send/` (`NotificationViewSet.send`,
 *   `IsAdminUser`): a una persona (201 `{detail, recipients}`) o a todas
 *   las cuentas activas, staff incluido (202 `{detail}`, se encola sin
 *   recuento). **Nunca aplica plantillas** (`data._skip_template`). No se
 *   audita. `apiFetch` no expone el código de estado, así que el envío
 *   masivo se reconoce por la ausencia de `recipients`.
 * - `GET`/`POST /api/notification-templates/` y `PATCH`/`DELETE .../{id}/`
 *   (`NotificationTemplateViewSet`, `IsAdminUser`, 20 por página). Una
 *   plantilla solo afecta a las notificaciones que genera el propio
 *   sistema de ese tipo (gana la primera activa por tipo, la de id más
 *   bajo), y su texto es un *msgid* en inglés con `{marcadores}` que se
 *   traduce con los `.po` del backend.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { NOTIFICATIONS } from "@/lib/api/endpoints";
import type {
  AdminSendNotificationRequest,
  AdminSendNotificationResponse,
  NotificationTemplateInput,
  NotificationTemplateRow,
  Paginated,
} from "@/lib/api/types";

export type AdminNotificationsErrorKind =
  | "invalido"
  | "sin_acceso"
  | "no_encontrado"
  | "pagina_inexistente"
  | "desconocido";

export class AdminNotificationsError extends Error {
  readonly kind: AdminNotificationsErrorKind;
  readonly detail?: string;

  constructor(kind: AdminNotificationsErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "AdminNotificationsError";
    this.kind = kind;
    this.detail = detail;
  }
}

function toError(error: unknown, fallback: string): AdminNotificationsError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      const detail = detailOf(error);
      return new AdminNotificationsError("invalido", detail ?? "Revisa los datos.", detail);
    }
    if (error.status === 403) {
      return new AdminNotificationsError("sin_acceso", "Solo el personal de plataforma gestiona las notificaciones.");
    }
    if (error.status === 404) {
      return new AdminNotificationsError("no_encontrado", "Ya no existe.");
    }
  }
  return new AdminNotificationsError("desconocido", fallback);
}

export const NOTIFICATION_TEMPLATES_KEY = "panel-notification-templates";

export function useSendAdminNotification(): UseMutationResult<
  AdminSendNotificationResponse,
  AdminNotificationsError,
  AdminSendNotificationRequest
> {
  return useMutation<AdminSendNotificationResponse, AdminNotificationsError, AdminSendNotificationRequest>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<AdminSendNotificationResponse>(NOTIFICATIONS.SEND(), { method: "POST", body: input });
      } catch (error) {
        throw toError(error, "No se pudo enviar la notificación.");
      }
    },
  });
}

export function useNotificationTemplates(
  page: number,
): UseQueryResult<Paginated<NotificationTemplateRow>, AdminNotificationsError> {
  return useQuery<Paginated<NotificationTemplateRow>, AdminNotificationsError>({
    queryKey: [NOTIFICATION_TEMPLATES_KEY, page],
    queryFn: async () => {
      try {
        return await apiFetch<Paginated<NotificationTemplateRow>>(`${NOTIFICATIONS.TEMPLATES()}?page=${page}`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          throw new AdminNotificationsError("pagina_inexistente", "Esa página ya no existe.");
        }
        throw toError(error, "No se pudieron cargar las plantillas.");
      }
    },
  });
}

export interface SaveTemplateInput {
  /** `null` crea; un id edita. */
  id: number | null;
  data: NotificationTemplateInput;
}

export function useSaveNotificationTemplate(): UseMutationResult<
  NotificationTemplateRow,
  AdminNotificationsError,
  SaveTemplateInput
> {
  const queryClient = useQueryClient();
  return useMutation<NotificationTemplateRow, AdminNotificationsError, SaveTemplateInput>({
    mutationFn: async ({ id, data }) => {
      try {
        return id === null
          ? await apiFetch<NotificationTemplateRow>(NOTIFICATIONS.TEMPLATES(), { method: "POST", body: data })
          : await apiFetch<NotificationTemplateRow>(NOTIFICATIONS.TEMPLATE(id), { method: "PATCH", body: data });
      } catch (error) {
        throw toError(error, "No se pudo guardar la plantilla.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [NOTIFICATION_TEMPLATES_KEY] });
    },
  });
}

export function useDeleteNotificationTemplate(): UseMutationResult<void, AdminNotificationsError, number> {
  const queryClient = useQueryClient();
  return useMutation<void, AdminNotificationsError, number>({
    mutationFn: async (id) => {
      try {
        await apiFetch(NOTIFICATIONS.TEMPLATE(id), { method: "DELETE" });
      } catch (error) {
        throw toError(error, "No se pudo borrar la plantilla.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [NOTIFICATION_TEMPLATES_KEY] });
    },
  });
}
