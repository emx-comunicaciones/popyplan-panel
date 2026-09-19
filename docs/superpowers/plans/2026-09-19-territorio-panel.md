# Territorio y administraciones multinivel (bloque 1) — plan del panel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/paraguas/[slug]` en el área de administración con
cuatro secciones (Inicio, Territorio, Red financiada, Informes), donde
Territorio es un observatorio por municipio con mapa de burbujas, tabla,
comparativa y ficha de municipio; y dar a plataforma y entidad el control
de sede, nivel administrativo y territorio declarado — con los dos
renombres de interfaz que abren el bloque (Recursos → Biblioteca,
Contratos → Suscripciones).

**Architecture:** Nada de lógica nueva de agregación en el panel: las
rutas `/api/panel/territorio/{org_id}/*` devuelven el **mismo esquema
fijo** que paraguas, así que `useMetrics`/`useCompare`/`useExport` solo
ganan un ámbito más (`'territorio'`) y un `kind` de error más (409 →
`sin_territorio`), y los componentes compartidos de `components/metrics/*`
(`StatCard`, `PeriodSelector`, `MetricsTable`, `ComparativaTable`,
`ExportPanel`) se reutilizan tal cual. Lo único genuinamente nuevo es el
mapa (`react-leaflet` cargado con `next/dynamic` + `ssr:false`, mockeado
en Vitest igual que `ResponsiveContainer` de `recharts`), sus helpers puros
de escala (`lib/metrics/mapScale.ts`) y la ficha de municipio
(`hooks/usePlaceSheet.ts` + un panel lateral sobre `components/ui/Dialog.tsx`).

**Tech Stack:** Next.js 15 (App Router, Server Components para los gates
de sesión/rol), TypeScript estricto, Tailwind CSS 4, TanStack Query 5,
next-intl v4 sin enrutado de idioma (`messages/{en,es,eu,ca}.json`),
Vitest + Testing Library + `vitest-axe`, Playwright para e2e,
`react-leaflet` 5 + `leaflet` 1.9 (dependencia nueva de este plan).

**Spec:**
`/Users/mikelerrasti/Code/popyplan/.worktrees/territorio/docs/superpowers/specs/2026-09-19-territorio-administraciones-design.md`
(§4 panel, §5 pruebas del panel, §7 despliegue). Hechos del repo
verificados leyendo el árbol real:
`/Users/mikelerrasti/Code/popyplan/.worktrees/territorio/.superpowers/sdd/2026-09-19-territorio/repo-facts.md`
(sección «Panel»).

## Global Constraints

- **Worktree:** todo el trabajo va en
  `/Users/mikelerrasti/Code/popyplan-panel/.worktrees/territorio` (rama
  `feature/territorio-administraciones`, base `develop`). **Nunca** se
  toca `/Users/mikelerrasti/Code/popyplan-panel` (sirve el servidor de
  desarrollo del propietario) ni `.worktrees/demo`. Rutas absolutas en
  todos los comandos.
- **Verificación antes de cerrar cada tarea:**
  `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
  (desde la raíz del worktree). El e2e (`npm run e2e`) solo en la Tarea 8,
  y solo con el backend de la rama de territorio sembrado en local.
- **Cobertura:** umbral con ratchet en `vitest.config.ts`
  (`coverage.thresholds.lines: 99.7`), medido sobre `lib/**`, `hooks/**`,
  `app/**/*.ts` y `middleware.ts` — **nunca** los `.tsx` de páginas,
  layouts o componentes. Todo `lib/**.ts` y `hooks/**.ts` nuevo de este
  plan necesita test hasta la última rama; los `.tsx` se prueban por
  comportamiento.
- **i18n:** ningún literal de interfaz en el código. Cada texto es una
  clave de `messages/{en,es,eu,ca}.json` (`en` es la cadena fuente, `es`
  el literal español, `eu` batua, `ca` forma general del IEC — glosario
  en `docs/i18n/glosario.md`). `lib/i18n/messages.test.ts` exige paridad
  exacta de claves hoja y de parámetros ICU entre los cuatro catálogos, y
  que ningún valor esté vacío. `eslint.config.mjs` aplica
  `react/jsx-no-literals` (`noStrings: true, ignoreProps: true`) y una
  guarda `no-restricted-syntax` sobre `aria-label|aria-description|placeholder|title|alt`
  en `app/**/*.tsx` y `components/**/*.tsx`.
- **Los tests afirman texto traducido, nunca claves**: `test-utils/render.tsx`
  envuelve en `NextIntlClientProvider locale="es" messages={es}` y
  `vitest.setup.ts` mockea `next-intl/server` contra `messages/es.json`
  real; una clave que falte rompe el test que la usa.
- **Errores tipados:** un hook (`.ts` plano) no puede llamar a `t()`;
  construye su `Error` con `kind` + `message` en español + `detail?`
  verbatim del backend (`lib/api/drfError.ts::detailOf`). El componente
  traduce con `lib/i18n/errorKindText.ts::errorKindText(error, keys, t,
  fallbackKey)` y un `Record<Kind, string>` explícito de claves (nunca
  claves construidas por concatenación). El `detail` del backend manda
  sobre la traducción por `kind` — y el backend ya responde en el idioma
  de `Accept-Language`, que `lib/api/client.ts` envía siempre.
- **Regla de supresión:** `lib/metrics/format.ts::formatCount`/`formatPct`
  son el **único** sitio que decide si una celda se pinta `<5`, `—` o el
  valor. Ningún componente nuevo puede decidirlo por su cuenta.
- **Accesibilidad:** cada página nueva con `page.test.tsx` estrena un
  test «no tiene violaciones de accesibilidad (axe)» como primer test de
  su `describe`, con `axe` de `@/test-utils/axe` (que desactiva `region`
  y `color-contrast`, ver su docstring). Toda `<table>` lleva `caption`.
  Todo texto usa `primary-700`, nunca `primary` (que queda para
  superficies decorativas sin texto — los rellenos del mapa entran en
  esa excepción).
- **Tipos del contrato:** `lib/api/types.generated.ts` se regenera con
  `npm run gen:types` desde `../popyplan/docs/schema.yaml`. **Mientras la
  rama de backend no esté fusionada y el esquema regenerado**, los campos
  nuevos se declaran a mano en `lib/api/types.ts` con un docstring que
  diga de dónde salen y que se retiran al regenerar (patrón ya
  documentado en ese fichero para `Me.preferred_language`).
- **Contrato del backend que este plan consume** (spec §3, el plan del
  backend se escribe en paralelo; estos son los valores exactos):
  - `GET /api/panel/territorio/{org_id}/metrics/?since&until&group_by=place|comarca|province|month|year`
  - `GET /api/panel/territorio/{org_id}/compare/?since&until&group_by=place|comarca|province` (**obligatorio**)
  - `GET /api/panel/territorio/{org_id}/export/?since&until&format=csv|pdf&group_by=…`
  - Los tres: mismo esquema fijo que paraguas; **403** si la organización
    no es administración; **409** `{"detail": "Esta administración no
    tiene territorio declarado."}` (traducido por `Accept-Language`).
  - `GET /api/panel/territorio/{org_id}/places/{ine_code}/?since&until` →
    `{place:{ine_code,name,name_local,comarca_name_es,prov_name,latitude,longitude},
    events:{held,upcoming}, people:{value,suppressed},
    attendance:{rate,suppressed}, communities:{count},
    organizations_based_here}`; **404** fuera del territorio.
  - `GET /api/places/?ine_code=a,b&search=&ccaa_code=&prov_code=&comarca_code=&page=`
    → listado paginado DRF de
    `{ine_code,name,name_local,comarca_code,comarca_name_es,comarca_name_eu,
    prov_code,prov_name,ccaa_code,ccaa_name,latitude,longitude}`.
    `ccaa_code`/`prov_code`/`comarca_code` son filtros de **coincidencia
    exacta**, combinables entre sí y con `search`/`ine_code`; `count` de
    la respuesta paginada es el total que casa con el filtro, no el
    tamaño de la página — es lo que hace posible la vista previa «N
    municipios» de la Tarea 7 sin traerse las filas.
  - `GET /api/users/users/me/` → cada `org_memberships[]` gana
    `is_administration: boolean` y
    `admin_level: "ayuntamiento"|"mancomunidad"|"diputacion"|"gobierno"|""`.
  - `PATCH /api/organizations/{id}/` acepta `place` (código INE),
    `admin_level`, `territory_kind` (`ccaa|provincia|comarca|municipios|""`)
    y `territory_code` (texto; lista de códigos INE separados por comas
    cuando `territory_kind === "municipios"`). `Organization` gana esos
    cuatro campos más `territory_places_count` (solo lectura).
- **Dependencia entre tareas:** las Tareas 1-7 se prueban enteras con
  mocks de Vitest y **no** necesitan el backend. La Tarea 8 (e2e) exige
  la rama de backend fusionada, migrada y con la demo sembrada (spec §6:
  territorio provincia 20/48 a las dos diputaciones, sede a todas las
  organizaciones, un ayuntamiento de Irun y una asociación de Bizkaia
  sin colgar de la diputación).

---

## Decisiones tomadas al escribir este plan (ambigüedades de la spec)

Se documentan aquí, no dentro de una tarea, porque afectan a varias:

1. **Color de las burbujas.** La spec §4.2 dice «tamaño = actividades,
   color = tasa de asistencia», pero también que el componente «recibe
   las filas de `by_place`» — y `ByPlaceRow` (`docs/PANEL.md` §1.4,
   `lib/api/types.generated.ts`) es `{key, label, events, people,
   suppressed}`: **no lleva tasa de asistencia por fila** (limitación ya
   documentada en `CLAUDE.md`, «Desviación conocida» de la tarea W2).
   Resolución: el **tamaño** codifica `events` y el **color** codifica
   `people` (la métrica suprimible), con gris para las suprimidas. Se
   anota como pendiente de backend: una tasa por fila en `by_place`, o
   un `group_by=place` de `compare/` dedicado solo al color, permitirían
   la lectura literal de la spec.
2. **Alcance de los renombres.** Se renombran las **rutas**, las entradas
   de menú, las claves `pages.*`/`help.*` (que el registro de ayuda exige
   que coincidan con la pantalla) y **todos los textos visibles**. **No**
   se renombran los ficheros de componente (`RecursosPanel.tsx`,
   `ContratosPanel.tsx`) ni los namespaces internos de catálogo
   (`entidad.recursos.*`, `plataforma.contratos.*`), por el mismo
   criterio que la propia spec aplica a la API: «Los nombres de la API
   (`/api/panel/entidad/{id}/resources/`) no cambian». Dentro de
   Suscripciones, la pestaña «Contratos» **sigue** llamándose así: lo que
   se renombra es la sección, no el objeto de dominio `Contract`.
3. **Vista previa «N municipios».** El backend **sí** expondrá filtros
   `ccaa_code`/`prov_code`/`comarca_code` en `GET /api/places/`
   (coincidencia exacta, combinables con `search`/`ine_code`, respuesta
   paginada cuyo `count` es el total del filtro) — decidido por el
   coordinador del bloque al revisar este plan, así que la spec §3.3 se
   lee ampliada con esos tres parámetros. Resolución: con
   `territory_kind === "municipios"` la vista previa cuenta los códigos
   escritos en el cliente (exacto y sin red); con uno de los tres atajos,
   pide `count` al backend con el filtro correspondiente y el código
   escrito, **con retardo** (`useDebouncedValue`, igual que el resto de
   buscadores del panel). `territory_places_count` sigue siendo el valor
   **guardado**, el que se muestra cuando todavía no se ha escrito ningún
   código o tras guardar. No queda nada pendiente de backend por este
   punto.
4. **Quién edita sede desde plataforma.** La spec §4.3 dice «sede … para
   toda organización» sin acotar rol, pero §2.3 dice «Solo la plataforma
   (`superadmin`) … `place` sí lo puede editar el `titular` de la entidad
   en su configuración». Resolución: desde plataforma, editar sede, nivel
   y territorio es **solo `superadmin`** (el resto lo ve en modo lectura,
   mismo patrón que «Paraguas»); desde la entidad, el `titular` edita su
   propia sede en Configuración.
5. **Tarjeta «entidades con sede» del Inicio.** No existe ningún agregado
   de organizaciones con sede en el territorio
   (`organizations_based_here` es **por municipio**, spec §3.2).
   Resolución: el Inicio pinta tres tarjetas de territorio (actividades,
   personas, comunidades) y, en el bloque de red financiada, el recuento
   de entidades hijas (`useOrganizations({parent: orgId}).count`), que sí
   existe. Anotado como pendiente de backend.
6. **«Panel lateral» de la ficha de municipio.** El panel no tiene
   primitiva de *drawer*. Resolución: `components/ui/Dialog.tsx` gana una
   prop `placement?: "center" | "side"` (por defecto `"center"`, sin
   cambio para sus seis consumidores actuales) — así la ficha hereda el
   foco atrapado, `Escape` y la devolución del foco ya probados, sin
   duplicar esa mecánica.
7. **Accesibilidad del mapa.** El contenedor es `role="img"` con
   `aria-label`, con `zoomControl={false}` y `keyboard={false}` para que
   no haya controles enfocables dentro de un rol no interactivo; **toda**
   acción del mapa (abrir la ficha de un municipio) está duplicada en un
   botón «Ver ficha» de la tabla de debajo, que es teclado-accesible. Así
   ningún dato ni ninguna acción existe solo en el mapa, que es lo que
   pide la spec §4.2.

---

## Estructura de ficheros

**Nuevos:**

| Fichero | Responsabilidad |
|---|---|
| `lib/config/redirects.ts` (+ `.test.ts`) | Las dos redirecciones permanentes de los renombres, en `lib/` para poder probarlas (mismo patrón que `imagePatterns.ts`/`securityHeaders.ts`). |
| `lib/metrics/mapScale.ts` (+ `.test.ts`) | Funciones puras: radio y color de burbuja, unión de `by_place` con coordenadas. Sin JSX, sin React. |
| `hooks/usePlaceSheet.ts` (+ `.test.tsx`) | `GET …/territorio/{org}/places/{ine}/`, errores tipados. |
| `hooks/usePlaces.ts` (+ `.test.tsx`) | `usePlacesByIne` (coordenadas del mapa, sigue páginas), `useSearchPlaces` (buscador de sede, una página) y `usePlacesCount` (vista previa «N municipios» de un atajo de territorio, solo el `count`). |
| `hooks/useSetOrganizationTerritory.ts` (+ `.test.tsx`) | `PATCH /api/organizations/{id}/` con `admin_level`/`territory_kind`/`territory_code`, solo esos campos. |
| `components/metrics/TerritoryMapCanvas.tsx` | La parte `react-leaflet` pura (se importa solo desde el `dynamic`). |
| `components/metrics/TerritoryMap.tsx` (+ `.test.tsx`) | Envoltorio `"use client"` con `next/dynamic({ssr:false})`, `role="img"` y `aria-label`. |
| `components/metrics/PlaceSheetPanel.tsx` | Ficha de municipio dentro de `Dialog placement="side"`. |
| `components/metrics/TerritorioDashboard.tsx` | Observatorio completo: periodo, mapa, tabla, comparativa, ficha. |
| `components/metrics/ParaguasHomeDashboard.tsx` | Inicio del área de administración (territorio + red financiada). |
| `components/plataforma/SedeSelector.tsx` | Buscador de municipio reutilizado por los tres formularios de sede. |
| `components/plataforma/TerritorioForm.tsx` | Nivel + tipo de territorio + código + vista previa, solo `superadmin`. |
| `app/paraguas/[slug]/territorio/page.tsx` (+ `.test.tsx`) | Gate de sesión/rol + `TerritorioDashboard`. |
| `app/paraguas/[slug]/red-financiada/page.tsx` (+ `.test.tsx`) | Gate + `ParaguasMetricsDashboard` (sin cambios en el dashboard). |
| `app/entidad/[slug]/biblioteca/page.tsx` (+ `.test.tsx`) | Movida desde `recursos/`. |
| `app/plataforma/suscripciones/page.tsx` (+ `.test.tsx`) | Movida desde `contratos/`. |
| `test-utils/fixtures/places.ts` | `buildPlaceRow`, `buildPlaceSheet`. |
| `e2e/territorio.spec.ts` | Flujo real de la analista de la diputación. |

**Modificados:** `next.config.ts`, `next.config.test.ts`, `lib/api/types.ts`,
`lib/api/endpoints.ts`, `lib/auth/area.ts`, `lib/auth/paraguasMenu.ts`,
`lib/auth/entidadMenu.ts`, `lib/auth/plataformaMenu.ts`,
`lib/help/pageHelp.ts`, `hooks/useMetrics.ts`, `hooks/useCompare.ts`,
`hooks/useExport.ts`, `hooks/useUpdateOrganization.ts`,
`components/ui/Dialog.tsx`, `components/metrics/ExportPanel.tsx`,
`components/metrics/MetricsTable.tsx`,
`components/plataforma/{EntidadDetail,EntidadesTable,NuevaEntidadDialog}.tsx`,
`components/entidad/{ConfiguracionPanel,FamiliasPanel}.tsx`,
`app/paraguas/[slug]/{layout.tsx,page.tsx,informes/page.tsx}`,
`vitest.setup.ts`, `package.json`, `messages/{en,es,eu,ca}.json`,
`e2e/contratos.spec.ts`, `CLAUDE.md`, `AGENTS.md`, `docs/i18n/ESTADO.md`.

---

## Task 1: Renombres «Recursos → Biblioteca» y «Contratos → Suscripciones»

Primer commit del bloque (spec §4.5). Mueve las dos rutas, deja
redirecciones permanentes desde las viejas, renombra menú, títulos,
ayuda por pantalla y los textos de los cuatro catálogos. Los nombres de
la API y los ficheros de componente **no** cambian (decisión 2 de arriba).

**Files:**
- Create: `/Users/mikelerrasti/Code/popyplan-panel/.worktrees/territorio/lib/config/redirects.ts`
- Create: `/Users/mikelerrasti/Code/popyplan-panel/.worktrees/territorio/lib/config/redirects.test.ts`
- Move: `app/entidad/[slug]/recursos/page.tsx` → `app/entidad/[slug]/biblioteca/page.tsx` (y su `page.test.tsx`)
- Move: `app/plataforma/contratos/page.tsx` → `app/plataforma/suscripciones/page.tsx` (y su `page.test.tsx`)
- Modify: `next.config.ts`, `next.config.test.ts`
- Modify: `lib/auth/entidadMenu.ts`, `lib/auth/entidadMenu.test.ts`
- Modify: `lib/auth/plataformaMenu.ts`, `lib/auth/plataformaMenu.test.ts`
- Modify: `lib/help/pageHelp.ts`
- Modify: `components/entidad/FamiliasPanel.tsx` (línea ~497, enlace a `/recursos`)
- Modify: `components/plataforma/EntidadDetail.tsx` (etiqueta de la pestaña «Contrato»)
- Modify: `app/plataforma/layout.test.tsx`, `e2e/contratos.spec.ts`
- Modify: `messages/en.json`, `messages/es.json`, `messages/eu.json`, `messages/ca.json`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces:
  - `lib/config/redirects.ts::permanentRedirects(): { source: string; destination: string; permanent: true }[]`
  - `EntidadMenuItem` pasa a incluir `"biblioteca"` en vez de `"recursos"`;
    `PlataformaMenuItem` incluye `"suscripciones"` en vez de `"contratos"`.
  - Claves de catálogo `menu.entidad.biblioteca`, `menu.plataforma.suscripciones`,
    `pages.entidad.biblioteca.title`, `pages.plataforma.suscripciones.title`,
    `help.entidad.biblioteca.*`, `help.plataforma.suscripciones.*`.

- [ ] **Step 1: Escribir el test que falla de las redirecciones**

Crea `lib/config/redirects.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { permanentRedirects } from "./redirects";

describe("permanentRedirects", () => {
  it("redirige la ruta vieja de Recursos a Biblioteca conservando el slug", () => {
    expect(permanentRedirects()).toContainEqual({
      source: "/entidad/:slug/recursos",
      destination: "/entidad/:slug/biblioteca",
      permanent: true,
    });
  });

  it("redirige la ruta vieja de Contratos a Suscripciones", () => {
    expect(permanentRedirects()).toContainEqual({
      source: "/plataforma/contratos",
      destination: "/plataforma/suscripciones",
      permanent: true,
    });
  });

  it("todas las redirecciones son permanentes (308)", () => {
    expect(permanentRedirects().every((rule) => rule.permanent)).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar el test y comprobar que falla**

Run: `cd /Users/mikelerrasti/Code/popyplan-panel/.worktrees/territorio && npx vitest run lib/config/redirects.test.ts`
Expected: FAIL — `Failed to resolve import "./redirects"`.

- [ ] **Step 3: Escribir `lib/config/redirects.ts`**

```ts
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
```

- [ ] **Step 4: Ejecutar el test y comprobar que pasa**

Run: `npx vitest run lib/config/redirects.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Enchufar las redirecciones en `next.config.ts`**

Añade el import y la función junto a `headers()`:

```ts
import { permanentRedirects } from "./lib/config/redirects";
```

y dentro de `nextConfig`:

```ts
  async redirects() {
    return permanentRedirects();
  },
```

Añade a `next.config.test.ts`:

```ts
  it("mantiene vivas las rutas anteriores a los renombres del bloque de territorio", async () => {
    const config = await loadConfig();

    const rules = await config.redirects?.();

    expect(rules).toEqual([
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
    ]);
  });
```

Run: `npx vitest run next.config.test.ts`
Expected: PASS.

- [ ] **Step 6: Mover las dos rutas**

```bash
cd /Users/mikelerrasti/Code/popyplan-panel/.worktrees/territorio
git mv "app/entidad/[slug]/recursos" "app/entidad/[slug]/biblioteca"
git mv app/plataforma/contratos app/plataforma/suscripciones
```

En `app/entidad/[slug]/biblioteca/page.tsx`: renombra la función a
`EntidadBibliotecaPage`, cambia `getTranslations("pages.entidad.recursos")`
por `getTranslations("pages.entidad.biblioteca")` y el gate
`entidadMenuFor(membership.role).includes("recursos")` por
`…includes("biblioteca")`. **No** toques `RecursosPanel` ni las claves
`entidad.recursos.*` (decisión 2).

En `app/plataforma/suscripciones/page.tsx`: renombra la función a
`PlataformaSuscripcionesPage`, cambia
`getTranslations("pages.plataforma.contratos")` por
`…("pages.plataforma.suscripciones")` y el gate
`plataformaMenuFor(role).includes("contratos")` por `…includes("suscripciones")`.

Actualiza los dos `page.test.tsx` movidos: el `import … from "./page"` no
cambia, pero sí los nombres de `describe` y cualquier aserción de texto
que dijera «Recursos»/«Contratos» (pasan a «Biblioteca»/«Suscripciones»).

- [ ] **Step 7: Renombrar los dos elementos de menú**

En `lib/auth/entidadMenu.ts`: en `ENTIDAD_MENU_ITEMS` cambia `"recursos"`
por `"biblioteca"`; en `ENTIDAD_MENU_LABELS` la entrada pasa a
`biblioteca: "menu.entidad.biblioteca"`. Añade al docstring del módulo:

```
 * Bloque 1 de territorio (spec §4.5): «Recursos» pasa a llamarse
 * «Biblioteca» en toda la interfaz y su ruta es
 * `/entidad/[slug]/biblioteca` (la vieja redirige con 308, ver
 * `lib/config/redirects.ts`). El nombre de la API no cambia
 * (`/api/panel/entidad/{id}/resources/`), ni el del componente
 * (`components/entidad/RecursosPanel.tsx`), ni el namespace de catálogo
 * `entidad.recursos.*`: solo el nombre visible y la ruta.
```

En `lib/auth/plataformaMenu.ts`: `"contratos"` → `"suscripciones"` en
`PLATAFORMA_MENU_ITEMS` y `PLATAFORMA_MENU_LABELS`, con una nota
equivalente (el objeto de dominio sigue siendo `Contract`; la pestaña
«Contratos» de dentro del panel no se toca).

Actualiza `lib/auth/entidadMenu.test.ts` y `lib/auth/plataformaMenu.test.ts`
cambiando los literales `"recursos"`/`"contratos"` por los nuevos.

- [ ] **Step 8: Actualizar el registro de ayuda y los enlaces internos**

En `lib/help/pageHelp.ts`:

```ts
  { route: "/entidad/[slug]/biblioteca", key: "entidad.biblioteca" },
```
(en el sitio que ocupaba `recursos`, manteniendo el orden del array) y

```ts
  { route: "/plataforma/suscripciones", key: "plataforma.suscripciones" },
```

En `components/entidad/FamiliasPanel.tsx` (~línea 497), el enlace
`href={`/entidad/${slug}/recursos`}` pasa a
`href={`/entidad/${slug}/biblioteca`}`.

En `components/plataforma/EntidadDetail.tsx`, `SECTION_LABEL_KEYS.contrato`
sigue apuntando a `plataforma.entidadFicha.tabContrato` (solo cambia su
valor en los catálogos, Step 9).

- [ ] **Step 9: Renombrar las claves y los textos en los cuatro catálogos**

Renombra las claves (`menu.entidad.recursos` → `menu.entidad.biblioteca`,
`pages.entidad.recursos` → `pages.entidad.biblioteca`,
`help.entidad.recursos` → `help.entidad.biblioteca`,
`menu.plataforma.contratos` → `menu.plataforma.suscripciones`,
`pages.plataforma.contratos` → `pages.plataforma.suscripciones`,
`help.plataforma.contratos` → `help.plataforma.suscripciones`) **en los
cuatro ficheros**, conservando su posición en el objeto, y aplica estos
valores:

`messages/en.json`
```json
{
  "menu": { "entidad": { "biblioteca": "Library" },
            "plataforma": { "suscripciones": "Subscriptions" } },
  "pages": { "entidad": { "biblioteca": { "title": "Entity library" } },
             "plataforma": { "suscripciones": { "title": "Subscriptions" } } },
  "entidad": { "recursos": { "heading": "Library",
                             "noAccessDescription": "Your role doesn't have access to the Library." } },
  "plataforma": { "entidadFicha": { "tabContrato": "Subscription" } },
  "help": {
    "entidad": { "biblioteca": {
      "title": "Library",
      "summary": "The entity's content library: text, PDFs, videos, audio and links, organised by category and aimed at members, families or anyone.",
      "actions": [
        "Create, edit or delete resources (owner and moderator)",
        "Choose category and audience; “How to support” is the category for the support network"
      ],
      "audience": "Owner, moderator and facilitator." } },
    "plataforma": { "suscripciones": {
      "title": "Subscriptions",
      "summary": "Popyplan's subscriptions with each entity: contracts, pricing tiers and invoices.",
      "actions": [
        "Create and activate contracts, tiers and invoices (superadmin)",
        "Mark invoices as paid"
      ],
      "audience": "Superadmin and support; support can only view." } }
  }
}
```

`messages/es.json`
```json
{
  "menu": { "entidad": { "biblioteca": "Biblioteca" },
            "plataforma": { "suscripciones": "Suscripciones" } },
  "pages": { "entidad": { "biblioteca": { "title": "Biblioteca de la entidad" } },
             "plataforma": { "suscripciones": { "title": "Suscripciones" } } },
  "entidad": { "recursos": { "heading": "Biblioteca",
                             "noAccessDescription": "Tu rol no tiene acceso a la Biblioteca." } },
  "plataforma": { "entidadFicha": { "tabContrato": "Suscripción" } },
  "help": {
    "entidad": { "biblioteca": {
      "title": "Biblioteca",
      "summary": "La biblioteca de contenidos de la entidad: textos, PDF, vídeos, audios y enlaces, organizados por categoría y dirigidos a miembros, familias o a cualquiera.",
      "actions": [
        "Crear, editar o borrar recursos (titular y moderador)",
        "Elegir categoría y audiencia; «Cómo acompañar» es la categoría para la red de apoyo"
      ],
      "audience": "Titular, moderador y dinamizador." } },
    "plataforma": { "suscripciones": {
      "title": "Suscripciones",
      "summary": "Suscripciones de Popyplan con cada entidad: contratos, tramos de precio y facturas.",
      "actions": [
        "Crear y activar contratos, tramos y facturas (superadmin)",
        "Marcar facturas como pagadas"
      ],
      "audience": "Superadmin y soporte; soporte solo consulta." } }
  }
}
```

`messages/eu.json`
```json
{
  "menu": { "entidad": { "biblioteca": "Liburutegia" },
            "plataforma": { "suscripciones": "Harpidetzak" } },
  "pages": { "entidad": { "biblioteca": { "title": "Erakundearen liburutegia" } },
             "plataforma": { "suscripciones": { "title": "Harpidetzak" } } },
  "entidad": { "recursos": { "heading": "Liburutegia",
                             "noAccessDescription": "Zure rolak ez du sarbiderik Liburutegian." } },
  "plataforma": { "entidadFicha": { "tabContrato": "Harpidetza" } },
  "help": {
    "entidad": { "biblioteca": {
      "title": "Liburutegia",
      "summary": "Erakundearen edukien liburutegia: testuak, PDFak, bideoak, audioak eta estekak, kategoriaka antolatuta eta kideei, familiei edo edonori zuzenduta.",
      "actions": [
        "Baliabideak sortu, editatu edo ezabatu (titularra eta moderatzailea)",
        "Kategoria eta hartzaileak aukeratu; «Nola lagundu» da laguntza-sarearen kategoria"
      ],
      "audience": "Titularra, moderatzailea eta dinamizatzailea." } },
    "plataforma": { "suscripciones": {
      "title": "Harpidetzak",
      "summary": "Popyplanek erakunde bakoitzarekin dituen harpidetzak: kontratuak, prezio-tarteak eta fakturak.",
      "actions": [
        "Kontratuak, tarteak eta fakturak sortu eta aktibatu (superadmin)",
        "Fakturak ordainduta gisa markatu"
      ],
      "audience": "Superadmin eta laguntza; laguntzak kontsulta bakarrik egin dezake." } }
  }
}
```

`messages/ca.json`
```json
{
  "menu": { "entidad": { "biblioteca": "Biblioteca" },
            "plataforma": { "suscripciones": "Subscripcions" } },
  "pages": { "entidad": { "biblioteca": { "title": "Biblioteca de l'entitat" } },
             "plataforma": { "suscripciones": { "title": "Subscripcions" } } },
  "entidad": { "recursos": { "heading": "Biblioteca",
                             "noAccessDescription": "El teu rol no té accés a la Biblioteca." } },
  "plataforma": { "entidadFicha": { "tabContrato": "Subscripció" } },
  "help": {
    "entidad": { "biblioteca": {
      "title": "Biblioteca",
      "summary": "La biblioteca de continguts de l'entitat: textos, PDF, vídeos, àudios i enllaços, organitzats per categoria i adreçats a membres, famílies o a qualsevol.",
      "actions": [
        "Crear, editar o esborrar recursos (titular i moderador)",
        "Triar categoria i audiència; «Com acompanyar» és la categoria per a la xarxa de suport"
      ],
      "audience": "Titular, moderador i dinamitzador." } },
    "plataforma": { "suscripciones": {
      "title": "Subscripcions",
      "summary": "Subscripcions de Popyplan amb cada entitat: contractes, trams de preu i factures.",
      "actions": [
        "Crear i activar contractes, trams i factures (superadmin)",
        "Marcar factures com a pagades"
      ],
      "audience": "Superadmin i suport; suport només consulta." } }
  }
}
```

- [ ] **Step 10: Actualizar los dos tests que afirman el texto viejo**

En `app/plataforma/layout.test.tsx`, cualquier aserción sobre el enlace
«Contratos» pasa a «Suscripciones». En `e2e/contratos.spec.ts` (líneas
~23-24), el clic del menú y la cabecera pasan a «Suscripciones»; el clic
de la **pestaña** de la línea ~38 (`getByRole("button", { name:
"Contratos", exact: true })`) **no** cambia.

- [ ] **Step 11: Ejecutar la suite completa**

Run: `cd /Users/mikelerrasti/Code/popyplan-panel/.worktrees/territorio && npm run typecheck && npm run lint && npm run test:coverage`
Expected: PASS. En particular `lib/help/pageHelp.test.ts` (el test de
completitud recorre `app/` de verdad: si una ruta se movió sin actualizar
el registro, falla aquí) y `lib/i18n/messages.test.ts` (paridad de las
cuatro traducciones).

- [ ] **Step 12: Commit**

```bash
cd /Users/mikelerrasti/Code/popyplan-panel/.worktrees/territorio
git add -A
git commit -m "refactor(panel): Recursos pasa a Biblioteca y Contratos a Suscripciones, con redirección permanente"
```

---

## Task 2: Tipos, endpoints, `isParaguas` por `is_administration` y menú de 4 secciones

Todo lo que no depende del backend estando desplegado: los tipos
manuales, las rutas nuevas en el registro de endpoints, la regla de área
leyendo el campo nuevo (con respaldo) y el menú del área de
administración con sus cuatro secciones.

**Files:**
- Modify: `lib/api/types.ts`
- Modify: `lib/api/endpoints.ts`
- Modify: `lib/auth/area.ts`, `lib/auth/area.test.ts`
- Modify: `lib/auth/paraguasMenu.ts`, `lib/auth/paraguasMenu.test.ts`
- Modify: `app/paraguas/[slug]/layout.tsx`, `app/paraguas/[slug]/layout.test.tsx`
- Modify: `test-utils/fixtures/me.ts`, `test-utils/fixtures/organization.ts`
- Create: `test-utils/fixtures/places.ts`
- Modify: `messages/{en,es,eu,ca}.json`

**Interfaces:**
- Consumes: de la Tarea 1, nada más que el árbol ya renombrado.
- Produces:
  - `lib/api/types.ts`: `AdminLevel`, `TerritoryKind`, `PlaceRow`,
    `PaginatedPlaceList`, `PlaceSheet`, `PlaceSheetPlace`; `Organization`
    ensanchado con `place`/`admin_level`/`territory_kind`/`territory_code`/
    `territory_places_count`; `OrgMembershipForArea` ensanchado con
    `is_administration?`/`admin_level?`; `OrganizationCreateRequest`
    ensanchado con `place`.
  - `lib/api/endpoints.ts`: `METRICS.TERRITORIO(orgId)`,
    `METRICS.COMPARE_TERRITORIO(orgId)`, `EXPORT.TERRITORIO(orgId)`,
    `TERRITORIO.PLACE_SHEET(orgId, ineCode)`, `PLACES.LIST()`.
  - `lib/auth/paraguasMenu.ts`: `PARAGUAS_MENU_ITEMS = ["inicio",
    "territorio", "red-financiada", "informes"]`,
    `ParaguasMenuItem`, `PARAGUAS_MENU_LABELS`, `paraguasMenuFor(role)`.
  - `test-utils/fixtures/places.ts`: `buildPlaceRow(overrides?)`,
    `buildPlaceSheet(overrides?)`.

- [ ] **Step 1: Escribir los tests que fallan de `isParaguas`**

En `lib/auth/area.test.ts`, dentro de `describe("resolveArea", …)`:

```ts
  it("con `is_administration: true` resuelve paraguas aunque no venga organization_type", () => {
    const me = buildMe({
      org_memberships: [
        buildOrgMembership({
          role: "analista",
          organization_slug: "gipuzkoako-foru-aldundia",
          organization_type: "",
          is_administration: true,
        }),
      ],
    });

    expect(resolveArea(me, buildPlatformRole(null))).toEqual({
      kind: "paraguas",
      slug: "gipuzkoako-foru-aldundia",
    });
  });

  it("`is_administration: false` manda sobre un organization_type heredado", () => {
    const me = buildMe({
      org_memberships: [
        buildOrgMembership({
          role: "titular",
          organization_slug: "asociacion-bidasoa",
          organization_type: "administracion",
          is_administration: false,
        }),
      ],
    });

    expect(resolveArea(me, buildPlatformRole(null))).toEqual({
      kind: "entidad",
      slug: "asociacion-bidasoa",
    });
  });

  it("sin `is_administration` (backend anterior al despliegue) sigue el respaldo por organization_type", () => {
    const me = buildMe({
      org_memberships: [
        buildOrgMembership({
          role: "analista",
          organization_slug: "gipuzkoako-foru-aldundia",
          organization_type: "administracion",
        }),
      ],
    });

    expect(resolveArea(me, buildPlatformRole(null))).toEqual({
      kind: "paraguas",
      slug: "gipuzkoako-foru-aldundia",
    });
  });
```

- [ ] **Step 2: Escribir el test que falla del menú de 4 secciones**

En `lib/auth/paraguasMenu.test.ts`, sustituye los literales `["inicio",
"informes"]` por los nuevos y añade el caso de `dinamizador`:

```ts
  it("titular, moderador y analista ven las cuatro secciones", () => {
    for (const role of ["titular", "moderador", "analista"]) {
      expect(paraguasMenuFor(role)).toEqual([
        "inicio",
        "territorio",
        "red-financiada",
        "informes",
      ]);
    }
  });

  it("dinamizador y referente ven todo salvo Informes (no exportan)", () => {
    for (const role of ["dinamizador", "referente"]) {
      expect(paraguasMenuFor(role)).toEqual(["inicio", "territorio", "red-financiada"]);
    }
  });

  it("un rol desconocido no ve ninguna sección", () => {
    expect(paraguasMenuFor("voluntario")).toEqual([]);
  });
```

- [ ] **Step 3: Ejecutar los dos ficheros y comprobar que fallan**

Run: `npx vitest run lib/auth/area.test.ts lib/auth/paraguasMenu.test.ts`
Expected: FAIL — los tres de `area` porque `buildOrgMembership` todavía
no acepta `is_administration` (error de tipo) y `isParaguas` no lo mira;
los de `paraguasMenu` porque el array solo tiene dos elementos.

- [ ] **Step 4: Ampliar los tipos manuales en `lib/api/types.ts`**

Justo debajo del bloque de `OrgMembershipForArea`, y ampliando
`Organization`:

```ts
/**
 * Nivel administrativo de una organización de tipo `administracion`
 * (spec de diseño `2026-09-19-territorio-administraciones-design.md`
 * §2.1). Cadena vacía en todo lo que no es una administración: el
 * backend lo declara `CharField(choices, blank=True)`, no nullable.
 *
 * **Tipo manual, provisional**: se retira en cuanto la rama de backend
 * `feature/territorio-*` esté fusionada y se regenere el esquema con
 * `npm run gen:types` (spec §7, «regenerar tipos desde
 * docs/schema.yaml»). Mismo patrón que `Me.preferred_language` más
 * arriba en este fichero.
 */
export type AdminLevel = "ayuntamiento" | "mancomunidad" | "diputacion" | "gobierno" | "";

/**
 * Forma del territorio declarado (spec §2.1): un atajo (`ccaa`,
 * `provincia`, `comarca`) o una lista literal de municipios
 * (`municipios`); cadena vacía si la administración no tiene territorio.
 * `territory_code` guarda el código del atajo o, con `municipios`, los
 * códigos INE separados por comas. Tipo manual, misma nota que
 * `AdminLevel`.
 */
export type TerritoryKind = "ccaa" | "provincia" | "comarca" | "municipios" | "";

/**
 * `GET`/`PATCH /api/organizations/{id}/`, ensanchado con los cuatro
 * campos de territorio de la spec §2.1 más el recuento derivado
 * `territory_places_count` (solo lectura: cuántos municipios tiene hoy
 * el `OrgScope` expandido). Todos opcionales porque un backend anterior
 * al despliegue de este bloque no los trae (spec §7) — el panel trata su
 * ausencia igual que `place: null` (ver `EntidadDetail`/`SedeSelector`).
 * Tipo manual, misma nota que `AdminLevel`.
 */
export type Organization = components["schemas"]["Organization"] & {
  /** Código INE de la sede (`Place.ine_code`), `null` si no la tiene. */
  place?: string | null;
  admin_level?: AdminLevel;
  territory_kind?: TerritoryKind;
  territory_code?: string;
  readonly territory_places_count?: number;
};
```

y en `OrgMembershipForArea`:

```ts
export type OrgMembershipForArea = OrgMembershipRef & {
  org_type?: components["schemas"]["OrgTypeEnum"];
  /**
   * `users/profile_serializers.py::OrgMembershipRefSerializer`, spec
   * §3.5: el backend deriva este booleano de `org_type` para que el
   * panel deje de comparar cadenas. Opcional porque un backend anterior
   * al despliegue no lo trae — `lib/auth/area.ts::isParaguas` lo usa
   * cuando está y cae al respaldo por `organization_type` cuando no
   * (spec §7). Tipo manual hasta `npm run gen:types`.
   */
  is_administration?: boolean;
  admin_level?: AdminLevel;
};
```

Y, al final del fichero (junto a `OrganizationCreateRequest`):

```ts
/**
 * `POST /api/organizations/` con la sede obligatoria (spec §4.3, «Alta
 * de entidad: sede obligatoria»): el serializer de alta exige `place`
 * (código INE). Tipo manual hasta `npm run gen:types`.
 */
export type OrganizationCreateInput = OrganizationCreateRequest & {
  place: string;
};

/**
 * Fila de `GET /api/places/?ine_code=a,b&search=&ccaa_code=&prov_code=
 * &comarca_code=&page=` (spec §3.3, ampliada con los tres filtros de
 * código por decisión del coordinador del bloque): listado de municipios
 * de solo lectura, autenticado y paginado (solo `is_active`), sin ningún
 * dato personal. Los tres filtros de código son de coincidencia exacta y
 * combinables entre sí y con `search`/`ine_code`; el `count` de
 * `PaginatedPlaceList` es el total que casa con el filtro, no el tamaño
 * de la página. Tipo manual hasta `npm run gen:types`.
 *
 * `latitude`/`longitude` se declaran `number | null` siguiendo el
 * ejemplo de la spec §3.2. Quien las consuma las pasa igualmente por
 * `lib/metrics/mapScale.ts::toFiniteNumber`, porque un `DecimalField` de
 * DRF puede llegar serializado como cadena según la configuración del
 * backend y una coordenada no numérica no puede pintar una burbuja.
 */
export interface PlaceRow {
  ine_code: string;
  name: string;
  name_local: string;
  comarca_code: string;
  comarca_name_es: string;
  comarca_name_eu: string;
  prov_code: string;
  prov_name: string;
  ccaa_code: string;
  ccaa_name: string;
  latitude: number | null;
  longitude: number | null;
}

/** Envoltorio DRF estándar de `GET /api/places/`. */
export interface PaginatedPlaceList {
  count: number;
  next: string | null;
  previous: string | null;
  results: PlaceRow[];
}

/** El municipio dentro de la ficha de `GET …/territorio/{org}/places/{ine}/`. */
export interface PlaceSheetPlace {
  ine_code: string;
  name: string;
  name_local: string;
  comarca_name_es: string;
  prov_name: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * `GET /api/panel/territorio/{org_id}/places/{ine_code}/?since&until`
 * (spec §3.2): ficha agregada de un municipio del territorio.
 * `organizations_based_here` es un **recuento** de organizaciones con
 * sede ahí, nunca sus nombres (invariante 1). `people`/`attendance`
 * respetan el umbral `PANEL_MIN_GROUP_SIZE` igual que el resto del
 * panel. Tipo manual hasta `npm run gen:types`.
 */
export interface PlaceSheet {
  place: PlaceSheetPlace;
  events: { held: number; upcoming: number };
  people: { value: number | null; suppressed: boolean };
  attendance: { rate: number | null; suppressed: boolean };
  communities: { count: number };
  organizations_based_here: number;
}
```

- [ ] **Step 5: (sin endpoints todavía)**

Las rutas nuevas de `lib/api/endpoints.ts` se añaden en la **Tarea 3**,
no aquí: `lib/api/consumption.test.ts` falla con «endpoint declarado sin
usar» si una constante se declara en un commit y se consume en otro, y
sus consumidores (los hooks) son de la Tarea 3.

- [ ] **Step 6: Implementar `isParaguas` con el campo nuevo**

En `lib/auth/area.ts`, sustituye la función y actualiza el docstring del
módulo:

```ts
/**
 * Una membresía es de administración (área `/paraguas/[slug]`) cuando el
 * backend lo dice con `is_administration` (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §3.5: el campo se
 * deriva de `org_type` para que el panel deje de comparar cadenas).
 *
 * El campo **manda cuando está**, también con valor `false`: un backend
 * que ya lo sirve es la autoridad, y un `organization_type` heredado no
 * puede contradecirlo. Solo si el campo **no viene** (backend anterior al
 * despliegue de este bloque, spec §7) se cae al respaldo histórico por
 * `organization_type`/`org_type`, que es lo que hacía W1.
 */
function isParaguas(membership: OrgMembershipForArea): boolean {
  if (typeof membership.is_administration === "boolean") {
    return membership.is_administration;
  }
  return membership.organization_type === "administracion" || membership.org_type === "administracion";
}
```

- [ ] **Step 7: Implementar el menú de cuatro secciones**

En `lib/auth/paraguasMenu.ts`:

```ts
export const PARAGUAS_MENU_ITEMS = ["inicio", "territorio", "red-financiada", "informes"] as const;

export type ParaguasMenuItem = (typeof PARAGUAS_MENU_ITEMS)[number];

export const PARAGUAS_MENU_LABELS: Record<ParaguasMenuItem, string> = {
  inicio: "menu.paraguas.inicio",
  territorio: "menu.paraguas.territorio",
  "red-financiada": "menu.paraguas.redFinanciada",
  informes: "menu.paraguas.informes",
};
```

`paraguasMenuFor` no cambia de forma (sigue filtrando solo `informes` por
`EXPORTA_INFORMES`), pero sí el docstring del módulo:

```
 * Bloque 1 de territorio (spec §4.1): el área de paraguas pasa a ser el
 * **área de administración** y su menú de 2 a 4 secciones — Inicio,
 * Territorio (observatorio del territorio declarado), Red financiada
 * (el dashboard de paraguas de siempre, sobre el árbol `parent`) e
 * Informes. La ruta no cambia (`/paraguas/[slug]`), para no romper
 * marcadores ni los e2e existentes. Las tres primeras solo piden
 * `ver_panel`, así que las ven los cinco roles; Informes sigue acotada a
 * `exportar_informes` (`titular`/`moderador`/`analista`).
```

- [ ] **Step 8: Añadir las dos etiquetas de menú a los catálogos**

`messages/en.json` → `menu.paraguas`: `"territorio": "Territory"`,
`"redFinanciada": "Funded network"`.
`messages/es.json`: `"territorio": "Territorio"`, `"redFinanciada": "Red financiada"`.
`messages/eu.json`: `"territorio": "Lurraldea"`, `"redFinanciada": "Finantzatutako sarea"`.
`messages/ca.json`: `"territorio": "Territori"`, `"redFinanciada": "Xarxa finançada"`.

Cambia además `menu.paraguas.navLabel` para que nombre el área nueva:
en `"Administration area sections"`, es `"Secciones del área de administración"`,
eu `"Administrazio-arloaren atalak"`, ca `"Seccions de l'àrea d'administració"`.

- [ ] **Step 9: Ampliar las fixtures**

En `test-utils/fixtures/me.ts`, `buildOrgMembership` ya acepta
`Partial<OrgMembershipForArea>`, así que `is_administration`/`admin_level`
entran solos al ampliar el tipo — no hay que tocar el fichero. En
`test-utils/fixtures/organization.ts` añade los campos nuevos al objeto
base:

```ts
    place: "20069",
    admin_level: "",
    territory_kind: "",
    territory_code: "",
    territory_places_count: 0,
```

Crea `test-utils/fixtures/places.ts`:

```ts
import type { PlaceRow, PlaceSheet } from "@/lib/api/types";

/** Municipio real del ejemplo de la spec §3.2 (Irun, Gipuzkoa). */
export function buildPlaceRow(overrides: Partial<PlaceRow> = {}): PlaceRow {
  return {
    ine_code: "20069",
    name: "Irun",
    name_local: "Irun",
    comarca_code: "C1",
    comarca_name_es: "Bidasoa",
    comarca_name_eu: "Bidasoa",
    prov_code: "20",
    prov_name: "Gipuzkoa",
    ccaa_code: "16",
    ccaa_name: "País Vasco",
    latitude: 43.34,
    longitude: -1.79,
    ...overrides,
  };
}

/** Ficha de municipio del ejemplo de la spec §3.2 (personas suprimidas). */
export function buildPlaceSheet(overrides: Partial<PlaceSheet> = {}): PlaceSheet {
  return {
    place: {
      ine_code: "20069",
      name: "Irun",
      name_local: "Irun",
      comarca_name_es: "Bidasoa",
      prov_name: "Gipuzkoa",
      latitude: 43.34,
      longitude: -1.79,
    },
    events: { held: 12, upcoming: 3 },
    people: { value: null, suppressed: true },
    attendance: { rate: 0.71, suppressed: false },
    communities: { count: 4 },
    organizations_based_here: 2,
    ...overrides,
  };
}
```

- [ ] **Step 10: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run lib/auth/area.test.ts lib/auth/paraguasMenu.test.ts`
Expected: PASS.

- [ ] **Step 11: Actualizar el test del layout de paraguas**

`app/paraguas/[slug]/layout.test.tsx` ya renderiza el menú; añade:

```ts
  it("el menú de la administración lleva las cuatro secciones para la analista", async () => {
    setPathname("/paraguas/diputacion-demo");
    getServerSessionMock.mockResolvedValue(session("analista"));
    serverFetchMock.mockResolvedValue({ ok: true, status: 200, data: buildOrganization() });

    const element = await ParaguasLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "diputacion-demo" }),
    });
    render(element);

    const nav = screen.getByRole("navigation", { name: "Secciones del área de administración" });
    expect(nav.textContent).toContain("Territorio");
    expect(nav.textContent).toContain("Red financiada");
    expect(screen.getByRole("link", { name: "Territorio" })).toHaveAttribute(
      "href",
      "/paraguas/diputacion-demo/territorio",
    );
    expect(screen.getByRole("link", { name: "Red financiada" })).toHaveAttribute(
      "href",
      "/paraguas/diputacion-demo/red-financiada",
    );
  });
```

El `layout.tsx` **no** necesita cambios: ya construye el `href` con
`item === "inicio" ? base : `${base}/${item}`` y el `item`
`"red-financiada"` es exactamente el segmento de ruta.

- [ ] **Step 12: Ejecutar la suite completa y commit**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: PASS. `lib/api/consumption.test.ts` sigue verde porque esta
tarea **no** declara ningún endpoint nuevo (van en la Tarea 3, con sus
consumidores).

```bash
git add -A
git commit -m "feat(territorio): tipos manuales, isParaguas por is_administration y menú de 4 secciones"
```

---

## Task 3: Ámbito `territorio` en los hooks de métricas, y los dos hooks nuevos de municipios

Las rutas del registro de endpoints y todos los hooks que las consumen.
Al terminar, el panel sabe pedir métricas, comparativa, exportación,
ficha de municipio y coordenadas de territorio — sin que ninguna pantalla
lo use todavía.

**Files:**
- Modify: `lib/api/endpoints.ts`
- Modify: `hooks/useMetrics.ts`, `hooks/useMetrics.test.tsx`
- Modify: `hooks/useCompare.ts`, `hooks/useCompare.test.tsx`
- Modify: `hooks/useExport.ts`, `hooks/useExport.test.tsx`
- Create: `hooks/usePlaceSheet.ts`, `hooks/usePlaceSheet.test.tsx`
- Create: `hooks/usePlaces.ts`, `hooks/usePlaces.test.tsx`
- Modify: `messages/{en,es,eu,ca}.json`

**Interfaces:**
- Consumes: de la Tarea 2, `PlaceRow`, `PaginatedPlaceList`, `PlaceSheet`
  de `lib/api/types.ts`.
- Produces:
  - `METRICS.TERRITORIO(orgId)`, `METRICS.COMPARE_TERRITORIO(orgId)`,
    `EXPORT.TERRITORIO(orgId)`, `TERRITORIO.PLACE_SHEET(orgId, ineCode)`,
    `PLACES.LIST()`.
  - `MetricsScope = "entidad" | "paraguas" | "plataforma" | "territorio"`;
    `MetricsErrorKind` gana `"sin_territorio"`.
  - `CompareScope = "paraguas" | "plataforma" | "territorio"`;
    `CompareErrorKind` gana `"sin_territorio"`.
  - `ExportErrorKind` gana `"sin_territorio"`.
  - `usePlaceSheet(orgId: number | string, ineCode: string | null, period:
    Period): UseQueryResult<PlaceSheet, PlaceSheetError>` con
    `PlaceSheetErrorKind = "fuera_de_territorio" | "sin_acceso" |
    "sin_territorio" | "desconocido"`.
  - `usePlacesByIne(ineCodes: string[]): UseQueryResult<PlaceRow[], PlacesError>`,
    `useSearchPlaces(search: string): UseQueryResult<PlaceRow[], PlacesError>`
    y `usePlacesCount(kind: TerritoryKind, code: string):
    UseQueryResult<number, PlacesError>`, con
    `PlacesErrorKind = "demasiadas_paginas" | "desconocido"`.

- [ ] **Step 1: Añadir las rutas a `lib/api/endpoints.ts`**

Dentro del bloque `METRICS` ya existente, tras `PLATAFORMA`:

```ts
  /**
   * `GET /api/panel/territorio/{org_id}/metrics/?since&until&group_by=
   * place|comarca|province|month|year` (spec de diseño
   * `2026-09-19-territorio-administraciones-design.md` §3.1): mismo
   * esquema fijo que paraguas, pero sobre `scope_territorio(org)` —
   * todo lo que ocurre en los municipios del `OrgScope`, sea de la
   * entidad que sea. `group_by=organization` **no** se ofrece aquí a
   * propósito: listar por nombre entidades que la administración no
   * financia sería exponer a terceros (§3.1). 403 si la organización no
   * es una administración; 409 si no tiene territorio declarado.
   */
  TERRITORIO: (orgId: number | string) => `/api/panel/territorio/${orgId}/metrics/`,
  /**
   * `GET /api/panel/territorio/{org_id}/compare/?since&until&group_by=
   * place|comarca|province` (§3.1). `group_by` obligatorio, igual que en
   * las otras dos rutas de comparativa.
   */
  COMPARE_TERRITORIO: (orgId: number | string) => `/api/panel/territorio/${orgId}/compare/`,
```

Dentro de `EXPORT`:

```ts
  /** `GET /api/panel/territorio/{org_id}/export/?format=csv|pdf&since&until&group_by` (spec §3.1). */
  TERRITORIO: (orgId: number | string) => `/api/panel/territorio/${orgId}/export/`,
```

Y dos bloques nuevos al final del fichero:

```ts
/**
 * Observatorio de territorio (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §3.2). Las
 * métricas, la comparativa y la exportación viven en `METRICS`/`EXPORT`
 * junto a las de los otros ámbitos; aquí solo la ficha de municipio, que
 * no tiene equivalente en paraguas.
 */
export const TERRITORIO = {
  /**
   * `GET /api/panel/territorio/{org_id}/places/{ine_code}/?since&until`:
   * ficha agregada de un municipio del territorio. 404 si el municipio
   * no pertenece al territorio de esa administración (nunca se revela
   * nada de un municipio de fuera). Permiso `ver_panel` + administración.
   */
  PLACE_SHEET: (orgId: number | string, ineCode: string) =>
    `/api/panel/territorio/${orgId}/places/${ineCode}/`,
} as const;

/**
 * Catálogo de municipios (spec §3.3): solo lectura, autenticado,
 * paginado y limitado a `is_active`, sin ningún dato personal. El panel
 * lo usa para dos cosas: las coordenadas del mapa de Territorio
 * (`?ine_code=a,b`) y el buscador de sede de plataforma y de
 * Configuración (`?search=`).
 */
export const PLACES = {
  /**
   * `GET /api/places/?ine_code=&search=&ccaa_code=&prov_code=
   * &comarca_code=&page=`. Los tres filtros de código son de
   * coincidencia exacta y combinables con `search`/`ine_code`; el
   * `count` de la respuesta paginada es el total del filtro, que es lo
   * que usa la vista previa «N municipios» del formulario de territorio
   * (`components/plataforma/TerritorioForm.tsx`) para no traerse las
   * filas.
   */
  LIST: () => "/api/places/",
} as const;
```

- [ ] **Step 2: Escribir los tests que fallan de `useMetrics` con territorio**

En `hooks/useMetrics.test.tsx` (sigue el patrón de los tests que ya hay
ahí: mockean `@/lib/api/client` y renderizan el hook con
`renderHook` + `createTestQueryClient`):

```ts
  it("el ámbito 'territorio' pide la ruta de territorio con el periodo y el desglose", async () => {
    apiFetchMock.mockResolvedValue(buildMetricsResponse());

    const { result } = renderHook(
      () => useMetrics("territorio", 3, { since: "2026-01-01", until: "2026-01-31" }, "place"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/territorio/3/metrics/?since=2026-01-01&until=2026-01-31&group_by=place",
    );
  });

  it("el ámbito 'territorio' sin orgId es un error de programación", () => {
    expect(() =>
      renderHook(
        () => useMetrics("territorio", undefined, { since: "2026-01-01", until: "2026-01-31" }),
        { wrapper },
      ),
    ).toThrow("useMetrics: falta orgId para el ámbito 'territorio'");
  });

  it("un 409 se traduce a kind 'sin_territorio' con el detail literal del backend", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError(409, { detail: "Esta administración no tiene territorio declarado." }),
    );

    const { result } = renderHook(
      () => useMetrics("territorio", 3, { since: "2026-01-01", until: "2026-01-31" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("sin_territorio");
    expect(result.current.error?.detail).toBe("Esta administración no tiene territorio declarado.");
  });
```

- [ ] **Step 3: Ejecutar y comprobar que falla**

Run: `npx vitest run hooks/useMetrics.test.tsx`
Expected: FAIL — `"territorio"` no es asignable a `MetricsScope`.

- [ ] **Step 4: Implementar el ámbito en `useMetrics`**

```ts
export type MetricsScope = "entidad" | "paraguas" | "plataforma" | "territorio";

export type MetricsErrorKind =
  | "periodo_invalido"
  | "sin_acceso"
  | "sin_territorio"
  | "desconocido";
```

En `endpointFor`, añade el caso:

```ts
    case "territorio":
      if (orgId === undefined) {
        throw new Error("useMetrics: falta orgId para el ámbito 'territorio'");
      }
      return METRICS.TERRITORIO(orgId);
```

En `toMetricsError`, antes del `return` genérico:

```ts
    if (error.status === 409) {
      // Solo el ámbito `territorio` responde 409 (spec §3.1): una
      // administración sin territorio declarado, que no es un fallo sino
      // una configuración que falta. Se conserva el `detail` literal del
      // backend porque ya viene traducido por `Accept-Language`.
      const detail = detailOf(error);
      return new MetricsError(
        "sin_territorio",
        detail ?? "Esta administración no tiene territorio declarado.",
        detail,
      );
    }
```

con `import { detailOf } from "@/lib/api/drfError";` arriba. Añade al
docstring del módulo una línea explicando el 409 y el ámbito nuevo.

- [ ] **Step 5: Repetir para `useCompare` y `useExport`**

`hooks/useCompare.ts`:

```ts
export type CompareScope = "paraguas" | "plataforma" | "territorio";

export type CompareErrorKind =
  | "periodo_invalido"
  | "sin_acceso"
  | "sin_territorio"
  | "desconocido";
```
`endpointFor` gana el caso `territorio` → `METRICS.COMPARE_TERRITORIO(orgId)`
(con el mismo `throw` si falta `orgId`, con el texto
`"useCompare: falta orgId para el ámbito 'territorio'"`), y
`toCompareError` la misma rama 409 con `detailOf`.

`hooks/useExport.ts`:

```ts
export type ExportErrorKind =
  | "pdf_unavailable"
  | "forbidden"
  | "sin_territorio"
  | "sesion_caducada"
  | "desconocido";
```
`endpointFor` gana `case "territorio": … return EXPORT.TERRITORIO(orgId);`
(mismo `throw` con `"useExport: falta orgId para el ámbito 'territorio'"`)
y `toExportError` la rama 409 (antes del `return` de «desconocido»):

```ts
    if (error.status === 409) {
      return new ExportError(
        "sin_territorio",
        detailOf(error) ?? "Esta administración no tiene territorio declarado.",
      );
    }
```

Añade a cada fichero de test un caso equivalente a los tres de `useMetrics`.

- [ ] **Step 6: Ejecutar y comprobar que pasan**

Run: `npx vitest run hooks/useMetrics.test.tsx hooks/useCompare.test.tsx hooks/useExport.test.tsx`
Expected: PASS.

- [ ] **Step 7: Escribir el test que falla de `usePlaceSheet`**

Crea `hooks/usePlaceSheet.test.tsx`:

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/client";
import { buildPlaceSheet } from "@/test-utils/fixtures/places";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { usePlaceSheet } from "./usePlaceSheet";

// Mismo wrapper local que `hooks/useMetrics.test.tsx`: este repo no
// tiene un helper compartido de QueryClient para tests de hooks.
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}

const PERIOD = { since: "2026-01-01", until: "2026-01-31" };

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("usePlaceSheet", () => {
  it("pide la ficha del municipio con el periodo", async () => {
    apiFetchMock.mockResolvedValue(buildPlaceSheet());

    const { result } = renderHook(() => usePlaceSheet(3, "20069", PERIOD), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/panel/territorio/3/places/20069/?since=2026-01-01&until=2026-01-31",
    );
    expect(result.current.data?.organizations_based_here).toBe(2);
  });

  it("sin ine_code no pide nada (la ficha está cerrada)", () => {
    renderHook(() => usePlaceSheet(3, null, PERIOD), { wrapper });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("un 404 (municipio fuera del territorio) es kind 'fuera_de_territorio'", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(404, { detail: "No encontrado." }));

    const { result } = renderHook(() => usePlaceSheet(3, "28079", PERIOD), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("fuera_de_territorio");
  });

  it("un 403 es kind 'sin_acceso' y un 409 kind 'sin_territorio'", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, {}));
    const forbidden = renderHook(() => usePlaceSheet(3, "20069", PERIOD), {
      wrapper,
    });
    await waitFor(() => expect(forbidden.result.current.isError).toBe(true));
    expect(forbidden.result.current.error?.kind).toBe("sin_acceso");

    apiFetchMock.mockRejectedValueOnce(new ApiError(409, { detail: "Sin territorio." }));
    const conflict = renderHook(() => usePlaceSheet(4, "20069", PERIOD), {
      wrapper,
    });
    await waitFor(() => expect(conflict.result.current.isError).toBe(true));
    expect(conflict.result.current.error?.kind).toBe("sin_territorio");
    expect(conflict.result.current.error?.detail).toBe("Sin territorio.");
  });

  it("cualquier otro fallo es kind 'desconocido'", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, {}));

    const { result } = renderHook(() => usePlaceSheet(3, "20069", PERIOD), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });
});
```

- [ ] **Step 8: Ejecutar y comprobar que falla**

Run: `npx vitest run hooks/usePlaceSheet.test.tsx`
Expected: FAIL — `Failed to resolve import "./usePlaceSheet"`.

- [ ] **Step 9: Implementar `hooks/usePlaceSheet.ts`**

```ts
"use client";

/**
 * `GET /api/panel/territorio/{org_id}/places/{ine_code}/?since&until`
 * (spec de diseño `2026-09-19-territorio-administraciones-design.md`
 * §3.2): ficha agregada de un municipio del territorio de la
 * administración, para el panel lateral de la pantalla Territorio.
 *
 * `ineCode` es `null` mientras la ficha está cerrada: la consulta queda
 * deshabilitada (`enabled`), así que abrir y cerrar el panel no dispara
 * peticiones de más.
 *
 * Errores tipados (mismo patrón que `useMetrics`/`MetricsError`): **404**
 * es el municipio fuera del territorio declarado — el backend responde
 * lo mismo para un municipio inexistente y para uno de fuera, a
 * propósito, para no revelar nada de lo segundo (§3.2); **403** es no
 * tener `ver_panel` o que la organización no sea una administración;
 * **409** es la administración sin territorio (§3.1), que en esta
 * pantalla no debería llegar a verse porque la página entera ya lo trata
 * antes, pero se distingue igual para no pintar «fuera del territorio»
 * cuando no hay territorio ninguno.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { TERRITORIO } from "@/lib/api/endpoints";
import type { PlaceSheet } from "@/lib/api/types";
import type { Period } from "@/lib/metrics/period";

export type PlaceSheetErrorKind =
  | "fuera_de_territorio"
  | "sin_acceso"
  | "sin_territorio"
  | "desconocido";

export class PlaceSheetError extends Error {
  readonly kind: PlaceSheetErrorKind;
  readonly detail?: string;

  constructor(kind: PlaceSheetErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "PlaceSheetError";
    this.kind = kind;
    this.detail = detail;
  }
}

function toPlaceSheetError(error: unknown): PlaceSheetError {
  if (error instanceof ApiError) {
    const detail = detailOf(error);
    if (error.status === 404) {
      return new PlaceSheetError(
        "fuera_de_territorio",
        detail ?? "Ese municipio no está en el territorio de esta administración.",
        detail,
      );
    }
    if (error.status === 403) {
      return new PlaceSheetError("sin_acceso", detail ?? "No tienes acceso a esta ficha.", detail);
    }
    if (error.status === 409) {
      return new PlaceSheetError(
        "sin_territorio",
        detail ?? "Esta administración no tiene territorio declarado.",
        detail,
      );
    }
  }
  return new PlaceSheetError("desconocido", "No se pudo cargar la ficha del municipio.");
}

export function usePlaceSheet(
  orgId: number | string,
  ineCode: string | null,
  period: Period,
): UseQueryResult<PlaceSheet, PlaceSheetError> {
  const query = new URLSearchParams({ since: period.since, until: period.until }).toString();

  return useQuery<PlaceSheet, PlaceSheetError>({
    // `String(orgId)` normaliza el id: la página lo recibe como
    // parámetro de ruta (cadena) y la API lo devuelve como número — con
    // los dos en la misma clave, `invalidateQueries` no empareja (mismo
    // fallo que documenta `CLAUDE.md` para `useProgram`).
    queryKey: ["panel-place-sheet", String(orgId), ineCode, period.since, period.until],
    enabled: ineCode !== null,
    queryFn: async () => {
      // `enabled` ya garantiza que hay código, pero TanStack tipa la
      // `queryFn` sin saberlo: se comprueba en vez de forzar con `!`,
      // así el caso imposible tampoco deja una rama sin cubrir.
      if (ineCode === null) {
        throw new PlaceSheetError("desconocido", "No se pudo cargar la ficha del municipio.");
      }
      try {
        return await apiFetch<PlaceSheet>(`${TERRITORIO.PLACE_SHEET(orgId, ineCode)}?${query}`);
      } catch (error) {
        throw toPlaceSheetError(error);
      }
    },
  });
}
```

- [ ] **Step 10: Ejecutar y comprobar que pasa**

Run: `npx vitest run hooks/usePlaceSheet.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 11: Escribir el test que falla de `usePlaces`**

Crea `hooks/usePlaces.test.tsx` con el mismo andamiaje del fichero
anterior (mock de `@/lib/api/client`, `wrapper` local con su
`QueryClient` y `apiFetchMock.mockReset()` en el `afterEach`), los
imports `import { usePlacesByIne, usePlacesCount, useSearchPlaces } from "./usePlaces";`
y `import { buildPlaceRow } from "@/test-utils/fixtures/places";`, y
estos casos:

```tsx
  it("usePlacesByIne pide los municipios por código y sigue las páginas", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        count: 2,
        next: "http://x/api/places/?ine_code=20069%2C20045&page=2",
        previous: null,
        results: [buildPlaceRow()],
      })
      .mockResolvedValueOnce({
        count: 2,
        next: null,
        previous: null,
        results: [buildPlaceRow({ ine_code: "20045", name: "Hondarribia" })],
      });

    const { result } = renderHook(() => usePlacesByIne(["20069", "20045"]), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, "/api/places/?ine_code=20069%2C20045");
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/api/places/?ine_code=20069%2C20045&page=2");
    expect(result.current.data?.map((place) => place.name)).toEqual(["Irun", "Hondarribia"]);
  });

  it("usePlacesByIne sin códigos no pide nada y devuelve lista vacía", () => {
    const { result } = renderHook(() => usePlacesByIne([]), { wrapper });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("usePlacesByIne lanza 'demasiadas_paginas' si el backend no termina nunca", async () => {
    apiFetchMock.mockResolvedValue({
      count: 9999,
      next: "http://x/api/places/?page=2",
      previous: null,
      results: [buildPlaceRow()],
    });

    const { result } = renderHook(() => usePlacesByIne(["20069"]), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("demasiadas_paginas");
    expect(apiFetchMock).toHaveBeenCalledTimes(25);
  });

  it("useSearchPlaces solo pide con dos caracteres o más, y una sola página", async () => {
    const short = renderHook(() => useSearchPlaces("i"), { wrapper });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(short.result.current.data).toBeUndefined();

    apiFetchMock.mockResolvedValue({
      count: 1,
      next: "http://x/api/places/?search=irun&page=2",
      previous: null,
      results: [buildPlaceRow()],
    });
    const { result } = renderHook(() => useSearchPlaces("irun"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledExactlyOnceWith("/api/places/?search=irun");
    expect(result.current.data).toHaveLength(1);
  });

  it("un fallo del listado es kind 'desconocido'", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, {}));

    const { result } = renderHook(() => useSearchPlaces("irun"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });

  it("usePlacesCount traduce cada atajo a su filtro y devuelve solo el total", async () => {
    apiFetchMock.mockResolvedValue({ count: 88, next: null, previous: null, results: [] });

    const { result } = renderHook(() => usePlacesCount("provincia", "20"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledExactlyOnceWith("/api/places/?prov_code=20");
    expect(result.current.data).toBe(88);
  });

  it("usePlacesCount usa ccaa_code y comarca_code para los otros dos atajos", async () => {
    apiFetchMock.mockResolvedValue({ count: 3, next: null, previous: null, results: [] });

    const ccaa = renderHook(() => usePlacesCount("ccaa", "16"), { wrapper });
    await waitFor(() => expect(ccaa.result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/places/?ccaa_code=16");

    const comarca = renderHook(() => usePlacesCount("comarca", "C1"), { wrapper });
    await waitFor(() => expect(comarca.result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/places/?comarca_code=C1");
  });

  it("usePlacesCount no pide nada sin atajo, con «municipios» o sin código", () => {
    renderHook(() => usePlacesCount("", "20"), { wrapper });
    renderHook(() => usePlacesCount("municipios", "20069,20045"), { wrapper });
    renderHook(() => usePlacesCount("provincia", "   "), { wrapper });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("un fallo de la vista previa es kind 'desconocido'", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, {}));

    const { result } = renderHook(() => usePlacesCount("provincia", "20"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });
```

- [ ] **Step 12: Ejecutar y comprobar que falla**

Run: `npx vitest run hooks/usePlaces.test.tsx`
Expected: FAIL — `Failed to resolve import "./usePlaces"`.

- [ ] **Step 13: Implementar `hooks/usePlaces.ts`**

```ts
"use client";

/**
 * `GET /api/places/?ine_code=&search=&page=` (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §3.3): catálogo de
 * municipios, solo lectura, autenticado, paginado y limitado a
 * `is_active`. Sin ningún dato personal (riesgo R1 de la spec: es
 * enumerable, pero no hay nada que enumerar salvo geografía pública).
 *
 * Dos consumidores con necesidades opuestas, así que dos hooks en vez de
 * uno con dos comportamientos:
 *
 * - **`usePlacesByIne`** (mapa de Territorio): necesita **todas** las
 *   coordenadas de los municipios que salen en `by_place`, así que
 *   recorre las páginas hasta agotarlas. El listado de `by_place` solo
 *   trae municipios con actividad en el periodo, así que en la práctica
 *   es una o dos páginas; `MAX_PAGES` es una red de seguridad contra un
 *   `next` que no termine nunca (mismo patrón y mismo motivo que
 *   `hooks/useEntityCommunities.ts`), y prefiere **fallar en voz alta** a
 *   devolver un listado truncado que parece completo.
 * - **`useSearchPlaces`** (buscador de sede de plataforma y de
 *   Configuración): solo la primera página, que es lo que se pinta en un
 *   desplegable de resultados, y solo a partir de dos caracteres (mismo
 *   umbral que `hooks/useUserSearch.ts`).
 * - **`usePlacesCount`** (vista previa «N municipios» del formulario de
 *   territorio): no necesita ninguna fila, solo el `count` de la
 *   respuesta paginada con el filtro de código correspondiente al atajo
 *   elegido — por eso pide una sola página y se queda con el total. Los
 *   tres filtros (`ccaa_code`/`prov_code`/`comarca_code`) los expone el
 *   backend de este bloque; `municipios` no pasa por aquí, porque su
 *   recuento es la lista que se está escribiendo y se cuenta en el
 *   cliente.
 *
 * `staleTime` de 5 minutos en los dos: la geografía no cambia durante
 * una sesión y montar otra vez un selector de municipio no debería
 * repetir el recorrido (misma decisión que el hallazgo F5 de la
 * auditoría para `useEntityCommunities`).
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { PLACES } from "@/lib/api/endpoints";
import type { PaginatedPlaceList, PlaceRow, TerritoryKind } from "@/lib/api/types";

export type PlacesErrorKind = "demasiadas_paginas" | "desconocido";

export class PlacesError extends Error {
  readonly kind: PlacesErrorKind;

  constructor(kind: PlacesErrorKind, message: string) {
    super(message);
    this.name = "PlacesError";
    this.kind = kind;
  }
}

/** 25 páginas × 20 filas del paginador del backend = 500 municipios. */
const MAX_PAGES = 25;
const STALE_TIME_MS = 5 * 60 * 1000;
const MIN_SEARCH_LENGTH = 2;

export function usePlacesByIne(ineCodes: string[]): UseQueryResult<PlaceRow[], PlacesError> {
  // Se ordena para que dos renders con los mismos códigos en distinto
  // orden compartan entrada de caché (y la misma query string).
  const joined = [...ineCodes].sort().join(",");

  return useQuery<PlaceRow[], PlacesError>({
    queryKey: ["panel-places-by-ine", joined],
    enabled: joined.length > 0,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      const results: PlaceRow[] = [];
      const base = new URLSearchParams({ ine_code: joined });
      let page = 1;

      while (page <= MAX_PAGES) {
        const params = new URLSearchParams(base);
        if (page > 1) params.set("page", String(page));

        let data: PaginatedPlaceList;
        try {
          data = await apiFetch<PaginatedPlaceList>(`${PLACES.LIST()}?${params.toString()}`);
        } catch {
          throw new PlacesError("desconocido", "No se pudo cargar el listado de municipios.");
        }

        results.push(...(data.results ?? []));
        if (!data.next) return results;
        page += 1;
      }

      throw new PlacesError(
        "demasiadas_paginas",
        "Hay demasiados municipios para cargarlos todos; contacta con Popyplan.",
      );
    },
  });
}

export function useSearchPlaces(search: string): UseQueryResult<PlaceRow[], PlacesError> {
  const term = search.trim();

  return useQuery<PlaceRow[], PlacesError>({
    queryKey: ["panel-places-search", term],
    enabled: term.length >= MIN_SEARCH_LENGTH,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      const params = new URLSearchParams({ search: term });
      try {
        const data = await apiFetch<PaginatedPlaceList>(`${PLACES.LIST()}?${params.toString()}`);
        return data.results ?? [];
      } catch {
        throw new PlacesError("desconocido", "No se pudo buscar el municipio.");
      }
    },
  });
}

/**
 * Nombre del parámetro de `GET /api/places/` que filtra cada atajo de
 * territorio (spec §2.2/§3.3). `""` y `municipios` no tienen filtro de
 * código: el primero no declara territorio y el segundo es una lista
 * literal que se cuenta en el cliente.
 */
const COUNT_FILTER_PARAM: Record<TerritoryKind, string | null> = {
  "": null,
  municipios: null,
  ccaa: "ccaa_code",
  provincia: "prov_code",
  comarca: "comarca_code",
};

/**
 * Total de municipios activos que casan con el código de un atajo, para
 * la vista previa «N municipios» de
 * `components/plataforma/TerritorioForm.tsx`. Se queda con el `count` de
 * la respuesta paginada y **descarta las filas**: no hay que pintar
 * ninguna, y una CCAA son cientos de municipios que no interesa traer.
 */
export function usePlacesCount(
  kind: TerritoryKind,
  code: string,
): UseQueryResult<number, PlacesError> {
  const param = COUNT_FILTER_PARAM[kind];
  const trimmed = code.trim();

  return useQuery<number, PlacesError>({
    queryKey: ["panel-places-count", kind, trimmed],
    enabled: param !== null && trimmed.length > 0,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      // `enabled` ya lo garantiza; se comprueba en vez de forzar con `!`
      // para no dejar una rama sin cubrir (mismo criterio que
      // `usePlaceSheet`).
      if (param === null) {
        throw new PlacesError("desconocido", "No se pudo contar los municipios del territorio.");
      }
      const params = new URLSearchParams({ [param]: trimmed });
      try {
        const data = await apiFetch<PaginatedPlaceList>(`${PLACES.LIST()}?${params.toString()}`);
        return data.count ?? 0;
      } catch {
        throw new PlacesError("desconocido", "No se pudo contar los municipios del territorio.");
      }
    },
  });
}
```

- [ ] **Step 14: Ejecutar y comprobar que pasa**

Run: `npx vitest run hooks/usePlaces.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 15: Añadir las claves de error a los cuatro catálogos**

Bajo `errors`, en cada fichero (claves nuevas; las de `metrics`,
`compare` y `export` se añaden a los bloques ya existentes):

`messages/en.json`
```json
{
  "errors": {
    "metrics": { "sinTerritorio": "This administration has no declared territory yet." },
    "compare": { "sinTerritorio": "This administration has no declared territory yet." },
    "export": { "sinTerritorio": "This administration has no declared territory yet." },
    "placeSheet": {
      "fueraDeTerritorio": "That municipality is not in this administration's territory.",
      "sinAcceso": "You don't have access to this municipality's details.",
      "sinTerritorio": "This administration has no declared territory yet.",
      "desconocido": "The municipality details could not be loaded."
    },
    "places": {
      "demasiadasPaginas": "There are too many municipalities to load them all; get in touch with Popyplan.",
      "desconocido": "The list of municipalities could not be loaded."
    }
  }
}
```

`messages/es.json`
```json
{
  "errors": {
    "metrics": { "sinTerritorio": "Esta administración no tiene territorio declarado." },
    "compare": { "sinTerritorio": "Esta administración no tiene territorio declarado." },
    "export": { "sinTerritorio": "Esta administración no tiene territorio declarado." },
    "placeSheet": {
      "fueraDeTerritorio": "Ese municipio no está en el territorio de esta administración.",
      "sinAcceso": "No tienes acceso a la ficha de este municipio.",
      "sinTerritorio": "Esta administración no tiene territorio declarado.",
      "desconocido": "No se pudo cargar la ficha del municipio."
    },
    "places": {
      "demasiadasPaginas": "Hay demasiados municipios para cargarlos todos; contacta con Popyplan.",
      "desconocido": "No se pudo cargar el listado de municipios."
    }
  }
}
```

`messages/eu.json`
```json
{
  "errors": {
    "metrics": { "sinTerritorio": "Administrazio honek ez du lurralderik adierazita." },
    "compare": { "sinTerritorio": "Administrazio honek ez du lurralderik adierazita." },
    "export": { "sinTerritorio": "Administrazio honek ez du lurralderik adierazita." },
    "placeSheet": {
      "fueraDeTerritorio": "Udalerri hori ez dago administrazio honen lurraldean.",
      "sinAcceso": "Ez duzu udalerri honen fitxarako sarbiderik.",
      "sinTerritorio": "Administrazio honek ez du lurralderik adierazita.",
      "desconocido": "Ezin izan da udalerriaren fitxa kargatu."
    },
    "places": {
      "demasiadasPaginas": "Udalerri gehiegi daude denak kargatzeko; jarri harremanetan Popyplanekin.",
      "desconocido": "Ezin izan da udalerrien zerrenda kargatu."
    }
  }
}
```

`messages/ca.json`
```json
{
  "errors": {
    "metrics": { "sinTerritorio": "Aquesta administració no té territori declarat." },
    "compare": { "sinTerritorio": "Aquesta administració no té territori declarat." },
    "export": { "sinTerritorio": "Aquesta administració no té territori declarat." },
    "placeSheet": {
      "fueraDeTerritorio": "Aquest municipi no és al territori d'aquesta administració.",
      "sinAcceso": "No tens accés a la fitxa d'aquest municipi.",
      "sinTerritorio": "Aquesta administració no té territori declarat.",
      "desconocido": "No s'ha pogut carregar la fitxa del municipi."
    },
    "places": {
      "demasiadasPaginas": "Hi ha massa municipis per carregar-los tots; contacta amb Popyplan.",
      "desconocido": "No s'ha pogut carregar la llista de municipis."
    }
  }
}
```

- [ ] **Step 16: Ejecutar la suite completa y commit**

Run: `npm run typecheck && npm run lint && npm run test:coverage`
Expected: PASS. `lib/api/consumption.test.ts` exige que cada endpoint
declarado esté usado **y** citado en algún `*.test.ts(x)`: los cinco lo
están (los tres de métricas por sus hooks, `TERRITORIO.PLACE_SHEET` por
`usePlaceSheet.test.tsx` y `PLACES.LIST` por `usePlaces.test.tsx`).

```bash
git add -A
git commit -m "feat(territorio): ámbito territorio en métricas, comparativa y exportación, más ficha de municipio y catálogo de places"
```

---

## Task 4: Mapa de burbujas (`TerritoryMap`) y sus helpers puros de escala

La única pieza visual nueva del bloque. Los cálculos (radio, color,
unión con coordenadas) viven en `lib/metrics/mapScale.ts` —código puro,
100 % cubierto por tests— y el componente solo pinta.

**Files:**
- Modify: `package.json` (dependencias `leaflet`, `react-leaflet`, `@types/leaflet`)
- Create: `lib/metrics/mapScale.ts`, `lib/metrics/mapScale.test.ts`
- Create: `components/metrics/TerritoryMapCanvas.tsx`
- Create: `components/metrics/TerritoryMap.tsx`, `components/metrics/TerritoryMap.test.tsx`
- Modify: `vitest.setup.ts` (mock de `react-leaflet`)
- Modify: `messages/{en,es,eu,ca}.json`

**Interfaces:**
- Consumes: de la Tarea 2, `PlaceRow` y `ByPlaceRow` de `lib/api/types.ts`
  y `buildPlaceRow` de `test-utils/fixtures/places.ts`.
- Produces:
  - `lib/metrics/mapScale.ts`: `toFiniteNumber(value: unknown): number | null`,
    `bubbleRadius(events: number, maxEvents: number): number`,
    `bubbleColor(people: number | null, suppressed: boolean, maxPeople: number): string`,
    `toBubbles(rows: ByPlaceRow[], places: PlaceRow[]): MapBubble[]`,
    `interface MapBubble { ineCode; label; latitude; longitude; radius; color; events; people; suppressed }`,
    constantes `MIN_RADIUS`, `MAX_RADIUS`, `SUPPRESSED_COLOR`.
  - `components/metrics/TerritoryMap.tsx`:
    `<TerritoryMap bubbles={MapBubble[]} onSelect={(ineCode: string) => void} />`.

- [ ] **Step 1: Instalar las dependencias del mapa**

```bash
cd /Users/mikelerrasti/Code/popyplan-panel/.worktrees/territorio
npm install leaflet@^1.9.4 react-leaflet@^5.0.0
npm install --save-dev @types/leaflet@^1.9.12
```

`react-leaflet` 5 exige React 19 (el repo tiene 19.1.0) y las teselas son
de OpenStreetMap, sin clave de API (spec §4.2). Comprueba que
`package-lock.json` queda commiteado.

- [ ] **Step 2: Escribir el test que falla de `mapScale`**

Crea `lib/metrics/mapScale.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildPlaceRow } from "@/test-utils/fixtures/places";

import {
  MAX_RADIUS,
  MIN_RADIUS,
  SUPPRESSED_COLOR,
  bubbleColor,
  bubbleRadius,
  toBubbles,
  toFiniteNumber,
} from "./mapScale";

describe("toFiniteNumber", () => {
  it("acepta números y cadenas numéricas (DRF puede serializar decimales como texto)", () => {
    expect(toFiniteNumber(43.34)).toBe(43.34);
    expect(toFiniteNumber("-1.79")).toBe(-1.79);
  });

  it("rechaza null, cadena vacía, texto y no finitos", () => {
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber("")).toBeNull();
    expect(toFiniteNumber("norte")).toBeNull();
    expect(toFiniteNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("bubbleRadius", () => {
  it("el municipio con más actividades ocupa el radio máximo", () => {
    expect(bubbleRadius(12, 12)).toBe(MAX_RADIUS);
  });

  it("sin actividades se queda en el radio mínimo", () => {
    expect(bubbleRadius(0, 12)).toBe(MIN_RADIUS);
  });

  it("escala por área, no por radio: la mitad de actividades no es la mitad de radio", () => {
    const half = bubbleRadius(6, 12);
    expect(half).toBeGreaterThan(MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) / 2 - 0.001);
    expect(half).toBeLessThan(MAX_RADIUS);
  });

  it("un máximo inválido no rompe la escala", () => {
    expect(bubbleRadius(4, 0)).toBe(MAX_RADIUS);
    expect(bubbleRadius(Number.NaN, 12)).toBe(MIN_RADIUS);
  });
});

describe("bubbleColor", () => {
  it("una celda suprimida se pinta en gris", () => {
    expect(bubbleColor(null, true, 30)).toBe(SUPPRESSED_COLOR);
  });

  it("una celda sin dato también se pinta en gris", () => {
    expect(bubbleColor(null, false, 30)).toBe(SUPPRESSED_COLOR);
  });

  it("más personas, tono más intenso de la marca", () => {
    const low = bubbleColor(1, false, 30);
    const high = bubbleColor(30, false, 30);
    expect(low).not.toBe(high);
    expect(high).toBe("var(--color-primary-700)");
    expect(low).toBe("var(--color-primary-100)");
  });
});

describe("toBubbles", () => {
  const rows = [
    { key: "20069", label: "Irun", events: 12, people: 30, suppressed: false },
    { key: "20045", label: "Hondarribia", events: 3, people: null, suppressed: true },
  ];

  it("une cada fila con sus coordenadas y calcula radio y color", () => {
    const places = [
      buildPlaceRow(),
      buildPlaceRow({ ine_code: "20045", name: "Hondarribia", latitude: 43.36, longitude: -1.79 }),
    ];

    expect(toBubbles(rows, places)).toEqual([
      {
        ineCode: "20069",
        label: "Irun",
        latitude: 43.34,
        longitude: -1.79,
        radius: MAX_RADIUS,
        color: "var(--color-primary-700)",
        events: 12,
        people: 30,
        suppressed: false,
      },
      {
        ineCode: "20045",
        label: "Hondarribia",
        latitude: 43.36,
        longitude: -1.79,
        radius: bubbleRadius(3, 12),
        color: SUPPRESSED_COLOR,
        events: 3,
        people: null,
        suppressed: true,
      },
    ]);
  });

  it("descarta las filas sin municipio conocido o sin coordenadas", () => {
    const places = [buildPlaceRow({ latitude: null })];

    expect(toBubbles(rows, places)).toEqual([]);
  });
});
```

- [ ] **Step 3: Ejecutar y comprobar que falla**

Run: `npx vitest run lib/metrics/mapScale.test.ts`
Expected: FAIL — `Failed to resolve import "./mapScale"`.

- [ ] **Step 4: Implementar `lib/metrics/mapScale.ts`**

```ts
/**
 * Escala del mapa de burbujas de Territorio (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §4.2). Funciones
 * puras, sin React y sin `leaflet`: el componente
 * `components/metrics/TerritoryMap.tsx` solo pinta lo que sale de aquí,
 * así que toda la aritmética es probable sin montar un mapa.
 *
 * **Desviación documentada de la spec.** §4.2 pide «tamaño =
 * actividades, color = tasa de asistencia», pero el componente recibe
 * las filas de `by_place`, y `ByPlaceRow` (`docs/PANEL.md` §1.4) es
 * `{key, label, events, people, suppressed}`: **no lleva tasa de
 * asistencia por fila** — limitación del esquema fijo ya documentada en
 * `CLAUDE.md` («Desviación conocida» de la tarea W2), no un olvido de
 * esta tarea. Aquí el **tamaño** codifica `events` y el **color**
 * codifica `people` (la métrica suprimible), con gris para lo suprimido,
 * que es la lectura que los datos disponibles permiten sin una petición
 * extra por municipio. Si algún día `by_place` trae una tasa por fila,
 * `bubbleColor` es el único sitio que hay que cambiar.
 *
 * El color sale de tokens decorativos (`--color-primary*`), no de los
 * tonos de texto: son rellenos sin texto encima, que es justo la
 * excepción que `CLAUDE.md` reserva para `--color-primary` (todo texto
 * usa `--color-primary-700`). El gris de supresión es
 * `--color-text-disabled`, el único gris medio de la paleta.
 */
import type { ByPlaceRow, PlaceRow } from "@/lib/api/types";

export const MIN_RADIUS = 6;
export const MAX_RADIUS = 28;
export const SUPPRESSED_COLOR = "var(--color-text-disabled)";

/**
 * Rampa de tres tonos de la marca, de menos a más personas. Tres y no
 * más: el mapa es una lectura de un vistazo y la tabla de debajo tiene
 * la cifra exacta.
 */
const PEOPLE_COLORS = [
  "var(--color-primary-100)",
  "var(--color-primary)",
  "var(--color-primary-700)",
] as const;

export interface MapBubble {
  ineCode: string;
  label: string;
  latitude: number;
  longitude: number;
  radius: number;
  color: string;
  events: number;
  people: number | null;
  suppressed: boolean;
}

/**
 * Número finito o `null`. `PlaceRow.latitude`/`longitude` se declaran
 * `number | null` siguiendo el ejemplo de la spec §3.2, pero un
 * `DecimalField` de DRF puede llegar serializado como cadena según la
 * configuración del backend: una coordenada que no sea un número finito
 * no puede pintar una burbuja, y `L.CircleMarker` con `NaN` lanza.
 */
export function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Radio en píxeles. El área del círculo (∝ radio²) es lo que el ojo lee
 * como «cantidad», así que el radio crece con la raíz cuadrada de la
 * proporción de actividades — si no, un municipio con el doble de
 * actividades parecería tener cuatro veces más.
 */
export function bubbleRadius(events: number, maxEvents: number): number {
  if (!Number.isFinite(events) || events <= 0) return MIN_RADIUS;
  const safeMax = Number.isFinite(maxEvents) && maxEvents > 0 ? maxEvents : events;
  const ratio = Math.sqrt(Math.min(events, safeMax) / safeMax);
  return MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);
}

/**
 * Color de relleno. Un `people` nulo es gris **siempre**, esté marcado
 * `suppressed` o no: en los dos casos no hay cifra que representar, y
 * pintar el tono más claro de la rampa se leería como «casi nadie».
 */
export function bubbleColor(people: number | null, suppressed: boolean, maxPeople: number): string {
  if (people === null || suppressed) return SUPPRESSED_COLOR;
  const safeMax = Number.isFinite(maxPeople) && maxPeople > 0 ? maxPeople : people;
  if (safeMax <= 0) return PEOPLE_COLORS[0];
  const ratio = Math.min(people, safeMax) / safeMax;
  if (ratio >= 1) return PEOPLE_COLORS[2];
  if (ratio > 1 / 3) return PEOPLE_COLORS[1];
  return PEOPLE_COLORS[0];
}

/**
 * Une las filas de `by_place` (`key` = código INE) con las coordenadas
 * del catálogo de municipios y devuelve una burbuja por fila **que tenga
 * coordenadas**: una fila sin municipio en el catálogo, o con la
 * coordenada vacía, se descarta en silencio — el dato sigue estando
 * entero en la tabla de debajo, que es la alternativa completa al mapa.
 */
export function toBubbles(rows: ByPlaceRow[], places: PlaceRow[]): MapBubble[] {
  const byIne = new Map(places.map((place) => [place.ine_code, place]));
  const maxEvents = rows.reduce((max, row) => Math.max(max, row.events), 0);
  const maxPeople = rows.reduce((max, row) => Math.max(max, row.people ?? 0), 0);

  const bubbles: MapBubble[] = [];
  for (const row of rows) {
    const place = byIne.get(row.key);
    if (!place) continue;
    const latitude = toFiniteNumber(place.latitude);
    const longitude = toFiniteNumber(place.longitude);
    if (latitude === null || longitude === null) continue;

    bubbles.push({
      ineCode: row.key,
      label: row.label,
      latitude,
      longitude,
      radius: bubbleRadius(row.events, maxEvents),
      color: bubbleColor(row.people, row.suppressed, maxPeople),
      events: row.events,
      people: row.people,
      suppressed: row.suppressed,
    });
  }
  return bubbles;
}
```

- [ ] **Step 5: Ejecutar y comprobar que pasa**

Run: `npx vitest run lib/metrics/mapScale.test.ts`
Expected: PASS (11 tests). Comprueba también la cobertura del fichero:
`npx vitest run --coverage lib/metrics/mapScale.test.ts` debe dar 100 %
de líneas de `lib/metrics/mapScale.ts`.

- [ ] **Step 6: Mockear `react-leaflet` en `vitest.setup.ts`**

Añade, junto al mock de `recharts` y con el mismo estilo de docstring:

```ts
/**
 * `react-leaflet` monta un mapa real de `leaflet` sobre el DOM: mide el
 * contenedor, carga teselas por red y usa APIs de canvas/SVG que jsdom no
 * implementa. Mismo problema y misma solución que `ResponsiveContainer`
 * de `recharts` (arriba): se sustituyen las cuatro primitivas que usa
 * `components/metrics/TerritoryMapCanvas.tsx` por elementos planos que sí
 * se pueden inspeccionar desde un test.
 *
 * `CircleMarker` se sustituye por un `<button>` **de verdad** —no un
 * `<div>`— porque lo que hay que poder probar es que pulsar una burbuja
 * abre la ficha de ese municipio; en el mapa real, el `eventHandlers`
 * de `CircleMarker` hace ese mismo papel. Sus hijos (`<Tooltip>`) se
 * pintan dentro, así que el nombre accesible del botón es el texto del
 * tooltip.
 */
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "map-container" }, children),
  TileLayer: () => React.createElement("div", { "data-testid": "tile-layer" }),
  CircleMarker: ({
    children,
    eventHandlers,
  }: {
    children?: React.ReactNode;
    eventHandlers?: { click?: () => void };
  }) =>
    React.createElement(
      "button",
      { type: "button", onClick: () => eventHandlers?.click?.() },
      children,
    ),
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement("span", null, children),
}));
```

- [ ] **Step 7: Escribir el test que falla de `TerritoryMap`**

Crea `components/metrics/TerritoryMap.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { MAX_RADIUS, type MapBubble } from "@/lib/metrics/mapScale";

import { TerritoryMap } from "./TerritoryMap";

const BUBBLES: MapBubble[] = [
  {
    ineCode: "20069",
    label: "Irun",
    latitude: 43.34,
    longitude: -1.79,
    radius: MAX_RADIUS,
    color: "var(--color-primary-700)",
    events: 12,
    people: 30,
    suppressed: false,
  },
  {
    ineCode: "20045",
    label: "Hondarribia",
    latitude: 43.36,
    longitude: -1.79,
    radius: 10,
    color: "var(--color-text-disabled)",
    events: 3,
    people: null,
    suppressed: true,
  },
];

describe("TerritoryMap", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(<TerritoryMap bubbles={BUBBLES} onSelect={vi.fn()} />);

    expect(await screen.findByRole("img", { name: /Mapa del territorio/ })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("describe el mapa con el número de municipios con actividad", async () => {
    render(<TerritoryMap bubbles={BUBBLES} onSelect={vi.fn()} />);

    expect(
      await screen.findByRole("img", {
        name: "Mapa del territorio: 2 municipios con actividad en el periodo",
      }),
    ).toBeInTheDocument();
  });

  it("pinta una burbuja por municipio, con la cifra suprimida como «<5»", async () => {
    render(<TerritoryMap bubbles={BUBBLES} onSelect={vi.fn()} />);

    expect(await screen.findByText("Irun: 12 actividades, 30 personas")).toBeInTheDocument();
    expect(screen.getByText("Hondarribia: 3 actividades, <5 personas")).toBeInTheDocument();
  });

  it("pulsar una burbuja pide abrir la ficha de ese municipio", async () => {
    const onSelect = vi.fn();
    render(<TerritoryMap bubbles={BUBBLES} onSelect={onSelect} />);

    await userEvent.click(await screen.findByRole("button", { name: /^Irun:/ }));

    expect(onSelect).toHaveBeenCalledWith("20069");
  });

  it("sin burbujas avisa en vez de pintar un mapa vacío", async () => {
    render(<TerritoryMap bubbles={[]} onSelect={vi.fn()} />);

    expect(
      await screen.findByText("Ningún municipio del territorio tiene actividad en este periodo."),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Ejecutar y comprobar que falla**

Run: `npx vitest run components/metrics/TerritoryMap.test.tsx`
Expected: FAIL — `Failed to resolve import "./TerritoryMap"`.

- [ ] **Step 9: Implementar `components/metrics/TerritoryMapCanvas.tsx`**

```tsx
"use client";

/**
 * La parte `react-leaflet` del mapa de Territorio, en su propio fichero
 * porque `components/metrics/TerritoryMap.tsx` la carga con
 * `next/dynamic({ssr:false})`: `leaflet` toca `window` al importarse, así
 * que no puede formar parte del bundle del servidor ni del resto del
 * panel (riesgo R2 de la spec, «peso del mapa en el bundle»).
 *
 * Teselas de OpenStreetMap, sin clave de API (spec §4.2). `zoomControl`
 * y `keyboard` van desactivados **a propósito**: el contenedor de
 * `TerritoryMap` es `role="img"`, y los controles de zoom de leaflet son
 * `<a href>` enfocables — un elemento enfocable dentro de un rol no
 * interactivo es una trampa de teclado sin salida útil. El zoom con
 * rueda sigue disponible para quien use ratón, y toda la información y
 * toda la acción del mapa están duplicadas en la tabla de debajo.
 */
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

import type { MapBubble } from "@/lib/metrics/mapScale";

import "leaflet/dist/leaflet.css";

export interface TerritoryMapCanvasProps {
  bubbles: MapBubble[];
  /** Texto ya formateado por burbuja, indexado por código INE. */
  labels: Record<string, string>;
  attribution: string;
  onSelect: (ineCode: string) => void;
}

/** Centro y zoom iniciales: el centroide medio de las burbujas. */
function center(bubbles: MapBubble[]): [number, number] {
  const total = bubbles.length;
  const sum = bubbles.reduce(
    (acc, bubble) => [acc[0] + bubble.latitude, acc[1] + bubble.longitude] as [number, number],
    [0, 0] as [number, number],
  );
  return [sum[0] / total, sum[1] / total];
}

export function TerritoryMapCanvas({
  bubbles,
  labels,
  attribution,
  onSelect,
}: TerritoryMapCanvasProps) {
  return (
    <MapContainer
      center={center(bubbles)}
      zoom={9}
      zoomControl={false}
      keyboard={false}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution={attribution}
      />
      {bubbles.map((bubble) => (
        <CircleMarker
          key={bubble.ineCode}
          center={[bubble.latitude, bubble.longitude]}
          radius={bubble.radius}
          pathOptions={{ color: bubble.color, fillColor: bubble.color, fillOpacity: 0.7 }}
          eventHandlers={{ click: () => onSelect(bubble.ineCode) }}
        >
          <Tooltip>{labels[bubble.ineCode]}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 10: Implementar `components/metrics/TerritoryMap.tsx`**

```tsx
"use client";

/**
 * Mapa de burbujas del territorio (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §4.2): un círculo
 * por municipio sobre su centroide, con el tamaño y el color que decide
 * `lib/metrics/mapScale.ts` (y la desviación de «color = asistencia»
 * documentada en ese módulo).
 *
 * **Carga diferida** (`next/dynamic` con `ssr: false`, riesgo R2): todo
 * `leaflet` entra solo al visitar esta pantalla; el resto del panel no
 * lo paga. `TerritoryMapCanvas` está en un fichero aparte precisamente
 * para poder importarlo así.
 *
 * **Accesibilidad**: el contenedor es `role="img"` con un `aria-label`
 * que dice cuántos municipios hay, y nada dentro es enfocable (ver el
 * docstring del canvas). No es una pérdida de información ni de acción:
 * la tabla «Por municipio» de debajo lleva las mismas cifras y un botón
 * «Ver ficha» por fila que abre exactamente el mismo panel lateral que
 * pulsar la burbuja.
 */
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { formatCount } from "@/lib/metrics/format";
import type { MapBubble } from "@/lib/metrics/mapScale";

const TerritoryMapCanvas = dynamic(
  () => import("./TerritoryMapCanvas").then((module) => module.TerritoryMapCanvas),
  { ssr: false },
);

export interface TerritoryMapProps {
  bubbles: MapBubble[];
  onSelect: (ineCode: string) => void;
}

export function TerritoryMap({ bubbles, onSelect }: TerritoryMapProps) {
  const t = useTranslations("metrics.map");

  if (bubbles.length === 0) {
    return <p className="text-sm text-text-secondary">{t("empty")}</p>;
  }

  // `formatCount` es la única regla de supresión del panel: la burbuja
  // suprimida dice «<5» igual que su celda de la tabla, nunca «0».
  const labels = Object.fromEntries(
    bubbles.map((bubble) => [
      bubble.ineCode,
      t("bubbleLabel", {
        place: bubble.label,
        events: formatCount(bubble.events, false),
        people: formatCount(bubble.people, bubble.suppressed),
      }),
    ]),
  );

  return (
    <div
      role="img"
      aria-label={t("ariaLabel", { count: bubbles.length })}
      className="h-96 w-full overflow-hidden rounded-lg border border-border"
    >
      <TerritoryMapCanvas
        bubbles={bubbles}
        labels={labels}
        attribution={t("attribution")}
        onSelect={onSelect}
      />
    </div>
  );
}
```

- [ ] **Step 11: Añadir las claves del mapa a los cuatro catálogos**

Bajo `metrics`, un bloque `map` nuevo:

`messages/en.json`
```json
{
  "metrics": {
    "map": {
      "ariaLabel": "{count, plural, one {Territory map: # municipality with activity in the period} other {Territory map: # municipalities with activity in the period}}",
      "bubbleLabel": "{place}: {events} activities, {people} people",
      "empty": "No municipality in the territory had activity in this period.",
      "attribution": "© OpenStreetMap contributors",
      "heading": "Map of the territory",
      "legend": "Bubble size shows activities; colour shows people, grey when the group is under the aggregation threshold."
    }
  }
}
```

`messages/es.json`
```json
{
  "metrics": {
    "map": {
      "ariaLabel": "{count, plural, one {Mapa del territorio: # municipio con actividad en el periodo} other {Mapa del territorio: # municipios con actividad en el periodo}}",
      "bubbleLabel": "{place}: {events} actividades, {people} personas",
      "empty": "Ningún municipio del territorio tiene actividad en este periodo.",
      "attribution": "© Colaboradores de OpenStreetMap",
      "heading": "Mapa del territorio",
      "legend": "El tamaño de la burbuja indica las actividades; el color, las personas, en gris cuando el grupo está por debajo del umbral de agregación."
    }
  }
}
```

`messages/eu.json`
```json
{
  "metrics": {
    "map": {
      "ariaLabel": "{count, plural, one {Lurraldearen mapa: # udalerri jarduerarekin aldi honetan} other {Lurraldearen mapa: # udalerri jarduerarekin aldi honetan}}",
      "bubbleLabel": "{place}: {events} jarduera, {people} pertsona",
      "empty": "Lurraldeko udalerri batek ere ez du jarduerarik aldi honetan.",
      "attribution": "© OpenStreetMap-eko laguntzaileak",
      "heading": "Lurraldearen mapa",
      "legend": "Burbuilaren tamainak jarduerak adierazten ditu; koloreak, pertsonak, eta grisa taldea agregazio-atalasetik behera dagoenean."
    }
  }
}
```

`messages/ca.json`
```json
{
  "metrics": {
    "map": {
      "ariaLabel": "{count, plural, one {Mapa del territori: # municipi amb activitat en el període} other {Mapa del territori: # municipis amb activitat en el període}}",
      "bubbleLabel": "{place}: {events} activitats, {people} persones",
      "empty": "Cap municipi del territori té activitat en aquest període.",
      "attribution": "© Col·laboradors d'OpenStreetMap",
      "heading": "Mapa del territori",
      "legend": "La mida de la bombolla indica les activitats; el color, les persones, en gris quan el grup és per sota del llindar d'agregació."
    }
  }
}
```

> El `ariaLabel` de la prueba del Step 7 («Mapa del territorio: 2
> municipios con actividad en el periodo») sale del plural ICU `other`
> con `count: 2` — el mismo mecanismo que `common.items`, ya probado en
> `test-utils/render.test.tsx`.

- [ ] **Step 12: Ejecutar y comprobar que pasa**

Run: `npx vitest run components/metrics/TerritoryMap.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 13: Suite completa y commit**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: PASS. El `build` importa de verdad `leaflet` a través del
`dynamic`: si la carga diferida estuviera mal escrita, fallaría aquí con
`window is not defined`.

```bash
git add -A
git commit -m "feat(territorio): mapa de burbujas con react-leaflet diferido y escala pura probada"
```

---

## Task 5: Pantalla «Territorio» (observatorio) con ficha de municipio en panel lateral

La pantalla central del bloque (spec §4.1, fila «Territorio»): periodo,
mapa, tabla por municipio, comparativa y, al pulsar un municipio, su
ficha en un panel lateral. Incluye el estado 409 «sin territorio
declarado» que decide la página entera.

**Files:**
- Modify: `components/ui/Dialog.tsx` (prop `placement`)
- Create: `components/metrics/PlaceSheetPanel.tsx`
- Create: `components/metrics/TerritorioDashboard.tsx`
- Modify: `components/metrics/MetricsTable.tsx` (columna de acción opcional)
- Create: `app/paraguas/[slug]/territorio/page.tsx`, `app/paraguas/[slug]/territorio/page.test.tsx`
- Modify: `lib/help/pageHelp.ts`
- Modify: `messages/{en,es,eu,ca}.json`

**Interfaces:**
- Consumes: `useMetrics("territorio", …)`, `useCompare("territorio", …)`,
  `usePlaceSheet`, `usePlacesByIne` (Tarea 3); `toBubbles` (Tarea 4);
  `TerritoryMap` (Tarea 4); `paraguasMenuFor` (Tarea 2).
- Produces:
  - `components/ui/Dialog.tsx`: prop `placement?: "center" | "side"`
    (por defecto `"center"`).
  - `components/metrics/MetricsTable.tsx`: prop
    `onSelectRow?: (key: string) => void` y `selectRowLabel?: string`;
    con las dos, una columna de acciones al final.
  - `components/metrics/PlaceSheetPanel.tsx`:
    `<PlaceSheetPanel orgId ineCode period onClose />`.
  - `components/metrics/TerritorioDashboard.tsx`:
    `<TerritorioDashboard orgId={number | string} />`.
  - Entrada de ayuda `{ route: "/paraguas/[slug]/territorio", key: "paraguas.territorio" }`.

- [ ] **Step 1: Escribir el test que falla del `placement` del diálogo**

En `components/ui/Dialog.test.tsx` (si no existe, créalo con el mismo
andamiaje que `components/ui/ConfirmDialog.test.tsx`):

```tsx
  it("por defecto se centra; con placement='side' se ancla al lado", () => {
    const { rerender, container } = render(
      <Dialog open titleId="t" title="Ficha" onClose={vi.fn()}>
        <p>contenido</p>
      </Dialog>,
    );
    expect(container.firstChild).toHaveClass("justify-center");

    rerender(
      <Dialog open titleId="t" title="Ficha" onClose={vi.fn()} placement="side">
        <p>contenido</p>
      </Dialog>,
    );
    expect(container.firstChild).toHaveClass("justify-end");
  });
```

- [ ] **Step 2: Implementar `placement` en `Dialog`**

```tsx
export interface DialogProps {
  // …lo que ya había…
  /**
   * `"side"` ancla el diálogo al borde derecho y lo estira a toda la
   * altura: es el «panel lateral» de la ficha de municipio (spec §4.1).
   * Sigue siendo el mismo diálogo modal, con su foco atrapado, su
   * `Escape` y su devolución del foco — solo cambia dónde se pinta, para
   * no duplicar esa mecánica en un componente nuevo de *drawer*.
   */
  placement?: "center" | "side";
}
```

y, en el cuerpo:

```tsx
  const overlayPlacement = placement === "side" ? "justify-end" : "justify-center items-center";
  const panelPlacement = placement === "side" ? "h-full overflow-y-auto rounded-none" : "";
```

usándolos en el `className` del overlay (`fixed inset-0 z-50 flex
${overlayPlacement} bg-black/40 p-4`) y del panel
(`w-full ${widthClassName} ${panelPlacement} rounded-lg bg-white p-6 shadow-lg`).

Run: `npx vitest run components/ui/Dialog.test.tsx`
Expected: PASS.

- [ ] **Step 3: Añadir la columna de acción opcional a `MetricsTable`**

```tsx
export interface MetricsTableProps {
  caption: string;
  rows: ByPlaceRow[];
  nameHeader: string;
  codeHeader?: string;
  /**
   * Con las dos props, la tabla añade al final una columna de acciones
   * con un botón por fila. Es lo que hace que el mapa de Territorio no
   * tenga ninguna acción exclusiva: pulsar una burbuja y pulsar este
   * botón abren la misma ficha, y este sí es alcanzable con el teclado.
   * Sin ellas, la tabla se comporta exactamente como antes (así la usan
   * los dos dashboards de paraguas y plataforma).
   */
  onSelectRow?: (key: string) => void;
  selectRowLabel?: string;
}
```

y, tras las columnas existentes:

```tsx
    ...(onSelectRow && selectRowLabel
      ? [
          {
            key: "actions",
            // Cabecera solo para lectores de pantalla: una `<th>` vacía
            // incumple `empty-table-header` de axe (hallazgo B27).
            header: <span className="sr-only">{t("actionsHeader")}</span>,
            render: (row: ByPlaceRow) => (
              <button
                type="button"
                onClick={() => onSelectRow(row.key)}
                className="text-primary-700 underline focus-visible:outline-primary-700"
              >
                {selectRowLabel}
              </button>
            ),
          },
        ]
      : []),
```

con `actionsHeader` añadido al namespace `metrics.table` (valores en el
Step 9).

- [ ] **Step 4: Implementar `components/metrics/PlaceSheetPanel.tsx`**

```tsx
"use client";

/**
 * Ficha de un municipio del territorio (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §3.2), en el panel
 * lateral que pide §4.1. Se monta solo con un `ineCode`: cerrar el panel
 * es desmontarlo, y `usePlaceSheet` con `ineCode: null` ni siquiera pide.
 *
 * `organizations_based_here` es un **recuento**, nunca una lista de
 * nombres (invariante 1: la administración no ve entidades concretas que
 * no financia). `people`/`attendance` pasan por `formatCount`/`formatPct`,
 * así que una cifra suprimida se lee «<5» igual que en la tabla.
 */
import { useId } from "react";
import { useTranslations } from "next-intl";

import { Dialog } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatCard } from "@/components/metrics/StatCard";
import { usePlaceSheet, type PlaceSheetErrorKind } from "@/hooks/usePlaceSheet";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatCount, formatPct } from "@/lib/metrics/format";
import type { Period } from "@/lib/metrics/period";

const PLACE_SHEET_ERROR_KEYS: Record<PlaceSheetErrorKind, string> = {
  fuera_de_territorio: "errors.placeSheet.fueraDeTerritorio",
  sin_acceso: "errors.placeSheet.sinAcceso",
  sin_territorio: "errors.placeSheet.sinTerritorio",
  desconocido: "errors.placeSheet.desconocido",
};

export interface PlaceSheetPanelProps {
  orgId: number | string;
  ineCode: string;
  period: Period;
  onClose: () => void;
}

export function PlaceSheetPanel({ orgId, ineCode, period, onClose }: PlaceSheetPanelProps) {
  const t = useTranslations();
  const titleId = useId();
  const sheet = usePlaceSheet(orgId, ineCode, period);

  const title = sheet.data ? sheet.data.place.name : t("metrics.placeSheet.loadingTitle");

  return (
    <Dialog open titleId={titleId} title={title} onClose={onClose} placement="side" widthClassName="max-w-md">
      {sheet.isError ? (
        <ErrorState
          title={t("metrics.placeSheet.loadError")}
          description={errorKindText(sheet.error, PLACE_SHEET_ERROR_KEYS, t, "errors.placeSheet.desconocido")}
        />
      ) : !sheet.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            {t("metrics.placeSheet.location", {
              comarca: sheet.data.place.comarca_name_es || t("metrics.placeSheet.noComarca"),
              province: sheet.data.place.prov_name,
              ineCode: sheet.data.place.ine_code,
            })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={t("metrics.placeSheet.eventsHeld")}
              value={formatCount(sheet.data.events.held, false)}
            />
            <StatCard
              label={t("metrics.placeSheet.eventsUpcoming")}
              value={formatCount(sheet.data.events.upcoming, false)}
            />
            <StatCard
              label={t("metrics.placeSheet.people")}
              value={formatCount(sheet.data.people.value, sheet.data.people.suppressed)}
            />
            <StatCard
              label={t("metrics.placeSheet.attendance")}
              value={formatPct(sheet.data.attendance.rate, sheet.data.attendance.suppressed)}
            />
            <StatCard
              label={t("metrics.placeSheet.communities")}
              value={formatCount(sheet.data.communities.count, false)}
            />
            <StatCard
              label={t("metrics.placeSheet.organizationsBasedHere")}
              value={formatCount(sheet.data.organizations_based_here, false)}
            />
          </div>
          <p className="text-xs text-text-secondary">{t("metrics.placeSheet.noNamesNotice")}</p>
        </div>
      )}
    </Dialog>
  );
}
```

- [ ] **Step 5: Implementar `components/metrics/TerritorioDashboard.tsx`**

```tsx
"use client";

/**
 * Observatorio del territorio declarado de una administración (spec de
 * diseño `2026-09-19-territorio-administraciones-design.md` §4.1, fila
 * «Territorio»). Ámbito `scope_territorio`: todo lo que ocurre en los
 * municipios del `OrgScope`, sea de la entidad que sea — a diferencia de
 * «Red financiada» (`ParaguasMetricsDashboard`), que va sobre el árbol
 * `parent`/`children`. Por eso aquí **no** hay desglose «Por entidad»:
 * la spec §3.1 lo excluye a propósito del contrato.
 *
 * Tres peticiones de métricas por periodo (el esquema fijo solo rellena
 * un desglose por petición, igual que en paraguas): base para las
 * tarjetas, `place` para el mapa y la tabla, y `month`/`year` para la
 * serie; más la comparativa y las coordenadas de los municipios que
 * salen en `by_place`.
 *
 * **409, «sin territorio declarado»** (§3.1): no es un error de carga
 * sino una configuración que falta — la pinta un `EmptyState` que ocupa
 * toda la pantalla (nunca tarjetas a cero, que se leerían como «no pasa
 * nada en mi territorio») y dice quién puede arreglarlo, porque la
 * administración no se declara su propio territorio (§2.3).
 */
import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCompare, type CompareErrorKind, type CompareGroupBy } from "@/hooks/useCompare";
import { useMetrics, type MetricsErrorKind } from "@/hooks/useMetrics";
import { usePlacesByIne, type PlacesErrorKind } from "@/hooks/usePlaces";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { toBubbles } from "@/lib/metrics/mapScale";
import { presetPeriod, type Period, type PeriodPreset } from "@/lib/metrics/period";

import { ComparativaTable } from "./ComparativaTable";
import { MetricsTable } from "./MetricsTable";
import { PeriodSelector } from "./PeriodSelector";
import { PlaceSheetPanel } from "./PlaceSheetPanel";
import { SeriesChart } from "./SeriesChart";
import { StatCard } from "./StatCard";
import { TerritoryMap } from "./TerritoryMap";

export interface TerritorioDashboardProps {
  orgId: number | string;
}

/** Los tres desgloses que admite `compare/` en territorio (spec §3.1). */
type TerritorioCompareGroupBy = Extract<CompareGroupBy, "place" | "comarca" | "province">;

const COMPARE_GROUP_BY_OPTION_KEYS: { value: TerritorioCompareGroupBy; labelKey: string }[] = [
  { value: "comarca", labelKey: "metrics.groupBy.comarca" },
  { value: "place", labelKey: "metrics.groupBy.place" },
  { value: "province", labelKey: "metrics.groupBy.province" },
];

const METRICS_ERROR_KEYS: Record<MetricsErrorKind, string> = {
  periodo_invalido: "errors.metrics.periodoInvalido",
  sin_acceso: "errors.metrics.sinAcceso",
  sin_territorio: "errors.metrics.sinTerritorio",
  desconocido: "errors.metrics.desconocido",
};

const COMPARE_ERROR_KEYS: Record<CompareErrorKind, string> = {
  periodo_invalido: "errors.compare.periodoInvalido",
  sin_acceso: "errors.compare.sinAcceso",
  sin_territorio: "errors.compare.sinTerritorio",
  desconocido: "errors.compare.desconocido",
};

const PLACES_ERROR_KEYS: Record<PlacesErrorKind, string> = {
  demasiadas_paginas: "errors.places.demasiadasPaginas",
  desconocido: "errors.places.desconocido",
};

export function TerritorioDashboard({ orgId }: TerritorioDashboardProps) {
  const t = useTranslations();
  const [preset, setPreset] = useState<PeriodPreset>("mes");
  const [period, setPeriod] = useState<Period>(() => presetPeriod("mes"));
  const [compareGroupBy, setCompareGroupBy] = useState<TerritorioCompareGroupBy>("comarca");
  const [selectedIne, setSelectedIne] = useState<string | null>(null);
  const compareSelectId = useId();

  function handlePeriodChange(next: Period, nextPreset: PeriodPreset) {
    setPeriod(next);
    setPreset(nextPreset);
    // La ficha abierta es del periodo anterior: cerrarla evita enseñar
    // cifras de un rango que ya no es el que se está mirando.
    setSelectedIne(null);
  }

  const seriesGroupBy = preset === "plurianual" ? "year" : "month";

  const base = useMetrics("territorio", orgId, period);
  const byMunicipio = useMetrics("territorio", orgId, period, "place");
  const series = useMetrics("territorio", orgId, period, seriesGroupBy);
  const compare = useCompare("territorio", orgId, period, compareGroupBy);

  const placeRows = useMemo(() => byMunicipio.data?.by_place ?? [], [byMunicipio.data]);
  const ineCodes = useMemo(() => placeRows.map((row) => row.key), [placeRows]);
  const places = usePlacesByIne(ineCodes);
  const bubbles = useMemo(
    () => toBubbles(placeRows, places.data ?? []),
    [placeRows, places.data],
  );

  // Cualquiera de las consultas de territorio responde el mismo 409; con
  // la base basta para decidir la pantalla entera.
  if (base.error?.kind === "sin_territorio") {
    return (
      <EmptyState
        title={errorKindText(base.error, METRICS_ERROR_KEYS, t, "errors.metrics.sinTerritorio")}
        description={t("paraguas.territorio.noTerritoryHint")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PeriodSelector value={period} preset={preset} onChange={handlePeriodChange} />

      {base.isError ? (
        <ErrorState
          title={t("metrics.dashboard.loadError")}
          description={errorKindText(base.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
        />
      ) : !base.data ? (
        <p className="text-sm text-text-secondary">{t("metrics.dashboard.loading")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label={t("metrics.stats.activePeople")}
              value={formatCount(base.data.people.active, base.data.people.suppressed)}
            />
            <StatCard
              label={t("metrics.stats.eventsHeld")}
              value={formatCount(base.data.events.held, false)}
            />
            <StatCard
              label={t("metrics.stats.attendanceRate")}
              value={formatPct(base.data.attendance.rate, base.data.attendance.suppressed)}
            />
            <StatCard
              label={t("paraguas.territorio.communitiesStat")}
              value={formatCount(base.data.communities.active, base.data.communities.suppressed)}
            />
          </div>

          <section aria-labelledby="territorio-mapa-heading">
            <h2 id="territorio-mapa-heading" className="mb-2 text-lg font-semibold text-text-base">
              {t("metrics.map.heading")}
            </h2>
            <p className="mb-2 text-sm text-text-secondary">{t("metrics.map.legend")}</p>
            {byMunicipio.isError ? (
              <ErrorState
                title={t("metrics.dashboard.byMunicipioError")}
                description={errorKindText(byMunicipio.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
              />
            ) : places.isError ? (
              <ErrorState
                title={t("paraguas.territorio.placesError")}
                description={errorKindText(places.error, PLACES_ERROR_KEYS, t, "errors.places.desconocido")}
              />
            ) : (
              <TerritoryMap bubbles={bubbles} onSelect={setSelectedIne} />
            )}
          </section>

          <section aria-labelledby="territorio-tabla-heading">
            <h2 id="territorio-tabla-heading" className="mb-2 text-lg font-semibold text-text-base">
              {t("metrics.dashboard.byMunicipioHeading")}
            </h2>
            {byMunicipio.isError ? (
              <ErrorState
                title={t("metrics.dashboard.byMunicipioError")}
                description={errorKindText(byMunicipio.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
              />
            ) : placeRows.length > 0 ? (
              <MetricsTable
                caption={t("metrics.dashboard.byMunicipioCaption")}
                rows={placeRows}
                nameHeader={t("metrics.groupBy.place")}
                codeHeader={t("metrics.groupBy.ineCode")}
                onSelectRow={setSelectedIne}
                selectRowLabel={t("paraguas.territorio.openSheet")}
              />
            ) : (
              <EmptyState title={t("metrics.dashboard.byMunicipioEmpty")} />
            )}
          </section>

          <section aria-labelledby="territorio-serie-heading">
            <h2 id="territorio-serie-heading" className="mb-2 text-lg font-semibold text-text-base">
              {preset === "plurianual"
                ? t("metrics.dashboard.yearlySeriesHeading")
                : t("metrics.dashboard.monthlySeriesHeading")}
            </h2>
            {series.isError ? (
              <ErrorState
                title={t("metrics.dashboard.seriesError")}
                description={errorKindText(series.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
              />
            ) : series.data && series.data.series.length > 0 ? (
              <SeriesChart data={series.data.series} />
            ) : (
              <EmptyState
                title={
                  preset === "plurianual"
                    ? t("metrics.dashboard.yearlySeriesEmpty")
                    : t("metrics.dashboard.monthlySeriesEmpty")
                }
              />
            )}
          </section>

          <section aria-labelledby="territorio-comparativa-heading">
            <h2
              id="territorio-comparativa-heading"
              className="mb-2 text-lg font-semibold text-text-base"
            >
              {t("metrics.dashboard.comparativaHeading")}
            </h2>
            <div className="mb-3">
              <label htmlFor={compareSelectId} className="mb-1 block text-sm font-medium text-text-form">
                {t("metrics.dashboard.comparativaGroupByLabel")}
              </label>
              <select
                id={compareSelectId}
                value={compareGroupBy}
                onChange={(event) =>
                  setCompareGroupBy(event.target.value as TerritorioCompareGroupBy)
                }
                className="rounded-md border border-border px-2 py-1 text-sm text-text-base focus-visible:outline-primary-700"
              >
                {COMPARE_GROUP_BY_OPTION_KEYS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            {compare.isError ? (
              <ErrorState
                title={t("metrics.dashboard.comparativaError")}
                description={errorKindText(compare.error, COMPARE_ERROR_KEYS, t, "errors.compare.desconocido")}
              />
            ) : compare.data && compare.data.rows.length > 0 ? (
              <ComparativaTable data={compare.data} />
            ) : (
              <EmptyState title={t("metrics.dashboard.comparativaEmpty")} />
            )}
          </section>
        </>
      )}

      {selectedIne ? (
        <PlaceSheetPanel
          orgId={orgId}
          ineCode={selectedIne}
          period={period}
          onClose={() => setSelectedIne(null)}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Escribir el test que falla de la página**

Crea `app/paraguas/[slug]/territorio/page.test.tsx`, siguiendo el
andamiaje de `app/paraguas/[slug]/page.test.tsx` (mockea
`@/lib/auth/session`, `@/lib/api/serverFetch`, `@/hooks/useMetrics`,
`@/hooks/useCompare`) **más** `@/hooks/usePlaces`, `@/hooks/usePlaceSheet`
y `@/components/metrics/TerritoryMap`:

```tsx
// El mapa real carga `leaflet` con `next/dynamic({ssr:false})`, que en
// jsdom resuelve de forma asíncrona y metería una espera en cada test de
// esta página. Aquí se sustituye por un doble con la misma interfaz
// (`bubbles`/`onSelect`); el mapa de verdad tiene su propio test, con su
// propio `axe`, en `components/metrics/TerritoryMap.test.tsx`.
vi.mock("@/components/metrics/TerritoryMap", () => ({
  TerritoryMap: ({ bubbles, onSelect }: { bubbles: { ineCode: string; label: string }[]; onSelect: (ine: string) => void }) => (
    <div data-testid="territory-map">
      {bubbles.map((bubble) => (
        <button key={bubble.ineCode} type="button" onClick={() => onSelect(bubble.ineCode)}>
          {bubble.label}
        </button>
      ))}
    </div>
  ),
}));
```

y estos tests:

```tsx
describe("ParaguasTerritorioPage", () => {
  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("pinta el mapa y la tabla por municipio del periodo", async () => {
    await renderPage();

    expect(screen.getByTestId("territory-map")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Por municipio" })).toBeInTheDocument();
    expect(screen.getByText("Alfaville")).toBeInTheDocument();
    // La fila suprimida se lee «<5», nunca 0 (regla de `formatCount`).
    expect(screen.getByText("<5")).toBeInTheDocument();
  });

  it("«Ver ficha» abre el panel lateral con la ficha de ese municipio", async () => {
    usePlaceSheetMock.mockReturnValue({ data: buildPlaceSheet(), isError: false, error: null });
    await renderPage();

    await userEvent.click(screen.getAllByRole("button", { name: "Ver ficha" })[0]);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Irun" })).toBeInTheDocument();
    expect(within(dialog).getByText("Entidades con sede aquí")).toBeInTheDocument();
  });

  it("una administración sin territorio ve el aviso del contrato, no tarjetas a cero", async () => {
    useMetricsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new MetricsError(
        "sin_territorio",
        "Esta administración no tiene territorio declarado.",
        "Esta administración no tiene territorio declarado.",
      ),
    });

    await renderPage();

    expect(screen.getByText("Esta administración no tiene territorio declarado.")).toBeInTheDocument();
    expect(
      screen.getByText("La plataforma declara el territorio de cada administración desde su ficha de entidad."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("territory-map")).not.toBeInTheDocument();
  });

  it("una cuenta sin membresía de panel en esa entidad va a la raíz", async () => {
    // `paraguasMenuFor` da Territorio a los cinco roles de panel, así
    // que el `EmptyState` «Sin acceso» de esta página es defensivo (el
    // mismo patrón que `informes/page.tsx`) y no se puede provocar con
    // un rol real: lo que sí se prueba es el gate de antes, el de
    // membresía — `voluntario` no es rol de panel, así que la página
    // redirige, igual que el resto del área.
    await expect(renderPage("voluntario")).rejects.toThrow(NextRedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 7: Ejecutar y comprobar que falla**

Run: `npx vitest run "app/paraguas/[slug]/territorio/page.test.tsx"`
Expected: FAIL — `Failed to resolve import "./page"`.

- [ ] **Step 8: Implementar `app/paraguas/[slug]/territorio/page.tsx`**

```tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { TerritorioDashboard } from "@/components/metrics/TerritorioDashboard";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { paraguasMenuFor } from "@/lib/auth/paraguasMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.paraguas.territorio");
  return { title: t("title") };
}

export default async function ParaguasTerritorioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const membership = session.me.org_memberships.find(
    (m) => m.organization_slug === slug && isEntidadPanelRole(m.role),
  );
  if (!membership) {
    redirect("/");
  }

  const t = await getTranslations();

  if (!paraguasMenuFor(membership.role).includes("territorio")) {
    return (
      <EmptyState
        title={t("common.noAccess")}
        description={t("paraguas.territorio.noAccessDescription")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text-base">{t("paraguas.territorio.heading")}</h1>
      <TerritorioDashboard orgId={membership.organization_id} />
    </div>
  );
}
```

- [ ] **Step 9: Añadir las claves de la pantalla a los cuatro catálogos**

`messages/en.json`
```json
{
  "metrics": {
    "table": { "actionsHeader": "Actions" },
    "placeSheet": {
      "loadingTitle": "Municipality",
      "loadError": "The municipality details could not be loaded",
      "location": "{comarca} · {province} · INE code {ineCode}",
      "noComarca": "No district",
      "eventsHeld": "Activities held",
      "eventsUpcoming": "Upcoming activities",
      "people": "People",
      "attendance": "Attendance",
      "communities": "Communities",
      "organizationsBasedHere": "Entities based here",
      "noNamesNotice": "This sheet only shows aggregates: never the names of people or of the entities based here."
    }
  },
  "paraguas": {
    "territorio": {
      "heading": "Territory",
      "noAccessDescription": "Your role doesn't have access to Territory.",
      "noTerritoryHint": "The platform declares each administration's territory from its entity record.",
      "communitiesStat": "Active communities",
      "openSheet": "View details",
      "placesError": "The map coordinates could not be loaded"
    }
  },
  "pages": { "paraguas": { "territorio": { "title": "Territory observatory" } } },
  "help": {
    "paraguas": {
      "territorio": {
        "title": "Territory",
        "summary": "Observatory of your declared territory: everything that happens in its municipalities, whoever runs it. Bubble map, table by municipality, monthly series and comparison against the previous period. You never see people: any group of fewer than five shows as “<5”.",
        "actions": [
          "Change the period",
          "Open a municipality to see its aggregated details",
          "Compare districts, municipalities or provinces against the previous period"
        ],
        "audience": "All roles of the administration."
      }
    }
  }
}
```

`messages/es.json`
```json
{
  "metrics": {
    "table": { "actionsHeader": "Acciones" },
    "placeSheet": {
      "loadingTitle": "Municipio",
      "loadError": "No se pudo cargar la ficha del municipio",
      "location": "{comarca} · {province} · Código INE {ineCode}",
      "noComarca": "Sin comarca",
      "eventsHeld": "Actividades celebradas",
      "eventsUpcoming": "Próximas actividades",
      "people": "Personas",
      "attendance": "Asistencia",
      "communities": "Comunidades",
      "organizationsBasedHere": "Entidades con sede aquí",
      "noNamesNotice": "Esta ficha solo muestra agregados: nunca nombres de personas ni de las entidades con sede aquí."
    }
  },
  "paraguas": {
    "territorio": {
      "heading": "Territorio",
      "noAccessDescription": "Tu rol no tiene acceso a Territorio.",
      "noTerritoryHint": "La plataforma declara el territorio de cada administración desde su ficha de entidad.",
      "communitiesStat": "Comunidades activas",
      "openSheet": "Ver ficha",
      "placesError": "No se pudieron cargar las coordenadas del mapa"
    }
  },
  "pages": { "paraguas": { "territorio": { "title": "Observatorio del territorio" } } },
  "help": {
    "paraguas": {
      "territorio": {
        "title": "Territorio",
        "summary": "Observatorio de tu territorio declarado: todo lo que ocurre en sus municipios, sea de la entidad que sea. Mapa de burbujas, tabla por municipio, serie mensual y comparativa con el periodo anterior. Nunca ves personas: cualquier grupo con menos de cinco se muestra como «<5».",
        "actions": [
          "Cambiar el periodo",
          "Abrir un municipio para ver su ficha agregada",
          "Comparar comarcas, municipios o provincias con el periodo anterior"
        ],
        "audience": "Todos los roles de la administración."
      }
    }
  }
}
```

`messages/eu.json`
```json
{
  "metrics": {
    "table": { "actionsHeader": "Ekintzak" },
    "placeSheet": {
      "loadingTitle": "Udalerria",
      "loadError": "Ezin izan da udalerriaren fitxa kargatu",
      "location": "{comarca} · {province} · INE kodea {ineCode}",
      "noComarca": "Eskualderik gabe",
      "eventsHeld": "Egindako jarduerak",
      "eventsUpcoming": "Hurrengo jarduerak",
      "people": "Pertsonak",
      "attendance": "Bertaratzea",
      "communities": "Komunitateak",
      "organizationsBasedHere": "Hemen egoitza duten erakundeak",
      "noNamesNotice": "Fitxa honek datu agregatuak baino ez ditu erakusten: inoiz ez pertsonen izenak, ezta hemen egoitza duten erakundeenak ere."
    }
  },
  "paraguas": {
    "territorio": {
      "heading": "Lurraldea",
      "noAccessDescription": "Zure rolak ez du sarbiderik Lurraldean.",
      "noTerritoryHint": "Plataformak administrazio bakoitzaren lurraldea bere erakunde-fitxatik adierazten du.",
      "communitiesStat": "Komunitate aktiboak",
      "openSheet": "Fitxa ikusi",
      "placesError": "Ezin izan dira maparen koordenatuak kargatu"
    }
  },
  "pages": { "paraguas": { "territorio": { "title": "Lurraldearen behatokia" } } },
  "help": {
    "paraguas": {
      "territorio": {
        "title": "Lurraldea",
        "summary": "Adierazitako zure lurraldearen behatokia: bere udalerrietan gertatzen den guztia, edozein erakunderena dela ere. Burbuila-mapa, udalerrika banatutako taula, hileko seriea eta aurreko aldiarekiko konparaketa. Inoiz ez dituzu pertsonak ikusten: bost baino gutxiagoko talde oro «<5» gisa erakusten da.",
        "actions": [
          "Aldia aldatu",
          "Udalerri bat ireki bere fitxa agregatua ikusteko",
          "Eskualdeak, udalerriak edo probintziak aurreko aldiarekin konparatu"
        ],
        "audience": "Administrazioko rol guztiak."
      }
    }
  }
}
```

`messages/ca.json`
```json
{
  "metrics": {
    "table": { "actionsHeader": "Accions" },
    "placeSheet": {
      "loadingTitle": "Municipi",
      "loadError": "No s'ha pogut carregar la fitxa del municipi",
      "location": "{comarca} · {province} · Codi INE {ineCode}",
      "noComarca": "Sense comarca",
      "eventsHeld": "Activitats fetes",
      "eventsUpcoming": "Properes activitats",
      "people": "Persones",
      "attendance": "Assistència",
      "communities": "Comunitats",
      "organizationsBasedHere": "Entitats amb seu aquí",
      "noNamesNotice": "Aquesta fitxa només mostra dades agregades: mai noms de persones ni de les entitats amb seu aquí."
    }
  },
  "paraguas": {
    "territorio": {
      "heading": "Territori",
      "noAccessDescription": "El teu rol no té accés a Territori.",
      "noTerritoryHint": "La plataforma declara el territori de cada administració des de la seva fitxa d'entitat.",
      "communitiesStat": "Comunitats actives",
      "openSheet": "Veure fitxa",
      "placesError": "No s'han pogut carregar les coordenades del mapa"
    }
  },
  "pages": { "paraguas": { "territorio": { "title": "Observatori del territori" } } },
  "help": {
    "paraguas": {
      "territorio": {
        "title": "Territori",
        "summary": "Observatori del teu territori declarat: tot el que passa als seus municipis, sigui de l'entitat que sigui. Mapa de bombolles, taula per municipi, sèrie mensual i comparativa amb el període anterior. Mai veus persones: qualsevol grup amb menys de cinc es mostra com a «<5».",
        "actions": [
          "Canviar el període",
          "Obrir un municipi per veure'n la fitxa agregada",
          "Comparar comarques, municipis o províncies amb el període anterior"
        ],
        "audience": "Tots els rols de l'administració."
      }
    }
  }
}
```

- [ ] **Step 10: Registrar la pantalla en la ayuda**

En `lib/help/pageHelp.ts`, en el bloque de paraguas:

```ts
  { route: "/paraguas/[slug]/territorio", key: "paraguas.territorio" },
```

- [ ] **Step 11: Ejecutar y comprobar que pasa**

Run: `npx vitest run "app/paraguas/[slug]/territorio/page.test.tsx" lib/help/pageHelp.test.ts`
Expected: PASS.

- [ ] **Step 12: Suite completa y commit**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: PASS.

```bash
git add -A
git commit -m "feat(territorio): pantalla Territorio con mapa, tabla, comparativa y ficha de municipio"
```

---

## Task 6: Inicio, Red financiada e Informes del área de administración

Cierra las otras tres secciones del menú (spec §4.1): Inicio con las dos
lecturas (territorio y red financiada), Red financiada como la ruta nueva
del dashboard de paraguas de siempre, e Informes con el selector de
ámbito.

**Files:**
- Create: `components/metrics/ParaguasHomeDashboard.tsx`
- Modify: `app/paraguas/[slug]/page.tsx`, `app/paraguas/[slug]/page.test.tsx`
- Create: `app/paraguas/[slug]/red-financiada/page.tsx`, `.../page.test.tsx`
- Modify: `app/paraguas/[slug]/informes/page.tsx`, `.../page.test.tsx`
- Modify: `components/metrics/ExportPanel.tsx`, `components/metrics/ExportPanel.test.tsx`
- Modify: `lib/help/pageHelp.ts`
- Modify: `messages/{en,es,eu,ca}.json`

**Interfaces:**
- Consumes: `useMetrics("territorio"|"paraguas", …)` y `MetricsErrorKind`
  con `sin_territorio` (Tarea 3), `paraguasMenuFor` (Tarea 2),
  `useOrganizations({parent})` (ya existía).
- Produces:
  - `components/metrics/ParaguasHomeDashboard.tsx`:
    `<ParaguasHomeDashboard orgId={number | string} slug={string} orgName={string} />`.
  - `components/metrics/ExportPanel.tsx`: prop
    `scopeChoices?: readonly MetricsScope[]` (con dos o más, pinta el
    selector «Ámbito del informe»).
  - Entradas de ayuda `paraguas.redFinanciada` y actualización de
    `paraguas.inicio`.

- [ ] **Step 1: Escribir el test que falla del selector de ámbito de `ExportPanel`**

En `components/metrics/ExportPanel.test.tsx`:

```tsx
  it("con varios ámbitos ofrece elegir entre territorio y red financiada", async () => {
    render(<ExportPanel scope="territorio" orgId={3} scopeChoices={["territorio", "paraguas"]} />);

    const select = screen.getByLabelText("Ámbito del informe");
    expect(select).toHaveValue("territorio");
    expect(screen.getByRole("option", { name: "Territorio" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Red financiada" })).toBeInTheDocument();

    await userEvent.selectOptions(select, "paraguas");
    expect(select).toHaveValue("paraguas");
  });

  it("con un solo ámbito no pinta el selector (las dos páginas de Informes de entidad)", () => {
    render(<ExportPanel scope="entidad" orgId={7} />);

    expect(screen.queryByLabelText("Ámbito del informe")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run components/metrics/ExportPanel.test.tsx`
Expected: FAIL — `scopeChoices` no existe en `ExportPanelProps`.

- [ ] **Step 3: Implementar `scopeChoices` en `ExportPanel`**

En `ExportPanelOwnProps`:

```ts
  /**
   * Ámbitos entre los que puede elegir quien exporta. Con dos o más, el
   * panel pinta un `<select>` «Ámbito del informe» y la descarga usa el
   * elegido; con uno (o sin la prop) se comporta como siempre y usa
   * `scope`. Lo usa Informes del área de administración (spec §4.1):
   * la misma pantalla exporta el territorio o la red financiada, que son
   * dos rutas distintas del backend con el mismo formato de salida.
   */
  scopeChoices?: readonly MetricsScope[];
```

En el cuerpo del componente:

```ts
  const scopeSelectId = useId();
  const [chosenScope, setChosenScope] = useState<MetricsScope>(scope);
  const showScopeSelect = (scopeChoices?.length ?? 0) > 1;
  const effectiveScope = showScopeSelect ? chosenScope : scope;
```

un `<select>` con `<label htmlFor={scopeSelectId}>{t("scopeLabel")}</label>`
justo encima del selector de desglose, que recorre `scopeChoices` con un
mapa explícito de claves:

```ts
const SCOPE_LABEL_KEYS: Record<MetricsScope, string> = {
  entidad: "scopeEntidad",
  paraguas: "scopeRedFinanciada",
  plataforma: "scopePlataforma",
  territorio: "scopeTerritorio",
};
```

y `ExportButtons` recibe `scope: effectiveScope`.

- [ ] **Step 4: Ejecutar y comprobar que pasa**

Run: `npx vitest run components/metrics/ExportPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Crear la página «Red financiada» y su test**

`app/paraguas/[slug]/red-financiada/page.tsx` es **idéntica** a la
`page.tsx` actual de Inicio, salvo por el título, el encabezado y el
gate por sección:

```tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ParaguasMetricsDashboard } from "@/components/metrics/ParaguasMetricsDashboard";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerOrganization } from "@/lib/auth/organization";
import { paraguasMenuFor } from "@/lib/auth/paraguasMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.paraguas.redFinanciada");
  return { title: t("title") };
}

export default async function ParaguasRedFinanciadaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const membership = session.me.org_memberships.find(
    (m) => m.organization_slug === slug && isEntidadPanelRole(m.role),
  );
  if (!membership) {
    redirect("/");
  }

  const t = await getTranslations();

  if (!paraguasMenuFor(membership.role).includes("red-financiada")) {
    return (
      <EmptyState
        title={t("common.noAccess")}
        description={t("paraguas.redFinanciada.noAccessDescription")}
      />
    );
  }

  const orgResult = await getServerOrganization(membership.organization_id, session.token);
  const orgName = orgResult.ok ? orgResult.data.name : membership.organization_name;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text-base">
        {t("paraguas.redFinanciada.heading")}
      </h1>
      <ParaguasMetricsDashboard orgId={membership.organization_id} orgName={orgName} />
    </div>
  );
}
```

Su `page.test.tsx` es una copia del actual `app/paraguas/[slug]/page.test.tsx`
(mismos mocks de `useMetrics`/`useCompare`), con el encabezado «Red
financiada» en vez de «Inicio», un test de `axe` como primero del
`describe` y un caso de «Sin acceso» con `referente`:

```tsx
  it("un rol sin exportar_informes sí ve Red financiada (solo pide ver_panel)", async () => {
    await renderPage("referente");

    expect(screen.getByRole("heading", { name: "Red financiada" })).toBeInTheDocument();
  });
```

- [ ] **Step 6: Escribir el test que falla del Inicio nuevo**

En `app/paraguas/[slug]/page.test.tsx`, sustituye las aserciones del
dashboard de paraguas por las del Inicio nuevo:

```tsx
  it("resume el territorio y la red financiada, cada uno con su enlace", async () => {
    await renderPage();

    const territorio = screen.getByRole("region", { name: "Tu territorio" });
    expect(within(territorio).getByText("Personas activas")).toBeInTheDocument();
    expect(within(territorio).getByRole("link", { name: "Ver el territorio" })).toHaveAttribute(
      "href",
      "/paraguas/diputacion-demo/territorio",
    );

    const red = screen.getByRole("region", { name: "Red financiada" });
    expect(within(red).getByText("Entidades financiadas")).toBeInTheDocument();
    expect(within(red).getByRole("link", { name: "Ver la red financiada" })).toHaveAttribute(
      "href",
      "/paraguas/diputacion-demo/red-financiada",
    );
  });

  it("sin territorio declarado, el bloque de territorio lo dice y el de red financiada sigue entero", async () => {
    useMetricsMock.mockImplementation((scope: MetricsScope) =>
      scope === "territorio"
        ? {
            data: undefined,
            isError: true,
            error: new MetricsError(
              "sin_territorio",
              "Esta administración no tiene territorio declarado.",
              "Esta administración no tiene territorio declarado.",
            ),
          }
        : { data: buildMetricsResponse(), isError: false, error: null },
    );

    await renderPage();

    expect(screen.getByText("Esta administración no tiene territorio declarado.")).toBeInTheDocument();
    expect(screen.getByText("Entidades financiadas")).toBeInTheDocument();
  });
```

- [ ] **Step 7: Implementar `components/metrics/ParaguasHomeDashboard.tsx`**

```tsx
"use client";

/**
 * Inicio del área de administración (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §4.1, fila
 * «Inicio»): responde a «¿cómo está mi territorio?» con dos bloques que
 * son dos lecturas distintas de la misma administración — el
 * **territorio** declarado (`scope_territorio`: todo lo que ocurre en
 * sus municipios) y la **red financiada** (el árbol `parent`/`children`:
 * solo sus entidades hijas). Cada bloque enlaza a su sección, donde
 * está el detalle.
 *
 * **Decisión documentada** (ver el plan de esta tarea): la spec pedía
 * además una tarjeta de «entidades con sede» en el territorio, pero el
 * contrato no tiene ningún agregado para eso —
 * `organizations_based_here` es **por municipio** (§3.2) y sumarlo
 * exigiría una petición por municipio. El bloque de red financiada sí
 * cuenta sus entidades, que es el recuento que el backend sí da
 * (`GET /api/organizations/?parent=`).
 */
import Link from "next/link";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useMetrics, type MetricsErrorKind } from "@/hooks/useMetrics";
import { useOrganizations } from "@/hooks/useOrganizations";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { presetPeriod } from "@/lib/metrics/period";

import { StatCard } from "./StatCard";

const METRICS_ERROR_KEYS: Record<MetricsErrorKind, string> = {
  periodo_invalido: "errors.metrics.periodoInvalido",
  sin_acceso: "errors.metrics.sinAcceso",
  sin_territorio: "errors.metrics.sinTerritorio",
  desconocido: "errors.metrics.desconocido",
};

export interface ParaguasHomeDashboardProps {
  orgId: number | string;
  slug: string;
  orgName: string;
}

export function ParaguasHomeDashboard({ orgId, slug, orgName }: ParaguasHomeDashboardProps) {
  const t = useTranslations();
  // Periodo fijo al mes en curso, sin selector: el Inicio es un vistazo,
  // y las dos secciones que enlaza sí tienen su `PeriodSelector`.
  const period = presetPeriod("mes");

  const territorio = useMetrics("territorio", orgId, period);
  const red = useMetrics("paraguas", orgId, period);
  const children = useOrganizations({ parent: orgId });

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="inicio-territorio-heading" className="flex flex-col gap-3">
        <h2 id="inicio-territorio-heading" className="text-lg font-semibold text-text-base">
          {t("paraguas.inicio.territoryHeading")}
        </h2>
        {territorio.error?.kind === "sin_territorio" ? (
          <EmptyState
            title={errorKindText(territorio.error, METRICS_ERROR_KEYS, t, "errors.metrics.sinTerritorio")}
            description={t("paraguas.territorio.noTerritoryHint")}
          />
        ) : territorio.isError ? (
          <ErrorState
            title={t("metrics.dashboard.loadError")}
            description={errorKindText(territorio.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
          />
        ) : !territorio.data ? (
          <p className="text-sm text-text-secondary">{t("metrics.dashboard.loading")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard
              label={t("metrics.stats.activePeople")}
              value={formatCount(territorio.data.people.active, territorio.data.people.suppressed)}
            />
            <StatCard
              label={t("metrics.stats.eventsHeld")}
              value={formatCount(territorio.data.events.held, false)}
            />
            <StatCard
              label={t("paraguas.territorio.communitiesStat")}
              value={formatCount(
                territorio.data.communities.active,
                territorio.data.communities.suppressed,
              )}
            />
          </div>
        )}
        <Link href={`/paraguas/${slug}/territorio`} className="text-sm text-primary-700 underline">
          {t("paraguas.inicio.territoryLink")}
        </Link>
      </section>

      <section aria-labelledby="inicio-red-heading" className="flex flex-col gap-3">
        <h2 id="inicio-red-heading" className="text-lg font-semibold text-text-base">
          {t("paraguas.inicio.networkHeading")}
        </h2>
        {red.isError ? (
          <ErrorState
            title={t("metrics.dashboard.loadError")}
            description={errorKindText(red.error, METRICS_ERROR_KEYS, t, "errors.metrics.desconocido")}
          />
        ) : !red.data ? (
          <p className="text-sm text-text-secondary">
            {t("metrics.dashboard.loadingWithName", { orgName })}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard
              label={t("paraguas.inicio.fundedEntities")}
              value={formatCount(children.data?.count ?? null, false)}
            />
            <StatCard
              label={t("metrics.stats.eventsHeld")}
              value={formatCount(red.data.events.held, false)}
            />
            <StatCard
              label={t("metrics.stats.attendanceRate")}
              value={formatPct(red.data.attendance.rate, red.data.attendance.suppressed)}
            />
          </div>
        )}
        <Link
          href={`/paraguas/${slug}/red-financiada`}
          className="text-sm text-primary-700 underline"
        >
          {t("paraguas.inicio.networkLink")}
        </Link>
      </section>
    </div>
  );
}
```

`app/paraguas/[slug]/page.tsx` cambia una sola línea de cuerpo:
sustituye `<ParaguasMetricsDashboard orgId={…} orgName={orgName} />` por
`<ParaguasHomeDashboard orgId={membership.organization_id} slug={slug} orgName={orgName} />`
(y su import).

- [ ] **Step 8: Añadir el selector de ámbito a Informes**

En `app/paraguas/[slug]/informes/page.tsx`, el `ExportPanel` pasa a:

```tsx
      <ExportPanel
        scope="territorio"
        orgId={membership.organization_id}
        scopeChoices={["territorio", "paraguas"]}
      />
```

y en su `page.test.tsx`, un caso nuevo:

```tsx
  it("permite exportar el territorio o la red financiada", async () => {
    await renderPage("analista");

    expect(screen.getByLabelText("Ámbito del informe")).toHaveValue("territorio");
    expect(screen.getByRole("option", { name: "Red financiada" })).toBeInTheDocument();
  });
```

- [ ] **Step 9: Añadir las claves nuevas a los cuatro catálogos**

`messages/en.json`
```json
{
  "metrics": { "export": {
    "scopeLabel": "Report scope",
    "scopeEntidad": "Entity",
    "scopeRedFinanciada": "Funded network",
    "scopePlataforma": "Platform",
    "scopeTerritorio": "Territory"
  } },
  "paraguas": {
    "inicio": {
      "territoryHeading": "Your territory",
      "territoryLink": "View the territory",
      "networkHeading": "Funded network",
      "networkLink": "View the funded network",
      "fundedEntities": "Funded entities"
    },
    "redFinanciada": {
      "heading": "Funded network",
      "noAccessDescription": "Your role doesn't have access to the Funded network."
    }
  },
  "pages": { "paraguas": { "redFinanciada": { "title": "Funded network" } } },
  "help": { "paraguas": { "redFinanciada": {
    "title": "Funded network",
    "summary": "Aggregated metrics for the entities that hang off this administration: people, activities and attendance by municipality, by entity and by month, plus the comparison with the previous period. It follows the parent/children tree, not the territory.",
    "actions": [
      "Change the period",
      "Compare districts, entities or municipalities against the previous period"
    ],
    "audience": "All roles of the administration."
  } } }
}
```

`messages/es.json`
```json
{
  "metrics": { "export": {
    "scopeLabel": "Ámbito del informe",
    "scopeEntidad": "Entidad",
    "scopeRedFinanciada": "Red financiada",
    "scopePlataforma": "Plataforma",
    "scopeTerritorio": "Territorio"
  } },
  "paraguas": {
    "inicio": {
      "territoryHeading": "Tu territorio",
      "territoryLink": "Ver el territorio",
      "networkHeading": "Red financiada",
      "networkLink": "Ver la red financiada",
      "fundedEntities": "Entidades financiadas"
    },
    "redFinanciada": {
      "heading": "Red financiada",
      "noAccessDescription": "Tu rol no tiene acceso a la Red financiada."
    }
  },
  "pages": { "paraguas": { "redFinanciada": { "title": "Red financiada" } } },
  "help": { "paraguas": { "redFinanciada": {
    "title": "Red financiada",
    "summary": "Métricas agregadas de las entidades que cuelgan de esta administración: personas, actividades y asistencia por municipio, por entidad y por mes, y la comparativa con el periodo anterior. Sigue el árbol de entidades, no el territorio.",
    "actions": [
      "Cambiar el periodo",
      "Comparar comarcas, entidades o municipios con el periodo anterior"
    ],
    "audience": "Todos los roles de la administración."
  } } }
}
```

`messages/eu.json`
```json
{
  "metrics": { "export": {
    "scopeLabel": "Txostenaren esparrua",
    "scopeEntidad": "Erakundea",
    "scopeRedFinanciada": "Finantzatutako sarea",
    "scopePlataforma": "Plataforma",
    "scopeTerritorio": "Lurraldea"
  } },
  "paraguas": {
    "inicio": {
      "territoryHeading": "Zure lurraldea",
      "territoryLink": "Lurraldea ikusi",
      "networkHeading": "Finantzatutako sarea",
      "networkLink": "Finantzatutako sarea ikusi",
      "fundedEntities": "Finantzatutako erakundeak"
    },
    "redFinanciada": {
      "heading": "Finantzatutako sarea",
      "noAccessDescription": "Zure rolak ez du sarbiderik Finantzatutako sarean."
    }
  },
  "pages": { "paraguas": { "redFinanciada": { "title": "Finantzatutako sarea" } } },
  "help": { "paraguas": { "redFinanciada": {
    "title": "Finantzatutako sarea",
    "summary": "Administrazio honen menpe dauden erakundeen metrika agregatuak: pertsonak, jarduerak eta bertaratzea udalerriz, erakundez eta hilabetez, eta aurreko aldiarekiko konparaketa. Erakundeen zuhaitzari jarraitzen dio, ez lurraldeari.",
    "actions": [
      "Aldia aldatu",
      "Eskualdeak, erakundeak edo udalerriak aurreko aldiarekin konparatu"
    ],
    "audience": "Administrazioko rol guztiak."
  } } }
}
```

`messages/ca.json`
```json
{
  "metrics": { "export": {
    "scopeLabel": "Àmbit de l'informe",
    "scopeEntidad": "Entitat",
    "scopeRedFinanciada": "Xarxa finançada",
    "scopePlataforma": "Plataforma",
    "scopeTerritorio": "Territori"
  } },
  "paraguas": {
    "inicio": {
      "territoryHeading": "El teu territori",
      "territoryLink": "Veure el territori",
      "networkHeading": "Xarxa finançada",
      "networkLink": "Veure la xarxa finançada",
      "fundedEntities": "Entitats finançades"
    },
    "redFinanciada": {
      "heading": "Xarxa finançada",
      "noAccessDescription": "El teu rol no té accés a la Xarxa finançada."
    }
  },
  "pages": { "paraguas": { "redFinanciada": { "title": "Xarxa finançada" } } },
  "help": { "paraguas": { "redFinanciada": {
    "title": "Xarxa finançada",
    "summary": "Mètriques agregades de les entitats que pengen d'aquesta administració: persones, activitats i assistència per municipi, per entitat i per mes, i la comparativa amb el període anterior. Segueix l'arbre d'entitats, no el territori.",
    "actions": [
      "Canviar el període",
      "Comparar comarques, entitats o municipis amb el període anterior"
    ],
    "audience": "Tots els rols de l'administració."
  } } }
}
```

Actualiza además el resumen de `help.paraguas.inicio` en los cuatro
idiomas para que describa el Inicio nuevo (dos bloques con enlace) en vez
de las métricas agregadas que ahora viven en «Red financiada»:

- en: `"summary": "A single glance at the administration: the state of your declared territory and of the entities you fund, each with a link to its own section."`, `"actions": ["Open the territory observatory", "Open the funded network"]`.
- es: `"summary": "Un vistazo a la administración: cómo está tu territorio declarado y cómo está la red de entidades que financias, cada bloque con enlace a su sección."`, `"actions": ["Abrir el observatorio del territorio", "Abrir la red financiada"]`.
- eu: `"summary": "Administrazioaren begiratu bat: nola dagoen adierazitako zure lurraldea eta nola dagoen finantzatzen duzun erakunde-sarea, bloke bakoitza bere atalerako estekarekin."`, `"actions": ["Lurraldearen behatokia ireki", "Finantzatutako sarea ireki"]`.
- ca: `"summary": "Una ullada a l'administració: com està el teu territori declarat i com està la xarxa d'entitats que finances, cada bloc amb enllaç a la seva secció."`, `"actions": ["Obrir l'observatori del territori", "Obrir la xarxa finançada"]`.

- [ ] **Step 10: Registrar «Red financiada» en la ayuda**

En `lib/help/pageHelp.ts`:

```ts
  { route: "/paraguas/[slug]/red-financiada", key: "paraguas.redFinanciada" },
```

- [ ] **Step 11: Ejecutar y comprobar que pasa**

Run: `npx vitest run "app/paraguas/[slug]" components/metrics lib/help/pageHelp.test.ts`
Expected: PASS.

- [ ] **Step 12: Suite completa y commit**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: PASS.

```bash
git add -A
git commit -m "feat(territorio): Inicio, Red financiada e Informes del área de administración"
```

---

## Task 7: Plataforma (sede, nivel y territorio) y sede editable por el titular

Lo que la spec §4.3 y §4.4 piden fuera del área de administración: dar de
alta y editar la sede de cualquier organización, declarar nivel y
territorio de una administración (solo `superadmin`), avisar de las
entidades sin sede, y dejar que el `titular` edite su propia sede.

**Files:**
- Create: `components/plataforma/SedeSelector.tsx`
- Create: `components/plataforma/TerritorioForm.tsx`
- Create: `hooks/useSetOrganizationTerritory.ts`, `hooks/useSetOrganizationTerritory.test.tsx`
- Modify: `hooks/useUpdateOrganization.ts`, `hooks/useUpdateOrganization.test.tsx`
- Modify: `hooks/useOrganizations.ts` (tipo de entrada de alta)
- Modify: `components/plataforma/EntidadDetail.tsx`
- Modify: `components/plataforma/EntidadesTable.tsx`
- Modify: `components/plataforma/NuevaEntidadDialog.tsx`
- Modify: `components/entidad/ConfiguracionPanel.tsx`
- Modify: `app/plataforma/entidades/page.test.tsx`, `app/entidad/[slug]/configuracion/page.test.tsx`
- Modify: `messages/{en,es,eu,ca}.json`

**Interfaces:**
- Consumes: `useSearchPlaces` y `usePlacesCount` (Tarea 3),
  `useDebouncedValue` (ya existía), `Organization` con `place`/
  `admin_level`/`territory_kind`/`territory_code`/`territory_places_count`,
  `AdminLevel`, `TerritoryKind`, `OrganizationCreateInput` (Tarea 2).
- Produces:
  - `components/plataforma/SedeSelector.tsx`:
    `<SedeSelector id={string} value={string | null} onChange={(ineCode: string | null) => void} />`.
  - `components/plataforma/TerritorioForm.tsx`:
    `<TerritorioForm organization={Organization} />`.
  - `hooks/useSetOrganizationTerritory.ts`:
    `useSetOrganizationTerritory(orgId): UseMutationResult<Organization,
    OrganizationsError, { admin_level: AdminLevel; territory_kind:
    TerritoryKind; territory_code: string }>`.
  - `hooks/useUpdateOrganization.ts`: `UpdateOrganizationInput` gana
    `place?: string | null`.

- [ ] **Step 1: Escribir el test que falla del `SedeSelector`**

Crea `components/plataforma/SedeSelector.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { buildPlaceRow } from "@/test-utils/fixtures/places";

const useSearchPlacesMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/usePlaces", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePlaces")>("@/hooks/usePlaces");
  return { ...actual, useSearchPlaces: useSearchPlacesMock };
});

import { SedeSelector } from "./SedeSelector";

// Los campos con retardo se prueban con `fireEvent.change` +
// `vi.advanceTimersByTime`, nunca con `userEvent` y temporizadores
// falsos: `userEvent` se cuelga en esta suite (ver CLAUDE.md,
// «Buscadores con retardo»).
afterEach(() => {
  vi.useRealTimers();
  useSearchPlacesMock.mockReset();
});

describe("SedeSelector", () => {
  it("busca municipios con retardo y ofrece los resultados", () => {
    vi.useFakeTimers();
    useSearchPlacesMock.mockReturnValue({ data: [buildPlaceRow()], isError: false, error: null });

    render(<SedeSelector id="sede" value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Municipio de la sede"), { target: { value: "irun" } });
    act(() => vi.advanceTimersByTime(300));

    expect(useSearchPlacesMock).toHaveBeenLastCalledWith("irun");
    expect(screen.getByRole("option", { name: "Irun (Gipuzkoa) · 20069" })).toBeInTheDocument();
  });

  it("elegir un municipio devuelve su código INE", async () => {
    const onChange = vi.fn();
    useSearchPlacesMock.mockReturnValue({ data: [buildPlaceRow()], isError: false, error: null });

    render(<SedeSelector id="sede" value={null} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Municipio de la sede"), "20069");

    expect(onChange).toHaveBeenCalledWith("20069");
  });

  it("si la búsqueda falla lo dice, en vez de dejar el selector vacío en silencio", () => {
    useSearchPlacesMock.mockReturnValue({ data: undefined, isError: true, error: { kind: "desconocido" } });

    render(<SedeSelector id="sede" value={null} onChange={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo buscar el municipio.");
  });
});
```

- [ ] **Step 2: Implementar `components/plataforma/SedeSelector.tsx`**

```tsx
"use client";

/**
 * Buscador de municipio para la sede de una organización (spec de
 * diseño `2026-09-19-territorio-administraciones-design.md` §4.3: «sede
 * (`place`, buscador de municipio por nombre sobre 3.3)»). Lo usan los
 * tres formularios que tocan la sede — alta de entidad, ficha de
 * plataforma y Configuración de la entidad — para no tener tres
 * versiones del mismo control.
 *
 * Escribir dispara `useSearchPlaces` con retardo (`useDebouncedValue`,
 * 300 ms, mismo patrón que `EntidadesTable`/`RolesPanel`): sin él,
 * teclear «irun» serían cuatro peticiones. Un fallo de la búsqueda
 * **se dice** (`role="alert"`), no se deja como un selector vacío, que
 * es indistinguible de «no hay ningún municipio con ese nombre»
 * (hallazgo B15 de la auditoría).
 */
import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSearchPlaces } from "@/hooks/usePlaces";

export interface SedeSelectorProps {
  id: string;
  /** Código INE ya guardado, o `null`. */
  value: string | null;
  onChange: (ineCode: string | null) => void;
}

export function SedeSelector({ id, value, onChange }: SedeSelectorProps) {
  const t = useTranslations("plataforma.sede");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const places = useSearchPlaces(debouncedSearch);
  const errorId = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-text-form">
        {t("label")}
      </label>
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label={t("searchLabel")}
        className="mb-2 w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
      />
      <select
        id={id}
        value={value ?? ""}
        aria-describedby={places.isError ? errorId : undefined}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
      >
        <option value="">{t("none")}</option>
        {/* El valor ya guardado sigue seleccionable aunque la búsqueda
            actual no lo devuelva: si no, abrir el formulario y no buscar
            nada borraría la sede al guardar. */}
        {value && !(places.data ?? []).some((place) => place.ine_code === value) ? (
          <option value={value}>{t("current", { ineCode: value })}</option>
        ) : null}
        {(places.data ?? []).map((place) => (
          <option key={place.ine_code} value={place.ine_code}>
            {t("option", { name: place.name, province: place.prov_name, ineCode: place.ine_code })}
          </option>
        ))}
      </select>
      {places.isError ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-error">
          {t("searchError")}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Ejecutar y comprobar que pasa**

Run: `npx vitest run components/plataforma/SedeSelector.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 4: Escribir el test que falla de `useSetOrganizationTerritory`**

Crea `hooks/useSetOrganizationTerritory.test.tsx` con el mismo andamiaje
de los tests de hooks (mock de `@/lib/api/client`, `wrapper` local):

```tsx
  it("manda solo los tres campos de territorio, nunca junto a otros", async () => {
    apiFetchMock.mockResolvedValue(buildOrganization());

    const { result } = renderHook(() => useSetOrganizationTerritory(3), { wrapper });
    result.current.mutate({
      admin_level: "diputacion",
      territory_kind: "provincia",
      territory_code: "20",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/3/", {
      method: "PATCH",
      body: { admin_level: "diputacion", territory_kind: "provincia", territory_code: "20" },
    });
  });

  it("un 400 conserva el mensaje literal del backend", async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError(400, { territory_code: ["Ese código no tiene municipios activos."] }),
    );

    const { result } = renderHook(() => useSetOrganizationTerritory(3), { wrapper });
    result.current.mutate({ admin_level: "", territory_kind: "provincia", territory_code: "99" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("invalido");
    expect(result.current.error?.detail).toBe("Ese código no tiene municipios activos.");
  });

  it("un 403 es kind 'sin_permiso'", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, {}));

    const { result } = renderHook(() => useSetOrganizationTerritory(3), { wrapper });
    result.current.mutate({ admin_level: "", territory_kind: "", territory_code: "" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("sin_permiso");
  });
```

- [ ] **Step 5: Implementar `hooks/useSetOrganizationTerritory.ts`**

```ts
"use client";

/**
 * `PATCH /api/organizations/{id}/ {admin_level, territory_kind,
 * territory_code}` (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §2.3: solo
 * `superadmin`, desde la ficha de entidad, «como hoy cambia `parent`»).
 *
 * Manda **solo** esos tres campos, igual que `useSetOrganizationParent`
 * manda solo `parent`: el backend distingue quién puede tocar qué
 * mirando qué campos trae el cuerpo, así que mezclarlos con la lista
 * blanca del titular provocaría un 403 en una petición que por separado
 * sí pasa.
 *
 * `territory_kind: ""` con `territory_code: ""` limpia el territorio
 * (§2.2, `set_territory(org, '', '')`).
 */
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import type { AdminLevel, Organization, TerritoryKind } from "@/lib/api/types";

import { OrganizationsError } from "./useOrganizations";

export interface SetOrganizationTerritoryInput {
  admin_level: AdminLevel;
  territory_kind: TerritoryKind;
  territory_code: string;
}

export function useSetOrganizationTerritory(
  orgId: number | string,
): UseMutationResult<Organization, OrganizationsError, SetOrganizationTerritoryInput> {
  const queryClient = useQueryClient();

  return useMutation<Organization, OrganizationsError, SetOrganizationTerritoryInput>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<Organization>(ORGANIZATIONS.DETAIL(orgId), {
          method: "PATCH",
          body: input,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          const detail = detailOf(error);
          throw new OrganizationsError(
            detail ?? "Revisa el territorio: alguno de los datos no es válido.",
            "invalido",
            detail,
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          throw new OrganizationsError("Solo superadmin declara el territorio.", "sin_permiso");
        }
        throw new OrganizationsError("No se pudo guardar el territorio.", "desconocido");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel-organizations"] });
      queryClient.invalidateQueries({ queryKey: ["panel-organization", orgId] });
    },
  });
}
```

Run: `npx vitest run hooks/useSetOrganizationTerritory.test.tsx`
Expected: PASS.

- [ ] **Step 6: Añadir `place` a `useUpdateOrganization`**

En `UpdateOrganizationInput`, un campo más:

```ts
  /**
   * Código INE de la sede. El `titular` sí la edita desde Configuración
   * (spec §2.3: «`place` sí lo puede editar el titular de la entidad en
   * su configuración, porque es un dato propio»), a diferencia de
   * `admin_level`/`territory_*`, que son solo de plataforma y van por
   * `hooks/useSetOrganizationTerritory.ts`.
   */
  place?: string | null;
```

y en `hooks/useUpdateOrganization.test.tsx`:

```ts
  it("manda la sede junto al resto de la lista blanca del titular", async () => {
    apiFetchMock.mockResolvedValue(buildOrganization());

    const { result } = renderHook(() => useUpdateOrganization(7), { wrapper });
    result.current.mutate({ description: "Hola", place: "20069" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/", {
      method: "PATCH",
      body: { description: "Hola", place: "20069" },
    });
  });
```

- [ ] **Step 7: Implementar `components/plataforma/TerritorioForm.tsx`**

```tsx
"use client";

/**
 * Nivel administrativo y territorio declarado de una administración
 * (spec de diseño `2026-09-19-territorio-administraciones-design.md`
 * §2.1 y §4.3). Solo lo monta `EntidadDetail` cuando el rol de
 * plataforma es `superadmin` **y** la organización es una
 * administración: §2.3 dice que una administración no se autoasigna
 * territorio, y §2.1 que `admin_level` va en blanco en todo lo demás.
 *
 * **Vista previa «N municipios»** (§4.3): con `municipios` se cuentan
 * los códigos escritos, que es exacto y no toca la red; con uno de los
 * tres atajos se pide el total al backend
 * (`hooks/usePlaces.ts::usePlacesCount`, que filtra `GET /api/places/`
 * por `ccaa_code`/`prov_code`/`comarca_code` y se queda con el `count`
 * de la respuesta paginada), **con retardo** — el código se teclea
 * carácter a carácter y sin `useDebouncedValue` cada tecla sería una
 * petición, igual que en `EntidadesTable`/`SedeSelector`. Mientras no
 * haya código escrito, o justo después de guardar, se muestra el
 * `territory_places_count` **guardado**, que el backend recalcula al
 * expandir el `OrgScope` (§2.2).
 */
import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { OrganizationsErrorKind } from "@/hooks/useOrganizations";
import { usePlacesCount } from "@/hooks/usePlaces";
import {
  useSetOrganizationTerritory,
  type SetOrganizationTerritoryInput,
} from "@/hooks/useSetOrganizationTerritory";
import type { AdminLevel, Organization, TerritoryKind } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

const ADMIN_LEVEL_LABEL_KEYS: Record<AdminLevel, string> = {
  "": "plataforma.territorio.adminLevelNone",
  ayuntamiento: "plataforma.territorio.adminLevelAyuntamiento",
  mancomunidad: "plataforma.territorio.adminLevelMancomunidad",
  diputacion: "plataforma.territorio.adminLevelDiputacion",
  gobierno: "plataforma.territorio.adminLevelGobierno",
};

const TERRITORY_KIND_LABEL_KEYS: Record<TerritoryKind, string> = {
  "": "plataforma.territorio.kindNone",
  ccaa: "plataforma.territorio.kindCcaa",
  provincia: "plataforma.territorio.kindProvincia",
  comarca: "plataforma.territorio.kindComarca",
  municipios: "plataforma.territorio.kindMunicipios",
};

const TERRITORY_ERROR_KEYS: Record<OrganizationsErrorKind, string> = {
  invalido: "errors.setOrganizationTerritory.invalido",
  sin_permiso: "errors.setOrganizationTerritory.sinPermiso",
  desconocido: "errors.setOrganizationTerritory.desconocido",
};

export interface TerritorioFormProps {
  organization: Organization;
}

/** Códigos INE no vacíos de una lista separada por comas. */
export function countMunicipios(code: string): number {
  return code
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

export function TerritorioForm({ organization }: TerritorioFormProps) {
  const t = useTranslations();
  const save = useSetOrganizationTerritory(organization.id);
  const levelId = useId();
  const kindId = useId();
  const codeId = useId();

  const [form, setForm] = useState<SetOrganizationTerritoryInput>({
    admin_level: organization.admin_level ?? "",
    territory_kind: organization.territory_kind ?? "",
    territory_code: organization.territory_code ?? "",
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate(form);
  }

  // El código se teclea, así que la cuenta va con retardo; `usePlacesCount`
  // además se deshabilita sola con «municipios», sin atajo o sin código.
  const debouncedCode = useDebouncedValue(form.territory_code);
  const placesCount = usePlacesCount(form.territory_kind, debouncedCode);

  const preview = previewText();

  function previewText(): string {
    if (form.territory_kind === "municipios") {
      return t("plataforma.territorio.previewTyped", {
        count: countMunicipios(form.territory_code),
      });
    }
    if (form.territory_kind === "" || debouncedCode.trim().length === 0) {
      return t("plataforma.territorio.previewSaved", {
        count: organization.territory_places_count ?? 0,
      });
    }
    if (placesCount.isError) return t("plataforma.territorio.previewError");
    if (placesCount.data === undefined) return t("plataforma.territorio.previewLoading");
    return t("plataforma.territorio.previewFilter", { count: placesCount.data });
  }

  return (
    <Card title={t("plataforma.territorio.cardTitle")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor={levelId} className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.territorio.adminLevelLabel")}
          </label>
          <select
            id={levelId}
            value={form.admin_level}
            onChange={(event) =>
              setForm({ ...form, admin_level: event.target.value as AdminLevel })
            }
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            {(Object.keys(ADMIN_LEVEL_LABEL_KEYS) as AdminLevel[]).map((level) => (
              <option key={level} value={level}>
                {t(ADMIN_LEVEL_LABEL_KEYS[level])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={kindId} className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.territorio.kindLabel")}
          </label>
          <select
            id={kindId}
            value={form.territory_kind}
            onChange={(event) =>
              setForm({ ...form, territory_kind: event.target.value as TerritoryKind })
            }
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            {(Object.keys(TERRITORY_KIND_LABEL_KEYS) as TerritoryKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {t(TERRITORY_KIND_LABEL_KEYS[kind])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={codeId} className="mb-1 block text-sm font-medium text-text-form">
            {form.territory_kind === "municipios"
              ? t("plataforma.territorio.codeLabelMunicipios")
              : t("plataforma.territorio.codeLabelShortcut")}
          </label>
          <input
            id={codeId}
            type="text"
            value={form.territory_code}
            onChange={(event) => setForm({ ...form, territory_code: event.target.value })}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <p className="text-sm text-text-secondary">{preview}</p>
        <div>
          <Button type="submit" disabled={save.isPending}>
            {t("common.save")}
          </Button>
        </div>
        {save.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(save.error, TERRITORY_ERROR_KEYS, t, "errors.setOrganizationTerritory.desconocido")}
          </p>
        ) : null}
        {save.isSuccess ? (
          <p className="text-sm text-success">{t("plataforma.entidadFicha.saved")}</p>
        ) : null}
      </form>
    </Card>
  );
}
```

Crea `components/plataforma/TerritorioForm.test.tsx`. Mockea
`usePlacesCount` (la vista previa de los atajos es lo único que toca la
red en este formulario) y recuerda la convención de los campos con
retardo: `fireEvent.change` + `act(() => vi.advanceTimersByTime(300))`,
nunca `userEvent` con temporizadores falsos, y `vi.useRealTimers()` al
principio del `afterEach`.

```tsx
const usePlacesCountMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/usePlaces", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/usePlaces")>("@/hooks/usePlaces");
  return { ...actual, usePlacesCount: usePlacesCountMock };
});

afterEach(() => {
  vi.useRealTimers();
  usePlacesCountMock.mockReset();
});

describe("TerritorioForm", () => {
  it("la vista previa cuenta los códigos escritos con «municipios», sin pedir nada", async () => {
    usePlacesCountMock.mockReturnValue({ data: undefined, isError: false, error: null });

    render(<TerritorioForm organization={buildOrganization({ territory_kind: "municipios" })} />);
    await userEvent.type(screen.getByLabelText("Códigos INE separados por comas"), "20069, 20045");

    expect(screen.getByText("2 municipios en la lista escrita")).toBeInTheDocument();
  });

  it("con un atajo y un código escrito enseña el total que devuelve el backend", () => {
    vi.useFakeTimers();
    usePlacesCountMock.mockReturnValue({ data: 88, isError: false, error: null });

    render(
      <TerritorioForm
        organization={buildOrganization({ territory_kind: "provincia", territory_places_count: 0 })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Código del territorio"), { target: { value: "20" } });
    act(() => vi.advanceTimersByTime(300));

    expect(usePlacesCountMock).toHaveBeenLastCalledWith("provincia", "20");
    expect(screen.getByText("88 municipios en el código escrito")).toBeInTheDocument();
  });

  it("sin código escrito todavía, enseña el recuento ya guardado", () => {
    usePlacesCountMock.mockReturnValue({ data: undefined, isError: false, error: null });

    render(
      <TerritorioForm
        organization={buildOrganization({
          territory_kind: "provincia",
          territory_code: "",
          territory_places_count: 88,
        })}
      />,
    );

    expect(screen.getByText("88 municipios en el territorio guardado")).toBeInTheDocument();
  });

  it("si la cuenta falla lo dice, en vez de enseñar un cero que se leería como «ese código no tiene municipios»", () => {
    vi.useFakeTimers();
    usePlacesCountMock.mockReturnValue({ data: undefined, isError: true, error: { kind: "desconocido" } });

    render(<TerritorioForm organization={buildOrganization({ territory_kind: "provincia" })} />);
    fireEvent.change(screen.getByLabelText("Código del territorio"), { target: { value: "20" } });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText("No se pudo contar los municipios de ese código.")).toBeInTheDocument();
  });
});
```

y un test unitario de `countMunicipios` (cadena vacía → 0, comas de más
→ no cuentan, espacios alrededor → sí cuentan).

- [ ] **Step 8: Escribir el test que falla de la pestaña «Datos» de `EntidadDetail`**

En `components/plataforma/EntidadDetail.test.tsx` (o en
`app/plataforma/entidades/[id]/page.test.tsx`, donde ya haya cobertura de
la ficha):

```tsx
  it("superadmin ve y edita sede, nivel y territorio de una administración", async () => {
    useOrganizationMock.mockReturnValue({
      data: buildOrganization({ org_type: "administracion", place: "20069", admin_level: "diputacion" }),
      isError: false,
    });

    render(<EntidadDetail orgId={3} role="superadmin" />);

    expect(screen.getByLabelText("Municipio de la sede")).toBeInTheDocument();
    expect(screen.getByLabelText("Nivel administrativo")).toHaveValue("diputacion");
    expect(screen.getByLabelText("Tipo de territorio")).toBeInTheDocument();
  });

  it("verifier ve la sede en solo lectura y ningún control de territorio", () => {
    useOrganizationMock.mockReturnValue({
      data: buildOrganization({ org_type: "administracion", place: "20069" }),
      isError: false,
    });

    render(<EntidadDetail orgId={3} role="verifier" />);

    expect(screen.queryByLabelText("Municipio de la sede")).not.toBeInTheDocument();
    expect(screen.getByText("20069")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tipo de territorio")).not.toBeInTheDocument();
  });

  it("una asociación no tiene nivel ni territorio, ni siquiera para superadmin", () => {
    useOrganizationMock.mockReturnValue({
      data: buildOrganization({ org_type: "asociacion", place: "20069" }),
      isError: false,
    });

    render(<EntidadDetail orgId={7} role="superadmin" />);

    expect(screen.getByLabelText("Municipio de la sede")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tipo de territorio")).not.toBeInTheDocument();
  });
```

- [ ] **Step 9: Implementar los cambios de `EntidadDetail.tsx`**

En `DatosTab`, tras la `<dl>` que ya existe:

```tsx
  const canManageTerritory = role === "superadmin";
  const isAdministration = org.org_type === "administracion";
```

- Una fila más en la `<dl>` con la sede en lectura:
  `<dt>{t("plataforma.sede.label")}</dt><dd>{org.place || t("plataforma.sede.missing")}</dd>`
  — así `verifier`/`moderator`/`support` la ven aunque no la editen.
- Con `canManageTerritory`, debajo de la tarjeta de datos, un formulario
  propio con `<SedeSelector id="entidad-sede" value={org.place ?? null}
  onChange={setSede} />` y un botón «Guardar» que llama a
  `useUpdateOrganization(orgId).mutate({ place: sede })` — el mismo hook
  que usa el titular, porque el campo es el mismo y no va mezclado con
  `parent`/`territory_*`.
- Con `canManageTerritory && isAdministration`, `<TerritorioForm organization={org} />`.

Documenta arriba del componente, en su docstring, la decisión 4 del plan:
desde plataforma, sede/nivel/territorio son **solo `superadmin`** (spec
§2.3, «Solo la plataforma (`superadmin`), desde la ficha de entidad, como
hoy cambia `parent`»); el `titular` edita su propia sede desde
Configuración de la entidad.

- [ ] **Step 10: Aviso «Sede sin municipio» en el listado**

En `components/plataforma/EntidadesTable.tsx`, una columna más tras
«Tipo»:

```tsx
              {
                key: "place",
                header: t("plataforma.sede.header"),
                render: (org) =>
                  org.place ? (
                    org.place
                  ) : (
                    <Badge tone="neutral">{t("plataforma.sede.missing")}</Badge>
                  ),
              },
```

y en `app/plataforma/entidades/page.test.tsx`:

```tsx
  it("avisa de las entidades sin sede", async () => {
    useOrganizationsMock.mockReturnValue({
      data: { count: 1, next: null, previous: null, results: [buildOrganization({ place: null })] },
      isError: false,
    });

    await renderPage();

    expect(screen.getByText("Sede sin municipio")).toBeInTheDocument();
  });
```

- [ ] **Step 11: Sede obligatoria en el alta de entidad**

En `components/plataforma/NuevaEntidadDialog.tsx`:

- Estado nuevo `const [place, setPlace] = useState<string | null>(null);`
- `<SedeSelector id="nueva-entidad-sede" value={place} onChange={setPlace} />`
  entre «Tipo» y «CIF».
- `canSubmit` pasa a
  `name.trim().length > 0 && slug.trim().length > 0 && cif.trim().length > 0 && place !== null`.
- El cuerpo del `create.mutate` incluye `place` y el hook cambia de
  `OrganizationCreateRequest` a `OrganizationCreateInput`
  (`hooks/useOrganizations.ts::useCreateOrganization`).
- `onSuccess` limpia también `setPlace(null)`.
- Bajo el selector, una pista permanente:
  `<p className="text-xs text-text-secondary">{t("plataforma.sede.requiredHint")}</p>`.

Test en `app/plataforma/entidades/page.test.tsx` (el diálogo ya se abre
ahí para el test de `axe`):

```tsx
  it("no deja crear una entidad sin sede", async () => {
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Nueva entidad" }));

    await userEvent.type(screen.getByLabelText("Nombre"), "Ayuntamiento de Irun");
    await userEvent.type(screen.getByLabelText("Slug"), "ayto-irun");
    await userEvent.type(screen.getByLabelText("CIF"), "P2000000A");

    expect(screen.getByRole("button", { name: "Crear entidad" })).toBeDisabled();
    expect(screen.getByText("La sede es obligatoria para dar de alta una entidad.")).toBeInTheDocument();
  });
```

- [ ] **Step 12: Sede editable por el titular en Configuración**

En `components/entidad/ConfiguracionPanel.tsx::DatosEntidad`, el estado
del formulario gana `place: string | null` (inicializado con
`organization.data.place ?? null`), un `<SedeSelector id="config-sede"
value={data.place} onChange={(place) => setForm({ ...data, place })} />`
tras el campo «Web», y `handleSubmit` manda el objeto completo tal cual
(ya lo hace: `updateOrganization.mutate(data)`).

Test en `app/entidad/[slug]/configuracion/page.test.tsx`:

```tsx
  it("el titular puede cambiar la sede de su entidad", async () => {
    await renderPage("titular");

    expect(screen.getByLabelText("Municipio de la sede")).toBeInTheDocument();
  });
```

- [ ] **Step 13: Añadir las claves nuevas a los cuatro catálogos**

`messages/en.json`
```json
{
  "plataforma": {
    "sede": {
      "label": "Registered municipality",
      "searchLabel": "Search for a municipality",
      "header": "Registered seat",
      "none": "No municipality",
      "missing": "No registered municipality",
      "current": "Current municipality (INE {ineCode})",
      "option": "{name} ({province}) · {ineCode}",
      "searchError": "The municipality search failed.",
      "requiredHint": "A registered seat is required to create an entity."
    },
    "territorio": {
      "cardTitle": "Declared territory",
      "adminLevelLabel": "Administration level",
      "adminLevelNone": "Not an administration",
      "adminLevelAyuntamiento": "Town council",
      "adminLevelMancomunidad": "Joint authority",
      "adminLevelDiputacion": "Provincial council",
      "adminLevelGobierno": "Regional government",
      "kindLabel": "Territory type",
      "kindNone": "No territory",
      "kindCcaa": "Autonomous community",
      "kindProvincia": "Province",
      "kindComarca": "District",
      "kindMunicipios": "List of municipalities",
      "codeLabelShortcut": "Territory code",
      "codeLabelMunicipios": "INE codes separated by commas",
      "previewTyped": "{count, plural, one {# municipality in the typed list} other {# municipalities in the typed list}}",
      "previewFilter": "{count, plural, one {# municipality for the typed code} other {# municipalities for the typed code}}",
      "previewSaved": "{count, plural, one {# municipality in the saved territory} other {# municipalities in the saved territory}}",
      "previewLoading": "Counting municipalities…",
      "previewError": "The municipalities for that code could not be counted."
    }
  },
  "errors": { "setOrganizationTerritory": {
    "invalido": "Check the territory: one of the values isn't valid.",
    "sinPermiso": "Only a superadmin can declare the territory.",
    "desconocido": "The territory could not be saved."
  } }
}
```

`messages/es.json`
```json
{
  "plataforma": {
    "sede": {
      "label": "Municipio de la sede",
      "searchLabel": "Buscar un municipio",
      "header": "Sede",
      "none": "Sin municipio",
      "missing": "Sede sin municipio",
      "current": "Municipio actual (INE {ineCode})",
      "option": "{name} ({province}) · {ineCode}",
      "searchError": "No se pudo buscar el municipio.",
      "requiredHint": "La sede es obligatoria para dar de alta una entidad."
    },
    "territorio": {
      "cardTitle": "Territorio declarado",
      "adminLevelLabel": "Nivel administrativo",
      "adminLevelNone": "No es una administración",
      "adminLevelAyuntamiento": "Ayuntamiento",
      "adminLevelMancomunidad": "Mancomunidad",
      "adminLevelDiputacion": "Diputación",
      "adminLevelGobierno": "Gobierno",
      "kindLabel": "Tipo de territorio",
      "kindNone": "Sin territorio",
      "kindCcaa": "Comunidad autónoma",
      "kindProvincia": "Provincia",
      "kindComarca": "Comarca",
      "kindMunicipios": "Lista de municipios",
      "codeLabelShortcut": "Código del territorio",
      "codeLabelMunicipios": "Códigos INE separados por comas",
      "previewTyped": "{count, plural, one {# municipio en la lista escrita} other {# municipios en la lista escrita}}",
      "previewFilter": "{count, plural, one {# municipio en el código escrito} other {# municipios en el código escrito}}",
      "previewSaved": "{count, plural, one {# municipio en el territorio guardado} other {# municipios en el territorio guardado}}",
      "previewLoading": "Contando municipios…",
      "previewError": "No se pudo contar los municipios de ese código."
    }
  },
  "errors": { "setOrganizationTerritory": {
    "invalido": "Revisa el territorio: alguno de los datos no es válido.",
    "sinPermiso": "Solo superadmin declara el territorio.",
    "desconocido": "No se pudo guardar el territorio."
  } }
}
```

`messages/eu.json`
```json
{
  "plataforma": {
    "sede": {
      "label": "Egoitzaren udalerria",
      "searchLabel": "Udalerri bat bilatu",
      "header": "Egoitza",
      "none": "Udalerririk gabe",
      "missing": "Egoitza udalerririk gabe",
      "current": "Egungo udalerria (INE {ineCode})",
      "option": "{name} ({province}) · {ineCode}",
      "searchError": "Ezin izan da udalerria bilatu.",
      "requiredHint": "Egoitza derrigorrezkoa da erakunde bat alta emateko."
    },
    "territorio": {
      "cardTitle": "Adierazitako lurraldea",
      "adminLevelLabel": "Administrazio-maila",
      "adminLevelNone": "Ez da administrazio bat",
      "adminLevelAyuntamiento": "Udala",
      "adminLevelMancomunidad": "Mankomunitatea",
      "adminLevelDiputacion": "Foru aldundia",
      "adminLevelGobierno": "Gobernua",
      "kindLabel": "Lurralde mota",
      "kindNone": "Lurralderik gabe",
      "kindCcaa": "Autonomia erkidegoa",
      "kindProvincia": "Probintzia",
      "kindComarca": "Eskualdea",
      "kindMunicipios": "Udalerrien zerrenda",
      "codeLabelShortcut": "Lurraldearen kodea",
      "codeLabelMunicipios": "INE kodeak komaz bereizita",
      "previewTyped": "{count, plural, one {udalerri # idatzitako zerrendan} other {# udalerri idatzitako zerrendan}}",
      "previewFilter": "{count, plural, one {udalerri # idatzitako kodean} other {# udalerri idatzitako kodean}}",
      "previewSaved": "{count, plural, one {udalerri # gordetako lurraldean} other {# udalerri gordetako lurraldean}}",
      "previewLoading": "Udalerriak zenbatzen…",
      "previewError": "Ezin izan dira kode horretako udalerriak zenbatu."
    }
  },
  "errors": { "setOrganizationTerritory": {
    "invalido": "Berrikusi lurraldea: datuetakoren bat ez da baliozkoa.",
    "sinPermiso": "Superadminak baino ezin du lurraldea adierazi.",
    "desconocido": "Ezin izan da lurraldea gorde."
  } }
}
```

`messages/ca.json`
```json
{
  "plataforma": {
    "sede": {
      "label": "Municipi de la seu",
      "searchLabel": "Cercar un municipi",
      "header": "Seu",
      "none": "Sense municipi",
      "missing": "Seu sense municipi",
      "current": "Municipi actual (INE {ineCode})",
      "option": "{name} ({province}) · {ineCode}",
      "searchError": "No s'ha pogut cercar el municipi.",
      "requiredHint": "La seu és obligatòria per donar d'alta una entitat."
    },
    "territorio": {
      "cardTitle": "Territori declarat",
      "adminLevelLabel": "Nivell d'administració",
      "adminLevelNone": "No és una administració",
      "adminLevelAyuntamiento": "Ajuntament",
      "adminLevelMancomunidad": "Mancomunitat",
      "adminLevelDiputacion": "Diputació",
      "adminLevelGobierno": "Govern",
      "kindLabel": "Tipus de territori",
      "kindNone": "Sense territori",
      "kindCcaa": "Comunitat autònoma",
      "kindProvincia": "Província",
      "kindComarca": "Comarca",
      "kindMunicipios": "Llista de municipis",
      "codeLabelShortcut": "Codi del territori",
      "codeLabelMunicipios": "Codis INE separats per comes",
      "previewTyped": "{count, plural, one {# municipi a la llista escrita} other {# municipis a la llista escrita}}",
      "previewFilter": "{count, plural, one {# municipi per al codi escrit} other {# municipis per al codi escrit}}",
      "previewSaved": "{count, plural, one {# municipi al territori desat} other {# municipis al territori desat}}",
      "previewLoading": "Comptant municipis…",
      "previewError": "No s'han pogut comptar els municipis d'aquest codi."
    }
  },
  "errors": { "setOrganizationTerritory": {
    "invalido": "Revisa el territori: alguna de les dades no és vàlida.",
    "sinPermiso": "Només un superadmin declara el territori.",
    "desconocido": "No s'ha pogut desar el territori."
  } }
}
```

> **Ojo con el plural en euskera** (`previewTyped`/`previewFilter`/
> `previewSaved`): igual
> que el resto de plurales de este catálogo, la rama `one` antepone el
> numeral (`udalerri #`), coherente con la corrección documentada en
> `docs/i18n/ESTADO.md`; no lo reescribas como `# udalerri` sin revisar
> esa nota.

- [ ] **Step 14: Ejecutar y comprobar que pasa**

Run: `npx vitest run components/plataforma app/plataforma "app/entidad/[slug]/configuracion" hooks/useSetOrganizationTerritory.test.tsx hooks/useUpdateOrganization.test.tsx`
Expected: PASS.

- [ ] **Step 15: Suite completa y commit**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: PASS.

```bash
git add -A
git commit -m "feat(territorio): sede, nivel y territorio desde plataforma, y sede editable por el titular"
```

---

## Task 8: E2E contra el backend real, regeneración de tipos y documentación

Última tarea. **Depende del backend**: la rama de territorio del repo
backend tiene que estar fusionada, migrada y con la demo sembrada (spec
§6) antes del Step 3; los pasos de documentación (1, 6 y 7) se pueden
hacer antes.

**Files:**
- Create: `e2e/territorio.spec.ts`
- Modify: `e2e/helpers.ts`
- Modify: `lib/api/types.generated.ts` (regenerado), `lib/api/types.ts`
- Modify: `CLAUDE.md`, `AGENTS.md`, `docs/i18n/ESTADO.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `e2e/helpers.ts` gana
  `GFA_SLUG = "gipuzkoako-foru-aldundia"` (hoy el slug está escrito a
  mano en `analista.spec.ts` y `comparativa.spec.ts`).

- [ ] **Step 1: Escribir `e2e/territorio.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

import { ANALISTA_GFA_EMAIL, DEMO_PASSWORD, GFA_SLUG } from "./helpers";

/**
 * Analista de la diputación (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §5, «E2E»): abre
 * Territorio, ve la tabla por municipio con alguna celda suprimida y
 * abre la ficha de un municipio.
 *
 * Igual que `analista.spec.ts` y `comparativa.spec.ts`, se navega a la
 * vista de administración a propósito en vez de depender de la
 * resolución de área del login: el gate de la página solo mira membresía
 * y rol, así que el flujo bajo prueba queda fijado sin depender de que
 * el backend desplegado ya sirva `is_administration`.
 *
 * **Un solo login de UI**, sin ninguna llamada de API: el límite del
 * backend es de 5 intentos por 60 s y por IP
 * (`users/rate_limiting.py`), compartido con el resto de la suite.
 *
 * El preset por defecto («Este mes») no tiene volumen suficiente en la
 * demo sembrada para que la comparativa devuelva filas (mismo motivo
 * documentado en `comparativa.spec.ts`), así que el spec cambia a «Año»
 * antes de comprobar la tabla.
 */
test("analista de la diputación ve el territorio y la ficha de un municipio", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Usuario o email").fill(ANALISTA_GFA_EMAIL);
  await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`/(entidad|paraguas)/${GFA_SLUG}`));

  await page.goto(`/paraguas/${GFA_SLUG}`);
  await page.getByRole("link", { name: "Territorio" }).click();
  await expect(page.getByRole("heading", { name: "Territorio", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Año", exact: true }).click();

  // El mapa es `role="img"`: su contenido no es la alternativa accesible,
  // la tabla sí — se comprueban los dos.
  await expect(page.getByRole("img", { name: /^Mapa del territorio:/ })).toBeVisible();

  const tabla = page.locator('section[aria-labelledby="territorio-tabla-heading"]');
  await expect(tabla.locator("table")).toBeVisible();
  await expect(tabla.getByText(/^(<5|—)$/).first()).toBeVisible();

  await tabla.getByRole("button", { name: "Ver ficha" }).first().click();

  const ficha = page.getByRole("dialog");
  await expect(ficha.getByText("Actividades celebradas")).toBeVisible();
  await expect(ficha.getByText("Entidades con sede aquí")).toBeVisible();
  // Invariante 1: la ficha nunca nombra entidades ni personas.
  await expect(
    ficha.getByText("Esta ficha solo muestra agregados: nunca nombres de personas ni de las entidades con sede aquí."),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
```

- [ ] **Step 2: Añadir `GFA_SLUG` a `e2e/helpers.ts`**

```ts
/** Diputación Foral de Gipuzkoa de la demo (`docs/PANEL.md` §14.6): la
 *  administración con territorio declarado (provincia 20) de la spec §6. */
export const GFA_SLUG = "gipuzkoako-foru-aldundia";
```

y sustituye el literal en `e2e/analista.spec.ts` y `e2e/comparativa.spec.ts`.

- [ ] **Step 3: Levantar el backend sembrado y ejecutar el e2e**

```bash
# En el worktree del backend, con su entorno ya preparado:
cd /Users/mikelerrasti/Code/popyplan/.worktrees/territorio
DJANGO_SETTINGS_MODULE=pop.settings_e2e python manage.py migrate
DJANGO_SETTINGS_MODULE=pop.settings_e2e python manage.py load_places
DJANGO_SETTINGS_MODULE=pop.settings_e2e python manage.py seed_catalogs
DJANGO_SETTINGS_MODULE=pop.settings_e2e python manage.py seed_panel_demo
DJANGO_SETTINGS_MODULE=pop.settings_e2e python manage.py runserver 0.0.0.0:8001
```

y, en otra terminal:

```bash
cd /Users/mikelerrasti/Code/popyplan-panel/.worktrees/territorio
npx playwright test e2e/territorio.spec.ts
```

Expected: PASS. Si el backend local **no** usa `pop.settings_e2e`, el
límite de login (5/60 s/IP) está activo: deja pasar un minuto entre
ejecuciones o la suite responde 429.

- [ ] **Step 4: Regenerar los tipos desde el esquema del backend**

Solo cuando la rama de backend esté fusionada y `docs/schema.yaml`
regenerado (spec §7: «después el panel (regenerar tipos desde
`docs/schema.yaml`)»):

```bash
cd /Users/mikelerrasti/Code/popyplan-panel/.worktrees/territorio
npm run gen:types
```

Después, en `lib/api/types.ts`, **retira uno a uno** los tipos manuales
que el esquema ya cubra, comprobando la forma generada antes de borrar:

- `Organization`: si `components["schemas"]["Organization"]` ya trae
  `place`/`admin_level`/`territory_kind`/`territory_code`/
  `territory_places_count`, vuelve a ser un alias directo.
- `OrgMembershipForArea`: si `OrgMembershipRef` ya trae
  `is_administration`/`admin_level`, deja solo el `org_type?` heredado.
- `AdminLevel`/`TerritoryKind`: si el esquema genera sus enums, pásalos a
  alias (`components["schemas"]["AdminLevelEnum"]`, etc.).
- `PlaceRow`/`PaginatedPlaceList`/`PlaceSheet`: ídem.
- `OrganizationCreateInput`: solo si `OrganizationCreateRequest` ya marca
  `place` como obligatorio.

Si alguno **no** coincide (drf-spectacular tiene quirks conocidos en este
repo: un campo con `default` sale como obligatorio en el `Patched*`),
**no lo fuerces**: deja el tipo manual y actualiza su docstring diciendo
el motivo real, igual que hacen hoy `ProgramWriteFields` y
`PricingTierUpdateRequest`.

Run: `npm run typecheck && npm run test:coverage`
Expected: PASS.

- [ ] **Step 5: Ejecutar la suite e2e completa una vez**

Run: `npm run e2e`
Expected: PASS. Ojo al límite de login si el backend local no usa
`pop.settings_e2e`.

- [ ] **Step 6: Documentar el bloque en `CLAUDE.md` y `AGENTS.md`**

Añade una sección nueva, **«Territorio y administraciones multinivel
(bloque 1)»**, tras «Contratos y facturación de plataforma (tarea W4,
Fase 6)», con estos puntos (los dos ficheros tienen que quedar
**idénticos salvo las dos primeras líneas de cabecera**):

- Spec y rutas del backend que consume el panel (las cinco de «Global
  Constraints» de este plan).
- Los dos renombres y sus redirecciones permanentes
  (`lib/config/redirects.ts`), con la decisión 2 de este plan: la API,
  los ficheros de componente y los namespaces internos de catálogo no
  cambian.
- El área de administración: `/paraguas/[slug]` con cuatro secciones,
  `paraguasMenuFor`, y que Informes sigue acotada a `exportar_informes`.
- `isParaguas` leyendo `is_administration` **con precedencia sobre**
  `organization_type` (incluido el `false` explícito), y el respaldo
  mientras el backend desplegado no traiga el campo.
- El mapa: `react-leaflet` + `next/dynamic({ssr:false})`, el mock de
  `react-leaflet` en `vitest.setup.ts`, `role="img"` + `zoomControl:
  false` + `keyboard: false`, y la tabla como alternativa completa con
  «Ver ficha» por fila.
- `lib/metrics/mapScale.ts` y la **desviación documentada** del color
  (decisión 1 de este plan: `ByPlaceRow` no lleva tasa de asistencia).
- El 409 `sin_territorio` en `useMetrics`/`useCompare`/`useExport` y su
  tratamiento como `EmptyState`, no como error.
- Plataforma: sede/nivel/territorio solo `superadmin` (decisión 4), la
  vista previa «N municipios» (`usePlacesCount` sobre los filtros
  `ccaa_code`/`prov_code`/`comarca_code` de `GET /api/places/`, con
  retardo; `municipios` se cuenta en el cliente y
  `territory_places_count` es el valor ya guardado — decisión 3), el
  aviso «Sede sin municipio» y la sede obligatoria en el alta;
  Configuración de entidad edita la sede del titular.
- Los **dos pendientes de backend** que abre este bloque, en la lista
  «Pendientes conocidos»: agregado de «organizaciones con sede en el
  territorio» (decisión 5) y tasa de asistencia por fila en `by_place`
  (decisión 1). La vista previa de municipios **no** es uno de ellos: el
  backend de este mismo bloque expone los tres filtros de código.
- Actualiza los recuentos que el fichero mantiene: el menú de entidad
  sigue en 14 secciones (Recursos pasa a llamarse Biblioteca), el de
  plataforma en 9 (Contratos pasa a Suscripciones), el de paraguas pasa
  de 2 a **4**; la lista de páginas con test de `axe` gana
  `paraguas/[slug]/territorio` y `paraguas/[slug]/red-financiada` y, a
  nivel de componente, `components/metrics/TerritoryMap`; y el número de
  pantallas del registro de ayuda pasa de 32 a **34**.
- Apunta la cobertura y el número de tests reales al cerrar la rama
  (sale de `npm run test:coverage`), como hacen las entradas anteriores
  de la sección «Cobertura».

- [ ] **Step 7: Anotar el estado de las traducciones**

En `docs/i18n/ESTADO.md`, una entrada nueva para este bloque: las claves
añadidas (`metrics.map.*`, `metrics.placeSheet.*`, `metrics.export.scope*`,
`metrics.table.actionsHeader`, `paraguas.territorio.*`,
`paraguas.redFinanciada.*`, `paraguas.inicio.*`, `plataforma.sede.*`,
`plataforma.territorio.*`, `errors.{metrics,compare,export}.sinTerritorio`,
`errors.placeSheet.*`, `errors.places.*`,
`errors.setOrganizationTerritory.*`, más los renombres de
`menu`/`pages`/`help`), con `eu`/`ca` marcados como **borrador pendiente
de revisión del propietario** (misma convención que las tareas de i18n).

- [ ] **Step 8: Verificación final y commit**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build && npm run e2e`
Expected: PASS.

```bash
cd /Users/mikelerrasti/Code/popyplan-panel/.worktrees/territorio
git add -A
git commit -m "test(territorio): e2e del observatorio, tipos regenerados y documentación del bloque"
```
