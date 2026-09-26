# Historial — Landing pública y login único

> Texto trasladado tal cual desde el `CLAUDE.md` raíz (2026-09-26) para no cargarlo en cada sesión. Las referencias a «más arriba/abajo» apuntan al `CLAUDE.md` original; busca la sección en `docs/historial/`.

## Landing pública y login único (2026-09-20)

Spec de diseño: `docs/superpowers/specs/2026-09-20-landing-login-unico-design.md`
(encargo del propietario 2026-09-18: «una web de presentación… y que todo
el software tenga un mismo login»). Plan de 6 tareas:
`docs/superpowers/plans/2026-09-20-landing-login-unico.md`. **Rediseño
posterior, «planes sanos, gente activa»** (encargo del mismo día: «quiero
que copies el diseño de esta otra web que tenemos hecha… enfocado a gente
sana y deportista; no tiene que aparecer nada de asociaciones y problemas
de adicciones»): brief, capturas de la web de referencia y del resultado
en `.superpowers/sdd/2026-09-20-landing-deportiva/` (`brief.md`,
`site-circle.{html,png,txt}`, `after-{desktop,mobile}.png`, `report.md`).

**`/` deja de redirigir al login.** `app/page.tsx` sigue siendo el
repartidor de áreas, pero con dos ramas de render más:

- **Sin sesión** → `<Landing />` (`components/landing/Landing.tsx`), la web
  pública. Enfoque 1 de la spec: se descartó mover el resolutor a `/entrar`
  porque obligaba a tocar los cinco `redirect("/")` del panel y el
  `returnTo` del login por una ventaja marginal.
- **Con sesión** → `resolveArea` como siempre (`/plataforma`,
  `/entidad/{slug}`, `/paraguas/{slug}`, `/elegir-entidad`).
- **Con sesión y `sin-acceso`** → `<AppAccountScreen />` («Tu cuenta es de
  la app Popyplan», spec §5), que sustituye al `ErrorState` «No tienes
  acceso a ningún área del panel». Las claves `pages.home.noAccess*` salen
  de los cuatro catálogos al quedarse sin consumidor.

**`middleware.ts`: la raíz sigue en el `matcher` pero ya no manda al
login.** Con cookie se refresca la sesión igual que siempre (hallazgo A2:
`getServerSession` solo lee la cabecera interna que pone el middleware, así
que sin esto el reparto por área no funciona); **sin** cookie o con el
refresh rechazado, `/` pasa por `passThroughWithoutAccess` en vez de
`redirectToLogin` — incluso en una navegación de documento. `isPublicRoot`
es la única condición nueva; `redirectToLogin` pierde su excepción
`pathname !== "/"` (la raíz ya nunca llega ahí) y guarda siempre el
`returnTo`. Ninguna otra ruta del `matcher` cambia.

### Qué cuenta la web (rediseño de 2026-09-20)

Discurso de **deporte, naturaleza y bienestar**, para gente sana y
deportista: planes y comunidades sin alcohol ni drogas. **Ninguna mención
a asociaciones, ONG, administraciones, profesionales, panel institucional,
adicciones, intervención, guardia ni red de apoyo** — el panel sigue
existiendo, pero la web pública no habla de él salvo por dos enlaces
discretos («Entrar» en la cabecera, «Acceso al panel» en el pie). Bloques,
en orden:

1. **`LandingHeader`** — logo (`public/landing/logo.svg`), anclas
   `#inicio`/`#funcionalidades`/`#descarga` (ocultas bajo `md`), botón
   negro «Descarga la app» (icono-only bajo `sm`, con `aria-label`
   traducido), `LanguageSwitcher` y «Entrar» → `/login`. Sin menú
   hamburguesa: serían un patrón nuevo (foco atrapado, estado) para tres
   anclas de la misma página.
2. **`Hero`** (`id="inicio"`) — `h1` «Planes sanos, gente activa.»,
   subtítulo, `StoreLinks` y el mockup `circle-hero.png` con tres tarjetas
   de foto flotantes (decorativas, `alt=""`; solo desde `lg`).
3. **`ModeToggle`** — **el único componente con estado de la landing**
   (`"use client"`): dos pastillas «Planes»/«Comunidades» con
   `aria-pressed` (no ARIA tabs: no hay paneles que mostrar y ocultar),
   que cambian una frase en una región `aria-live="polite"` siempre
   montada; debajo, los tres mockups y el `h2` fijo «Diseñado para quien
   cuida su cuerpo y a su gente.». La pastilla inactiva **se subraya** al
   pasar el ratón, no cambia de color: `text-primary-700` sobre el
   `primary-100` del contenedor da 4,31:1, así que el `hover` empeoraba un
   texto que en reposo está en 16,93:1.
4. **`Features`** (`id="funcionalidades"`) — tres columnas con icono
   redondo turquesa: comunidades por deporte, planes cerca de ti (con QR)
   y compartir logros.
5. **`Values`** — tres tarjetas: «100 % libre de alcohol y drogas»,
   «Gente real, planes reales» y «Tu privacidad, primero». Ninguna promesa
   que el producto no cumpla ya (invariante 9, asistencia por QR).
6. **`DownloadBanner`** (`id="descarga"`) — degradado turquesa con textura
   y dos móviles que sobresalen de la tarjeta (mockups de **comunidad**:
   los dos móviles de la web de referencia, `banner-phone-match.png` y
   `banner-phone-profile.png`, enseñaban emparejamiento —«¡Es un match!»,
   una ficha con me gusta / no me gusta— y **se borraron del repo**, por
   encargo del propietario: «no hay match en esta versión»), `StoreLinks`
   en variante `onDark`.
7. **`LandingFooter`** — logo blanco, columnas «Producto» y «Descargas»
   (sus títulos son `h2`, no `<p>` en negrita: dan navegación por
   encabezados y no rompen el orden), tarjeta **blanca entera** con el QR
   y texto oscuro, y la línea inferior con el aviso de derechos,
   los cuatro enlaces legales (`legalLinks()`), «Accesibilidad»
   (`/accesibilidad`, que es donde el RD 1112/2018 exige poder
   encontrarla) y «Acceso al panel». **`components/layout/Footer.tsx` no
   se usa en la landing**: este pie ya lleva ese enlace.

`AppAccountScreen` lleva también `<SkipLink />` + `<main id="main-content"
tabIndex={-1}>`, igual que `Landing` y que los tres layouts de área: son
pocos controles, pero el patrón de salto al contenido es el mismo en todo
el producto.

**Lo que se retiró y por qué**: `Audiences` (cuatro tarjetas por público),
`HowItWorks`, `Privacy`, `Contact` y `components/landing/mailto.ts` — el
rediseño no tiene bloque por público ni contacto por correo, así que se
borraron en vez de dejarlos como código muerto, con sus claves de catálogo
(`landing.audiences/how/privacy/contact`). `lib/config/site.ts::contactEmail()`
**sí se conserva**, documentado en su propio docstring: se queda sin
consumidor en la interfaz, pero `NEXT_PUBLIC_CONTACT_EMAIL` ya está
publicada en `.env.example` y el formulario de contacto guardado en
plataforma sigue planificado (spec §9).

**Tipografías** (`components/landing/fonts.ts`): **Plus Jakarta Sans**
(titulares) y **DM Sans** (cuerpo), vía `next/font/google`, **solo** en la
landing y en `AppAccountScreen` — el contenedor raíz de esas dos pantallas
es el único sitio que aplica `LANDING_FONT_CLASS`, y las dos variables
(`--font-plus-jakarta-sans`/`--font-dm-sans`) se exponen a Tailwind dentro
de `@theme inline` (`app/globals.css`), que resuelve la variable **en el
sitio de uso**: fuera de ese subárbol no existen, así que el resto del
panel sigue con Geist sin cambiar un píxel. `vitest.setup.ts` mockea
`next/font/google` (no tiene implementación fuera del build de Next), igual
que ya hacía `app/layout.test.tsx` por su cuenta.

**Tamaños propios, no la escala del panel** (`components/landing/linkStyles.ts`
y cada componente): la pasada de densidad de 2026-09-20 remapeó `text-sm`…
`text-2xl` hacia abajo (13-20 px), que es lo correcto para una herramienta
de uso diario y demasiado pequeño para una página de presentación. La
landing usa píxeles explícitos (`text-[56px]`, `text-[17px]`…), así que no
hereda esa escala ni cambia si el panel vuelve a ajustarla.

**Contraste: tres desviaciones deliberadas de la web de referencia**, todas
por la regla de este fichero («`primary` solo para superficies decorativas
sin texto»):

- El **pie** va en `--color-primary-700` (5,03:1 con blanco) y no en el
  turquesa de marca (2,59:1), y **sin blancos translúcidos, ni de texto ni
  de fondo**: `text-white/70` sobre ese fondo baja a ≈3,3:1, y un
  `bg-white/10` compuesto encima (el tinte que tenía la tarjeta del QR)
  dejaba su texto blanco en 4,20:1 — por eso esa tarjeta es **blanca
  entera con texto `text-base`** (19,8:1). Todo el texto del pie es blanco
  pleno y los enlaces se subrayan al pasar por encima.
- **El anillo de foco se invierte sobre fondo de marca**: el
  `:focus-visible` global de `app/globals.css` es `--color-primary-700`,
  que sobre el pie (del mismo color) da **1,00:1** — ningún indicador al
  tabular. Los once enlaces del pie y la insignia de tienda del banner
  fuerzan `focus-visible:outline-text-inverse` (blanco: 5,03:1 sobre el
  pie, 3,90:1 sobre el extremo claro del degradado del banner), y los dos
  pares están en `lib/a11y/tokens.test.ts`. El botón negro de la cabecera
  **conserva el anillo global** (3,93:1 sobre el propio botón y 5,03:1
  sobre el blanco de la cabecera, donde lo dibuja el `outline-offset`).
  Es la misma regresión que este fichero ya documenta para el botón «?»
  de `PageHelp`: la regla de contraste del repo está tabulada contra
  blanco y se invierte sobre una superficie de marca.
- El **banner de descarga** usa el degradado `--color-primary-600`
  (`#12908b`, token nuevo, 3,90:1) → `--color-primary-700`, con la textura
  al 10 % en `mix-blend-screen` (en el peor caso deja el extremo claro en
  ≈3,4:1, por encima del 3:1 de texto grande; el titular es de 30-36 px).
  Los dos pares están en `lib/a11y/tokens.test.ts`, como el resto.
- Los **iconos de funcionalidades** van en un degradado
  `primary → primary-700` en vez del tono de marca plano, para que el glifo
  blanco quede por encima de 3:1 (son además decorativos, `alt=""`).

La **portada** sí conserva el degradado de blanco al tono de marca: su
texto es negro (`--color-text-base`), que sobre el turquesa puro da 7,6:1,
y la textura va en `mix-blend-lighten`, que solo puede aclarar el fondo.

**Insignias de tienda** (`components/landing/StoreLinks.tsx`): icono +
«Descárgalo en / App Store» en dos líneas, variante `light` (fondo claro)
y `onDark` (banner). El **nombre accesible lo fija un `aria-label`**
(`landing.stores.appStoreLabel`), no la suma de las dos líneas: son dos
nodos de texto pegados y cada navegador decide por su cuenta si mete un
espacio al calcular el nombre (jsdom no, Chrome sí) — con el `aria-label`
el nombre es idéntico en el navegador, en Vitest y en Playwright. **Su
valor es exactamente el texto visible concatenado** («Descárgalo en App
Store», «Obtenlo en Google Play», y su equivalente en los otros tres
idiomas), nunca una redacción propia: WCAG 2.5.3 «Label in Name» (nivel A)
exige que lo visible esté contenido en el nombre accesible, o quien usa
control por voz dice lo que lee y el comando no encuentra el enlace.
`target="_blank"` + `rel="noopener noreferrer"` (dominios externos).

**Imágenes**: todas con `next/image` y `width`/`height` explícitos; los SVG
llevan además `unoptimized`, porque el optimizador de Next rechaza los SVG
salvo con `dangerouslyAllowSVG`, que no se activa por un icono. Rutas
relativas de `public/landing/` (**23** ficheros: los dos móviles de
emparejamiento del banner se borraron, ver el bloque 6), siempre
permitidas por `isAllowedImageSrc`.

**Contenido y textos**: namespace `landing.*` en los cuatro catálogos
(`meta`, `header`, `hero`, `stores`, `modes`, `features`, `values`,
`download`, `footer`, `appAccount`), reescrito entero en el rediseño.
`landing.footer.copyright` lleva el año como **cadena** (`{year}`): pasado
como número, `Intl` lo formatearía «© 2.026» en es-ES. Sin botón «?» de
ayuda: está fuera de las tres áreas (decisión 3 de «ayuda por pantalla»), y
`lib/help/pageHelp.ts` no lleva entrada de la raíz.

**Configuración** (`lib/config/site.ts`, mismo patrón de lectura que
`lib/api/baseUrl.ts`: `process.env` dentro de la función, nunca a nivel de
módulo): `siteUrl()` (`NEXT_PUBLIC_SITE_URL`, sin barra final, por defecto
`http://localhost:3100`), `contactEmail()` (`NEXT_PUBLIC_CONTACT_EMAIL`,
por defecto `hola@popyplan.com`), `storeLinks()` y `legalLinks()`.

- **`storeLinks()` cae a las fichas reales** cuando las variables están
  vacías (cambio del rediseño): App Store
  `https://apps.apple.com/us/app/polypop/id6755899118` y Google Play
  `https://play.google.com/store/apps/details?id=com.tikneo.popmobile`. La
  descarga es la llamada principal de la web y no puede depender de que
  alguien declare dos variables en el entorno de `next build`. Una variable
  **declarada** con algo que no sea una URL `https:` sigue dando `null` y
  su botón no se pinta: tapar un error de configuración con la ficha real
  sería peor.
- **`legalLinks()`** son constantes, sin variable: soporte, privacidad,
  términos y eliminación de cuenta de `popyplan.com`. Son URLs fijas del
  dominio del producto, y una variable mal puesta las dejaría apuntando a
  ninguna parte justo en los enlaces que la ley exige poder encontrar.

**A diferencia de `apiBaseUrl()`, `siteUrl()` no lanza en producción**: sin
`NEXT_PUBLIC_SITE_URL` la landing se pinta igual y lo único que sale mal es
el sitemap y las tarjetas de compartir. Las variables son `NEXT_PUBLIC_*`,
así que se incrustan **en el build**, no en runtime (`.env.example` lo dice
al lado de cada una).

**SEO** (spec §6): `app/robots.ts` permite `/` y `/accesibilidad` y
prohíbe `/entidad`, `/paraguas`, `/plataforma`, `/elegir-entidad`,
`/login` y `/api`; `app/sitemap.ts` lista las dos rutas públicas (sin
`lastModified`: no hay fecha real que dar). `app/page.tsx::generateMetadata`
usa `title.absolute` —el layout raíz aplica la plantilla `"%s · Popyplan"`
y el título ya lleva la marca— más `openGraph` (`url: siteUrl()`, `locale`
en forma `es_ES` derivada de `lib/i18n/locale.ts`) y
`twitter.card = "summary_large_image"`; **ningún `images` a mano**, porque
la imagen la genera una ruta y Next la inyecta sola en los dos sitios.
**`app/opengraph-image.tsx`** (1200×630, fondo `--color-primary-700`
`#0e7c78`, la marca y la frase de portada en blanco) la rasteriza con
`ImageResponse` de `next/og`, que **viene con Next 15** (Satori + resvg,
sin tocar el `package.json`); sigue leyendo `landing.header.brand` y
`landing.hero.title` del **catálogo español** (`import es from
"@/messages/es.json"`), así que con el rediseño su frase pasó sola a
«Planes sanos, gente activa.» — un fichero de imagen de metadatos no tiene
contexto de petición con el que resolver el idioma de quien comparte, y
`alt` es además una constante de módulo. El `#0e7c78` va como literal
hexadecimal y no `var(--…)` por el mismo motivo que
`lib/metrics/mapScale.ts`: Satori solo entiende estilos en línea.

**Pruebas**: `app/page.test.tsx` cubre los cinco redirects, la landing
(`h1`, conmutador, las tres funcionalidades, los tres valores, el banner,
el pie con QR y legales, «Entrar» → `/login`, las tiendas por defecto y con
variables) y la pantalla de cuenta de app, más `generateMetadata` y `axe`
en los dos estados de render — la raíz entra así en la lista de páginas con
test de accesibilidad. `components/landing/ModeToggle.test.tsx` prueba lo
que solo se ve al interactuar (frase, `aria-pressed`, región `aria-live`).
`middleware.test.ts` fija la raíz pública (sin cookie y con el refresh
rechazado pasa; con refresh válido sigue reenviando el access).
`lib/config/site.test.ts` (100 % de líneas, ramas y funciones),
`app/robots.test.ts` y `app/sitemap.test.ts` cubren los tres módulos que sí
cuentan para el umbral de cobertura. `e2e/landing.spec.ts` (dos logins de
UI, ninguno de API): la landing sin sesión con su `h1`, `h2` y `h3` nuevos
y las fichas reales de tienda; el conmutador cambiando de frase;
`panel-demo-asociacion-bidasoa-p01@test.com` (sin rol de panel) en «Tu
cuenta es de la app»; y el titular de Bidasoa que visita `/` con sesión y
aterriza en su entidad.

**Pendientes conocidos** (revisión final de la rama, no bloquean):

- **Sin `alternates.canonical` ni `Vary: Accept-Language`** (M11): la
  landing sirve tres idiomas desde una sola URL según `pp_lang` /
  `Accept-Language`, y no declara ninguna de las dos cosas. Hoy no es un
  bug —la ruta es dinámica y Next la sirve sin caché compartida— pero en
  cuanto se ponga un CDN delante podría servir la versión en euskera a un
  visitante castellanohablante. No se añade `alternates` porque **no hay
  enrutado de idioma** (decisión 7 de i18n: ni segmento `[locale]` ni URL
  por idioma), así que no hay ninguna URL alternativa que declarar; quien
  monte el CDN tiene que añadir `Vary: Accept-Language` para `/` en
  `lib/config/securityHeaders.ts`.
- **Los mockups de la app son los de la web de referencia** (una
  comunidad de gastronomía), no capturas de planes deportivos: el brief los
  daba como recursos a reutilizar y no hay material gráfico propio de la
  app en modo «deporte» todavía. Los dos que enseñaban emparejamiento ya
  **no están** (el propietario confirmó que esa función no existe en esta
  versión); los que quedan son de comunidad, que sí es una función real.
  Sustituirlos es trabajo de diseño, no de código: basta con reemplazar los
  PNG de `public/landing/` manteniendo el nombre.
- **El pie ya no usa `components/layout/Footer.tsx`**, así que un cambio en
  el pie del panel (p. ej. un enlace legal nuevo) hay que replicarlo a mano
  en `LandingFooter`. Unificarlos exigiría una prop de variante en un
  componente que comparten los tres layouts de área, y las dos piezas no se
  parecen en nada más que en el enlace de accesibilidad.
- **El `hover` de la llamada principal** ya no comparte el problema del
  `Button.tsx` del panel (M8): `DARK_BUTTON_CLASS` usa
  `hover:bg-secondary-900` (14,46:1 con blanco). El pendiente sigue vivo
  para `components/ui/Button.tsx`, que mantiene `hover:bg-secondary-600`.

**Fuera de alcance** (fases siguientes ya acordadas, spec §9): páginas por
público (`/asociaciones`, …); formulario de contacto guardado en plataforma
(«Solicitudes»); alta de entidades desde la web; versión web de la app para
usuarios finales; material gráfico de marca. Sin cambios en el backend ni en
el móvil.
