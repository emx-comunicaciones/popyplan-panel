/**
 * Campos de una actividad que antes solo ofrecía la app (petición del
 * propietario, 2026-10-07: «también en el panel»): categoría (del
 * catálogo o escrita a mano), coste por persona, edades y, en un viaje,
 * fechas por días y paradas. Contrato en `docs/PANEL.md` §17.6c-e del
 * backend (`events/serializers.py::EventCreateSerializer`); mismo criterio
 * que `popyplan-mobile/app/_containers/events/NewEvent/createEventPayload.ts`
 * y `app/_utils/trips.ts`.
 *
 * Funciones puras: las validaciones devuelven la **clave** de traducción
 * (o `null`) y `ActividadForm.tsx` la traduce, igual que
 * `lib/events/validation.ts`.
 */
import { eurosToCents } from "@/lib/programs/money";

/** Valor del `<select>` de categoría para «Otra (escríbela tú)»: `category: null` + `custom_category`. */
export const OTHER_CATEGORY = "other";
/** `category_type` de las categorías de viaje (`events/models.py::TRAVEL_CATEGORY_TYPE`). */
export const TRAVEL_CATEGORY_TYPE = "travel";

/** Topes del backend (`events/models.py`). */
export const CUSTOM_CATEGORY_MAX_LENGTH = 60;
export const MIN_AGE = 18;
export const MAX_AGE = 120;
export const MAX_STOPS = 30;
export const STOP_NAME_MAX_LENGTH = 120;
export const STOP_ADDRESS_MAX_LENGTH = 200;
/** `estimated_cost` es `DecimalField(max_digits=8, decimal_places=2)`. */
const COST_INTEGER_DIGITS = 6;

export const EVENT_CUSTOM_CATEGORY_ERROR_KEY = "entidad.actividadForm.errors.customCategory";
export const EVENT_COST_INVALID_ERROR_KEY = "entidad.actividadForm.errors.costInvalid";
export const EVENT_AGE_MIN_INVALID_ERROR_KEY = "entidad.actividadForm.errors.ageMinInvalid";
export const EVENT_AGE_MAX_INVALID_ERROR_KEY = "entidad.actividadForm.errors.ageMaxInvalid";
export const EVENT_AGES_ORDER_ERROR_KEY = "entidad.actividadForm.errors.agesOrder";
export const EVENT_TRIP_END_REQUIRED_ERROR_KEY = "entidad.actividadForm.errors.tripEndRequired";
export const EVENT_STOP_NAME_ERROR_KEY = "entidad.actividadForm.errors.stopName";

// ─── Categoría ──────────────────────────────────────────────────────────────

/** Como la guarda el backend (`validate_custom_category`): recortada y con un solo espacio. */
export function normalizeCustomCategory(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(" ");
}

/**
 * Con «Otra» hay que escribirla; con una del catálogo es una etiqueta
 * opcional («Deporte» + «Pádel»). Nunca más de 60 caracteres.
 */
export function validateCustomCategory(category: string, text: string): string | null {
  const normalized = normalizeCustomCategory(text);
  if (category === OTHER_CATEGORY && !normalized) return EVENT_CUSTOM_CATEGORY_ERROR_KEY;
  return normalized.length > CUSTOM_CATEGORY_MAX_LENGTH ? EVENT_CUSTOM_CATEGORY_ERROR_KEY : null;
}

/** Valor del `<select>` → `category` del backend (id entero, o `null` para «ninguna» y «Otra»). */
export function categoryToApi(category: string): number | null {
  if (!category || category === OTHER_CATEGORY) return null;
  return Number(category);
}

// ─── Coste ──────────────────────────────────────────────────────────────────

const COST_PATTERN = new RegExp(`^\\d{1,${COST_INTEGER_DIGITS}}([.,]\\d{1,2})?$`);

/** Con coste: un importe mayor que 0, con 2 decimales y 6 cifras enteras como mucho. */
export function validateEventCost(hasCost: boolean, text: string): string | null {
  if (!hasCost) return null;
  const trimmed = text.trim();
  if (!COST_PATTERN.test(trimmed)) return EVENT_COST_INVALID_ERROR_KEY;
  return eurosToCents(trimmed) > 0 ? null : EVENT_COST_INVALID_ERROR_KEY;
}

/** `"12,5"` → `"12.50"` (la cadena de un `DecimalField`); `null` = gratis. */
export function costToApi(hasCost: boolean, text: string): string | null {
  if (validateEventCost(hasCost, text) !== null || !hasCost) return null;
  return (eurosToCents(text) / 100).toFixed(2);
}

/** Coste guardado → estado del formulario; `0` o vacío es «sin coste», como en la app. */
export function costFromApi(cost: string | null | undefined): { hasCost: boolean; text: string } {
  if (!cost || !(Number(cost) > 0)) return { hasCost: false, text: "" };
  return { hasCost: true, text: cost };
}

// ─── Edades ─────────────────────────────────────────────────────────────────

function ageValid(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (!/^\d+$/.test(trimmed)) return false;
  const age = Number(trimmed);
  return age >= MIN_AGE && age <= MAX_AGE;
}

/** Vacías = sin límite. Si no, enteras entre 18 y 120 y la mínima ≤ la máxima. */
export function validateEventAges(minText: string, maxText: string): string | null {
  if (!ageValid(minText)) return EVENT_AGE_MIN_INVALID_ERROR_KEY;
  if (!ageValid(maxText)) return EVENT_AGE_MAX_INVALID_ERROR_KEY;
  const min = ageToApi(minText);
  const max = ageToApi(maxText);
  return min !== null && max !== null && min > max ? EVENT_AGES_ORDER_ERROR_KEY : null;
}

export function ageToApi(text: string): number | null {
  const trimmed = text.trim();
  return trimmed ? Number(trimmed) : null;
}

// ─── Fechas de un viaje ─────────────────────────────────────────────────────

/** `"YYYY-MM-DD"` de un `<input type="date">` → ese día local a esa hora, o `null` si no existe. */
function dayAt(day: string, hours: number, minutes: number, seconds: number): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const [year, month, date] = match.slice(1).map(Number);
  const result = new Date(year, month - 1, date, hours, minutes, seconds, 0);
  const real =
    result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === date;
  return real ? result : null;
}

/** `starts_at` de un viaje: el día de inicio a las 00:00 locales (`""` si no hay día). */
export function tripStartIso(day: string): string {
  return dayAt(day, 0, 0, 0)?.toISOString() ?? "";
}

/** `ends_at` de un viaje: el día final a las 23:59:59 locales (`""` si no hay día). */
export function tripEndIso(day: string): string {
  return dayAt(day, 23, 59, 59)?.toISOString() ?? "";
}

/** ISO guardado → `"YYYY-MM-DD"` en hora local, para un `<input type="date">`. */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

/** Un viaje necesita día final (`_validar_viaje`: «Un viaje necesita un día final.»). */
export function validateTripEnd(isTrip: boolean, endDay: string): string | null {
  return isTrip && !endDay ? EVENT_TRIP_END_REQUIRED_ERROR_KEY : null;
}

// ─── Paradas ────────────────────────────────────────────────────────────────

/**
 * Una parada en el formulario. Las coordenadas no se editan en el panel
 * (no hay buscador de direcciones): se conservan tal cual llegaron para
 * no borrar las que puso la app, porque la lista que se manda
 * **sustituye** a la guardada (`events/services.py::set_stops`).
 */
export interface StopDraft {
  /** Clave estable para React (el `id` si ya existe). */
  key: string;
  id?: string;
  name: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
}

export interface StopFromApi {
  id: string;
  name: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
}

export function stopsFromApi(stops: readonly StopFromApi[] | null | undefined): StopDraft[] {
  return (stops ?? []).map((stop) => ({
    key: stop.id,
    id: stop.id,
    name: stop.name,
    address: stop.address,
    latitude: stop.latitude,
    longitude: stop.longitude,
  }));
}

export interface StopToApi {
  id?: string;
  name: string;
  address: string;
  latitude?: string;
  longitude?: string;
}

/** En orden; con su `id` para conservar la parada (y sus gastos) y sus coordenadas si las tenía. */
export function stopsToApi(stops: readonly StopDraft[]): StopToApi[] {
  return stops.map((stop) => {
    const body: StopToApi = { name: stop.name.trim(), address: stop.address.trim() };
    if (stop.id) body.id = stop.id;
    if (stop.latitude !== null && stop.longitude !== null) {
      body.latitude = stop.latitude;
      body.longitude = stop.longitude;
    }
    return body;
  });
}

/** Cada parada con nombre (máx. 120) y dirección de 200 como mucho. */
export function validateStops(stops: readonly StopDraft[]): string | null {
  const invalid = stops.some((stop) => {
    const name = stop.name.trim();
    return !name || name.length > STOP_NAME_MAX_LENGTH || stop.address.trim().length > STOP_ADDRESS_MAX_LENGTH;
  });
  return invalid ? EVENT_STOP_NAME_ERROR_KEY : null;
}

/** Sube (`-1`) o baja (`1`) la parada `index`; fuera de los límites devuelve la misma lista. */
export function moveStop(stops: StopDraft[], index: number, delta: -1 | 1): StopDraft[] {
  const target = index + delta;
  if (target < 0 || target >= stops.length) return stops;
  const next = [...stops];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
