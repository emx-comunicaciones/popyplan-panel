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
 * formulario (el primero que encuentre, en ese orden de preferencia). Es
 * la única función del módulo: hubo un `fieldErrorsOf` (mapa completo
 * campo → primer mensaje, para pintar el error junto a cada control) que
 * nunca llegó a tener consumidor y se borró en vez de dejarlo como código
 * muerto cubierto por sus propios tests; quien necesite el desglose por
 * campo lo reintroduce con el formulario que lo use.
 */
import type { ApiError } from "@/lib/api/client";

function bodyObjectOf(error: ApiError): Record<string, unknown> | undefined {
  const body = error.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  return body as Record<string, unknown>;
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
