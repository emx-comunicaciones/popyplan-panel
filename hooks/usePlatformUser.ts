"use client";

/**
 * Ficha de una cuenta del admin de plataforma (bloque 1, 2026-09-26):
 * perfil público (`GET /api/users/{id}/`) y las cuatro acciones de
 * gestión — alta (`POST /api/auth/admin-register/`), desactivar/reactivar
 * (`PATCH /api/users/{id}/ {is_active}`), borrar (`DELETE /api/users/{id}/`)
 * y enviar el restablecimiento de contraseña (`POST /api/auth/password/reset/`).
 *
 * El backend responde sus rechazos con `{"error": …}` (no `detail`) o
 * campo por campo; `detailOf` lee los dos y el texto viaja literal en
 * `detail` (patrón `errorKindText` del panel).
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { AUTH, USERS } from "@/lib/api/endpoints";
import type { AdminRegisterRequest, PlatformAccount, PlatformPublicProfile } from "@/lib/api/types";

import { PLATFORM_ACCOUNT_KEY, PLATFORM_USERS_KEY } from "./usePlatformUsers";

export type PlatformProfileErrorKind = "no_encontrado" | "desconocido";

export class PlatformProfileError extends Error {
  readonly kind: PlatformProfileErrorKind;

  constructor(kind: PlatformProfileErrorKind, message: string) {
    super(message);
    this.name = "PlatformProfileError";
    this.kind = kind;
  }
}

/** 404 también para una cuenta suspendida o borrada (`retrieve` las oculta a todo el mundo). */
export function usePlatformUserProfile(
  userId: string,
): UseQueryResult<PlatformPublicProfile, PlatformProfileError> {
  return useQuery<PlatformPublicProfile, PlatformProfileError>({
    queryKey: ["panel-platform-user-profile", String(userId)],
    queryFn: async () => {
      try {
        return await apiFetch<PlatformPublicProfile>(USERS.DETAIL(userId));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          throw new PlatformProfileError("no_encontrado", "No hay perfil público de esta cuenta.");
        }
        throw new PlatformProfileError("desconocido", "No se pudo cargar el perfil de esta cuenta.");
      }
    },
  });
}

export type PlatformUserMutationErrorKind =
  | "invalido"
  | "sin_permiso"
  | "no_encontrado"
  | "demasiados_intentos"
  | "desconocido";

export class PlatformUserMutationError extends Error {
  readonly kind: PlatformUserMutationErrorKind;
  readonly detail?: string;

  constructor(kind: PlatformUserMutationErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "PlatformUserMutationError";
    this.kind = kind;
    this.detail = detail;
  }
}

function toMutationError(error: unknown, fallback: string): PlatformUserMutationError {
  if (error instanceof ApiError) {
    const detail = detailOf(error);
    if (error.status === 400) {
      return new PlatformUserMutationError("invalido", detail ?? "Revisa los datos.", detail);
    }
    if (error.status === 403) {
      return new PlatformUserMutationError("sin_permiso", "Solo el personal de plataforma puede hacer esto.");
    }
    if (error.status === 404) {
      return new PlatformUserMutationError("no_encontrado", "Esta cuenta ya no existe.");
    }
    if (error.status === 429) {
      return new PlatformUserMutationError("demasiados_intentos", "Demasiados intentos; espera un minuto.");
    }
  }
  return new PlatformUserMutationError("desconocido", fallback);
}

function useInvalidateAccounts(userId?: number | string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [PLATFORM_USERS_KEY] });
    void queryClient.invalidateQueries({ queryKey: ["panel-user-search"] });
    if (userId !== undefined) {
      void queryClient.invalidateQueries({ queryKey: [PLATFORM_ACCOUNT_KEY, String(userId)] });
      void queryClient.invalidateQueries({ queryKey: ["panel-platform-user-profile", String(userId)] });
    }
  };
}

export function useCreatePlatformUser(): UseMutationResult<
  PlatformAccount,
  PlatformUserMutationError,
  AdminRegisterRequest
> {
  const invalidate = useInvalidateAccounts();
  return useMutation<PlatformAccount, PlatformUserMutationError, AdminRegisterRequest>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<PlatformAccount>(AUTH.ADMIN_REGISTER, { method: "POST", body: input });
      } catch (error) {
        throw toMutationError(error, "No se pudo crear la cuenta.");
      }
    },
    onSuccess: invalidate,
  });
}

export function useSetPlatformUserActive(
  userId: string,
): UseMutationResult<unknown, PlatformUserMutationError, boolean> {
  const invalidate = useInvalidateAccounts(userId);
  return useMutation<unknown, PlatformUserMutationError, boolean>({
    mutationFn: async (isActive) => {
      try {
        return await apiFetch(USERS.DETAIL(userId), { method: "PATCH", body: { is_active: isActive } });
      } catch (error) {
        throw toMutationError(error, "No se pudo cambiar el estado de la cuenta.");
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeletePlatformUser(
  userId: string,
): UseMutationResult<void, PlatformUserMutationError, void> {
  const invalidate = useInvalidateAccounts(userId);
  return useMutation<void, PlatformUserMutationError, void>({
    mutationFn: async () => {
      try {
        await apiFetch(USERS.DETAIL(userId), { method: "DELETE" });
      } catch (error) {
        throw toMutationError(error, "No se pudo borrar la cuenta.");
      }
    },
    onSuccess: invalidate,
  });
}

export function useSendPasswordReset(): UseMutationResult<unknown, PlatformUserMutationError, string> {
  return useMutation<unknown, PlatformUserMutationError, string>({
    mutationFn: async (email) => {
      try {
        return await apiFetch(AUTH.PASSWORD_RESET, { method: "POST", body: { email } });
      } catch (error) {
        throw toMutationError(error, "No se pudo enviar el restablecimiento de contraseña.");
      }
    },
  });
}
