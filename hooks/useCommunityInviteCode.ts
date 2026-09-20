"use client";

/**
 * `GET /api/communities/{id}/invite-code/`
 * (`communities/unified_viewset.py::CommunityViewSet.invite_code`, «Solo
 * para gestores y solo en comunidades `private`»): devuelve
 * `{invite_code}` a quien pasa `Community.can_manage` —para una
 * comunidad con `owner_org`, el titular/moderador de esa entidad— y solo
 * si la visibilidad es `private`.
 *
 * **Hallazgo B-I8 de la auditoría de integración (2026-09-21)**: el
 * panel ofrecía crear comunidades `private` (`NuevaComunidadDialog`)
 * pero no enseñaba el código en ninguna parte, así que una comunidad
 * privada creada desde el panel era un callejón sin salida: nadie podía
 * entrar en ella.
 *
 * El endpoint responde `{"error": …}` (no `{"detail": …}`) en sus dos
 * rechazos; `lib/api/drfError.ts::detailOf` lee las dos formas, así que
 * el mensaje del backend llega tal cual cuando lo trae.
 *
 * Se pide solo con el panel de la comunidad privada abierto (`enabled`),
 * mismo patrón que `hooks/useCommunity.ts`: sin eso, cada comunidad
 * seleccionada dispararía una petición que casi siempre sería un 400.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { COMMUNITIES } from "@/lib/api/endpoints";

export type CommunityInviteCodeErrorKind = "sin_permiso" | "no_privada" | "desconocido";

export class CommunityInviteCodeError extends Error {
  readonly kind: CommunityInviteCodeErrorKind;
  readonly detail?: string;

  constructor(kind: CommunityInviteCodeErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "CommunityInviteCodeError";
    this.kind = kind;
    this.detail = detail;
  }
}

/**
 * Respuesta real del backend: `{"invite_code": "<uuid>"}`. El
 * `@extend_schema` de la acción no declara `responses=`, así que no sale
 * en `types.generated.ts` — mismo patrón de mismatches ya documentado en
 * `lib/api/types.ts` para `AttendanceMarkResponse`/`CheckinResponse`.
 */
export interface CommunityInviteCodeResponse {
  invite_code: string;
}

export function useCommunityInviteCode(
  communityId: string,
  options: { enabled?: boolean } = {},
): UseQueryResult<string, CommunityInviteCodeError> {
  return useQuery<string, CommunityInviteCodeError>({
    queryKey: ["panel-community-invite-code", communityId],
    queryFn: async () => {
      try {
        const data = await apiFetch<CommunityInviteCodeResponse>(
          COMMUNITIES.INVITE_CODE(communityId),
        );
        return data.invite_code;
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          const detail = detailOf(error);
          throw new CommunityInviteCodeError(
            "sin_permiso",
            detail ?? "No tienes permiso para ver el código de invitación.",
            detail,
          );
        }
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new CommunityInviteCodeError(
            "no_privada",
            detail ?? "Solo las comunidades privadas tienen código de invitación.",
            detail,
          );
        }
        throw new CommunityInviteCodeError(
          "desconocido",
          "No se pudo cargar el código de invitación.",
        );
      }
    },
    enabled: options.enabled ?? true,
  });
}
