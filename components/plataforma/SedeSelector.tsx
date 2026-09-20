"use client";

/**
 * Buscador de municipio para la sede de una organización (spec de
 * diseño `2026-09-19-territorio-administraciones-design.md` §4.3: «sede
 * (`place`, buscador de municipio por nombre sobre 3.3)»). Lo usan los
 * tres formularios que tocan la sede — alta de entidad, ficha de
 * plataforma y Configuración de la entidad — para no tener tres
 * versiones del mismo control.
 *
 * Escribir dispara `useSearchPlaces` con retardo (`useDebouncedValue`,
 * 300 ms, mismo patrón que `EntidadesTable`/`RolesPanel`): sin él,
 * teclear «irun» serían cuatro peticiones. Un fallo de la búsqueda
 * **se dice** (`role="alert"`), no se deja como un selector vacío, que
 * es indistinguible de «no hay ningún municipio con ese nombre»
 * (hallazgo B15 de la auditoría).
 *
 * **La sede es obligatoria, en alta y en edición** (hallazgo I5 de la
 * revisión final de rama, spec §2.1: el backend rechaza `place: null`).
 * El `<select>` ya no ofrece «Sin municipio» — ese estado solo se lee,
 * nunca se elige, en la ficha de una organización antigua sin sede
 * (`EntidadDetail.tsx`/`EntidadesTable.tsx`, `plataforma.sede.missing`).
 * `hintId`, opcional, liga el control (`aria-describedby`) al párrafo de
 * ayuda que pinta cada consumidor bajo el selector cuando el botón de
 * guardar está deshabiliado por falta de sede — el texto de ese párrafo
 * varía según el contexto (alta vs. edición), así que lo decide quien
 * llama, no este componente.
 *
 * **El valor ya guardado se resuelve a nombre + provincia** (hallazgo
 * I1): antes de esta tarea, mientras la búsqueda en curso no devolvía
 * el municipio ya guardado, la opción de reserva enseñaba el código INE
 * crudo («Municipio actual (INE 20069)»). `usePlacesByIne` resuelve ese
 * único código y `placeLabelState` decide el texto: «…» mientras carga,
 * el nombre resuelto si lo hay, o el código crudo como último recurso
 * si la consulta falla o el municipio no aparece en el catálogo.
 */
import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePlacesByIne, useSearchPlaces } from "@/hooks/usePlaces";
import { placeLabelState } from "@/lib/places/placeLabel";

export interface SedeSelectorProps {
  id: string;
  /** Código INE ya guardado, o `null`. */
  value: string | null;
  onChange: (ineCode: string | null) => void;
  /**
   * Id del párrafo de ayuda que pinta el consumidor bajo el selector
   * («la sede es obligatoria», con un texto distinto según el contexto).
   * Cuando se pasa, se liga al `<select>` con `aria-describedby` junto
   * al aviso de error de la búsqueda, si también está presente.
   */
  hintId?: string;
}

export function SedeSelector({ id, value, onChange, hintId }: SedeSelectorProps) {
  const t = useTranslations("plataforma.sede");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const places = useSearchPlaces(debouncedSearch);
  const errorId = useId();

  // Solo se resuelve cuando la búsqueda en curso no trae ya ese código
  // (el caso normal: nada más abrir el formulario, con `search === ""`).
  const showsFallbackOption =
    Boolean(value) && !(places.data ?? []).some((place) => place.ine_code === value);
  const currentPlace = usePlacesByIne(showsFallbackOption && value ? [value] : []);
  const currentLabel = placeLabelState(value, currentPlace);

  const describedBy = [hintId, places.isError ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-text-form">
        {t("label")}
      </label>
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label={t("searchLabel")}
        className="mb-2 w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
      />
      <select
        id={id}
        value={value ?? ""}
        aria-required="true"
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
      >
        {/* El valor ya guardado sigue seleccionable aunque la búsqueda
            actual no lo devuelva: si no, abrir el formulario y no buscar
            nada borraría la sede al guardar. Nunca una opción vacía: la
            sede es obligatoria (I5). */}
        {showsFallbackOption && value ? (
          <option value={value}>
            {currentLabel.kind === "loading"
              ? "…"
              : currentLabel.kind === "resolved"
                ? t("resolved", { name: currentLabel.name, province: currentLabel.province })
                : t("current", { ineCode: value })}
          </option>
        ) : null}
        {(places.data ?? []).map((place) => (
          <option key={place.ine_code} value={place.ine_code}>
            {t("option", { name: place.name, province: place.prov_name, ineCode: place.ine_code })}
          </option>
        ))}
      </select>
      {places.isError ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-error">
          {t("searchError")}
        </p>
      ) : null}
    </div>
  );
}
