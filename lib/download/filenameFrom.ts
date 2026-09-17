/**
 * Nombre de fichero de una cabecera `Content-Disposition`, compartido por
 * las dos descargas del panel (`hooks/useExport.ts`,
 * `hooks/useProgramReport.ts`), que antes llevaban cada una su propia
 * expresión regular de `filename="…"` — y ninguna de las dos entendía la
 * forma `filename*=UTF-8''…` (RFC 5987/6266), la única que puede llevar
 * acentos o eñes sin depender del juego de caracteres del servidor.
 *
 * Orden de preferencia, el que manda la RFC 6266 §4.3: `filename*`
 * primero (si se descodifica bien) y `filename` como reserva. Si no hay
 * ninguno utilizable, `fallback`.
 *
 * Recordatorio para quien lo depure: en el panel esta cabecera casi
 * siempre llega vacía. `pop/settings.py` no declara
 * `CORS_EXPOSE_HEADERS`, así que el navegador oculta
 * `Content-Disposition` a `fetch()` en una petición entre orígenes y se
 * acaba usando siempre `fallback` (ver CLAUDE.md, «Cierre del panel»).
 */
const EXTENDED = /filename\*=(?:([^']*)'([^']*)')?([^;]+)/i;
const PLAIN = /filename=("([^"]*)"|[^;]+)/i;

function plainFilename(header: string): string | undefined {
  const match = PLAIN.exec(header);
  if (!match) return undefined;
  const value = (match[2] ?? match[1]).trim();
  return value.length > 0 ? value : undefined;
}

function extendedFilename(header: string): string | undefined {
  const match = EXTENDED.exec(header);
  if (!match) return undefined;
  const raw = match[3].trim();
  if (raw.length === 0) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    // Porcentaje mal formado: quien llama cae al `filename` de reserva.
    return undefined;
  }
}

export function filenameFromContentDisposition(
  header: string | null | undefined,
  fallback: string,
): string {
  if (!header) return fallback;
  return extendedFilename(header) ?? plainFilename(header) ?? fallback;
}
