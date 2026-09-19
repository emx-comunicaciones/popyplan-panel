"use client";

/**
 * `GET /api/panel/territorio/{org_id}/places/{ine_code}/?since&until`
 * (spec de diseño `2026-09-19-territorio-administraciones-design.md`
 * §3.2): ficha agregada de un municipio del territorio de la
 * administración, para el panel lateral de la pantalla Territorio.
 *
 * `ineCode` es `null` mientras la ficha está cerrada: la consulta queda
 * deshabilitada (`enabled`), así que abrir y cerrar el panel no dispara
 * peticiones de más.
 *
 * Errores tipados (mismo patrón que `useMetrics`/`MetricsError`): **404**
 * es el municipio fuera del territorio declarado — el backend responde
 * lo mismo para un municipio inexistente y para uno de fuera, a
 * propósito, para no revelar nada de lo segundo (§3.2); **403** es no
 * tener `ver_panel` o que la organización no sea una administración;
 * **409** es la administración sin territorio (§3.1), que en esta
 * pantalla no debería llegar a verse porque la página entera ya lo trata
 * antes, pero se distingue igual para no pintar «fuera del territorio»
 * cuando no hay territorio ninguno.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { TERRITORIO } from "@/lib/api/endpoints";
import type { PlaceSheet } from "@/lib/api/types";
import type { Period } from "@/lib/metrics/period";

export type PlaceSheetErrorKind =
  | "fuera_de_territorio"
  | "sin_acceso"
  | "sin_territorio"
  | "desconocido";

export class PlaceSheetError extends Error {
  readonly kind: PlaceSheetErrorKind;
  readonly detail?: string;

  constructor(kind: PlaceSheetErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "PlaceSheetError";
    this.kind = kind;
    this.detail = detail;
  }
}

function toPlaceSheetError(error: unknown): PlaceSheetError {
  if (error instanceof ApiError) {
    const detail = detailOf(error);
    if (error.status === 404) {
      return new PlaceSheetError(
        "fuera_de_territorio",
        detail ?? "Ese municipio no está en el territorio de esta administración.",
        detail,
      );
    }
    if (error.status === 403) {
      return new PlaceSheetError("sin_acceso", detail ?? "No tienes acceso a esta ficha.", detail);
    }
    if (error.status === 409) {
      return new PlaceSheetError(
        "sin_territorio",
        detail ?? "Esta administración no tiene territorio declarado.",
        detail,
      );
    }
  }
  return new PlaceSheetError("desconocido", "No se pudo cargar la ficha del municipio.");
}

export function usePlaceSheet(
  orgId: number | string,
  ineCode: string | null,
  period: Period,
): UseQueryResult<PlaceSheet, PlaceSheetError> {
  const query = new URLSearchParams({ since: period.since, until: period.until }).toString();

  return useQuery<PlaceSheet, PlaceSheetError>({
    // `String(orgId)` normaliza el id: la página lo recibe como
    // parámetro de ruta (cadena) y la API lo devuelve como número — con
    // los dos en la misma clave, `invalidateQueries` no empareja (mismo
    // fallo que documenta `CLAUDE.md` para `useProgram`).
    queryKey: ["panel-place-sheet", String(orgId), ineCode, period.since, period.until],
    enabled: ineCode !== null,
    queryFn: async () => {
      // `enabled` ya garantiza que hay código, pero TanStack tipa la
      // `queryFn` sin saberlo: se comprueba en vez de forzar con `!`,
      // así el caso imposible tampoco deja una rama sin cubrir.
      if (ineCode === null) {
        throw new PlaceSheetError("desconocido", "No se pudo cargar la ficha del municipio.");
      }
      try {
        return await apiFetch<PlaceSheet>(`${TERRITORIO.PLACE_SHEET(orgId, ineCode)}?${query}`);
      } catch (error) {
        throw toPlaceSheetError(error);
      }
    },
  });
}
