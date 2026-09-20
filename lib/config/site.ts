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
 * **`NEXT_PUBLIC_*` se incrusta en el bundle al construir**: quien
 * despliegue tiene que declarar estas cuatro variables en el entorno de
 * `next build`, no solo en el de ejecución (`.env.example` lo dice al
 * lado de cada una).
 */
const DEFAULT_SITE_URL = "http://localhost:3100";
const DEFAULT_CONTACT_EMAIL = "hola@popyplan.com";

/** URL absoluta del sitio público, **sin** barra final. */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return DEFAULT_SITE_URL;
}

/** Destino del `mailto:` de la landing (spec §2, decisión 5). */
export function contactEmail(): string {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL;
}

export interface StoreUrls {
  appStore: string | null;
  playStore: string | null;
}

/**
 * Fichas de la app en las tiendas. Una variable ausente o vacía devuelve
 * `null` y su botón **no se pinta** (`components/landing/StoreLinks.tsx`):
 * enlazar a una ficha que todavía no existe es peor que no ofrecer el
 * botón.
 */
export function storeLinks(): StoreUrls {
  return {
    appStore: process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() || null,
    playStore: process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim() || null,
  };
}
