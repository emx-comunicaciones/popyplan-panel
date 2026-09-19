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
 */
import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSearchPlaces } from "@/hooks/usePlaces";

export interface SedeSelectorProps {
  id: string;
  /** Código INE ya guardado, o `null`. */
  value: string | null;
  onChange: (ineCode: string | null) => void;
}

export function SedeSelector({ id, value, onChange }: SedeSelectorProps) {
  const t = useTranslations("plataforma.sede");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const places = useSearchPlaces(debouncedSearch);
  const errorId = useId();

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
        className="mb-2 w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
      />
      <select
        id={id}
        value={value ?? ""}
        aria-describedby={places.isError ? errorId : undefined}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
      >
        <option value="">{t("none")}</option>
        {/* El valor ya guardado sigue seleccionable aunque la búsqueda
            actual no lo devuelva: si no, abrir el formulario y no buscar
            nada borraría la sede al guardar. */}
        {value && !(places.data ?? []).some((place) => place.ine_code === value) ? (
          <option value={value}>{t("current", { ineCode: value })}</option>
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
