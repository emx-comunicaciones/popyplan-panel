# Landing pública y login único — diseño

**Fecha:** 2026-09-20 · **Repo:** `popyplan-panel` (solo) · **Estado:** aprobado por secciones en conversación, pendiente de revisión escrita.

## 1. Contexto y objetivo

Encargo del propietario (2026-09-18): «una web de presentación de lo que
va a ser nuestra app, y también quiero que se haga el login desde esta
web con todos los tipos de usuarios. Me gustaría que todo el software
tenga un mismo login, para nosotros los dueños, instituciones públicas,
asociaciones y psicólogos privados y los usuarios finales».

Hoy el panel ya tiene el login único de facto: `POST /api/auth/login/`
acepta cualquier cuenta del backend y `lib/auth/area.ts::resolveArea`
decide el área (plataforma, entidad, paraguas). Lo que falta es (a) una
web pública que presente el producto y sea la puerta de entrada, y (b)
qué hacer con una cuenta que entra por la web y no tiene ningún rol de
panel (una persona usuaria de la app).

Visión de producto que manda sobre los textos (memoria del proyecto):
la app es para gente sana —planes, comunidades y actividades—; la
intervención (programas, red de apoyo, guardia) es una capa opcional para
quien está vinculado a una entidad. Vocabulario neutro: nunca presuponer
adicción.

## 2. Decisiones tomadas (preguntas 1-5)

| # | Pregunta | Decisión |
|---|---|---|
| 1 | Alcance de la primera versión | **A**: presentación + puerta de entrada. El usuario final sigue entrando solo por la app. Alta de entidades desde la web y app web quedan para fases posteriores. |
| 2 | Dónde vive | **A**: en el repo del panel, como rutas públicas. `/` es la landing, `/login` el acceso único. |
| 3 | Estructura del contenido | **A**: una sola página por bloques; páginas por público, después. |
| 4 | Cuenta sin rol de panel | **A**: pantalla «Tu cuenta es de la app» con enlaces a tiendas (si existen) y «Abrir la app». |
| 5 | Llamada para entidades | **C**: `mailto:` ahora; formulario guardado en plataforma en la fase de alta desde la web. |

Enfoque técnico aprobado: **`/` sigue resolviendo la sesión y, sin
sesión, pinta la landing** en vez de redirigir a `/login` (enfoque 1).
Descartado el enfoque 2 (mover el resolutor a `/entrar`): obligaba a
tocar los cinco `redirect("/")` del panel y el `returnTo` del login por
una ventaja marginal.

## 3. Arquitectura y rutas

### 3.1 `app/page.tsx`

Server Component público. Flujo:

1. `getServerSession()`.
2. Sin sesión → renderiza `<Landing />` (no redirige).
3. Con sesión → `resolveArea`: `plataforma` → `/plataforma`; entidad →
   `/entidad/{slug}`; paraguas → `/paraguas/{slug}`; varias elegibles →
   `/elegir-entidad` (todo como hoy).
4. Con sesión y `sin-acceso` → renderiza `<AppAccountScreen />` (§5),
   que sustituye al `ErrorState` «No tienes acceso a ningún área del
   panel».

`generateMetadata` devuelve título y descripción de la landing en el
idioma activo (`getTranslations("landing.meta")`), con Open Graph (§6).

### 3.2 `middleware.ts`

La raíz sigue en el `matcher` (refresca la sesión cuando hay cookie,
hallazgo A2). Cambia solo el camino **sin cookie** o **con refresh
rechazado** cuando `pathname === "/"`: en vez de `redirectToLogin`,
`passThroughWithoutAccess` (la petición sigue sin cabecera de acceso y
`app/page.tsx` pinta la landing). El resto de rutas del `matcher` no
cambian. `redirectToLogin` pierde la excepción de la raíz (`if
(pathname !== "/")` deja de hacer falta porque la raíz ya no llega ahí)
— se mantiene si simplifica menos de lo que rompe; decisión del
implementador con test.

### 3.3 Componentes

`components/landing/` (Server Components salvo donde se indica):

- `Landing.tsx` — compone los bloques en orden.
- `LandingHeader.tsx` — marca «Popyplan», `LanguageSwitcher`
  (cliente, existente) y `<a href="/login">` «Entrar».
- `Hero.tsx` — portada, dos llamadas (`StoreLinks` + «Entrar al panel»).
- `Audiences.tsx` — cuatro tarjetas (personas, asociaciones,
  administraciones, profesionales) con 2-3 beneficios y su llamada.
- `HowItWorks.tsx` — tres pasos.
- `Privacy.tsx` — compromisos del sistema.
- `Contact.tsx` — «Habla con nosotros» con `mailto:` por público.
- `StoreLinks.tsx` — botones de tienda, solo con URL configurada.
- `AppAccountScreen.tsx` — pantalla de cuenta de la app (§5); lleva
  `LogoutButton` (cliente, existente).

Todo texto vía `getTranslations("landing")`; ningún literal en JSX
(regla ESLint vigente). Sin botón «?» de ayuda (fuera de las tres áreas,
decisión 3 de la ayuda por pantalla).

### 3.4 Configuración

`lib/config/site.ts`:

```ts
export function siteUrl(): string        // NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100", sin barra final
export function contactEmail(): string   // NEXT_PUBLIC_CONTACT_EMAIL ?? "hola@popyplan.com"
export function storeLinks(): { appStore: string | null; playStore: string | null }
```

Las variables vacías o ausentes devuelven `null` en las tiendas (los
botones no se pintan). Documentadas en `.env.example` con la nota de que
`NEXT_PUBLIC_*` se fija en el build.

## 4. Contenido y aspecto

Bloques, en orden, con las claves de catálogo (`landing.*`):

1. **Cabecera** (`landing.header.*`): `brand`, `login`.
2. **Portada** (`landing.hero.*`): `title` («Planes, comunidades y
   actividades para vivir bien acompañado»), `subtitle`, `ctaApp`,
   `ctaPanel`.
3. **Para quién** (`landing.audiences.*`): `title`; por público
   (`people`, `associations`, `administrations`, `professionals`):
   `title`, `benefits` (array de 2-3, `t.raw`), `cta`. Beneficios sacados
   de lo que el producto hace hoy (personas/actividades/asistencia QR/
   comunicaciones/biblioteca/encuestas anónimas/programas; observatorio
   del territorio/red financiada/comparativas/informes; comunidades
   privadas/red de apoyo). Ninguna cifra ni cliente inventados.
4. **Cómo funciona** (`landing.how.*`): `title`, `steps` (array de 3).
5. **Privacidad por diseño** (`landing.privacy.*`): `title`, `items`
   (array): sin teléfonos en el panel; sin datos clínicos; encuestas
   anónimas y agregadas; recuentos con umbral mínimo de 5; nadie declara
   ser familiar de nadie; tres idiomas.
6. **Contacto** (`landing.contact.*`): `title`, `body`, `cta`,
   `subject.{associations,administrations,professionals,other}`.
7. **Pie**: `components/layout/Footer.tsx` existente + enlace de
   contacto.

Aspecto: tokens del panel (`app/globals.css`), criterio minimalista de
la pasada de densidad pero con más aire (`py-12`/`py-16` por sección,
`max-w-5xl`), `primary` solo en fondos decorativos, `primary-700` en
texto y botones, sin sombras, sin imágenes externas. Responsive desde
360 px. Orden de encabezados `h1` (portada) → `h2` (sección) → `h3`
(tarjeta). Foco visible global ya existente.

Textos en `messages/{en,es,eu,ca}.json` (inglés = cadena fuente, es
revisado por el propietario, eu/ca revisión posterior, misma regla que el
resto del panel). Test de paridad vigente.

## 5. Pantalla «Tu cuenta es de la app»

`AppAccountScreen` (`landing.appAccount.*`): título («Tu cuenta es de la
app Popyplan»), explicación (el panel es para asociaciones,
administraciones y profesionales; tu espacio está en la app), `StoreLinks`
(si hay URL), botón «Abrir la app» (`<a href="popyplan://">`, siempre; si
no está instalada el navegador no hace nada), y `LogoutButton`. Se pinta
solo con sesión y `resolveArea === "sin-acceso"`. Las cuentas con rol de
panel nunca la ven. Las claves `pages.home.noAccess*` actuales se
retiran de los cuatro catálogos al quedarse sin consumidor.

## 6. SEO, compartir y robots

- `app/robots.ts`: `allow: ["/", "/accesibilidad"]`, `disallow:
  ["/entidad", "/paraguas", "/plataforma", "/elegir-entidad", "/login",
  "/api"]`, `sitemap: ${siteUrl()}/sitemap.xml`.
- `app/sitemap.ts`: `/` y `/accesibilidad` con `siteUrl()`.
- `generateMetadata` de `app/page.tsx`: `title`, `description`,
  `openGraph {title, description, url, siteName, images:
  ["/og.png"], locale}`, `twitter.card = "summary_large_image"`.
- `public/og.png` (1200×630): fondo `primary-700`, nombre «Popyplan» y
  la frase de portada en español; se sustituye cuando haya material de
  marca. Generada con un script único (no se commitea el script).
- `<html lang>` ya es dinámico (i18n).

## 7. Pruebas

- `app/page.test.tsx`: sin sesión pinta la landing (h1, cuatro tarjetas,
  enlace «Entrar» a `/login`, sin botones de tienda cuando las variables
  están vacías, con ellos cuando no); con sesión redirige a cada área
  (casos existentes); `sin-acceso` pinta `AppAccountScreen` con «Abrir
  la app» y «Cerrar sesión»; `axe` sin violaciones en los dos estados.
  `generateMetadata` con título/descripción/Open Graph.
- `middleware.test.ts`: `/` sin cookie pasa sin cabecera de acceso (no
  redirige); `/` con refresh rechazado pasa igual; `/entidad/x` sin
  cookie sigue redirigiendo a `/login?returnTo=`.
- `lib/config/site.test.ts`: valores por defecto, barra final, tiendas
  vacías → `null`.
- `app/robots.test.ts`, `app/sitemap.test.ts`.
- `lib/i18n/messages.test.ts` (paridad) y `lib/help/pageHelp.test.ts`
  (completitud) siguen verdes sin cambios.
- `e2e/landing.spec.ts`: sin sesión `/` muestra la landing y «Entrar»
  lleva a `/login`; `panel-demo-asociacion-bidasoa-p01@test.com` (sin
  rol de panel) entra y ve «Tu cuenta es de la app»; el titular de
  Bidasoa con sesión que visita `/` aterriza en `/entidad/asociacion-
  bidasoa`. Dos logins de UI.
- Cobertura: `lib/config/site.ts`, `app/robots.ts`, `app/sitemap.ts`
  entran en la medición (`lib/**`, `app/**/*.ts`); umbral 99,7 intacto.

## 8. Variables de entorno nuevas

| Variable | Uso | Por defecto |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL absoluta para sitemap y Open Graph | `http://localhost:3100` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | destino del `mailto:` | `hola@popyplan.com` |
| `NEXT_PUBLIC_APP_STORE_URL` | botón App Store | vacío → oculto |
| `NEXT_PUBLIC_PLAY_STORE_URL` | botón Google Play | vacío → oculto |

## 9. Fuera de alcance (fases siguientes ya acordadas)

Páginas por público (`/asociaciones`, …); formulario de contacto guardado
en plataforma («Solicitudes»); alta de entidades desde la web; versión web
de la app para usuarios finales; material gráfico de marca. Sin cambios en
backend ni en móvil.
