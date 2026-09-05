/**
 * Validación del fichero de un recurso antes de subirlo (`docs/PANEL.md`
 * §7.3): límite de tamaño (`settings.RESOURCE_MAX_MB`, 20 MB) y extensión
 * permitida (`settings.RESOURCE_ALLOWED_TYPES`: `pdf`, `mp4`, `mp3`,
 * `docx`, `png`, `jpg`), mismo criterio que
 * `panel.services.resources.validate_file` en el backend (que rechaza
 * antes de persistir, con 400). Validar aquí primero evita subir un
 * fichero entero para que el backend lo rechace igual, y da el aviso al
 * instante en el formulario de `components/entidad/RecursosPanel.tsx`.
 */

export const RESOURCE_MAX_MB = 20;

export const RESOURCE_ALLOWED_EXTENSIONS = ["pdf", "mp4", "mp3", "docx", "png", "jpg"] as const;

export type ResourceAllowedExtension = (typeof RESOURCE_ALLOWED_EXTENSIONS)[number];

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

/** Fichero mínimo que necesita la validación (encaja con `File` del navegador). */
export interface ValidatableFile {
  name: string;
  size: number;
}

/** `null` si el fichero es válido; si no, el mensaje que mostrar en el formulario. */
export function validateResourceFile(file: ValidatableFile): string | null {
  const extension = extensionOf(file.name);
  if (!RESOURCE_ALLOWED_EXTENSIONS.includes(extension as ResourceAllowedExtension)) {
    return `Tipo de fichero no permitido. Usa uno de: ${RESOURCE_ALLOWED_EXTENSIONS.join(", ")}.`;
  }
  const maxBytes = RESOURCE_MAX_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return `El fichero supera el límite de ${RESOURCE_MAX_MB} MB.`;
  }
  return null;
}
