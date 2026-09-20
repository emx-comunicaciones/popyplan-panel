"use client";

/**
 * Nivel administrativo y territorio declarado de una administración
 * (spec de diseño `2026-09-19-territorio-administraciones-design.md`
 * §2.1 y §4.3). Solo lo monta `EntidadDetail` cuando el rol de
 * plataforma es `superadmin` **y** la organización es una
 * administración: §2.3 dice que una administración no se autoasigna
 * territorio, y §2.1 que `admin_level` va en blanco en todo lo demás.
 * Con cualquier otro rol de plataforma, `EntidadDetail` pinta los mismos
 * datos en solo lectura dentro de su propia `<dl>` (decisión del
 * coordinador del bloque: «visible en solo lectura, nunca oculto sin
 * más»), reutilizando `ADMIN_LEVEL_LABEL_KEYS`/`TERRITORY_KIND_LABEL_KEYS`
 * de aquí para no duplicar el mapa.
 *
 * **Vista previa «N municipios»** (§4.3): con `municipios` se cuentan
 * los códigos escritos, que es exacto y no toca la red; con uno de los
 * tres atajos se pide el total al backend
 * (`hooks/usePlaces.ts::usePlacesCount`, que filtra `GET /api/places/`
 * por `ccaa_code`/`prov_code`/`comarca_code` y se queda con el `count`
 * de la respuesta paginada), **con retardo** — el código se teclea
 * carácter a carácter y sin `useDebouncedValue` cada tecla sería una
 * petición, igual que en `EntidadesTable`/`SedeSelector`. Mientras no
 * haya código escrito, o justo después de guardar, se muestra el
 * `territory_places_count` **guardado**, que el backend recalcula al
 * expandir el `OrgScope` (§2.2).
 */
import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { OrganizationsErrorKind } from "@/hooks/useOrganizations";
import { usePlacesCount } from "@/hooks/usePlaces";
import {
  useSetOrganizationTerritory,
  type SetOrganizationTerritoryInput,
} from "@/hooks/useSetOrganizationTerritory";
import type { AdminLevel, Organization, TerritoryKind } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

export const ADMIN_LEVEL_LABEL_KEYS: Record<AdminLevel, string> = {
  "": "plataforma.territorio.adminLevelNone",
  ayuntamiento: "plataforma.territorio.adminLevelAyuntamiento",
  mancomunidad: "plataforma.territorio.adminLevelMancomunidad",
  diputacion: "plataforma.territorio.adminLevelDiputacion",
  gobierno: "plataforma.territorio.adminLevelGobierno",
};

export const TERRITORY_KIND_LABEL_KEYS: Record<TerritoryKind, string> = {
  "": "plataforma.territorio.kindNone",
  ccaa: "plataforma.territorio.kindCcaa",
  provincia: "plataforma.territorio.kindProvincia",
  comarca: "plataforma.territorio.kindComarca",
  municipios: "plataforma.territorio.kindMunicipios",
};

const TERRITORY_ERROR_KEYS: Record<OrganizationsErrorKind, string> = {
  invalido: "errors.setOrganizationTerritory.invalido",
  sin_permiso: "errors.setOrganizationTerritory.sinPermiso",
  desconocido: "errors.setOrganizationTerritory.desconocido",
};

export interface TerritorioFormProps {
  organization: Organization;
  /**
   * Id de la organización tal cual lo recibe `EntidadDetail` (el
   * parámetro de ruta del Server Component, casi siempre un `string`) —
   * **nunca** `organization.id` (un `number` del cuerpo de la API).
   * `useOrganization`/`DatosTab` cachean la ficha con este mismo valor;
   * pasarle a `useSetOrganizationTerritory` el `id` numérico en su lugar
   * hacía que la invalidación tras guardar nunca encontrara esa entrada
   * de caché, y la ficha se quedaba obsoleta hasta recargar a mano (fix
   * round 1, misma clase de bug que `useProgram`/`useAssignReferent`
   * documentada en `CLAUDE.md`).
   */
  orgId: string | number;
}

/** Códigos INE no vacíos de una lista separada por comas. */
export function countMunicipios(code: string): number {
  return code
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

export function TerritorioForm({ organization, orgId }: TerritorioFormProps) {
  const t = useTranslations();
  const save = useSetOrganizationTerritory(orgId);
  const levelId = useId();
  const kindId = useId();
  const codeId = useId();

  const [form, setForm] = useState<SetOrganizationTerritoryInput>({
    admin_level: organization.admin_level ?? "",
    territory_kind: organization.territory_kind ?? "",
    territory_code: organization.territory_code ?? "",
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate(form);
  }

  // El código se teclea, así que la cuenta va con retardo; `usePlacesCount`
  // además se deshabilita sola con «municipios», sin atajo o sin código.
  const debouncedCode = useDebouncedValue(form.territory_code);
  const placesCount = usePlacesCount(form.territory_kind, debouncedCode);

  const preview = previewText();

  function previewText(): string {
    if (form.territory_kind === "municipios") {
      return t("plataforma.territorio.previewTyped", {
        count: countMunicipios(form.territory_code),
      });
    }
    if (form.territory_kind === "" || debouncedCode.trim().length === 0) {
      return t("plataforma.territorio.previewSaved", {
        count: organization.territory_places_count ?? 0,
      });
    }
    if (placesCount.isError) return t("plataforma.territorio.previewError");
    if (placesCount.data === undefined) return t("plataforma.territorio.previewLoading");
    return t("plataforma.territorio.previewFilter", { count: placesCount.data });
  }

  return (
    <Card title={t("plataforma.territorio.cardTitle")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor={levelId} className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.territorio.adminLevelLabel")}
          </label>
          <select
            id={levelId}
            value={form.admin_level}
            onChange={(event) =>
              setForm({ ...form, admin_level: event.target.value as AdminLevel })
            }
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            {(Object.keys(ADMIN_LEVEL_LABEL_KEYS) as AdminLevel[]).map((level) => (
              <option key={level} value={level}>
                {t(ADMIN_LEVEL_LABEL_KEYS[level])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={kindId} className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.territorio.kindLabel")}
          </label>
          <select
            id={kindId}
            value={form.territory_kind}
            onChange={(event) =>
              setForm({ ...form, territory_kind: event.target.value as TerritoryKind })
            }
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            {(Object.keys(TERRITORY_KIND_LABEL_KEYS) as TerritoryKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {t(TERRITORY_KIND_LABEL_KEYS[kind])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={codeId} className="mb-1 block text-sm font-medium text-text-form">
            {form.territory_kind === "municipios"
              ? t("plataforma.territorio.codeLabelMunicipios")
              : t("plataforma.territorio.codeLabelShortcut")}
          </label>
          <input
            id={codeId}
            type="text"
            value={form.territory_code}
            onChange={(event) => setForm({ ...form, territory_code: event.target.value })}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <p className="text-sm text-text-secondary">{preview}</p>
        <div>
          <Button type="submit" disabled={save.isPending}>
            {t("common.save")}
          </Button>
        </div>
        {save.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(save.error, TERRITORY_ERROR_KEYS, t, "errors.setOrganizationTerritory.desconocido")}
          </p>
        ) : null}
        {save.isSuccess ? (
          <p className="text-sm text-success">{t("plataforma.entidadFicha.saved")}</p>
        ) : null}
      </form>
    </Card>
  );
}
