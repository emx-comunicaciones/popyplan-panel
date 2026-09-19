/**
 * Validación del fichero de un recurso antes de subirlo (`docs/PANEL.md`
 * §7.3): límite de tamaño (`settings.RESOURCE_MAX_MB`, 20 MB) y extensión
 * permitida (`settings.RESOURCE_ALLOWED_TYPES`: `pdf`, `mp4`, `mp3`,
 * `docx`, `png`, `jpg`), mismo criterio que
 * `panel.services.resources.validate_file` en el backend (que rechaza
 * antes de persistir, con 400). Validar aquí primero evita subir un
 * fichero entero para que el backend lo rechace igual, y da el aviso al
 * instante en el formulario de `components/entidad/RecursosPanel.tsx`.
 *
 * **i18n (tarea 4 del plan de i18n):** `validateResourceFile` devuelve un
 * `ResourceFileErrorKind` (o `null` si el fichero es válido) en vez del
 * mensaje ya construido — mismo criterio que
 * `lib/people/validateImportFile.ts::validateImportFile` (tarea 3): este
 * módulo es `.ts` plano, no puede llamar a `t()`. `RecursosPanel.tsx`
 * traduce el `kind` con los propios `RESOURCE_ALLOWED_EXTENSIONS`/
 * `RESOURCE_MAX_MB` como parámetros ICU (`{extensions}`/`{max}`), en vez
 * de que este módulo construya la lista a mano.
 */

export const RESOURCE_MAX_MB = 20;

export const RESOURCE_ALLOWED_EXTENSIONS = ["pdf", "mp4", "mp3", "docx", "png", "jpg"] as const;

export type ResourceAllowedExtension = (typeof RESOURCE_ALLOWED_EXTENSIONS)[number];

export type ResourceFileErrorKind = "tipo_no_permitido" | "demasiado_grande";

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

/** `null` si el fichero es válido; si no, el motivo (`ResourceFileErrorKind`). */
export function validateResourceFile(file: ValidatableFile): ResourceFileErrorKind | null {
  const extension = extensionOf(file.name);
  if (!RESOURCE_ALLOWED_EXTENSIONS.includes(extension as ResourceAllowedExtension)) {
    return "tipo_no_permitido";
  }
  const maxBytes = RESOURCE_MAX_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return "demasiado_grande";
  }
  return null;
}
