/**
 * Lógica pura del formulario de plantillas de entrenamiento de Popyplan
 * (Nomencladores de plataforma, `docs/PANEL.md` §17.2 del backend): pasar
 * de la plantilla leída al estado del formulario, del formulario al cuerpo
 * de `POST/PATCH`, y qué campos por defecto tiene cada ejercicio según su
 * métrica.
 *
 * Todo en cadenas mientras se edita (lo que dan los `<input>`); los
 * números se convierten solo al construir el cuerpo. Los decimales
 * (`weight_kg`, `distance_km`) viajan como cadena con punto, igual que los
 * sirve el backend (`"60.00"`), y se acepta la coma decimal al teclear.
 */
import type {
  TrainingMetric,
  TrainingTemplate,
  TrainingTemplateItemWrite,
  TrainingTemplateWrite,
} from "@/lib/api/types";

export const TRAINING_METRICS: readonly TrainingMetric[] = ["weight_reps", "reps", "time", "distance"];

/** Valor por defecto de cada serie que se puede fijar en un ejercicio de plantilla. */
export type ItemValueField = "reps" | "weight_kg" | "seconds" | "distance_km";

/**
 * Qué valores por defecto tiene sentido fijar según la métrica — la misma
 * forma que una serie de un entreno (§17.1): `weight_reps` → repeticiones
 * y peso; `reps` → repeticiones; `time` → segundos; `distance` →
 * distancia y, opcional, segundos.
 */
export const METRIC_FIELDS: Record<TrainingMetric, readonly ItemValueField[]> = {
  weight_reps: ["reps", "weight_kg"],
  reps: ["reps"],
  time: ["seconds"],
  distance: ["distance_km", "seconds"],
};

export interface TemplateItemForm {
  /** Clave estable de React (no viaja al backend). */
  key: string;
  /** Id del ejercicio del catálogo como cadena, o `""` para un nombre libre. */
  exerciseId: string;
  /** Nombre libre (solo sin ejercicio). */
  name: string;
  /** Métrica del nombre libre; con ejercicio manda la del catálogo. */
  metric: TrainingMetric;
  sets: string;
  reps: string;
  weight_kg: string;
  seconds: string;
  distance_km: string;
}

export interface TemplateForm {
  name: string;
  name_eu: string;
  name_ca: string;
  description: string;
  /** Id de la disciplina como cadena, `""` sin elegir. */
  disciplineId: string;
  duration_minutes: string;
  distance_km: string;
  order: string;
  is_active: boolean;
  items: TemplateItemForm[];
}

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `item-${keySeq}`;
}

function text(value: number | string | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export function emptyItem(): TemplateItemForm {
  return {
    key: nextKey(),
    exerciseId: "",
    name: "",
    metric: "weight_reps",
    sets: "3",
    reps: "",
    weight_kg: "",
    seconds: "",
    distance_km: "",
  };
}

/** Estado inicial: vacío para una plantilla nueva, o el de la plantilla leída. */
export function templateToForm(template: TrainingTemplate | null): TemplateForm {
  if (!template) {
    return {
      name: "",
      name_eu: "",
      name_ca: "",
      description: "",
      disciplineId: "",
      duration_minutes: "",
      distance_km: "",
      order: "0",
      is_active: true,
      items: [],
    };
  }
  return {
    // Siempre los crudos: `name` sale traducido al idioma de la petición.
    name: template.name_es,
    name_eu: template.name_eu,
    name_ca: template.name_ca,
    description: template.description,
    disciplineId: String(template.discipline.id),
    duration_minutes: text(template.duration_minutes),
    distance_km: text(template.distance_km),
    order: String(template.order),
    is_active: template.is_active,
    items: template.items.map((item) => ({
      key: nextKey(),
      exerciseId: text(item.exercise_id),
      name: item.name ?? "",
      metric: item.metric ?? "weight_reps",
      sets: String(item.sets),
      reps: text(item.reps),
      weight_kg: text(item.weight_kg),
      seconds: text(item.seconds),
      distance_km: text(item.distance_km),
    })),
  };
}

/**
 * Al cambiar la disciplina, los ejercicios del catálogo de la anterior ya
 * no valen (el backend exige que cada ejercicio sea de la disciplina, 400).
 * En vez de borrarlos, pasan a nombre libre con su nombre y su métrica: no
 * se pierde nada y se pueden volver a elegir del catálogo nuevo.
 */
export function detachExercises(
  items: TemplateItemForm[],
  catalog: ReadonlyMap<string, { name: string; metric: TrainingMetric }>,
): TemplateItemForm[] {
  return items.map((item) => {
    if (!item.exerciseId) return item;
    const exercise = catalog.get(item.exerciseId);
    return {
      ...item,
      exerciseId: "",
      name: exercise?.name ?? item.name,
      metric: exercise?.metric ?? item.metric,
    };
  });
}

/** Mueve el ejercicio `index` una posición (`-1` arriba, `+1` abajo). */
export function moveItem(items: TemplateItemForm[], index: number, delta: -1 | 1): TemplateItemForm[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function integer(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function decimal(value: string): string | null | undefined {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? trimmed : undefined;
}

/** Códigos de error del formulario; los traduce el componente. */
export type TemplateFormError =
  | "nameRequired"
  | "disciplineRequired"
  | "invalidNumber"
  | "itemNameRequired"
  | "itemSetsRange";

/** Primer problema del formulario, o `null` si se puede enviar. */
export function validateTemplateForm(form: TemplateForm): TemplateFormError | null {
  if (!form.name.trim()) return "nameRequired";
  if (!form.disciplineId) return "disciplineRequired";
  if (Number.isNaN(integer(form.duration_minutes)) || Number.isNaN(integer(form.order))) return "invalidNumber";
  if (decimal(form.distance_km) === undefined) return "invalidNumber";
  for (const item of form.items) {
    if (!item.exerciseId && !item.name.trim()) return "itemNameRequired";
    const sets = integer(item.sets);
    if (sets === null || Number.isNaN(sets) || sets < 1 || sets > 50) return "itemSetsRange";
    if (Number.isNaN(integer(item.reps)) || Number.isNaN(integer(item.seconds))) return "invalidNumber";
    if (decimal(item.weight_kg) === undefined || decimal(item.distance_km) === undefined) return "invalidNumber";
  }
  return null;
}

function itemToWrite(item: TemplateItemForm, metric: TrainingMetric): TrainingTemplateItemWrite {
  const fields = METRIC_FIELDS[metric];
  // Solo los valores de la métrica: un peso tecleado y luego pasado a
  // «tiempo» no debe colarse en la plantilla.
  const body: TrainingTemplateItemWrite = {
    exercise_id: item.exerciseId ? Number(item.exerciseId) : null,
    sets: integer(item.sets) ?? 3,
    reps: fields.includes("reps") ? integer(item.reps) : null,
    weight_kg: fields.includes("weight_kg") ? (decimal(item.weight_kg) ?? null) : null,
    seconds: fields.includes("seconds") ? integer(item.seconds) : null,
    distance_km: fields.includes("distance_km") ? (decimal(item.distance_km) ?? null) : null,
  };
  if (!item.exerciseId) {
    body.name = item.name.trim();
    body.metric = item.metric;
  }
  return body;
}

/**
 * Cuerpo de `POST` (`original === null`, con `system: true`) o `PATCH`.
 * `metricOf` resuelve la métrica de un ejercicio del catálogo por su id
 * (la de un nombre libre es la del propio formulario). Llamar solo con un
 * formulario válido (`validateTemplateForm`).
 */
export function formToWrite(
  form: TemplateForm,
  original: TrainingTemplate | null,
  metricOf: (exerciseId: string) => TrainingMetric | undefined,
): TrainingTemplateWrite {
  const body: TrainingTemplateWrite = {
    name: form.name.trim(),
    name_eu: form.name_eu.trim(),
    name_ca: form.name_ca.trim(),
    description: form.description.trim(),
    duration_minutes: integer(form.duration_minutes),
    distance_km: decimal(form.distance_km) ?? null,
    order: integer(form.order) ?? 0,
    is_active: form.is_active,
    items: form.items.map((item) =>
      itemToWrite(item, item.exerciseId ? (metricOf(item.exerciseId) ?? item.metric) : item.metric),
    ),
  };
  const disciplineId = Number(form.disciplineId);
  if (original === null) {
    body.discipline_id = disciplineId;
    body.system = true;
  } else if (original.discipline.id !== disciplineId) {
    body.discipline_id = disciplineId;
  }
  return body;
}
