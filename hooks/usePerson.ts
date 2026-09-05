"use client";

/**
 * `GET /api/panel/entidad/{org_id}/people/{user_id}/` (`docs/PANEL.md`
 * §3.3). Un `referente` que no tenga un `Reference` hacia esa persona
 * recibe **404** (no 403: no confirma que la persona exista en la
 * entidad a quien no tiene por qué verla) — este hook lo traduce a
 * `PersonError('sin_acceso', …)` para que la página pinte el estado «Sin
 * acceso» que pide la tarea, sea cual sea el código real.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { PANEL } from "@/lib/api/endpoints";
import type { PersonDetail } from "@/lib/api/types";
import type { Period } from "@/lib/metrics/period";

export type PersonErrorKind = "periodo_invalido" | "sin_acceso" | "desconocido";

export class PersonError extends Error {
  readonly kind: PersonErrorKind;

  constructor(kind: PersonErrorKind, message: string) {
    super(message);
    this.name = "PersonError";
    this.kind = kind;
  }
}

function toPersonError(error: unknown): PersonError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return new PersonError("periodo_invalido", "El periodo elegido no es válido.");
    }
    if (error.status === 403 || error.status === 404) {
      return new PersonError("sin_acceso", "Sin acceso a esta ficha.");
    }
  }
  return new PersonError("desconocido", "No se pudo cargar la ficha de esta persona.");
}

export function usePerson(
  orgId: number | string,
  userId: number | string,
  period: Period,
): UseQueryResult<PersonDetail, PersonError> {
  const query = new URLSearchParams({ since: period.since, until: period.until }).toString();

  return useQuery<PersonDetail, PersonError>({
    queryKey: ["panel-person", orgId, userId, query],
    queryFn: async () => {
      try {
        return await apiFetch<PersonDetail>(`${PANEL.PERSON(orgId, userId)}?${query}`);
      } catch (error) {
        throw toPersonError(error);
      }
    },
  });
}
