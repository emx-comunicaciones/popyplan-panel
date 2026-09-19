/**
 * Registro estático de ayuda por pantalla: una entrada por cada
 * `page.tsx` de `app/entidad/[slug]/**`, `app/paraguas/[slug]/**` y
 * `app/plataforma/**` (las cuatro páginas fuera de esas tres áreas —
 * login, elegir-entidad, accesibilidad, error/not-found — no tienen
 * botón de ayuda, decisión 3 del plan de «ayuda por pantalla»).
 *
 * **Tarea 5 de i18n (decisión 6 del plan):** las 203 cadenas
 * (título/resumen/acciones/audiencia de cada pantalla) ya no viven aquí
 * — pasan a `messages/{en,es,eu,ca}.json` bajo `help.<key>.*`. Cada
 * entrada solo guarda `route` (para resolver la pantalla actual, igual
 * que antes) y `key` (la ruta dentro del namespace `help` del catálogo,
 * p. ej. `"entidad.inicio"` → `help.entidad.inicio.title`); `key` reusa
 * exactamente los mismos segmentos que `pages.<area>.<slug>` (el
 * namespace de títulos de `<title>` de la tarea 2), así que las dos
 * tareas nombran la misma pantalla con la misma clave.
 * `components/help/PageHelp.tsx` resuelve el contenido con
 * `useTranslations("help")` (`t(`${key}.title`)`, etc.) y `t.raw` para
 * el array de `actions`.
 *
 * `lib/help/pageHelp.test.ts::"tiene exactamente una entrada por cada
 * page.tsx real..."` recorre `app/` de verdad y falla si una página
 * nueva no tiene entrada aquí, o si una entrada sobra sin fichero; un
 * segundo bloque de tests comprueba que la `key` de cada entrada existe,
 * con `title`/`summary`/`audience` no vacíos y entre 1 y 4 `actions` no
 * vacías, en los cuatro catálogos.
 */
export interface PageHelpEntry {
  /** Plantilla de ruta tal y como está en `app/` (con `[slug]`, `[userId]`…). */
  route: string;
  /** Ruta dentro de `messages/*.json::help`, p. ej. `"entidad.personas"`. */
  key: string;
}

export const PAGE_HELP: readonly PageHelpEntry[] = [
  // Entidad (`/entidad/[slug]/…`)
  { route: "/entidad/[slug]", key: "entidad.inicio" },
  { route: "/entidad/[slug]/personas", key: "entidad.personas" },
  { route: "/entidad/[slug]/personas/[userId]", key: "entidad.personaFicha" },
  { route: "/entidad/[slug]/comunidades", key: "entidad.comunidades" },
  { route: "/entidad/[slug]/actividades", key: "entidad.actividades" },
  { route: "/entidad/[slug]/asistencia", key: "entidad.asistencia" },
  { route: "/entidad/[slug]/asistencia/[eventId]", key: "entidad.asistenciaEvento" },
  { route: "/entidad/[slug]/comunicaciones", key: "entidad.comunicaciones" },
  { route: "/entidad/[slug]/encuestas", key: "entidad.encuestas" },
  { route: "/entidad/[slug]/encuestas/[surveyId]", key: "entidad.encuestaResultados" },
  { route: "/entidad/[slug]/biblioteca", key: "entidad.biblioteca" },
  { route: "/entidad/[slug]/familias", key: "entidad.familias" },
  { route: "/entidad/[slug]/programas", key: "entidad.programas" },
  { route: "/entidad/[slug]/programas/[programId]", key: "entidad.programaFicha" },
  { route: "/entidad/[slug]/reportes", key: "entidad.reportes" },
  { route: "/entidad/[slug]/reportes/[reportId]", key: "entidad.reporteDetalle" },
  { route: "/entidad/[slug]/guardia", key: "entidad.guardia" },
  { route: "/entidad/[slug]/informes", key: "entidad.informes" },
  { route: "/entidad/[slug]/configuracion", key: "entidad.configuracion" },

  // Paraguas (`/paraguas/[slug]/…`)
  { route: "/paraguas/[slug]", key: "paraguas.inicio" },
  { route: "/paraguas/[slug]/territorio", key: "paraguas.territorio" },
  { route: "/paraguas/[slug]/informes", key: "paraguas.informes" },

  // Plataforma (`/plataforma/…`)
  { route: "/plataforma", key: "plataforma.inicio" },
  { route: "/plataforma/entidades", key: "plataforma.entidades" },
  { route: "/plataforma/entidades/[id]", key: "plataforma.entidadFicha" },
  { route: "/plataforma/reportes", key: "plataforma.reportes" },
  { route: "/plataforma/reportes/[reportId]", key: "plataforma.reporteDetalle" },
  { route: "/plataforma/ayuda", key: "plataforma.ayuda" },
  { route: "/plataforma/verificaciones", key: "plataforma.verificaciones" },
  { route: "/plataforma/roles", key: "plataforma.roles" },
  { route: "/plataforma/auditoria", key: "plataforma.auditoria" },
  { route: "/plataforma/metricas", key: "plataforma.metricas" },
  { route: "/plataforma/suscripciones", key: "plataforma.suscripciones" },
];

/** Segmentos entre `[` y `]`, p. ej. `[slug]`, `[userId]`, `[eventId]`. */
const DYNAMIC_SEGMENT = /^\[.+\]$/;

/**
 * Convierte `/entidad/[slug]/personas/[userId]` en
 * `/^\/entidad\/[^/]+\/personas\/[^/]+\/?$/`: cada segmento dinámico
 * (`[algo]`) casa con exactamente un segmento no vacío de la ruta real
 * (sin `/`, así que no se cuela un segmento siguiente); los segmentos
 * literales se escapan tal cual. Una barra final opcional para que
 * `/entidad/x/personas/42` y `/entidad/x/personas/42/` casen igual.
 */
export function routeToRegExp(route: string): RegExp {
  const segments = route.split("/").filter((segment) => segment.length > 0);
  const pattern = segments
    .map((segment) =>
      DYNAMIC_SEGMENT.test(segment)
        ? "[^/]+"
        : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("\\/");
  return new RegExp(`^\\/${pattern}\\/?$`);
}

/**
 * Devuelve la entrada cuya plantilla casa con el pathname real, o
 * `null`. Cada plantilla de `PAGE_HELP` está anclada de principio a fin
 * (`routeToRegExp`), así que dos plantillas solo podrían casar a la vez
 * con el mismo pathname si tuvieran el mismo número de segmentos y los
 * mismos segmentos literales — el test de completitud de
 * `pageHelp.test.ts` garantiza que `PAGE_HELP` no tiene rutas
 * duplicadas, y las 32 rutas reales son literalmente distintas entre sí
 * en algún segmento, así que como mucho una entrada casa con un
 * pathname dado. No hace falta desempatar por especificidad: basta con
 * la primera que case.
 */
export function matchPageHelp(pathname: string): PageHelpEntry | null {
  return (
    PAGE_HELP.find((entry) => routeToRegExp(entry.route).test(pathname)) ??
    null
  );
}
