"use client";

/**
 * `GET /api/panel/entidad/{org_id}/people/{user_id}/support/`
 * (`docs/PANEL.md` §14.5): lo único que ve el **referente asignado** de
 * la red de apoyo de una persona — solo vínculos efectivos (activos y
 * sin pausa), nunca fechas, contacto ni quién invitó a quién.
 *
 * El permiso de la ruta es `ver_ficha` (deja pasar también a titular,
 * moderador y a los atajos de plataforma), pero la comprobación real
 * exige además el rol `referente` vigente en la `OrgMembership` de quien
 * pregunta (`docs/PANEL.md` §14.5, «defensa en profundidad»): el rol es
 * condición necesaria en las dos puntas, así que un titular/moderador
 * que además tuviera la `Reference` hacia esa persona tampoco pasaría —
 * una `OrgMembership` tiene un solo rol. Ese caso, y el de un
 * titular/moderador sin `Reference`, reciben 404 con el mismo `detail`
 * que la ficha (para no revelar que esa persona tiene red); `analista`
 * recibe 403 antes de llegar ahí (no está en `ver_ficha`). Este hook
 * traduce ambos a `'sin_acceso'`, mismo criterio que `usePerson.ts` con
 * el 404 de `Reference` de la propia ficha.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { PANEL } from "@/lib/api/endpoints";
import type { PersonSupportRow } from "@/lib/api/types";

export type PersonSupportErrorKind = "sin_acceso" | "desconocido";

/**
 * `kind` (+ `detail`, el texto verbatim del backend cuando lo hay) es lo
 * que traduce `components/entidad/PersonSheet.tsx` (tarea 3 de i18n,
 * `lib/i18n/errorKindText.ts`) — este hook, plano `.ts`, no puede llamar
 * a `t()`, así que `message` sigue en español tal cual (compatibilidad de
 * los tests que ya lo comprueban).
 */
export class PersonSupportError extends Error {
  readonly kind: PersonSupportErrorKind;
  readonly detail?: string;

  constructor(kind: PersonSupportErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "PersonSupportError";
    this.kind = kind;
    this.detail = detail;
  }
}

function toPersonSupportError(error: unknown): PersonSupportError {
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 404) {
      return new PersonSupportError("sin_acceso", "Sin acceso a la red de apoyo de esta persona.");
    }
    const detail = detailOf(error);
    return new PersonSupportError(
      "desconocido",
      detail ?? "No se pudo cargar la red de apoyo de esta persona.",
      detail,
    );
  }
  return new PersonSupportError("desconocido", "No se pudo cargar la red de apoyo de esta persona.");
}

export function usePersonSupport(
  orgId: number,
  userId: string,
  enabled: boolean,
): UseQueryResult<PersonSupportRow[], PersonSupportError> {
  return useQuery<PersonSupportRow[], PersonSupportError>({
    // `String(userId)` explícito aunque `userId` ya sea `string`: mismo
    // patrón defensivo que `usePerson`/`useProgram` documentan en
    // `CLAUDE.md` (el bug real fue mezclar un id de ruta string con un id
    // de API number en la misma clave de caché).
    queryKey: ["panel-person-support", orgId, String(userId)],
    enabled,
    queryFn: async () => {
      try {
        return await apiFetch<PersonSupportRow[]>(PANEL.PERSON_SUPPORT(orgId, userId));
      } catch (error) {
        throw toPersonSupportError(error);
      }
    },
  });
}
