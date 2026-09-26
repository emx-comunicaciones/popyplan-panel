# Historial — Cierre del panel: accesibilidad, e2e y CI (W6)

> Texto trasladado tal cual desde el `CLAUDE.md` raíz (2026-09-26) para no cargarlo en cada sesión. Las referencias a «más arriba/abajo» apuntan al `CLAUDE.md` original; busca la sección en `docs/historial/`.

## Cierre del panel: accesibilidad, e2e contra el backend real y CI (tarea W6)

### Carry-overs cerrados

- **Informes de entidad** (`app/entidad/[slug]/informes/page.tsx`,
  pregunta 18 de `docs/preguntas-diseno.md`): reutiliza
  `components/metrics/ExportPanel.tsx` con `scope="entidad"` (mismo
  componente que `paraguas/[slug]/informes`). Visible en el menú solo
  para `titular`/`moderador`/`analista` (`docs/PANEL.md` §2.1,
  `exportar_informes`); se encontró de paso que `dinamizador` la veía
  sin poder exportar — añadido a `DINAMIZADOR_HIDDEN`.
- **Columna «Entidad» de la cola de reportes con nombre**:
  `ReporteDetail.tsx`/`ReportesQueuePlataforma.tsx` pintan ahora
  `organization_display.name` (P7 lo añadió a `Report`/`ReportDetail`,
  `docs/PANEL.md` §10.3) en vez de «Entidad #`<id>`».
- **Ayuda de plataforma agregada de verdad**
  (`hooks/usePlatformPendingHelpRequests.ts`): una sola llamada a
  `GET /api/safety/help-requests/pending/` sin `organization` (P7,
  `docs/PANEL.md` §10.1) en vez de recorrer todas las entidades
  (N+1 peticiones, huella de la pregunta 26).
- **Ficha, pertenencia y referente en los avisos de ayuda** (fix
  posterior a W6): `HelpRequest.user_display` gana `is_member` y
  `referent: {id, public_name} | null` (`lib/api/types.ts
  ::HelpRequestUserDisplay`, tipo manual mientras el backend no lo trae
  en `types.generated.ts`). `GuardiaPanel.tsx` enlaza el nombre a
  `/entidad/{slug}/personas/{userId}` solo si `is_member`; si no, badge
  «No pertenece a la entidad» y el texto «Se apuntó a la actividad sin
  ser miembro.» — sin enlace, para no aterrizar en una ficha 404/«Sin
  acceso» de alguien sin membresía. `AyudaPendienteList.tsx` pinta el
  mismo badge (sin enlace: no conoce el slug de cada fila) y, en ambos,
  «Referente: `<public_name>`» cuando lo hay. Los dos listan además una
  línea fija bajo los avisos: «Popyplan no guarda teléfonos: contacta con
  la persona por el chat de la app o a través de su referente.»
  (invariante 9, sin contacto directo en el panel).
- **Selects de referente con nombre**
  (`components/people/AddPersonDialog.tsx`,
  `components/entidad/PersonSheet.tsx::AssignReferentForm`): pintan
  `public_name` de `useOrgMembers` (P7 lo añadió a `OrgMembership`,
  `docs/PANEL.md` §10.3) en vez de «Persona n.º `<user_id>`» o un id a
  mano — cierra las preguntas 13 y 22. Lo mismo en las tablas de Equipo
  (`ConfiguracionPanel.tsx`/`EntidadDetail.tsx`), que sí reciben
  `OrgMembership.public_name`. **La tabla de Referencias no**: `Reference`
  trae el `public_name` de la persona referenciada, pero del referente
  solo `referent: number`, así que `ConfiguracionPanel::ReferentName`
  resuelve el nombre contra `useOrgMembers` (por el id de **membresía**,
  ver A-I4 en «Auditoría de integración» abajo) y distingue tres estados
  («Referente…» mientras carga, «Referente no disponible» con la consulta
  en error, «Referente sin nombre» si el equipo está cargado y esa cuenta
  no está). Y solo lo intenta con rol `titular`: el `GET` de equipo es
  solo-titular (`entities/permissions.py`, `'equipo': {'titular'}`), así
  que con `moderador` se pinta «sin nombre» sin pedir nada.
- **Atajo de plataforma en Equipo/Métricas**
  (`components/plataforma/EntidadDetail.tsx`): el aviso de «esto
  normalmente da sin acceso» de W5 se corrigió — desde P7,
  `superadmin`/`moderator` pasan de verdad (`docs/PANEL.md` §10.2,
  cierra la pregunta 27).
- **Supresión por celda, no por sección** (`lib/metrics/format.ts`,
  pregunta 11): `formatCount`/`formatPct` miran primero si `value` es
  `null`; con un valor real lo pintan aunque la sección venga marcada
  `suppressed`. Ningún sitio de llamada cambió.

### Bugs reales encontrados por el e2e contra el backend (no por unit tests)

Ninguno se veía en Vitest porque los tests mockeaban la forma de la
respuesta, nunca la pedían de verdad:

1. **`GET /api/safety/reports/queue/` no pagina, nunca lo hizo**
   (`docs/SEGURIDAD_Y_MODERACION.md` §4: «200 lista»,
   `safety/viewsets.py::ReportViewSet.queue`, un array plano). El panel
   llevaba desde W4a/W5 tratándola como `{count, next, previous,
   results}` — `ReportesQueue.tsx`/`ReportesQueuePlataforma.tsx`
   pintaban botones «Anterior»/«Siguiente» que nunca podían funcionar
   (el `?page=` no hacía nada) y `useEntityHome.ts::fetchOptionalCount`
   leía `.count` de un array (`undefined`, sin lanzar excepción: las dos
   tarjetas de guardia del Inicio de entidad nunca mostraron un
   recuento real). `e2e/plataforma.spec.ts` lo hizo saltar de verdad
   (`TypeError: Cannot read properties of undefined (reading
   'length')` al leer `.results` de un array). Arreglado en
   `hooks/useReportsQueue.ts` (tipo `ReportRow[]`, sin `page`),
   `fetchOptionalCount` (cuenta `.length`) y los dos componentes (sin
   paginación, con el recuento real).
2. **`<dl>` anidado en `EntityHomeDashboard.tsx`/`{Paraguas,Plataforma}
   MetricsDashboard.tsx`**: agrupaban varias `StatCard` (cada una ya su
   propio `<dl>`) dentro de otro `<dl>` — regla `definition-list` de
   `axe-core`, hallada por el primer `expect(await axe(container))
   .toHaveNoViolations()` que se escribió. El contenedor pasa a
   `<div>`; cada `StatCard` sigue siendo su propia lista de definición.
3. **`Card.tsx` pintaba su título en `<h3>`**: con un `Card` colgando
   directo de un `<h1>` de página (el caso más común), saltaba de nivel
   1 a 3 sin pasar por 2 (`heading-order` de `axe-core`). Pasa a
   `<h2>`, que nunca salta nivel venga de donde venga.
4. **La descarga de informes no llevaba el nombre de fichero real**
   (`e2e/titular.spec.ts`, flujo de Informes) — **resuelto, en el repo
   backend**. `pop/settings.py` no declaraba `CORS_EXPOSE_HEADERS`, así
   que `Content-Disposition` — donde viaja
   `popyplan-<slug>-<since>-<until>.csv` (`docs/PANEL.md` §2.2) — no es
   una cabecera "segura" por defecto y el navegador se la ocultaba a
   `fetch()` en una petición cross-origin (el panel en `:3000`/`:3100`
   contra el backend en `:8001`): `useExport.ts::filenameFrom` caía
   siempre al nombre por defecto (`informe.csv`), en el panel real
   igual que en el test. Desde entonces el backend declara
   `CORS_EXPOSE_HEADERS = ['Content-Disposition']` (y `pop.settings_e2e`
   lo hereda con su `from .settings import *`, así que el job `e2e` de
   CI también lo tiene). `e2e/titular.spec.ts` y `e2e/programas.spec.ts`
   comprueban ya el nombre completo con
   `e2e/helpers.ts::expectExportFilename`, que solo acepta el nombre de
   respaldo si la respuesta no trae `Access-Control-Expose-Headers` con
   esa cabecera — así un backend anterior al cambio no deja el test
   verde por casualidad.

## Accesibilidad

- `eslint-plugin-jsx-a11y` en `strict` desde W1 (`eslint.config.mjs`);
  0 avisos al cerrar la fase.
- `lang="es"` en `app/layout.tsx`; `<title>` único por página vía
  `export const metadata` de Next (plantilla `"%s · Popyplan"` en el
  layout raíz + un título propio por `page.tsx`, sacado de su `<h1>`
  cuando no colisiona con otra área — p. ej. «Inicio de la entidad» vs.
  «Inicio del paraguas» vs. «Inicio de plataforma»). El login
  (`app/(auth)/login/page.tsx`) se partió en un Server Component (el
  `<title>`) y `LoginForm.tsx` (cliente, `useState`/`useRouter`) porque
  un Client Component no puede exportar `metadata`.
- Enlace «Saltar al contenido» (`components/ui/SkipLink.tsx`,
  invisible hasta que recibe el foco) en los tres layouts de área,
  apuntando a `<main id="main-content" tabIndex={-1}>`.
- Diálogos (`components/ui/{Dialog,ConfirmDialog}.tsx`) atrapan el foco
  de verdad (`lib/a11y/useFocusTrap.ts`): foco inicial dentro del
  diálogo, `Tab`/`Shift+Tab` sin escapar, `Escape` cierra/cancela, el
  foco vuelve a donde estaba al cerrarse. Los dos ya llevaban
  `aria-modal="true"` desde que se escribieron.
- Tablas: todas con `<caption>` (casi siempre `sr-only`) o, la
  compartida `components/ui/Table.tsx`, con `caption` como prop
  obligatoria — no hay manera de añadir una tabla nueva sin una.
- Foco visible global: `:focus-visible { outline: 3px solid
  var(--color-primary-700); }` en `app/globals.css`, desde W1 (también
  cada `focus-visible:outline-*` puntual de un control, ver más abajo).
- **Marca legible (`primary-700`, tarea W1, Fase 6, decisión D1):**
  `--color-primary` (`#1fb3ae`, la marca de Popyplan, misma paleta que
  `popyplan-mobile/app/_theme/colors.ts`) queda **solo para superficies
  decorativas sin texto** (fondos de tarjeta, iconos grandes, `fill`/
  `stroke` de `recharts` en `SeriesChart.tsx`/`SurveyResultsView.tsx`).
  Todo texto, enlace, botón, borde de control con texto o foco visible
  usa `--color-primary-700` (`#0e7c78`, 5,0:1 sobre blanco) —
  sustitución completa de `text-primary`/`bg-primary`/`border-primary`/
  `outline-primary` por su variante `-700` en todo `app/` y
  `components/` (`grep -rn "text-primary\b\|bg-primary\b" app
  components` no debe encontrar nada). La cabecera de `/entidad/[slug]`
  y `/paraguas/[slug]` calcula el texto legible sobre el color de marca
  de la propia entidad con `lib/a11y/contrast.ts::readableOn` (blanco o
  `--color-secondary-900`, el que dé más ratio) y, si aun así el par no
  llegara a 3:1 (defensivo — no ocurre con esas dos opciones, ver el
  docstring de `readableOn`), cae al tinte `--color-primary-100` con
  texto `--color-text-base` y una franja de 6px del color de la entidad
  de borde inferior.
- **Contraste de los tokens de color** (`app/globals.css`), comprobado
  con un test automático (`lib/a11y/tokens.test.ts`, sobre
  `lib/a11y/contrast.ts::contrastRatio`) que lee el fichero real y falla
  si algún par baja de su umbral — ya no es una comprobación a mano:

  | Par | Ratio | AA texto normal (4.5:1) | AA texto grande/UI (3:1) |
  |---|---|---|---|
  | `text-base` / `background` | 19,8:1 | ✅ | ✅ |
  | `text-secondary` / `background` | 20,3:1 | ✅ | ✅ |
  | `text-form` / `background` (etiquetas) | 4,85:1 | ✅ | ✅ |
  | `error` / `background` (texto de error) | 5,46:1 | ✅ | ✅ |
  | `success` / `background` (texto de éxito) | 5,11:1 | ✅ | ✅ |
  | `text-inverse` / `secondary-900` (cabecera de plataforma) | 14,46:1 | ✅ | ✅ |
  | `text-base` / `border-light` (fondo de página) | 17,9:1 | ✅ | ✅ |
  | `text-inverse` / `primary-700` (botón primario, cabecera de entidad con color de marca) | 5,03:1 | ✅ | ✅ |
  | `primary-700` / `background` (enlaces, texto en `text-primary-700`) | 5,03:1 | ✅ | ✅ |
  | `text-base` / `primary-100` (tinte claro de cabecera, caso defensivo) | 16,93:1 | ✅ | ✅ |

  Los dos pares que fallaban AA antes de esta tarea (`text-inverse`/
  `primary` y `primary`/`background`, 2,59:1 cada uno) se resolvieron
  introduciendo `--color-primary-700` en vez de tocar `--color-primary`
  (D1: no diverge de la marca, solo aclara qué tono usar para texto). El
  token `--color-text-form-secondary` (1,86:1, sin uso real como texto)
  se eliminó de `app/globals.css` al no tener ningún consumidor.
- `axe-core` vía `vitest-axe` (`vitest.setup.ts` registra
  `toHaveNoViolations`; `test-utils/axe.ts` desactiva `region` —los
  tests de página renderizan solo el `page.tsx`, sin el `<nav>`/`<main>`
  del `layout.tsx`— y `color-contrast` —jsdom no calcula estilos
  computados reales; el contraste real se audita con el test automático
  de arriba, `lib/a11y/tokens.test.ts`, no con axe). Cada
  `page.test.tsx` cubierto tiene un test «no tiene violaciones de
  accesibilidad (axe)» como primer test del `describe`, con `render()`
  del propio `@/test-utils/render` para tener `container`. La lista
  exacta y siempre comprobable es
  `grep -rln "toHaveNoViolations" app components`; tras el bloque 1 de
  «Administraciones multinivel y territorio» (que además cierra dos
  excepciones que arrastraba esta lista, `paraguas/[slug]/informes` y
  `plataforma/entidades/[id]`) y del bloque 1 del admin de plataforma
  (tres páginas más), del bloque 3 (ocho páginas más) y del bloque 2
  (dos páginas más) son **41 páginas y 10 componentes**:
  `app/page` (la raíz: la web pública sin sesión y la pantalla «Tu cuenta
  es de la app» con sesión sin rol), `app/(auth)/login`,
  `app/accesibilidad` (declaración pública, tarea
  W1), `entidad/[slug]` (Inicio), `entidad/[slug]/personas`
  (tabla + diálogo «Añadir persona» abierto, valida el foco atrapado),
  `entidad/[slug]/personas/[userId]` (ficha, con la sección «Red de
  apoyo» del referente y datos), `entidad/[slug]/informes`,
  `entidad/[slug]/asistencia/[eventId]`
  (caja de check-in), `entidad/[slug]/encuestas/[surveyId]` (gráfico
  `recharts`), `entidad/[slug]/familias` (resumen + lista de comunidades,
  ronda final de Fase 5), `entidad/[slug]/comunidades`,
  `entidad/[slug]/configuracion`, `entidad/[slug]/reportes` (cola),
  `entidad/[slug]/programas` y `entidad/[slug]/programas/[programId]`,
  `paraguas/[slug]` (Inicio), `paraguas/[slug]/territorio` (mapa +
  tabla), `paraguas/[slug]/red-financiada` y `paraguas/[slug]/informes`
  (las tres del bloque 1), `plataforma` (Inicio),
  `plataforma/entidades` (tabla + diálogo «Nueva entidad» abierto),
  `plataforma/entidades/[id]` (ficha, con `SedeSelector`/`TerritorioForm`
  del bloque 1 en la pestaña Datos), `plataforma/reportes` (cola) y
  `plataforma/reportes/[reportId]`, `plataforma/metricas`,
  `plataforma/suscripciones`, `plataforma/usuarios` (con «Nueva cuenta»
  abierto), `plataforma/usuarios/[id]` (con «Borrar cuenta» abierto) y
  `plataforma/bloqueos` (con «Revocar» abierto), las ocho del bloque 3
  (`plataforma/comunidades` y `comunidades/[id]`,
  `plataforma/actividades`, `plataforma/resenas`, `plataforma/chats` y
  `chats/[id]`, `plataforma/notificaciones`, `plataforma/nomencladores`,
  cada una con un diálogo abierto), las dos del bloque 2
  (`plataforma/busca-del-tesoro` con «Nuevo juego» abierto y
  `busca-del-tesoro/[id]` con una confirmación y un diálogo de prueba
  abiertos), más las dos rutas de error (`app/error`,
  `app/not-found`); y, a nivel de componente,
  `components/entidad/GuardiaPanel`, `components/help/PageHelp`,
  `components/landing/ModeToggle` (el conmutador de la web pública, el
  único componente con estado de esa página),
  `components/layout/LanguageSwitcher`, `components/layout/SideNav`,
  `components/layout/UserMenu`,
  `components/metrics/ComparativaTable`, `components/metrics/ExportPanel`,
  `components/metrics/TerritoryMap` (el mapa del bloque 1, `role="img"`)
  y `components/plataforma/AyudaPendienteList` — estos diez cubren por
  dentro lo que sus páginas (`guardia`, la ayuda de pantalla, el menú de
  cuenta y el selector de idioma de las tres cabeceras de área, el menú
  lateral, la comparativa de los dos dashboards, los dos `informes`, el
  propio mapa de Territorio y el conmutador de la landing) no comprueban
  siempre por fuera.
  **Excepción documentada**: siguen sin test propio de `axe`
  `elegir-entidad`, `entidad/[slug]/{actividades,asistencia,
  comunicaciones,encuestas,biblioteca,guardia}`,
  `entidad/[slug]/reportes/[reportId]` y
  `plataforma/{auditoria,ayuda,verificaciones,roles}` — la cobertura es
  representativa de las tres áreas y de todos los patrones compartidos
  (tablas, diálogos con foco atrapado, gráficos, formularios, pestañas,
  mapas), pero no exhaustiva; ampliarla es trabajo mecánico para quien
  retome accesibilidad.
- **Declaración de accesibilidad** (tarea W1, Fase 6): página pública
  `/accesibilidad` (`app/accesibilidad/page.tsx`, Server Component, sin
  sesión), conforme al RD 1112/2018 — alcance, situación de
  cumplimiento («parcialmente conforme» hasta cerrar la auditoría de
  esta fase), contenido no accesible (la misma excepción documentada
  arriba), preparación, contacto (`NEXT_PUBLIC_A11Y_CONTACT`, con
  fallback `accesibilidad@popyplan.com`) y procedimiento de aplicación.
  Enlazada desde `components/layout/Footer.tsx`, presente en el pie de
  los tres layouts de área y del login.

### E2E contra el backend real (`e2e/`)

`e2e/helpers.ts` centraliza login por API (`apiLogin`), resolución de
id de entidad por slug (`resolveOrgId`) y dos fixtures que la demo
sembrada no puede dar por sí sola porque sus fechas son relativas al
momento en que se sembró, no al momento en que corren los tests:

- `createCheckinFixture`: crea una actividad que empieza en 10 segundos
  (válida para `EventCreateSerializer.validate_starts_at`, que exige
  futuro) — su ventana de check-in (`starts_at - 2h`) ya está abierta
  al crearla — e inscribe a dos personas de calle de la demo
  (`panel-demo-asociacion-bidasoa-p01`/`p02@test.com`): una para el
  check-in por QR (con su token real de `my-checkin`), otra para
  «Marcar asistió» a mano.
- `escalateFirstPendingReport`: escala por API el primer reporte
  `pending` de una entidad — los reportes de la demo (Asociación
  Bidasoa) nunca aparecen en la cola *global* de plataforma mientras no
  estén escalados (`docs/SEGURIDAD_Y_MODERACION.md` §4), así que sin
  esto `e2e/plataforma.spec.ts` no tendría nada que abrir.

Specs: `login.spec.ts` (titular Bidasoa, y contraseña incorrecta →
mensaje del contrato), `titular.spec.ts` (Inicio → Personas → ficha →
Asistencia —marcar asistió + check-in por QR— → Informes, con
comprobación del nombre de fichero `popyplan-<slug>-<since>-<until>.csv`),
`analista.spec.ts` (métricas del paraguas + exportar PDF, con 503
tratado como salto documentado si WeasyPrint no está disponible),
`plataforma.spec.ts` (crear y verificar una entidad + abrir un reporte
escalado de la cola). Tarea W5 (Fase 6) añade cuatro specs más:
`accesibilidad.spec.ts` (`/accesibilidad` sin sesión; en `/login`, `Tab`
recorre email → contraseña → botón, con el foco siempre visible —
`getComputedStyle(document.activeElement).outlineStyle`), `programas.spec.ts`
(titular Bidasoa crea, activa y cierra un programa, y descarga su
informe CSV), `comparativa.spec.ts` (analista GFA ve la comparativa por
comarca del paraguas con alguna celda `<5`/`—` — el preset por defecto
«Este mes» no tiene actividad suficiente para que `compare_for` devuelva
ninguna fila en la demo sembrada, así que el spec cambia a «Año» antes
de comprobarlo) y `contratos.spec.ts` (superadmin crea un tramo de
precio y un contrato nuevo con él, para Asociación Bidasoa). Ninguno de
los cuatro necesita las fixtures de `helpers.ts` de arriba (fechas
fijas, sin ventana horaria que provocar).

**Hueco de contrato de W5, ya cerrado** (pregunta 3 de
`docs/preguntas-diseno.md`): el login de la analista de la diputación
(`panel-analista-gfa@test.com`) aterrizaba en
`/entidad/gipuzkoako-foru-aldundia` porque `isParaguas` miraba un campo
(`org_type`) que el backend nunca ha servido; con `organization_type`
(ver «Regla de paraguas» al principio de este fichero) resuelve ya a
`/paraguas/...`. `e2e/analista.spec.ts` y `e2e/comparativa.spec.ts`
siguen navegando a la vista de paraguas a propósito
(`page.goto('/paraguas/gipuzkoako-foru-aldundia')`): el gate de la página
solo mira membresía + rol, así que el flujo bajo prueba queda fijado sin
depender de la resolución de área.

**Límite de peticiones del login, imprescindible saberlo**: `POST
/api/auth/login/` está limitado a **5 intentos por 60 segundos por
IP** (`users/rate_limiting.py::RATE_LIMIT_CONFIGS`, clave
`ip:<ip>:auth`, compartida entre todas las cuentas que inicien sesión
desde la misma IP — no es por cuenta). La suite completa de `e2e/`
hace más de 5 logins seguidos (fixtures por API + login de UI en cada
spec), así que en local hay que darle margen entre specs o el backend
responde 429. La escapatoria real: `pop.settings_e2e`
(`RATE_LIMITING_ENABLED = False`, ya la usa
`popyplan-mobile/.github/workflows/e2e-live.yml`) — el job `e2e` de
este repo la usa siempre (ver «CI» más abajo), así que en CI nunca
salta.

**Arranque**: `playwright.config.ts` levanta `next dev --port 3100`
(nunca 3000: ese puerto es el panel de demo del propietario en
`.worktrees/demo/`, que no se toca) con
`NEXT_PUBLIC_API_URL=http://localhost:8001`; `workers: 1` (las specs
comparten el mismo backend y el mismo límite de login, en paralelo se
pisarían). `PANEL_BASE_URL` (variable de entorno) apunta el runner a un
servidor ya arrancado en vez de que Playwright levante el suyo — útil
para iterar en local sin esperar a que compile cada vez.

### CI (`.github/workflows/ci.yml`, job `e2e`)

Cross-repo checkout de `emx-comunicaciones/popyplan` (privado) `@main`
con un PAT propio, mismo patrón que
`popyplan-mobile/.github/workflows/e2e-live.yml`: requiere el secret
**`BACK_REPO_TOKEN`** (Settings → Secrets and variables → Actions de
este repo; un token de acceso personal con lectura sobre ese repo). Sin
él, un primer paso (`check_token`) deja `skip=true` y el resto de pasos
(condicionados a `if: steps.check_token.outputs.skip != 'true'`) no
corren — el job termina en verde sin haber hecho nada, con un
`::warning::` explicando qué falta. **A diferencia del patrón del
móvil, aquí no hay `continue-on-error: true` a nivel de job**: si el
secreto existe y el backend arranca, un fallo real de los tests sí
tira abajo el workflow.

Backend: instala dependencias con `uv` (`scripts/export_deps.py`,
fijadas por `poetry.lock`) + shim de PyMySQL (por si algo importa
`MySQLdb`) + librerías del sistema de WeasyPrint (`apt-get`, igual que
`popyplan/.github/workflows/ci.yml`). **Desviación deliberada del
brief de esta tarea** (que pedía un servicio de MariaDB): el job usa
`DJANGO_SETTINGS_MODULE=pop.settings_e2e` en vez de levantar
MariaDB — ese módulo (ya existe en el backend, lo usa
`popyplan-mobile`) sustituye la base de datos por SQLite efímero (sin
servicio que levantar) y **desactiva el límite de login**
(`RATE_LIMITING_ENABLED = False`), imprescindible: con el límite activo
la suite entera de `e2e/` no puede correr seguida (ver arriba). Migra,
siembra (`load_places`, `seed_catalogs`, `seed_panel_demo`) y arranca
`runserver 0.0.0.0:8001` en segundo plano con una espera activa
(`GET /api/health/` hasta 200/401). Luego `npx playwright install
--with-deps chromium` y `npm run e2e` (`NEXT_PUBLIC_API_URL=http://
localhost:8001`); si falla, sube el log del backend y el reporte de
Playwright como artefactos.
