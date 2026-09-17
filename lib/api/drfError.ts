/**
 * Lectura del cuerpo de error de DRF, compartida por todas las mutaciones
 * del panel. Hasta ahora cada hook llevaba su propia copia de `detailOf`,
 * y no todas cubrían lo mismo: unas solo miraban `detail` (así que un 400
 * por campo caía al mensaje genérico y la persona no sabía qué corregir),
 * otras `detail` + `error`, y solo `useProgramMutations.ts`/`useBilling.ts`
 * recorrían los errores por campo. Este módulo unifica las tres formas.
 *
 * Formas que devuelve el backend (`serializer.is_valid(raise_exception=True)`
 * y las excepciones propias de cada vista):
 *
 * 1. `{"detail": "Un programa cerrado no se modifica."}` — errores
 *    globales, 403 de permiso y 409 de transición.
 * 2. `{"error": "..."}` — unas pocas vistas (recursos, comunidades,
 *    moderación) que no usan `detail`.
 * 3. `{"campo": ["mensaje", ...]}` — el 400 estándar de DRF, un array de
 *    mensajes por campo; `non_field_errors` es un campo más.
 *
 * `detailOf` devuelve **un** mensaje para pintar en el aviso del
 * formulario (el primero que encuentre, en ese orden de preferencia);
 * `fieldErrorsOf` devuelve el mapa completo campo → primer mensaje, por
 * si un formulario quiere pintar el error junto a cada control.
 */
import type { ApiError } from "@/lib/api/client";

function bodyObjectOf(error: ApiError): Record<string, unknown> | undefined {
  const body = error.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  return body as Record<string, unknown>;
}

function stringOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

/**
 * El mensaje del backend para este error, o `undefined` si el cuerpo no
 * trae ninguno reconocible (quien llama cae entonces a su mensaje
 * genérico).
 */
export function detailOf(error: ApiError): string | undefined {
  const body = bodyObjectOf(error);
  if (!body) return undefined;
  if (typeof body.detail === "string") return body.detail;
  if (typeof body.error === "string") return body.error;
  for (const value of Object.values(body)) {
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return undefined;
}

/**
 * Mapa campo → primer mensaje, para pintar el error junto a cada control.
 * Incluye `detail`/`error` con su propia clave cuando vienen sueltos: no
 * hay forma de saber desde aquí si son de un campo o globales, y quien
 * pinte por campo ya sabe qué claves son suyas.
 */
export function fieldErrorsOf(error: ApiError): Record<string, string> {
  const body = bodyObjectOf(error);
  if (!body) return {};
  const fields: Record<string, string> = {};
  for (const [field, value] of Object.entries(body)) {
    const message = stringOf(value);
    if (message !== undefined) fields[field] = message;
  }
  return fields;
}
