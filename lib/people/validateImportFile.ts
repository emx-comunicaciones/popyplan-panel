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

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

/** `null` si el fichero es válido; si no, el mensaje que mostrar en el formulario. */
export function validateImportFile(file: ValidatableImportFile): string | null {
  const extension = extensionOf(file.name);
  if (!IMPORT_ALLOWED_EXTENSIONS.includes(extension as ImportAllowedExtension)) {
    return "Tipo de fichero no permitido. Usa un .csv o un .xlsx.";
  }
  const maxBytes = IMPORT_MAX_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return `El fichero supera el límite de ${IMPORT_MAX_MB} MB.`;
  }
  return null;
}
