/**
 * Patrones de `next.config.ts::images.remotePatterns` (hallazgo M3).
 *
 * Hasta ahora eran `hostname: "**"` en http y https: el optimizador de
 * imágenes de Next aceptaba **cualquier** host remoto, así que
 * `/_next/image?url=...` servía de proxy abierto a todo internet desde
 * nuestro dominio. Las únicas imágenes remotas del panel son las del
 * backend (el logo de cada entidad en las cabeceras de `/entidad/[slug]`
 * y `/paraguas/[slug]`, y la foto de `PersonSheet.tsx`, que sirve Django
 * o el almacenamiento de ficheros del despliegue), así que el patrón se
 * deriva de `NEXT_PUBLIC_API_URL`.
 *
 * Si el despliegue sirve los medios desde otro sitio (un CDN, un bucket
 * con dominio propio), se declara en `NEXT_PUBLIC_MEDIA_HOSTS`: lista de
 * hostnames separados por comas, siempre https. Ambas variables están
 * documentadas en `.env.example`.
 *
 * **No usa `lib/api/baseUrl.ts::apiBaseUrl()` a propósito**: esto se
 * evalúa al cargar `next.config.ts`, y `next build` corre con
 * `NODE_ENV=production` — `apiBaseUrl()` lanzaría y rompería la
 * construcción de un entorno que aún no tiene la variable (el valor real
 * lo pone el despliegue). Aquí, sin variable o con una URL ilegible, se
 * cae al backend local y punto.
 */
export interface ImageRemotePattern {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
}

/** Mismo backend local que `lib/api/baseUrl.ts` cuando no hay variable. */
const DEFAULT_PATTERN: ImageRemotePattern = {
  protocol: "http",
  hostname: "localhost",
  port: "8001",
};

function patternOf(apiUrl: string): ImageRemotePattern | null {
  try {
    const url = new URL(apiUrl);
    return {
      protocol: url.protocol === "https:" ? "https" : "http",
      hostname: url.hostname,
      port: url.port,
    };
  } catch {
    return null;
  }
}

function backendPattern(): ImageRemotePattern {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  return (configured ? patternOf(configured) : null) ?? { ...DEFAULT_PATTERN };
}

/**
 * Tolera que un host de la lista venga escrito como URL completa
 * (`https://cdn.example.com/media/`): se queda con el hostname.
 */
function hostnameOf(entry: string): string {
  return entry
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split("/")[0]
    .trim();
}

function mediaPatterns(): ImageRemotePattern[] {
  const raw = process.env.NEXT_PUBLIC_MEDIA_HOSTS?.trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map(hostnameOf)
    .filter((hostname) => hostname.length > 0)
    .map((hostname) => ({ protocol: "https" as const, hostname }));
}

export function imageRemotePatterns(): ImageRemotePattern[] {
  const byKey = new Map<string, ImageRemotePattern>();

  for (const pattern of [backendPattern(), ...mediaPatterns()]) {
    const key = `${pattern.protocol}|${pattern.hostname}|${pattern.port ?? ""}`;
    if (!byKey.has(key)) {
      byKey.set(key, pattern);
    }
  }

  return [...byKey.values()];
}
