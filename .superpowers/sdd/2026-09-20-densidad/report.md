# Densidad + selector de idioma desplegable — informe

Rama `feature/densidad-y-selector-idioma` (worktree `.worktrees/densidad`),
sobre `develop` `89a56e0`. Tres commits:

| SHA | Qué |
|---|---|
| `08aee34` | `feat(ui)`: selector de idioma como `<select>` |
| `3113470` | `refactor(ui)`: tokens, componentes compartidos, cabeceras y menú lateral |
| `821623a` | `refactor(ui)`: recorte proporcional en páginas y paneles |

(el commit de documentación —`CLAUDE.md`/`AGENTS.md` y este informe— va
después, ver el final).

## 1. Selector de idioma

`components/layout/LanguageSwitcher.tsx`: los tres `Button` «ES · EU · CA»
(40px cada uno, 3 paradas de tabulación) pasan a **un `<select>` de 32px**
con los idiomas por su nombre completo («Español · Euskara · Català»,
claves `language.es/eu/ca` **ya existentes**) y `<label className="sr-only">`
«Idioma» (`language.title`, también existente). **Ninguna clave nueva** en
`messages/{en,es,eu,ca}.json`.

Efectos secundarios idénticos a los de antes: `POST /api/lang` → si hay
sesión, `PATCH` del idioma de la cuenta (`useUpdatePreferredLanguage`) →
`queryClient.invalidateQueries()` → `router.refresh()`. Se conserva el
fondo blanco (hallazgo I3 de i18n: el control vive sobre la cabecera de
marca, que con la entidad por defecto es `primary-700`).

Añadido propio: un estado optimista `selected`. Un `<select>` controlado
solo por `useLocale()` volvería visualmente al idioma anterior entre el
`change` y el `router.refresh()`; con `selected` se pinta ya el elegido, y
si la cookie no se pudo fijar se vuelve al idioma activo de verdad.

## 2. Medidas, componente por componente

Escala tipográfica: bloque `@theme` nuevo en `app/globals.css` que baja un
peldaño toda la escala `text-*` de Tailwind. Es *la* fuente de los tamaños
del panel (431 usos de `text-sm`), así que se cambia ahí y no en 200
ficheros. El tamaño base del navegador sigue en 16px y nada baja de 12px.

| Clase | Antes | Ahora |
|---|---|---|
| `text-xs` | 12px | 12px (mínimo del panel) |
| `text-sm` | 14px | 13px |
| `text-base` | 16px | 15px |
| `text-lg` | 18px | 16px |
| `text-xl` | 20px | 18px |
| `text-2xl` | 24px | 20px |

| Componente | Antes | Ahora |
|---|---|---|
| Cabecera de área (3 layouts) | ~72px, título 18px, controles 40px | **48px**, título 15px semibold, controles 32px, logo 28px |
| `Button` (3 variantes) | 40px, texto 14px, padding 16px | **32px** (`min-h-8 py-1`), 13px, padding 12px |
| Campos (`input`/`select`/`textarea`, 97 sitios) | 36-40px | **32px** (`py-1.5`) |
| Menú lateral | 224px, filas ~36px, 14px, sin estado activo | **200px**, filas **30px**, 13px, activo con fondo tenue + `aria-current` |
| `<h1>` de página (33) | 24px + subtítulo genérico en Inicio | **18px**, sin subtítulo |
| `Card` | padding 16px, sombra | padding **12px**, borde 1px, radio 8px, **sin sombra** |
| Cifra / etiqueta de `StatCard` | 24px / 14px | **20px** / **12px** |
| `Table` compartida + 67 celdas a mano | filas ~37px, 14px | filas **~31px**, 13px, celdas 12×6px |
| Separación entre bloques / entre tarjetas | 24px / 16px | **16px** / **12px** |
| `Dialog` / `ConfirmDialog` | padding 24px, título 16px | padding **16px**, título 16px |
| `Badge` | `px-2.5`, 12px | `px-2`, 12px |
| `EmptyState` / `ErrorState` | padding 32px | padding **16px**, título 15px |
| `Footer` | 24×16px, 14px | **16×8px**, 12px |
| Botón «?» (`PageHelp`) | 40px | **32px**, mismo fondo blanco |
| `<main>` de área | padding 24px | **16px** |
| Selectores de color (Configuración) | 40×64px | **32×56px** |

Ningún objetivo interactivo baja de 32px de alto; ningún texto, de 12px;
`:focus-visible` y los tokens de color, intactos (`lib/a11y/tokens.test.ts`
sin tocar y en verde).

## 3. Ficheros tocados

- **Fuente de estilos**: `app/globals.css` (bloque `@theme` nuevo).
- **Compartidos**: `components/ui/{Button,Card,Table,Badge,Dialog,ConfirmDialog,EmptyState,ErrorState}.tsx`,
  `components/metrics/StatCard.tsx`, `components/layout/Footer.tsx`,
  `components/help/PageHelp.tsx`.
- **Nuevo**: `components/layout/SideNav.tsx` + `SideNav.test.tsx` — el
  `<nav>` que los tres layouts copiaban, con la sección actual marcada.
  Es `"use client"` (necesita `usePathname()`); las etiquetas llegan ya
  traducidas desde cada layout, así que no traduce nada.
- **Layouts**: `app/{entidad/[slug],paraguas/[slug],plataforma}/layout.tsx`.
- **Páginas y paneles**: 70 ficheros en el tercer commit (`<h1>`, `gap-6`,
  rejillas, campos de formulario y celdas de tabla), todos recortes
  mecánicos de clases de tamaño.
- **Catálogos**: `messages/{en,es,eu,ca}.json` pierden
  `entidad.inicio.panelSubtitle` (el subtítulo «Panel de `<entidad>`.» que
  el encargo pedía quitar). Ninguna clave añadida.

## 4. Tests ajustados (ninguno borrado) y por qué

- `components/layout/LanguageSwitcher.test.tsx`: los tres tests de botones
  pasan a comprobar el `<select>` (opciones por nombre completo, valor
  según `useLocale()`, etiqueta `sr-only`). El de fondo blanco (I3) y el de
  invalidación de caché (M12) se conservan sobre el control nuevo. Tres
  tests nuevos: altura de 32px, estado optimista, y vuelta al idioma activo
  si la cookie falla. 17 tests, todos por comportamiento.
- `app/{entidad/[slug],paraguas/[slug],plataforma}/layout.test.tsx`: cada
  uno fija que el selector es un `<select>` etiquetado «Idioma», junto a la
  aserción ya existente del botón de ayuda.
- `app/(auth)/login/page.test.tsx`: lo mismo para el login, donde el
  selector es además el primer control tabulable.
- `app/entidad/[slug]/page.test.tsx`: dos tests adaptados al subtítulo
  retirado. El segundo («si falla la ficha de la entidad, usa el nombre de
  la membresía») probaba un camino que ya no existe —sin subtítulo, la
  página ni siquiera pide la ficha—, así que pasa a fijar justamente eso
  (`expect(serverFetchMock).not.toHaveBeenCalled()`), en vez de borrarse.
- `components/layout/SideNav.test.tsx` (nuevo, 6 tests): enlaces, sección
  activa por `aria-current` + fondo tenue + `font-semibold`, subpágina que
  marca su sección y no «Inicio», ruta fuera del menú, y `axe`.
- `e2e/idioma.spec.ts` y `e2e/accesibilidad.spec.ts`: `selectOption` en vez
  de clic en botón, y una sola parada de tabulación en `/login`. **No
  ejecutados** (el encargo lo excluye); quedan coherentes con la UI nueva.
  Ojo documentado en el propio spec: la etiqueta del selector está
  traducida («Idioma» / «Hizkuntza»), el `value` no.
- `components/help/PageHelp.test.tsx` no cambia: su aserción es `bg-white`,
  que se conserva; solo cambia el tamaño del botón, que no fija.

## 5. Claves de catálogo

Añadidas: **ninguna**. Retirada: `entidad.inicio.panelSubtitle` en los
cuatro idiomas (con su único uso). `lib/i18n/messages.test.ts` (paridad)
en verde.

## 6. Verificación

```
npm run typecheck   OK
npm run lint        OK (0 avisos)
npx vitest run --coverage
  Test Files  178 passed (178)
  Tests       1748 passed (1748)
  Statements  99.58 % (2647/2658)
  Branches    96.55 % (1457/1509)
  Functions   99.70 % (687/689)
  Lines       99.88 % (2514/2517)   ← umbral 99,7
```

`npm run build` no se ejecuta (excluido del encargo). `npm run e2e`
tampoco.

## 7. Capturas

`.superpowers/sdd/2026-09-20-densidad/shots/`, 1440×900, Chromium:

| Pantalla | Antes | Después |
|---|---|---|
| `/login` | `before-login.png` | `after-login.png` |
| `/entidad/asociacion-bidasoa` | `before-inicio.png` | `after-inicio.png` |
| `/entidad/asociacion-bidasoa/personas` | `before-personas.png` | `after-personas.png` |

Servidor propio `next dev --port 3102` desde este worktree contra el
backend de `:8001`, **un solo login** (`panel-titular-asociacion-bidasoa@test.com`),
script de captura borrado y servidor parado al terminar; `:3100` y `:3000`
sin tocar. En Personas se ven **19 filas** donde antes cabían 15.

## 8. Lo que se ha dejado a propósito más grande (o igual)

- **`text-xs` se queda en 12px** y es el suelo: etiquetas de `StatCard`,
  `Badge` y `Footer`. No se baja de ahí aunque diera más densidad.
- **Todo control interactivo se queda en 32px**, aunque 28px habría
  apretado más: es el mínimo que fija el encargo y la práctica de
  accesibilidad del repo.
- **Filas de tabla a ~31px, no 32px exactos**: el encargo pedía a la vez
  «filas 32px» y «padding celda 8px 12px», que con texto de 13px no pueden
  cumplirse las dos. Se ha priorizado la altura de fila (6px verticales);
  el relleno horizontal sí es el pedido, 12px.
- **Título del `Dialog` a 16px** (no 15px como el resto de títulos
  medianos): lo pedía el encargo explícitamente y evita que el `<h2>` del
  diálogo quede igual que su cuerpo.
- **La sombra de la tarjeta del login y la del diálogo se mantienen**: son
  superficies flotantes sobre el fondo, no tarjetas en el flujo; la sombra
  que sí se quitó es la de `Card`, que era la repetida decenas de veces.
- **`app/accesibilidad`** solo baja el relleno y el `<h1>`: es una página
  pública de lectura larga, no una pantalla de trabajo, así que conserva
  su ritmo de párrafo.

## 9. Riesgos / cosas que quien revise debería mirar

1. **`text-2xl` ya no son 24px sino 20px.** El remapeo de la escala es lo
   que hace que la pasada sea una sola línea de cambio en vez de 400;
   queda documentado en `app/globals.css` y en `CLAUDE.md`, pero es el
   detalle que más puede sorprender.
2. **`SideNav` es el primer componente cliente en el menú lateral.** Los
   tres layouts siguen siendo Server Components; solo el `<nav>` se
   hidrata, y únicamente para leer `usePathname()`.
3. La resolución de «sección activa» por `href` más largo cubre
   subpáginas (`/personas/42` marca «Personas»); si algún día dos
   secciones comparten prefijo exacto, habría que revisarla.
