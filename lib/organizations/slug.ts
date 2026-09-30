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

/** ¿Vale como slug? Letras minúsculas, números y guiones, sin espacios. */
export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= SLUG_MAX_LENGTH;
}
