/**
 * Configuración pública de la web de presentación (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §3.4 y §8).
 *
 * Mismo patrón que `lib/api/baseUrl.ts` (hallazgo B9): cada variable se
 * lee **dentro** de la función que la necesita, nunca a nivel de módulo
 * — un valor congelado al importar rompería `next build` en un entorno
 * que todavía no tiene la variable, y dejaría los tests sin poder
 * sustituirla con `vi.stubEnv`.
 *
 * Diferencia deliberada con `apiBaseUrl()`: aquí **no se lanza** cuando
 * falta la variable en producción. Sin `NEXT_PUBLIC_API_URL` el panel no
 * puede hacer nada (mejor fallar en voz alta); sin `NEXT_PUBLIC_SITE_URL`
 * la landing se pinta perfectamente y lo único que sale mal es un sitemap
 * y unas tarjetas de compartir apuntando a `localhost` — tirar la página
 * pública entera por eso sería peor que el problema que resuelve.
 *
 * Lo que sí hace, desde la revisión final de la rama (hallazgos I1/I2):
 * **validar** el valor y **avisar en voz alta una sola vez** cuando falta
 * o no sirve, en vez de devolverlo tal cual. `app/page.tsx` construye un
 * `new URL(siteUrl())` para `metadataBase`, y ese constructor **lanza**
 * con cualquier cosa que no sea una URL absoluta (`popyplan.com`,
 * `https://`): como `/` es dinámica, el fallo no lo vería `next build`,
 * lo verían en producción todos los visitantes anónimos y todos los
 * rastreadores, con un 500 en la única página pública del producto.
 *
 * **`NEXT_PUBLIC_*` se incrusta en el bundle al construir**: quien
 * despliegue tiene que declarar estas cuatro variables en el entorno de
 * `next build`, no solo en el de ejecución (`.env.example` lo dice al
 * lado de cada una).
 */
const DEFAULT_SITE_URL = "http://localhost:3100";
const DEFAULT_CONTACT_EMAIL = "hola@popyplan.com";

/**
 * Fichas **reales** de la app, publicadas (rediseño de la landing,
 * 2026-09-20): son el valor por defecto de `storeLinks()`, no un
 * marcador de posición. Hasta ahora las dos variables vacías dejaban la
 * landing sin ningún botón de descarga, que era lo correcto mientras la
 * app no estaba en las tiendas; ya lo está, y el botón de descarga es la
 * llamada principal de la web, así que no puede depender de que alguien
 * se acuerde de declarar dos variables en el entorno de `next build`.
 * Las variables siguen mandando cuando traen una URL `https:` válida.
 */
const DEFAULT_APP_STORE_URL = "https://apps.apple.com/us/app/polypop/id6755899118";
const DEFAULT_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.tikneo.popmobile";

/**
 * Páginas legales y de soporte de la web pública (`popyplan.com`), que
 * **no** sirve este panel: son rutas de la web de marketing, enlazadas
 * desde el pie de la landing. Constantes a propósito, sin variable de
 * entorno — son URLs fijas del dominio del producto, no configuración de
 * despliegue: una variable mal puesta las dejaría apuntando a ninguna
 * parte justo en los enlaces que la ley exige poder encontrar.
 */
const LEGAL_LINKS = {
  support: "https://popyplan.com/support",
  privacy: "https://popyplan.com/privacy",
  terms: "https://popyplan.com/terms",
  deleteAccount: "https://popyplan.com/delete-account",
} as const;

/**
 * Comprobación mínima de un correo: algo, una arroba, algo con punto.
 * No pretende validar el RFC 5322 (imposible con una expresión regular
 * razonable) — solo descartar un valor que **no** puede funcionar en un
 * `mailto:`, como una frase con espacios o una cadena sin arroba.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Un solo aviso por proceso (I2): estas funciones se llaman en cada
 * petición de `/` (ruta dinámica), así que sin esta bandera un
 * despliegue mal configurado escribiría una línea de log por visita.
 */
let alreadyWarned = false;

/**
 * Solo en producción: en desarrollo y en los tests el valor por defecto
 * (`localhost:3100`) es justo el correcto, y avisar sería ruido en cada
 * arranque.
 */
function warnInProduction(message: string): void {
  if (process.env.NODE_ENV !== "production" || alreadyWarned) return;
  alreadyWarned = true;
  console.warn(message);
}

/** La URL parseada, o `null` si no es una URL absoluta de `protocols`. */
function parseUrl(value: string, protocols: readonly string[]): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return protocols.includes(url.protocol) ? url : null;
}

/**
 * URL absoluta del sitio público, **sin** barra final. **Nunca lanza y
 * nunca devuelve algo que `new URL()` no acepte** (I1): quien la llama
 * puede construir un `metadataBase` con el resultado sin envolverlo en
 * un `try`.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  if (!configured) {
    warnInProduction(
      `NEXT_PUBLIC_SITE_URL no está declarada: el sitemap y las tarjetas de compartir apuntarán a ${DEFAULT_SITE_URL}. Decláralo en el entorno de "next build".`,
    );
    return DEFAULT_SITE_URL;
  }

  if (!parseUrl(configured, ["http:", "https:"])) {
    warnInProduction(
      `NEXT_PUBLIC_SITE_URL no es una URL absoluta http(s) ("${configured}"): se usa ${DEFAULT_SITE_URL}.`,
    );
    return DEFAULT_SITE_URL;
  }

  return configured;
}

/**
 * Destino de contacto por correo. **Sin consumidor en la interfaz desde
 * el rediseño de la landing (2026-09-20)**: la web nueva no tiene bloque
 * «Habla con nosotros» ni tarjetas por público con `mailto:` — el pie
 * enlaza a la página de soporte de `popyplan.com` (`legalLinks()`). Se
 * conserva porque `NEXT_PUBLIC_CONTACT_EMAIL` es una variable ya
 * documentada en `.env.example` y el formulario de contacto guardado en
 * plataforma sigue planificado (spec §9); su validación y sus tests no
 * cuestan nada y evitan tener que reescribirla al retomarlo.
 *
 * Un valor que
 * no parezca un correo se descarta (M9): acabaría en un `href` que
 * ningún cliente de correo puede abrir, y un valor con espacios o con
 * `&cc=` sería además una vía de inyectar cabeceras de correo.
 */
export function contactEmail(): string {
  const configured = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

  if (configured && EMAIL_PATTERN.test(configured)) {
    return configured;
  }

  return DEFAULT_CONTACT_EMAIL;
}

export interface StoreUrls {
  appStore: string | null;
  playStore: string | null;
}

/**
 * Fichas de la app en las tiendas. Sin variable (o con una vacía) se
 * devuelven las **fichas reales** publicadas (`DEFAULT_APP_STORE_URL` /
 * `DEFAULT_PLAY_STORE_URL`): el caso normal de un despliegue es no tener
 * que declarar nada. Una variable con un valor que **no** sea una URL
 * `https:` sigue devolviendo `null` y su botón **no se pinta**
 * (`components/landing/StoreLinks.tsx`): estos dos valores acaban
 * directamente en un `href`, y el precedente del repo para eso es
 * `lib/config/imagePatterns.ts::isAllowedImageSrc` — un valor mal
 * configurado no puede convertirse en un enlace a cualquier sitio.
 */
export function storeLinks(): StoreUrls {
  return {
    appStore: httpsUrlOr(process.env.NEXT_PUBLIC_APP_STORE_URL, DEFAULT_APP_STORE_URL),
    playStore: httpsUrlOr(process.env.NEXT_PUBLIC_PLAY_STORE_URL, DEFAULT_PLAY_STORE_URL),
  };
}

function httpsUrlOr(value: string | undefined, fallback: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  return parseUrl(trimmed, ["https:"]) ? trimmed : null;
}

export interface LegalUrls {
  support: string;
  privacy: string;
  terms: string;
  deleteAccount: string;
}

/**
 * Enlaces legales del pie de la web pública (soporte, privacidad,
 * términos y eliminación de cuenta). Función, y no la constante suelta,
 * por coherencia con el resto del módulo: quien la llama no tiene que
 * saber si detrás hay una variable de entorno o un literal, y añadir una
 * mañana no cambia ningún sitio de llamada.
 */
export function legalLinks(): LegalUrls {
  return { ...LEGAL_LINKS };
}
