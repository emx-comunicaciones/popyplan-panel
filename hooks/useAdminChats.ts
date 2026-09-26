"use client";

/**
 * Chats vistos por el soporte de la plataforma (admin de plataforma,
 * bloque 3, 2026-09-26): `chats/admin_viewset.py::AdminChatViewSet`,
 * `IsAdminUser` (`is_staff`, que hoy solo tiene `superadmin`).
 *
 * - `GET /api/admin/chats/?chat_type=&search=&page=` (`ADMIN_CHATS.LIST`):
 *   salas activas, paginadas de 20 en 20; `?search=` solo mira `name`.
 * - `GET /api/admin/chats/{id}/` (`ADMIN_CHATS.DETAIL`): la sala.
 * - `GET`/`POST /api/admin/chats/{id}/messages/` (`ADMIN_CHATS.MESSAGES`):
 *   `GET` es un **array plano** del más antiguo al más reciente; `POST
 *   {content}` responde 201 con el mensaje, que sale con la cuenta real de
 *   quien lo manda. El esquema dice `ChatRoom` en los dos sentidos.
 *
 * **Nada de esto se audita en el backend**: ni leer ni responder deja
 * rastro en `AuditLog` (pendiente de privacidad anotado en CLAUDE.md).
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ADMIN_CHATS } from "@/lib/api/endpoints";
import type { Paginated, PlatformChatMessage, PlatformChatRoom } from "@/lib/api/types";

export type AdminChatsErrorKind = "invalido" | "sin_acceso" | "no_encontrado" | "desconocido";

export class AdminChatsError extends Error {
  readonly kind: AdminChatsErrorKind;
  readonly detail?: string;

  constructor(kind: AdminChatsErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "AdminChatsError";
    this.kind = kind;
    this.detail = detail;
  }
}

const ROOMS_KEY = "panel-admin-chats";
const ROOM_KEY = "panel-admin-chat";
const MESSAGES_KEY = "panel-admin-chat-messages";

function toReadError(error: unknown, fallback: string): AdminChatsError {
  if (error instanceof ApiError && error.status === 403) {
    return new AdminChatsError("sin_acceso", "Solo el personal de plataforma ve los chats.");
  }
  if (error instanceof ApiError && error.status === 404) {
    return new AdminChatsError("no_encontrado", "Esta conversación o esa página ya no existe.");
  }
  return new AdminChatsError("desconocido", fallback);
}

export interface AdminChatsFilters {
  chatType?: "individual" | "group";
  search?: string;
  page?: number;
}

export function useAdminChats(
  filters: AdminChatsFilters,
): UseQueryResult<Paginated<PlatformChatRoom>, AdminChatsError> {
  const params = new URLSearchParams({ page: String(filters.page ?? 1) });
  if (filters.chatType) params.set("chat_type", filters.chatType);
  const search = filters.search?.trim();
  if (search) params.set("search", search);
  const url = `${ADMIN_CHATS.LIST()}?${params.toString()}`;

  return useQuery<Paginated<PlatformChatRoom>, AdminChatsError>({
    queryKey: [ROOMS_KEY, url],
    queryFn: async () => {
      try {
        return await apiFetch<Paginated<PlatformChatRoom>>(url);
      } catch (error) {
        throw toReadError(error, "No se pudieron cargar los chats.");
      }
    },
  });
}

export function useAdminChat(roomId: string): UseQueryResult<PlatformChatRoom, AdminChatsError> {
  return useQuery<PlatformChatRoom, AdminChatsError>({
    queryKey: [ROOM_KEY, roomId],
    queryFn: async () => {
      try {
        return await apiFetch<PlatformChatRoom>(ADMIN_CHATS.DETAIL(roomId));
      } catch (error) {
        throw toReadError(error, "No se pudo cargar la conversación.");
      }
    },
  });
}

export function useAdminChatMessages(roomId: string): UseQueryResult<PlatformChatMessage[], AdminChatsError> {
  return useQuery<PlatformChatMessage[], AdminChatsError>({
    queryKey: [MESSAGES_KEY, roomId],
    queryFn: async () => {
      try {
        return await apiFetch<PlatformChatMessage[]>(ADMIN_CHATS.MESSAGES(roomId));
      } catch (error) {
        throw toReadError(error, "No se pudieron cargar los mensajes.");
      }
    },
  });
}

export function useSendAdminChatMessage(
  roomId: string,
): UseMutationResult<PlatformChatMessage, AdminChatsError, string> {
  const queryClient = useQueryClient();
  return useMutation<PlatformChatMessage, AdminChatsError, string>({
    mutationFn: async (content) => {
      try {
        return await apiFetch<PlatformChatMessage>(ADMIN_CHATS.MESSAGES(roomId), {
          method: "POST",
          body: { content },
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          // El backend responde `{"content": "…"}` con una **cadena**, no la
          // lista por campo de DRF que lee `detailOf`.
          const body = error.body as { content?: unknown } | null;
          const detail = detailOf(error) ?? (typeof body?.content === "string" ? body.content : undefined);
          throw new AdminChatsError("invalido", detail ?? "Escribe un mensaje.", detail);
        }
        throw toReadError(error, "No se pudo enviar el mensaje.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [MESSAGES_KEY, roomId] });
    },
  });
}
