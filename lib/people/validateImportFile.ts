/**
 * Validación del fichero de importación de personas antes de subirlo
 * (`docs/PANEL.md` §3b.3, tarea W3b): el backend acepta `.csv`/`.xlsx`
 * (hasta 2000 filas de datos, validado allí); el límite de tamaño de 5 MB
 * es una cautela solo del cliente (evita subir un fichero enorme dos
 * veces — vista previa y confirmación — antes de que el backend lo
 * rechace por otro motivo), no está documentado como límite del backend.
 * Mismo patrón que `lib/resources/validateFile.ts`, dominio aparte.
 */

export const IMPORT_MAX_MB = 5;

export const IMPORT_ALLOWED_EXTENSIONS = ["csv", "xlsx"] as const;

export type ImportAllowedExtension = (typeof IMPORT_ALLOWED_EXTENSIONS)[number];

export interface ValidatableImportFile {
  name: string;
  size: number;
}

/**
 * Motivo por el que el fichero no es válido — este módulo es una función
 * pura, sin acceso a `useTranslations` (tarea 3 de i18n), así que ya no
 * devuelve el texto en español a mostrar: `components/people/
 * ImportPeopleDialog.tsx` traduce el `kind` con
 * `people.importDialog.errors.<kind>` (`fileTooLarge` interpola
 * `IMPORT_MAX_MB` como parámetro ICU `{max}`).
 */
export type ImportFileErrorKind = "tipo_no_permitido" | "demasiado_grande";

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

/** `null` si el fichero es válido; si no, el motivo por el que no lo es. */
export function validateImportFile(file: ValidatableImportFile): ImportFileErrorKind | null {
  const extension = extensionOf(file.name);
  if (!IMPORT_ALLOWED_EXTENSIONS.includes(extension as ImportAllowedExtension)) {
    return "tipo_no_permitido";
  }
  const maxBytes = IMPORT_MAX_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return "demasiado_grande";
  }
  return null;
}
