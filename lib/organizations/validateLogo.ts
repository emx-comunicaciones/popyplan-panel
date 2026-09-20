/**
 * Validación del logo de una entidad antes de subirlo por
 * `PATCH /api/organizations/{id}/` (`multipart/form-data`, campo `logo`;
 * `entities/models.py::Organization.logo` es un `ImageField`, así que el
 * backend rechaza con 400 cualquier cosa que Pillow no abra como imagen —
 * un SVG incluido). Validar aquí primero evita subir el fichero entero
 * para que el backend lo rechace igual, y da el aviso al instante en
 * `components/entidad/ConfiguracionPanel.tsx`. El backend no impone un
 * tamaño máximo propio al logo: los 2 MB son un límite del panel, porque
 * el logo se pinta a 28 px en la cabecera y a 64 px en Configuración.
 *
 * Mismo patrón que `lib/resources/validateFile.ts`: devuelve un `kind`
 * corto (o `null` si el fichero vale), y quien llama traduce.
 */
import { extensionOf, type ValidatableFile } from "@/lib/resources/validateFile";

export const LOGO_MAX_MB = 2;

export const LOGO_ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

export type LogoFileErrorKind = "tipo_no_permitido" | "demasiado_grande";

export function validateLogoFile(file: ValidatableFile): LogoFileErrorKind | null {
  const extension = extensionOf(file.name);
  if (!(LOGO_ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    return "tipo_no_permitido";
  }
  if (file.size > LOGO_MAX_MB * 1024 * 1024) {
    return "demasiado_grande";
  }
  return null;
}
