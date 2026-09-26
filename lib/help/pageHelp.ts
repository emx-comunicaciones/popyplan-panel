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
 * con `title`/`summary`/`details`/`audience` no vacíos, entre 1 y 4
 * `actions`, 1-3 `tips` y 1-3 `related` no vacíos, en los cuatro
 * catálogos, y que cada clave de `related` apunta a otra entrada cuya
 * `route` solo usa `[slug]` como segmento dinámico (las fichas, con
 * `[userId]`/`[eventId]`/`[id]`, nunca son destino de la navegación
 * «Pantallas relacionadas»).
 *
 * `resolveRelatedRoute` (fase 1 de la ampliación) resuelve a qué ruta
 * navega cada botón de «Pantallas relacionadas»: las rutas estáticas se
 * navegan tal cual; con exactamente `[slug]` como segmento dinámico se
 * porta el slug del pathname actual si ambas entradas son de la misma
 * área (`/entidad/<slug>/…`, `/paraguas/<slug>/…`); cualquier otra cosa
 * devuelve `null` y `PageHelp` no pinta ese botón.
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
  { route: "/entidad/[slug]/seguimiento", key: "entidad.seguimiento" },
  { route: "/entidad/[slug]/reportes", key: "entidad.reportes" },
  { route: "/entidad/[slug]/reportes/[reportId]", key: "entidad.reporteDetalle" },
  { route: "/entidad/[slug]/guardia", key: "entidad.guardia" },
  { route: "/entidad/[slug]/informes", key: "entidad.informes" },
  { route: "/entidad/[slug]/configuracion", key: "entidad.configuracion" },

  // Paraguas (`/paraguas/[slug]/…`)
  { route: "/paraguas/[slug]", key: "paraguas.inicio" },
  { route: "/paraguas/[slug]/territorio", key: "paraguas.territorio" },
  { route: "/paraguas/[slug]/red-financiada", key: "paraguas.redFinanciada" },
  { route: "/paraguas/[slug]/informes", key: "paraguas.informes" },

  // Plataforma (`/plataforma/…`)
  { route: "/plataforma", key: "plataforma.inicio" },
  { route: "/plataforma/entidades", key: "plataforma.entidades" },
  { route: "/plataforma/entidades/[id]", key: "plataforma.entidadFicha" },
  { route: "/plataforma/usuarios", key: "plataforma.usuarios" },
  { route: "/plataforma/usuarios/[id]", key: "plataforma.usuarioFicha" },
  { route: "/plataforma/bloqueos", key: "plataforma.bloqueos" },
  { route: "/plataforma/comunidades", key: "plataforma.comunidades" },
  { route: "/plataforma/comunidades/[id]", key: "plataforma.comunidadFicha" },
  { route: "/plataforma/actividades", key: "plataforma.actividades" },
  { route: "/plataforma/resenas", key: "plataforma.resenas" },
  { route: "/plataforma/chats", key: "plataforma.chats" },
  { route: "/plataforma/chats/[id]", key: "plataforma.chatFicha" },
  { route: "/plataforma/notificaciones", key: "plataforma.notificaciones" },
  { route: "/plataforma/nomencladores", key: "plataforma.nomencladores" },
  { route: "/plataforma/busca-del-tesoro", key: "plataforma.tesoro" },
  { route: "/plataforma/busca-del-tesoro/[id]", key: "plataforma.tesoroFicha" },
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
 * Segmentos dinámicos (`[slug]`, `[userId]`…) de una plantilla, en el
 * orden en que aparecen; los literales no entran.
 */
export function dynamicSegments(route: string): string[] {
  return route
    .split("/")
    .filter((segment) => DYNAMIC_SEGMENT.test(segment));
}

/**
 * Sección del menú lateral a la que pertenece una plantilla de ruta:
 * el primer segmento **literal** después del área (`entidad`,
 * `paraguas`, `plataforma`), o `"inicio"` cuando no queda ninguno — la
 * raíz de cada área (`/plataforma`, `/entidad/[slug]`) es su Inicio.
 * Una ficha comparte sección con su listado (`/entidad/[slug]/personas/
 * [userId]` → `"personas"`), que es justo lo que gatean las páginas con
 * `entidadMenuFor`.
 *
 * Existe para que `PageHelp` pueda descartar una «pantalla relacionada»
 * que el rol de quien mira no tiene en su menú: el botón llevaría al
 * «Sin acceso» del gate de esa página. Misma clase de fallo que ya
 * corrigieron `ActividadesTable` (`canOpenAttendance`) y `GuardiaPanel`
 * (`canOpenPersonSheet`), y por el mismo motivo: quien pinta el enlace
 * no puede suponer el permiso de destino.
 */
export function menuSectionFor(route: string): string {
  const [, ...resto] = route.split("/").filter((segment) => segment.length > 0);
  const literal = resto.find((segment) => !DYNAMIC_SEGMENT.test(segment));
  return literal ?? "inicio";
}

/**
 * Resuelve la ruta de destino del botón «Pantallas relacionadas» para la
 * entrada `relatedEntry` cuando la pantalla actual es `currentPathname`
 * (entrada `entry`). Tres casos:
 *
 * - Ruta estática (`/plataforma/roles`, `/plataforma`…): se navega tal
 *   cual — plataforma no tiene slug, así que no hay nada que portar.
 * - Segmentos dinámicos exactamente `["[slug]"]` y área compartida: si la
 *   entrada **actual** también usa `[slug]` (solo entidad/paraguas) y el
 *   pathname tiene un segmento real en esa posición, se sustituye y se
 *   navega dentro del mismo área. Exigir `[slug]` en la entrada actual no
 *   es redundante: en `/plataforma/roles` el segundo segmento es un
 *   literal de la propia ruta (`roles`), no un slug, y portarlo generaría
 *   `/entidad/roles/personas`.
 * - Cualquier otro caso (fichas con `[userId]`/`[eventId]`/`[id]`,
 *   entrada actual sin `[slug]`, áreas distintas): `null`
 *   — `PageHelp` no pinta el botón, nunca navega a una ruta sin resolver.
 *
 * No usa `matchPageHelp` para extraer el slug: la validación de `related`
 * garantiza que la entrada actual ya es la que casa, así que basta con
 * comparar el primer segmento del área y tomar el siguiente.
 */
export function resolveRelatedRoute(
  currentPathname: string,
  entry: PageHelpEntry,
  relatedEntry: PageHelpEntry,
): string | null {
  const relatedDynamic = dynamicSegments(relatedEntry.route);
  if (relatedDynamic.length === 0) return relatedEntry.route;

  const area = entry.route.split("/").filter(Boolean)[0];
  const currentSegments = currentPathname.split("/").filter(Boolean);

  if (
    relatedDynamic.length === 1 &&
    relatedDynamic[0] === "[slug]" &&
    dynamicSegments(entry.route)[0] === "[slug]" &&
    currentSegments[0] === area &&
    currentSegments.length >= 2
  ) {
    return relatedEntry.route.replace("[slug]", currentSegments[1]);
  }

  return null;
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
