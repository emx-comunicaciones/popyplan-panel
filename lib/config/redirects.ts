/**
 * Redirecciones permanentes de los renombres del bloque 1 de territorio
 * (spec `2026-09-19-territorio-administraciones-design.md` §4.5):
 * «Recursos» pasa a «Biblioteca» y «Contratos» de plataforma a
 * «Suscripciones». Un marcador guardado, un enlace de un correo antiguo
 * o una pestaña abierta no pueden quedarse en 404, así que la ruta vieja
 * redirige con 308 (`permanent: true`) en vez de desaparecer.
 *
 * Vive en `lib/config/` —no en `next.config.ts`— por el mismo motivo que
 * `imagePatterns.ts` y `securityHeaders.ts`: así se puede probar con
 * Vitest y documentar aquí el porqué de cada regla. `next.config.ts` solo
 * la llama desde `redirects()`.
 *
 * Los nombres de la API no cambian (§4.5:
 * `/api/panel/entidad/{id}/resources/` sigue igual, y la app `billing`
 * también), así que estas dos reglas solo afectan a rutas del panel.
 */
export interface PermanentRedirect {
  source: string;
  destination: string;
  permanent: true;
}

export function permanentRedirects(): PermanentRedirect[] {
  return [
    {
      source: "/entidad/:slug/recursos",
      destination: "/entidad/:slug/biblioteca",
      permanent: true,
    },
    {
      source: "/plataforma/contratos",
      destination: "/plataforma/suscripciones",
      permanent: true,
    },
  ];
}
