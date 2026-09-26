# Historial — Ayuda por pantalla

> Texto trasladado tal cual desde el `CLAUDE.md` raíz (2026-09-26) para no cargarlo en cada sesión. Las referencias a «más arriba/abajo» apuntan al `CLAUDE.md` original; busca la sección en `docs/historial/`.

## Ayuda por pantalla (2026-09-19)

Botón «?» en la cabecera de las tres áreas (`components/help/PageHelp.tsx`,
`"use client"`, montado justo antes de `<LogoutButton />` en
`app/entidad/[slug]/layout.tsx`, `app/paraguas/[slug]/layout.tsx` y
`app/plataforma/layout.tsx`): al pulsarlo abre un diálogo
(`components/ui/Dialog.tsx`, foco atrapado, `Escape` cierra, el foco
vuelve al botón) con el resumen de para qué sirve la pantalla actual,
qué se puede hacer en ella y quién la ve.

- **Registro**: `lib/help/pageHelp.ts::PAGE_HELP`, una entrada
  (`PageHelpEntry {route, key}`) por cada `page.tsx` real de
  `app/entidad/[slug]/**`, `app/paraguas/[slug]/**` y
  `app/plataforma/**` — **47** pantallas (19 entidad, **4** paraguas —
  Inicio/Territorio/Red financiada/Informes, bloque 1 de territorio — 24
  plataforma, tres del bloque 1, dos del bloque 2 y ocho del bloque 3 del
  admin de plataforma de 2026-09-26). **Actualizado en la tarea 5 de i18n**: `title`/`summary`/
  `actions`/`audience` ya no viven en el registro como texto en español
  — `key` (p. ej. `"entidad.personas"`, mismos segmentos que
  `pages.<area>.<slug>` de la tarea 2) apunta a
  `messages/{en,es,eu,ca}.json::help.<key>.*`; `components/help/
  PageHelp.tsx` resuelve con `useTranslations("help")` (`t.raw` para el
  array `actions`, que no lleva interpolación). `lib/help/pageHelp.test.ts`
  comprueba, contra los cuatro catálogos reales, que cada `key` existe
  con `title`/`summary`/`audience` no vacíos y entre 1 y 4 `actions`.
- **Resolución de ruta**: `routeToRegExp(route)` convierte una plantilla
  con segmentos dinámicos (`/entidad/[slug]/personas/[userId]`) en una
  expresión regular anclada de principio a fin, con barra final
  opcional; `matchPageHelp(pathname)` devuelve la primera entrada de
  `PAGE_HELP` cuya plantilla casa con el `pathname` real de
  `usePathname()`, o `null`. Las 32 plantillas reales nunca colisionan
  entre sí (difieren en algún segmento literal), así que no hace falta
  desempatar por especificidad.
- **Test de completitud** (`lib/help/pageHelp.test.ts`): recorre de
  verdad el árbol de `app/` (sin *glob* de terceros, con el propio
  sistema de ficheros) y falla si aparece un `page.tsx` nuevo bajo esas
  tres áreas sin entrada en `PAGE_HELP`, o si `PAGE_HELP` tiene una
  entrada huérfana sin fichero — así ninguna pantalla nueva se queda sin
  ayuda sin que alguien lo decida explícitamente.
- **Decisiones (ya tomadas, ver el plan
  `docs/superpowers/plans/2026-09-19-ayuda-por-pantalla.md`)**:
  1. El botón vive en la cabecera de área, junto a «Cerrar sesión» — una
     sola inserción por layout, misma posición siempre; ninguna
     `page.tsx` se toca.
  2. El registro indexa por plantilla de ruta, no por `<h1>`: las
     páginas son Server Components y el botón vive en el layout
     (cliente), así que `usePathname()` es la única fuente fiable de
     «qué pantalla es».
  3. Las pantallas fuera de las tres áreas (`/login`, `/accesibilidad`,
     `/elegir-entidad`, `/`) no llevan ayuda: no tienen esta cabecera y
     su función es evidente; `matchPageHelp` devuelve `null` para ellas
     y `PageHelp` no pinta nada.
  4. Sin persistencia ni «no volver a mostrar»: es ayuda bajo demanda,
     no un tour guiado.
  5. Un texto por pantalla, no por rol: cuando una acción es solo de
     titular/moderador (o de otro rol concreto), el propio texto lo dice
     («Solo titular y moderador pueden…»), en vez de tener variantes por
     rol del mismo registro.
- **Ampliación de contenido y estructura (2026-09-23)**: el diálogo gana
  tres secciones, obligatorias en las 34 entradas y las 4 lenguas:
  `details` («Cómo funciona», las reglas del dominio de la pantalla —
  supresión <5, periodos ≤1461 días, ventanas de check-in, matriz de
  roles…), `tips` («Consejos», 1-3), y `related` («Pantallas
  relacionadas», 1-3 botones que navegan con `useRouter().push` y cierran
  el diálogo). Las etiquetas viven en `ui.pageHelp.{details,tips,related}
  Label`. **Reglas duras** (validadas por `lib/help/pageHelp.test.ts`):
  cada clave de `related` existe en `PAGE_HELP`, sin autorrelaciones ni
  duplicados, y su ruta solo puede tener `[slug]` como segmento dinámico —
  **las fichas (`[userId]`/`[eventId]`/`[surveyId]`/`[programId]`/
  `[reportId]`/`[id]`) nunca son destino de navegación**; la resolución de
  ruta es `lib/help/pageHelp.ts::resolveRelatedRoute` (pura, testeada):
  portael `[slug]` del pathname actual solo si ambas entradas son del
  mismo área; si no se resuelve, el botón no se pinta (defensivo).
  `components/ui/Dialog.tsx` centra su contenido con `max-h-[70vh]
  overflow-y-auto` para el diálogo completo. El contenido (en fuente, es/
  eu/ca traducidos) fue redactado contra CLAUDE.md y los docstrings — **no
  contra la intuición** — y el eu/ca queda anotado como pendiente de
  revisión nativa en `docs/i18n/PENDIENTES.md`.
- **Las relacionadas se filtran por el menú del rol (revisión de esa
  ampliación, misma fecha)**: `PageHelp` recibe `visibleSections` — el
  mismo array que cada layout de área ya calcula con `entidadMenuFor`/
  `paraguasMenuFor`/`plataformaMenuFor` para `SideNav` — y descarta toda
  relacionada cuya sección no esté ahí. Sin ese filtro había **29**
  combinaciones rol×pantalla con un botón que aterrizaba en el «Sin
  acceso» del gate de destino; la peor, una `analista` abriendo la ayuda
  del Inicio de entidad, donde las tres relacionadas (Personas,
  Actividades, Guardia) están fuera de su menú. Es la misma clase de
  fallo que ya corrigieron `ActividadesTable` (`canOpenAttendance`, F1) y
  `GuardiaPanel` (`canOpenPersonSheet`, I1): quien pinta el enlace no
  puede suponer el permiso de destino. La sección del menú de una
  plantilla la da `lib/help/pageHelp.ts::menuSectionFor` (primer segmento
  literal tras el área, `"inicio"` si no queda ninguno — una ficha
  comparte sección con su listado, que es justo lo que gatean las
  páginas), con un test que exige que el valor devuelto sea siempre una
  sección real de `ENTIDAD/PARAGUAS/PLATAFORMA_MENU_ITEMS`: un filtro que
  no casara nunca escondería *todos* los botones sin que nadie se
  enterase. **La lista definitiva se resuelve antes de pintar** y la
  cabecera «Pantallas relacionadas» solo aparece si queda al menos un
  botón — antes, con todas las relacionadas descartadas (ficha, otra
  área, y ahora también el rol), quedaba una cabecera sobre una fila
  vacía, que se lee como contenido que falta. `visibleSections` es
  **opcional a propósito**: omitirla no filtra nada, para que un montaje
  que no conozca el rol (tests, cualquier uso futuro) pinte de más en vez
  de esconder por accidente; los tres layouts reales siempre la pasan.
- **`related` es idéntico en los cuatro catálogos, con test**: son
  claves, no texto traducible. El cruce contra `PAGE_HELP` solo lee `en`
  y el test de paridad (`lib/i18n/messages.test.ts`) compara rutas de
  clave, no valores, así que una errata en `es`/`eu`/`ca` pasaba los dos
  y hacía desaparecer ese botón **solo en ese idioma** (`PAGE_HELP.find`
  devuelve `undefined` y no se pinta nada). `lib/help/pageHelp.test.ts`
  exige ahora las mismas claves en el mismo orden en las cuatro lenguas.
- **Accesibilidad**: botón redondo 40×40 con `aria-label="Ayuda: <título>"`,
  `aria-haspopup="dialog"`, `aria-expanded`, el signo «?» en
  `aria-hidden`. **Fondo blanco** (`bg-white text-primary-700 border
  border-border hover:bg-primary-100`), no `text-primary-700` a secas
  sobre el fondo de la cabecera: la regla de contraste de este fichero
  («todo texto usa `primary-700`») está tabulada contra
  `--color-background` (blanco), y aplicarla directamente sobre el
  fondo de marca de la cabecera la invertía — con la entidad más común
  (sin `primary_color` propio, cabecera a `primary-700`) el glifo
  quedaba del mismo color que su fondo, invisible (1,00:1); revisión
  final antes de mergear la rama. El botón lleva su propio fondo blanco,
  igual que «Cerrar sesión» (`Button variant="secondary"`), así
  funciona sobre cualquier color de cabecera; `components/help/
  PageHelp.test.tsx` fija `bg-white` en su className para que la
  regresión no vuelva a colarse (`axe` no la detecta:
  `test-utils/axe.ts` desactiva `color-contrast`). El diálogo pinta el
  resumen, un `<h3>Qué puedes hacer aquí</h3>` con la lista de acciones
  (por debajo del `<h2>` que ya pone `Dialog` en el título, sin saltar
  de nivel) y «Quién la ve: …», y se cierra solo si cambia el
  `pathname` (`useEffect(() => setOpen(false), [pathname])`) — sin eso,
  una navegación con el diálogo abierto (atrás/adelante del navegador,
  o un enlace dentro del propio diálogo) lo dejaba abierto mostrando ya
  el contenido de la pantalla nueva. `components/help/PageHelp.test.tsx`
  cubre el caso sin entrada (no renderiza nada), el botón cerrado, abrir
  el diálogo con su contenido, cambiar de pathname con el diálogo
  abierto (se cierra), `Escape` (cierra y devuelve el foco) y `axe` sin
  violaciones cerrado y abierto; los tres `layout.test.tsx` ganan una
  aserción del botón (`getByRole('button', {name: /^Ayuda:/})`) fijando
  `usePathname()` a una ruta con entrada
  (`test-utils/nextNavigationMock.ts::setPathname`, mismo patrón que
  `setSearchParams`).
