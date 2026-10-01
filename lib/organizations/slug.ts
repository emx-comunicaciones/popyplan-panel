/**
 * Identificador de la entidad en su dirección web (`Organization.slug`),
 * sacado del nombre: minúsculas, sin tildes, guiones entre palabras y como
 * mucho 80 caracteres (el `SlugField` del backend). «Asociación de
 * Adicciones de Errenteria» → «asociacion-de-adicciones-de-errenteria».
 */
export const SLUG_MAX_LENGTH = 80;

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * ¿Vale como slug? Lo mismo que acepta el `SlugField` de Django: letras
 * (también mayúsculas), números, guiones y guiones bajos, sin espacios.
 * `slugify` genera la forma canónica, pero a mano el backend admite más y el
 * panel no debe rechazar lo que él da por bueno.
 */
export function isValidSlug(value: string): boolean {
  return /^[-a-zA-Z0-9_]+$/.test(value) && value.length <= SLUG_MAX_LENGTH;
}
