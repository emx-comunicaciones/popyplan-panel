/**
 * Nombre + provincia de un municipio a partir de su código INE (hallazgo
 * I1 de la revisión final de rama: «nada de valores crudos del
 * contrato», B20 en `CLAUDE.md`). Se usa junto a
 * `hooks/usePlaces.ts::usePlacesByIne`: la sede de una entidad
 * (`Organization.place`) es el código INE, y pintarlo tal cual («20069»)
 * es ilegible para quien no se lo sepa de memoria.
 *
 * Función pura: no decide ningún texto, solo el **estado** de la
 * resolución — `EntidadDetail.tsx`, `EntidadesTable.tsx` y
 * `SedeSelector.tsx` (los tres consumidores) traducen cada `kind` a su
 * propio texto con `t()`, nunca aquí.
 */
import type { PlaceRow } from "@/lib/api/types";

export type PlaceLabelState =
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "resolved"; name: string; province: string }
  | { kind: "fallback" };

/** Subconjunto de `UseQueryResult<PlaceRow[], …>` que hace falta aquí. */
export interface PlaceQueryLike {
  data?: PlaceRow[];
  isPending: boolean;
  isError: boolean;
}

/**
 * `fallback` cubre dos casos a propósito, no solo el error: la consulta
 * puede ir bien y aun así no traer el municipio (un código INE que ya
 * no existe en el catálogo, o que la búsqueda todavía no ha devuelto).
 * En los dos, quien llama pinta el propio código INE en vez de
 * inventarse un nombre.
 */
export function placeLabelState(
  ineCode: string | null | undefined,
  query: PlaceQueryLike,
): PlaceLabelState {
  if (!ineCode) return { kind: "empty" };
  if (query.isPending) return { kind: "loading" };
  const place = query.data?.find((row) => row.ine_code === ineCode);
  if (place) return { kind: "resolved", name: place.name, province: place.prov_name };
  return { kind: "fallback" };
}
