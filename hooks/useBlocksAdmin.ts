"use client";

/**
 * Bloqueos entre personas vistos por la plataforma (admin de plataforma,
 * bloque 1, 2026-09-26): `GET /api/safety/blocks/admin/?user=<id>` y
 * `DELETE /api/safety/blocks/{id}/admin/ {reason}` (`safety/viewsets.py
 * ::BlockViewSet.admin_list/admin_destroy`, `moderator`/`superadmin`).
 *
 * No hay listado global: el backend exige `?user=` (bloqueos hechos por
 * esa cuenta o contra ella), así que el hook no pide nada sin cuenta
 * elegida. La respuesta es un **array plano** — el esquema la envuelve
 * como `PaginatedBlockAdminList`, pero la acción nunca pagina (misma
 * clase de mismatch que `reports/queue`, que el panel pagó caro).
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { SAFETY } from "@/lib/api/endpoints";
import type { BlockAdmin } from "@/lib/api/types";

export type BlocksAdminErrorKind = "invalido" | "sin_acceso" | "no_encontrado" | "desconocido";

export class BlocksAdminError extends Error {
  readonly kind: BlocksAdminErrorKind;
  readonly detail?: string;

  constructor(kind: BlocksAdminErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "BlocksAdminError";
    this.kind = kind;
    this.detail = detail;
  }
}

const QUERY_KEY = "panel-blocks-admin";

export function useBlocksAdmin(userId: string | null): UseQueryResult<BlockAdmin[], BlocksAdminError> {
  return useQuery<BlockAdmin[], BlocksAdminError>({
    queryKey: [QUERY_KEY, userId],
    queryFn: async () => {
      try {
        return await apiFetch<BlockAdmin[]>(
          `${SAFETY.BLOCKS_ADMIN()}?user=${encodeURIComponent(String(userId))}`,
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          throw new BlocksAdminError("sin_acceso", "Solo moderación y superadmin ven los bloqueos.");
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new BlocksAdminError("no_encontrado", "Esa cuenta no existe.");
        }
        throw new BlocksAdminError("desconocido", "No se pudieron cargar los bloqueos.");
      }
    },
    enabled: userId !== null,
  });
}

export interface RevokeBlockInput {
  blockId: string;
  reason: string;
}

export function useRevokeBlock(): UseMutationResult<void, BlocksAdminError, RevokeBlockInput> {
  const queryClient = useQueryClient();
  return useMutation<void, BlocksAdminError, RevokeBlockInput>({
    mutationFn: async ({ blockId, reason }) => {
      try {
        await apiFetch(SAFETY.BLOCK_ADMIN_REVOKE(blockId), { method: "DELETE", body: { reason } });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new BlocksAdminError("invalido", detail ?? "Escribe el motivo de la revocación.", detail);
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new BlocksAdminError("sin_acceso", "Solo moderación y superadmin revocan bloqueos.");
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new BlocksAdminError("no_encontrado", "Este bloqueo ya no existe.");
        }
        throw new BlocksAdminError("desconocido", "No se pudo revocar el bloqueo.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
