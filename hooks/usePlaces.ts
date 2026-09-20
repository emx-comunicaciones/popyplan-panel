"use client";

/**
 * `GET /api/places/?ine_code=&search=&page=` (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §3.3): catálogo de
 * municipios, solo lectura, autenticado, paginado y limitado a
 * `is_active`. Sin ningún dato personal (riesgo R1 de la spec: es
 * enumerable, pero no hay nada que enumerar salvo geografía pública).
 *
 * Dos consumidores con necesidades opuestas, así que dos hooks en vez de
 * uno con dos comportamientos:
 *
 * - **`usePlacesByIne`** (mapa de Territorio): necesita **todas** las
 *   coordenadas de los municipios que salen en `by_place`, así que
 *   recorre las páginas hasta agotarlas. El listado de `by_place` solo
 *   trae municipios con actividad en el periodo, así que en la práctica
 *   es una o dos páginas; `MAX_PAGES` es una red de seguridad contra un
 *   `next` que no termine nunca (mismo patrón y mismo motivo que
 *   `hooks/useEntityCommunities.ts`), y prefiere **fallar en voz alta** a
 *   devolver un listado truncado que parece completo.
 * - **`useSearchPlaces`** (buscador de sede de plataforma y de
 *   Configuración): solo la primera página, que es lo que se pinta en un
 *   desplegable de resultados, y solo a partir de dos caracteres (mismo
 *   umbral que `hooks/useUserSearch.ts`).
 * - **`usePlacesCount`** (vista previa «N municipios» del formulario de
 *   territorio): no necesita ninguna fila, solo el `count` de la
 *   respuesta paginada con el filtro de código correspondiente al atajo
 *   elegido — por eso pide una sola página y se queda con el total. Los
 *   tres filtros (`ccaa_code`/`prov_code`/`comarca_code`) los expone el
 *   backend de este bloque; `municipios` no pasa por aquí, porque su
 *   recuento es la lista que se está escribiendo y se cuenta en el
 *   cliente.
 *
 * `staleTime` de 5 minutos en los dos: la geografía no cambia durante
 * una sesión y montar otra vez un selector de municipio no debería
 * repetir el recorrido (misma decisión que el hallazgo F5 de la
 * auditoría para `useEntityCommunities`).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { PLACES } from "@/lib/api/endpoints";
import type { PaginatedPlaceList, PlaceRow, TerritoryKind } from "@/lib/api/types";

export type PlacesErrorKind = "demasiadas_paginas" | "desconocido";

/**
 * Comprueba que la respuesta trae de verdad el envoltorio paginado de
 * DRF (I4 de la revisión final de rama). Si `GET /api/places/` acabara
 * sirviendo un array plano —el mismo tipo de sorpresa que ya tuvo el
 * panel con `GET /api/safety/reports/queue/`, documentado en
 * `CLAUDE.md`— `data.results`/`.count`/`.next` serían `undefined` y los
 * tres hooks de abajo degradarían a «vacío» en silencio: el mapa diría
 * que ningún municipio tiene actividad, el buscador de sede nunca
 * encontraría nada y la vista previa diría «0 municipios», los tres sin
 * un solo error visible.
 */
function isPaginatedPlaceList(data: unknown): data is PaginatedPlaceList {
  return (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as { results?: unknown }).results)
  );
}

export class PlacesError extends Error {
  readonly kind: PlacesErrorKind;

  constructor(kind: PlacesErrorKind, message: string) {
    super(message);
    this.name = "PlacesError";
    this.kind = kind;
  }
}

/** 25 páginas × 20 filas del paginador del backend = 500 municipios. */
const MAX_PAGES = 25;
const STALE_TIME_MS = 5 * 60 * 1000;
const MIN_SEARCH_LENGTH = 2;

export function usePlacesByIne(ineCodes: string[]): UseQueryResult<PlaceRow[], PlacesError> {
  // Se conserva el orden de entrada tal cual: es el que ya trae
  // `by_place` (el consumidor real), y reordenar aquí no aportaría nada
  // salvo una query string distinta de la que se está pidiendo de verdad.
  const joined = ineCodes.join(",");

  return useQuery<PlaceRow[], PlacesError>({
    queryKey: ["panel-places-by-ine", joined],
    enabled: joined.length > 0,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      const results: PlaceRow[] = [];
      const base = new URLSearchParams({ ine_code: joined });
      let page = 1;

      while (page <= MAX_PAGES) {
        const params = new URLSearchParams(base);
        if (page > 1) params.set("page", String(page));

        let data: unknown;
        try {
          data = await apiFetch<PaginatedPlaceList>(`${PLACES.LIST()}?${params.toString()}`);
        } catch {
          throw new PlacesError("desconocido", "No se pudo cargar el listado de municipios.");
        }
        if (!isPaginatedPlaceList(data)) {
          throw new PlacesError("desconocido", "No se pudo cargar el listado de municipios.");
        }

        results.push(...data.results);
        if (!data.next) return results;
        page += 1;
      }

      throw new PlacesError(
        "demasiadas_paginas",
        "Hay demasiados municipios para cargarlos todos; contacta con Popyplan.",
      );
    },
  });
}

export function useSearchPlaces(search: string): UseQueryResult<PlaceRow[], PlacesError> {
  const term = search.trim();

  return useQuery<PlaceRow[], PlacesError>({
    queryKey: ["panel-places-search", term],
    enabled: term.length >= MIN_SEARCH_LENGTH,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      const params = new URLSearchParams({ search: term });
      let data: unknown;
      try {
        data = await apiFetch<PaginatedPlaceList>(`${PLACES.LIST()}?${params.toString()}`);
      } catch {
        throw new PlacesError("desconocido", "No se pudo buscar el municipio.");
      }
      if (!isPaginatedPlaceList(data)) {
        throw new PlacesError("desconocido", "No se pudo buscar el municipio.");
      }
      return data.results;
    },
  });
}

/**
 * Nombre del parámetro de `GET /api/places/` que filtra cada atajo de
 * territorio (spec §2.2/§3.3). `""` y `municipios` no tienen filtro de
 * código: el primero no declara territorio y el segundo es una lista
 * literal que se cuenta en el cliente.
 */
const COUNT_FILTER_PARAM: Record<TerritoryKind, string | null> = {
  "": null,
  municipios: null,
  ccaa: "ccaa_code",
  provincia: "prov_code",
  comarca: "comarca_code",
};

/**
 * Total de municipios activos que casan con el código de un atajo, para
 * la vista previa «N municipios» de
 * `components/plataforma/TerritorioForm.tsx`. Se queda con el `count` de
 * la respuesta paginada y **descarta las filas**: no hay que pintar
 * ninguna, y una CCAA son cientos de municipios que no interesa traer.
 */
export function usePlacesCount(
  kind: TerritoryKind,
  code: string,
): UseQueryResult<number, PlacesError> {
  const param = COUNT_FILTER_PARAM[kind];
  const trimmed = code.trim();

  return useQuery<number, PlacesError>({
    queryKey: ["panel-places-count", kind, trimmed],
    enabled: param !== null && trimmed.length > 0,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      // `enabled` ya lo garantiza; se comprueba en vez de forzar con `!`
      // para no dejar una rama sin cubrir (mismo criterio que
      // `usePlaceSheet`).
      if (param === null) {
        throw new PlacesError("desconocido", "No se pudo contar los municipios del territorio.");
      }
      const params = new URLSearchParams({ [param]: trimmed });
      let data: unknown;
      try {
        data = await apiFetch<PaginatedPlaceList>(`${PLACES.LIST()}?${params.toString()}`);
      } catch {
        throw new PlacesError("desconocido", "No se pudo contar los municipios del territorio.");
      }
      if (!isPaginatedPlaceList(data)) {
        throw new PlacesError("desconocido", "No se pudo contar los municipios del territorio.");
      }
      return data.count ?? 0;
    },
  });
}
