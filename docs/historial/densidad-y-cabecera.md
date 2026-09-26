# Historial — Densidad del panel, selector de idioma y menú de cuenta

> Texto trasladado tal cual desde el `CLAUDE.md` raíz (2026-09-26) para no cargarlo en cada sesión. Las referencias a «más arriba/abajo» apuntan al `CLAUDE.md` original; busca la sección en `docs/historial/`.

## Densidad del panel y selector de idioma desplegable (2026-09-20)

Encargo del propietario: «quiero que el selector de idiomas sea una
desplegable y los diseños más minimalistas del panel, está todo enorme».
Brief y capturas antes/después en
`.superpowers/sdd/2026-09-20-densidad/` (`brief.md`, `report.md`,
`shots/{before,after}-{login,inicio,personas}.png`).

**Escala tipográfica remapeada, no clase a clase** (`app/globals.css`,
bloque `@theme` nuevo, documentado en el propio fichero): la escala
`text-*` de Tailwind baja un peldaño, porque es la fuente real de todos
los tamaños del panel y `text-sm` era el tamaño de trabajo de casi todo
(controles, tablas, menú, prosa).

| Clase | Antes | Ahora | Dónde |
|---|---|---|---|
| `text-xs` | 12px | 12px | etiquetas de `StatCard`, `Badge`, `Footer` |
| `text-sm` | 14px | **13px** | controles, celdas, menú, párrafos |
| `text-base` | 16px | **15px** | títulos de `EmptyState`/`ErrorState`, marca de la cabecera |
| `text-lg` | 18px | **16px** | título de `Dialog`, `<h2>` de sección |
| `text-xl` | 20px | **18px** | `<h1>` de página |
| `text-2xl` | 24px | **20px** | cifra de `StatCard` |

**Ojo**: escribir `text-2xl` en este repo da 20px, no 24px. El tamaño
base del navegador **no** se toca (sigue en 16px: nada depende de un
`html { font-size }` reducido) y **ningún texto baja de 12px**. Las
alturas de línea van en rem, no en la proporción calculada por defecto
de Tailwind, para que filas y controles salgan a medida exacta
(13px + 6px + 6px = 30px de fila, 31px con el borde).

**Medidas de los componentes compartidos** (todo objetivo interactivo se
queda en **32px** de alto como mínimo, y `:focus-visible` no se toca):

- `Button` (las tres variantes): 40 → **32px** (`min-h-8 px-3 py-1`;
  `min-h-`, no `h-`, para que un texto largo a dos líneas no se recorte).
- Campos de formulario (`input`/`select`/`textarea`, 97 sitios con la
  clase común del panel): `py-2` → `py-1.5`, 36-40 → **32px**.
- `Card`: relleno 16 → **12px**, borde de 1px, radio 8px, **sin sombra**.
- `StatCard`: etiqueta a 12px, cifra a 20px.
- `Table` (y las 67 celdas de tablas escritas a mano, con las mismas
  medidas): celdas `px-3 py-1.5`, filas de ~37 → **~31px**.
- `Dialog`/`ConfirmDialog`: relleno 24 → **16px**, título a 16px.
- `Badge`, `EmptyState`, `ErrorState`, `Footer`, botón «?» de `PageHelp`
  (que se queda en 32px con su fondo blanco): en proporción.
- Cabecera de las tres áreas: ~72 → **48px** (título 15px, controles de
  32px, logo de 28px). `<main>`: relleno 24 → 16px. Separación entre
  bloques `gap-6` → `gap-4`; rejillas de tarjetas `gap-4` → `gap-3`.
- `<h1>` de las 33 páginas: 24 → 18px. Fuera el subtítulo genérico
  «Panel de `<entidad>`.» del Inicio de entidad (el nombre ya preside la
  cabecera) — la clave `entidad.inicio.panelSubtitle` sale de los cuatro
  catálogos y la página deja de pedir la ficha de la entidad.

**`components/layout/SideNav.tsx` (nuevo)**: el `<nav>` lateral que los
tres layouts copiaban, ahora de **200px** con filas de **30px** y texto
de 13px. Es `"use client"` porque marca la sección actual con
`usePathname()`, que un Server Component no puede llamar; las etiquetas
llegan ya traducidas desde cada layout, así que no traduce nada. La
sección activa es la de `href` **más largo** que case con el `pathname`
(exacto o como prefijo de segmento): comparar solo por prefijo marcaría
«Inicio» —cuyo `href` es la raíz del área— en todas las pantallas, y el
desempate por longitud lo resuelve sin una bandera `exact` por elemento.
Se marca con `aria-current="page"` **y** con fondo tenue + `font-semibold`
(nunca solo color); el par `text-base`/`primary-100` es uno de los ya
auditados en `lib/a11y/tokens.test.ts` (16,93:1) — `text-primary-700`
sobre `primary-100` **no** vale, la regla de contraste de este fichero
está tabulada contra blanco.

**Selector de idioma** (`components/layout/LanguageSwitcher.tsx`): los
tres botones «ES · EU · CA» pasan a un único `<select>` de 32px con los
idiomas por su nombre completo (claves `language.es/eu/ca`, ya existentes
— no hizo falta ninguna clave nueva) y `<label>` «Idioma»
(`language.title`) solo para lectores de pantalla. Los efectos son los
mismos de la tarea 6 de i18n (`POST /api/lang` → `PATCH` del idioma de la
cuenta si hay sesión → `invalidateQueries()` → `router.refresh()`);
conserva su fondo blanco (I3) porque vive sobre la cabecera de marca. Un
estado optimista (`selected`) evita que el control vuelva visualmente al
idioma anterior entre el `change` y el refresco, y se descarta si la
cookie no se pudo fijar. **En `/login` ocupa ahora una sola parada de
tabulación** (antes tres): `e2e/accesibilidad.spec.ts` lo refleja, y
`e2e/idioma.spec.ts` usa `selectOption` localizando el control por su
etiqueta, que **está traducida** («Idioma» en español, «Hizkuntza» en
euskera) mientras el `value` sigue siendo el código ISO.

## Menú de cuenta en la cabecera (2026-09-20)

Encargo del propietario: «pon estos botones bajo un icono de login típico,
que se vea el idioma, cerrar sesión y el correo electrónico».
`components/layout/UserMenu.tsx` (`"use client"`) sustituye en las tres
cabeceras de área al trío `LanguageSwitcher` + `LogoutButton` sueltos: un
botón redondo de 32 px con icono de persona (`aria-label` «Cuenta de
`<email>`», `aria-haspopup="true"`, `aria-expanded`, `aria-controls`)
abre un panel anclado a la derecha (`role="group"` con nombre «Cuenta»,
no un `role="menu"` ARIA: dentro hay un `<select>` y un botón, no
`menuitem`s) con el nombre de la cuenta (`lib/auth/displayName.ts`,
`first_name` + `last_name`, o solo el email si no hay), el email, el
selector de idioma con su etiqueta visible (`LanguageSwitcher
labelVisible`) y «Cerrar sesión» (`LogoutButton className="w-full"`).
Al abrir, el foco pasa al selector; `Escape` cierra y devuelve el foco al
botón; un clic fuera y un cambio de `pathname` cierran. El botón «?» de
`PageHelp` se queda fuera, a su izquierda: es ayuda de la pantalla, no de
la cuenta. En `/login` el selector sigue suelto (no hay cuenta). Los tres
`layout.test.tsx` comprueban el botón de cuenta; `e2e/idioma.spec.ts`
abre el menú antes de cambiar de idioma dentro del área.
