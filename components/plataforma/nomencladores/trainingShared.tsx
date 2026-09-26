"use client";

/**
 * Piezas comunes de los tres catálogos de entrenamiento de Nomencladores
 * (disciplinas, ejercicios y plantillas de Popyplan): clases de los
 * campos, mapas de etiquetas de los valores del contrato y los tres
 * campos de nombre traducible.
 *
 * Nombres: se editan **siempre** los crudos (`name_es`/`name_eu`/
 * `name_ca`) y se escribe `name` (castellano), `name_eu` y `name_ca`
 * (`docs/PANEL.md` §17 del backend). `name` sale traducido al idioma de la
 * interfaz: leerlo y guardarlo pisaría el castellano.
 */
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import type { TrainingCatalogErrorKind } from "@/hooks/useTrainingCatalog";
import type { TrainingDisciplineKind, TrainingMetric, TrainingMuscleGroup } from "@/lib/api/types";

export const FIELD = "w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700";
export const LABEL = "mb-1 block text-sm font-medium text-text-form";

export const TRAINING_ERROR_KEYS: Record<TrainingCatalogErrorKind, string> = {
  invalido: "errors.trainingCatalog.invalido",
  sin_acceso: "errors.trainingCatalog.sinAcceso",
  no_encontrado: "errors.trainingCatalog.noEncontrado",
  en_uso: "errors.trainingCatalog.enUso",
  demasiadas_paginas: "errors.trainingCatalog.demasiadasPaginas",
  desconocido: "errors.trainingCatalog.desconocido",
};

export const TRAINING_ERROR_FALLBACK = "errors.trainingCatalog.desconocido";

export const DISCIPLINE_KINDS: readonly TrainingDisciplineKind[] = ["strength", "endurance", "route"];

export const KIND_LABEL_KEYS: Record<TrainingDisciplineKind, string> = {
  strength: "plataforma.nomencladores.training.kinds.strength",
  endurance: "plataforma.nomencladores.training.kinds.endurance",
  route: "plataforma.nomencladores.training.kinds.route",
};

export const METRIC_LABEL_KEYS: Record<TrainingMetric, string> = {
  weight_reps: "plataforma.nomencladores.training.metrics.weightReps",
  reps: "plataforma.nomencladores.training.metrics.reps",
  time: "plataforma.nomencladores.training.metrics.time",
  distance: "plataforma.nomencladores.training.metrics.distance",
};

export const MUSCLE_GROUPS: readonly TrainingMuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "legs",
  "glutes",
  "core",
  "full_body",
  "cardio",
];

export const MUSCLE_LABEL_KEYS: Record<TrainingMuscleGroup, string> = {
  chest: "plataforma.nomencladores.training.muscleGroups.chest",
  back: "plataforma.nomencladores.training.muscleGroups.back",
  shoulders: "plataforma.nomencladores.training.muscleGroups.shoulders",
  biceps: "plataforma.nomencladores.training.muscleGroups.biceps",
  triceps: "plataforma.nomencladores.training.muscleGroups.triceps",
  legs: "plataforma.nomencladores.training.muscleGroups.legs",
  glutes: "plataforma.nomencladores.training.muscleGroups.glutes",
  core: "plataforma.nomencladores.training.muscleGroups.core",
  full_body: "plataforma.nomencladores.training.muscleGroups.fullBody",
  cardio: "plataforma.nomencladores.training.muscleGroups.cardio",
};

/** Etiqueta traducida de un valor del contrato, con reserva al valor crudo si el backend añade uno. */
export function labelFor(keys: Record<string, string>, value: string, t: (key: string) => string): string {
  return keys[value] ? t(keys[value]) : value;
}

export interface NameValues {
  name: string;
  name_eu: string;
  name_ca: string;
}

/** Los tres nombres traducibles (castellano obligatorio). */
export function NameFields({
  idPrefix,
  values,
  onChange,
}: {
  idPrefix: string;
  values: NameValues;
  onChange: (field: keyof NameValues, value: string) => void;
}) {
  const t = useTranslations("plataforma.nomencladores.training.fields");
  const fields: { field: keyof NameValues; label: string }[] = [
    { field: "name", label: t("nameEs") },
    { field: "name_eu", label: t("nameEu") },
    { field: "name_ca", label: t("nameCa") },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {fields.map(({ field, label }) => (
        <div key={field}>
          <label htmlFor={`${idPrefix}-${field}`} className={LABEL}>
            {label}
          </label>
          <input
            id={`${idPrefix}-${field}`}
            type="text"
            maxLength={100}
            value={values[field]}
            onChange={(event) => onChange(field, event.target.value)}
            className={FIELD}
          />
        </div>
      ))}
    </div>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  const t = useTranslations("plataforma.nomencladores");
  return <Badge tone={active ? "success" : "neutral"}>{active ? t("activeBadge") : t("inactiveBadge")}</Badge>;
}

/** Entero ≥ 0 de un `<input type="number">`; `fallback` si está vacío o no es válido. */
export function toInt(value: string, fallback: number): number {
  const parsed = Number(value.trim());
  return value.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
