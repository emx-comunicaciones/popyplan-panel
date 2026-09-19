# Ayuda por pantalla — plan de implementación (panel)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** En cada pantalla de las tres áreas del panel (entidad, paraguas, plataforma) hay un botón con un signo de interrogación en la cabecera; al pulsarlo se abre un diálogo con un resumen de para qué sirve esa pantalla, qué se puede hacer en ella y quién la ve.

**Architecture:** Un único componente cliente `components/help/PageHelp.tsx` montado en la cabecera de los tres layouts de área (no se toca ninguna `page.tsx`). Resuelve la pantalla actual con `usePathname()` contra un registro `lib/help/pageHelp.ts` indexado por plantilla de ruta (`/entidad/[slug]/personas/[userId]`), convierte cada plantilla en una expresión regular y pinta el texto en el `Dialog` existente (`components/ui/Dialog.tsx`, con foco atrapado). Un test recorre `app/{entidad,paraguas,plataforma}/**/page.tsx` y falla si a alguna pantalla le falta texto o si el registro tiene una entrada huérfana — así ninguna pantalla nueva se queda sin ayuda sin que nadie lo decida.

**Tech Stack:** Next.js 15 App Router, TypeScript estricto, Tailwind 4, Vitest + Testing Library + vitest-axe.

**Petición del usuario (2026-09-19):** «quiero que hagas una sección de ayuda de cada pantalla del panel donde se vea un signo de interrogación y un resumen de para qué es esa pantalla».

## Global Constraints

- Textos de UI en español (la internacionalización es un proyecto aparte que extraerá también estos textos; escribirlos como literales en `lib/help/pageHelp.ts`, **nunca** construidos por concatenación con variables). Identificadores en inglés. `CLAUDE.md` = `AGENTS.md` (actualizar los dos).
- Accesibilidad: el botón es un `<button type="button">` con `aria-label="Ayuda: <título de la pantalla>"`, `aria-haspopup="dialog"`, `aria-expanded`; el signo «?» va `aria-hidden`. Foco visible con el `outline` global. El diálogo reutiliza `Dialog` (foco atrapado, `Escape`, retorno del foco al botón). Colores: texto e icono en `text-primary-700`/`border-primary-700`, nunca `text-primary` a secas (regla de contraste de `CLAUDE.md`).
- Cobertura Vitest ≥ umbral (99.7 líneas sobre `lib/**`, `hooks/**`): `lib/help/pageHelp.ts` con todas sus ramas testeadas. Los tres `layout.test.tsx` ganan una aserción del botón; `components/help/PageHelp.test.tsx` con test de `axe` (botón y diálogo abierto).
- Nada de datos: la ayuda es texto estático, no hace peticiones ni depende del rol (menciona los roles en el propio texto cuando importa).
- Verificación: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. Commits en español, `feat(help):`/`docs:`, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Rama `feature/ayuda-por-pantalla` desde `develop` (9bfa285).

### Decisiones (ya tomadas)

1. **Botón en la cabecera de área**, junto a «Cerrar sesión», no dentro de cada página: una sola inserción por layout, misma posición siempre.
2. **Registro por plantilla de ruta**, no por `<h1>`: las páginas son Server Components y el botón vive en el layout; `usePathname()` es la única fuente fiable de «qué pantalla es».
3. **Pantallas fuera de las tres áreas** (`/login`, `/accesibilidad`, `/elegir-entidad`, `/`) **no** llevan ayuda: no tienen cabecera de área y su función es evidente. Anotado en el docstring del registro.
4. **Sin persistencia ni «no volver a mostrar»**: es ayuda bajo demanda, no un tour.
5. **Un texto por pantalla, no por rol**: cuando una acción es solo de titular/moderador, el propio texto lo dice («Solo titular y moderador pueden…»).

---

### Task 1: Registro de textos y resolución de ruta (`lib/help/pageHelp.ts`)

**Files:**
- Create: `lib/help/pageHelp.ts`, `lib/help/pageHelp.test.ts`

**Interfaces (Produces):**
```ts
export interface PageHelpEntry {
  /** Plantilla de ruta tal y como está en `app/` (con `[slug]`, `[userId]`…). */
  route: string;
  /** Nombre de la pantalla, tal y como aparece en el menú o en su <h1>. */
  title: string;
  /** Una o dos frases: para qué sirve. */
  summary: string;
  /** Qué se puede hacer aquí (2-4 puntos). */
  actions: readonly string[];
  /** Quién la ve (roles), una frase. */
  audience: string;
}
export const PAGE_HELP: readonly PageHelpEntry[];
/** Convierte `/entidad/[slug]/personas/[userId]` en /^\/entidad\/[^/]+\/personas\/[^/]+\/?$/ */
export function routeToRegExp(route: string): RegExp;
/** Devuelve la entrada cuya plantilla casa con el pathname real, o null. Las plantillas más específicas (más segmentos) ganan. */
export function matchPageHelp(pathname: string): PageHelpEntry | null;
```

**Textos (escribirlos literalmente; el implementador puede pulir la redacción sin cambiar el sentido ni añadir funciones que el panel no tenga):**

Entidad (`/entidad/[slug]/…`):
- `/entidad/[slug]` — **Inicio** — «Vista general de tu entidad para hoy: actividades del día, avisos pendientes y las métricas del mes en curso.» — acciones: «Ver las actividades de hoy y entrar en su lista de asistencia», «Ver cuántos avisos de ayuda y reportes hay pendientes (solo quien modera o está de guardia)», «Consultar personas, actividades y asistencia del mes» — audiencia: «Todos los roles de la entidad.»
- `/entidad/[slug]/personas` — **Personas** — «Las personas que participan en tu entidad, con sus comunidades, su actividad reciente y su referente. Nunca muestra datos de contacto: Popyplan trabaja con alias.» — acciones: «Buscar y filtrar por comunidad, referente o fecha de alta», «Invitar a una persona o importar un Excel/CSV (titular y moderador)», «Abrir la ficha de cada persona», «Incluir las invitaciones pendientes y reenviarlas o revocarlas» — audiencia: «Titular, moderador, dinamizador y referente.»
- `/entidad/[slug]/personas/[userId]` — **Ficha de la persona** — «Resumen de la participación de una persona en tu entidad: comunidades, actividades del periodo y próxima actividad. Sin email, teléfono ni notas: la relación es siempre a través de la app.» — acciones: «Asignar o cambiar su referente (titular y moderador)», «Ver su red de apoyo (solo su referente)», «Revisar a qué actividades se apuntó y si asistió» — audiencia: «Titular, moderador, dinamizador y el referente de esa persona.»
- `/entidad/[slug]/comunidades` — **Comunidades** — «Las comunidades de tu entidad y sus miembros: quién forma parte, quién modera y las solicitudes de entrada pendientes.» — acciones: «Crear comunidades y elegir su visibilidad», «Aceptar o rechazar solicitudes de entrada», «Nombrar moderadores o expulsar a alguien (titular y moderador)» — audiencia: «Titular, moderador y dinamizador.»
- `/entidad/[slug]/actividades` — **Actividades** — «Las actividades del periodo con sus inscritos, asistentes y responsable.» — acciones: «Filtrar por estado», «Entrar en la lista de asistencia de cada actividad», «Ver quién es responsable de cada una» — audiencia: «Titular, moderador, dinamizador y referente.»
- `/entidad/[slug]/asistencia` — **Asistencia** — «Elige una actividad para pasar lista o hacer el check-in por QR.» — acciones: «Abrir la lista nominal de una actividad», «Marcar asistencia a mano o escanear el QR de la app» — audiencia: «Titular, moderador y dinamizador.»
- `/entidad/[slug]/asistencia/[eventId]` — **Lista de asistencia** — «Quién se apuntó a esta actividad y quién ha venido. El check-in por QR solo funciona desde dos horas antes hasta doce después del inicio.» — acciones: «Marcar “asistió” o “no asistió” a cada persona», «Escanear el QR que la persona muestra en su app o pegar su código» — audiencia: «Titular, moderador y dinamizador.»
- `/entidad/[slug]/comunicaciones` — **Comunicaciones** — «Comunicaciones oficiales de la entidad a todos los miembros, a una comunidad o al espacio de familias, con su historial y el número de destinatarios.» — acciones: «Redactar y enviar una comunicación (titular y moderador)», «Usar la plantilla de bienvenida a la red de apoyo cuando exista el espacio de familias», «Consultar el historial» — audiencia: «Titular y moderador.»
- `/entidad/[slug]/encuestas` — **Encuestas** — «Encuestas anónimas y agregadas: las periódicas que creas tú y las que la app envía sola tras cada actividad.» — acciones: «Crear una encuesta periódica con sus preguntas (titular y moderador)», «Ver si está abierta o cerrada y entrar en sus resultados» — audiencia: «Titular, moderador y dinamizador.»
- `/entidad/[slug]/encuestas/[surveyId]` — **Resultados de la encuesta** — «Resultados agregados por pregunta. Con menos de cinco respuestas no se muestra el detalle, para que nadie sea identificable.» — acciones: «Ver la media y la distribución de cada pregunta», «Leer las respuestas de texto sin orden ni autor» — audiencia: «Titular, moderador y dinamizador.»
- `/entidad/[slug]/recursos` — **Recursos** — «La biblioteca de contenidos de la entidad: textos, PDF, vídeos, audios y enlaces, organizados por categoría y dirigidos a miembros, familias o a cualquiera.» — acciones: «Crear, editar o borrar recursos (titular y moderador)», «Elegir categoría y audiencia; “Cómo acompañar” es la categoría para la red de apoyo» — audiencia: «Titular, moderador y dinamizador.»
- `/entidad/[slug]/familias` — **Familias** — «El espacio de familias de la entidad, separado del de miembros: sus comunidades, próximas actividades, comunicaciones y recursos, y los contadores agregados de la red de apoyo. Nadie declara ser familiar de nadie.» — acciones: «Crear la comunidad de familias (titular y moderador)», «Activar o desactivar el cruce de espacios de cada comunidad», «Ver cuántas personas tienen red de apoyo y cuántos apoyos esperan a que exista la comunidad» — audiencia: «Titular, moderador y dinamizador.»
- `/entidad/[slug]/programas` — **Programas** — «Campañas con fechas cerradas y presupuesto declarado, con su informe final agregado. Un programa nunca lista personas.» — acciones: «Crear, activar y cerrar programas (titular y moderador)», «Descargar el informe CSV o PDF (titular, moderador y analista)» — audiencia: «Todos los roles de la entidad.»
- `/entidad/[slug]/programas/[programId]` — **Ficha del programa** — «Estado, fechas, presupuesto y métricas del programa en su periodo.» — acciones: «Editar, activar o cerrar el programa con notas de cierre (titular y moderador)», «Descargar su informe» — audiencia: «Todos los roles de la entidad; gestionar solo titular y moderador.»
- `/entidad/[slug]/reportes` — **Reportes** — «Cola de reportes de moderación de tu entidad: qué se ha reportado, por qué y en qué estado está.» — acciones: «Abrir cada reporte», «Asignarlo, resolverlo o escalarlo a la plataforma» — audiencia: «Titular y moderador.»
- `/entidad/[slug]/reportes/[reportId]` — **Detalle del reporte** — «Todo lo que hay que saber de un reporte para decidir: motivo, contenido reportado, historial y quién lo lleva.» — acciones: «Asignar a una persona del equipo», «Resolver con una decisión», «Escalar a Popyplan si excede a la entidad» — audiencia: «Titular y moderador.»
- `/entidad/[slug]/guardia` — **Guardia** — «Los avisos “hoy lo llevo mal” de las personas de tu entidad y la configuración de quién está de guardia. Popyplan no guarda teléfonos: el contacto es por el chat de la app o a través del referente.» — acciones: «Atender un aviso», «Elegir la persona de guardia y el teléfono de ayuda de la entidad», «Ver si alguien de la red de apoyo de la persona ya se ha hecho cargo» — audiencia: «Titular, moderador y la persona de guardia.»
- `/entidad/[slug]/informes` — **Informes** — «Exportación de las métricas de la entidad en CSV o PDF, por periodo y desglose, con la misma regla de agregación que el resto del panel.» — acciones: «Elegir periodo y desglose (municipio, comarca, mes o año)», «Descargar el informe» — audiencia: «Titular, moderador y analista.»
- `/entidad/[slug]/configuracion` — **Configuración** — «Datos de la entidad, equipo con sus roles y referencias entre referentes y personas.» — acciones: «Dar de alta o baja a alguien del equipo (solo titular)», «Asignar referencias», «Ajustar los datos y colores de la entidad» — audiencia: «Titular y moderador; el equipo solo lo ve el titular.»

Paraguas (`/paraguas/[slug]/…`):
- `/paraguas/[slug]` — **Inicio del paraguas** — «Métricas agregadas de todas las entidades de tu territorio: personas, actividades y asistencia por municipio, por entidad y por mes, y la comparativa con el periodo anterior. Nunca ves personas: cualquier grupo con menos de cinco se muestra como “<5”.» — acciones: «Cambiar el periodo», «Comparar comarcas, entidades o municipios con el periodo anterior» — audiencia: «Todos los roles de la entidad paraguas; las exportaciones, solo titular, moderador y analista.»
- `/paraguas/[slug]/informes` — **Informes del paraguas** — «Exportación agregada del territorio en CSV o PDF.» — acciones: «Elegir periodo y desglose», «Descargar el informe» — audiencia: «Titular, moderador y analista.»

Plataforma (`/plataforma/…`):
- `/plataforma` — **Inicio de plataforma** — «Estado general de Popyplan: entidades verificadas y pendientes, reportes escalados, avisos de ayuda sin atender, contratos y facturas.» — acciones: «Entrar en cada cola desde su tarjeta» — audiencia: «Equipo de Popyplan según su rol.»
- `/plataforma/entidades` — **Entidades** — «Todas las entidades dadas de alta, verificadas o no.» — acciones: «Buscar y filtrar por verificación», «Dar de alta una entidad nueva (verificador y superadmin)», «Abrir su ficha» — audiencia: «Superadmin y verificador.»
- `/plataforma/entidades/[id]` — **Ficha de la entidad** — «Datos, paraguas, ámbito territorial, equipo, métricas, comunidades y contrato de una entidad.» — acciones: «Verificarla», «Asignarle un paraguas o ampliar su ámbito (superadmin)», «Gestionar su equipo» — audiencia: «Superadmin y verificador; algunas pestañas solo superadmin.»
- `/plataforma/reportes` — **Reportes escalados** — «Cola global de reportes que las entidades han escalado a Popyplan.» — acciones: «Abrir cada reporte», «Asignarlo o resolverlo (moderador y superadmin); soporte solo consulta» — audiencia: «Superadmin, moderador y soporte.»
- `/plataforma/reportes/[reportId]` — **Detalle del reporte** — «Motivo, contenido, entidad de origen e historial de un reporte escalado.» — acciones: «Asignar o resolver (moderador y superadmin)» — audiencia: «Superadmin, moderador y soporte.»
- `/plataforma/ayuda` — **Avisos de ayuda** — «Avisos “hoy lo llevo mal” pendientes en toda la plataforma, para detectar entidades sin guardia que responda.» — acciones: «Ver el aviso, su entidad y su referente», «Atenderlo si procede» — audiencia: «Superadmin, moderador y soporte.»
- `/plataforma/verificaciones` — **Verificaciones** — «Revisiones de identidad pendientes: el recurso de la persona y el motivo del proveedor.» — acciones: «Aprobar o rechazar con una nota» — audiencia: «Superadmin y verificador.»
- `/plataforma/roles` — **Roles** — «Quién forma el equipo de Popyplan y con qué rol de plataforma.» — acciones: «Conceder un rol buscando la cuenta», «Revocarlo» — audiencia: «Solo superadmin.»
- `/plataforma/auditoria` — **Auditoría** — «Registro de acciones sensibles de todo el sistema, con filtros por actor, acción, objeto y fechas.» — acciones: «Filtrar y revisar el registro», «Exportar la página actual a CSV» — audiencia: «Solo superadmin.»
- `/plataforma/metricas` — **Métricas** — «Métricas agregadas de toda la plataforma, por territorio o por entidad, con comparativa entre periodos.» — acciones: «Cambiar periodo y desglose», «Exportar» — audiencia: «Superadmin, moderador y soporte.»
- `/plataforma/contratos` — **Contratos** — «Contratos de Popyplan con cada entidad, tramos de precio y facturas.» — acciones: «Crear y activar contratos, tramos y facturas (superadmin)», «Marcar facturas como pagadas» — audiencia: «Superadmin y soporte; soporte solo consulta.»

- [ ] **Step 1: Tests (rojo)** — `lib/help/pageHelp.test.ts`: (a) **completitud**: con `fast-glob` o `fs` recursivo, listar `app/entidad/**/page.tsx`, `app/paraguas/**/page.tsx`, `app/plataforma/**/page.tsx`, convertir cada ruta a plantilla (`app/entidad/[slug]/personas/[userId]/page.tsx` → `/entidad/[slug]/personas/[userId]`) y comprobar que existe exactamente una entrada `PAGE_HELP` por plantilla y ninguna entrada sin fichero; (b) `routeToRegExp('/entidad/[slug]/personas/[userId]')` casa `/entidad/asociacion-bidasoa/personas/42` y `/entidad/x/personas/42/` y no casa `/entidad/x/personas` ni `/entidad/x/personas/42/algo`; (c) `matchPageHelp('/entidad/x/asistencia/3f2a…')` devuelve la entrada de `asistencia/[eventId]`, y `/entidad/x/asistencia` la de `asistencia` (la más específica gana); `/login` → `null`; (d) toda entrada tiene `title`, `summary`, `audience` no vacíos y entre 1 y 4 `actions`.
- [ ] **Step 2**: rojo → implementar → verde. `npx vitest run lib/help`.
- [ ] **Step 3: Commit** `feat(help): registro de ayuda por pantalla y resolución de ruta`.

### Task 2: Componente `PageHelp`, cabeceras y documentación

**Files:**
- Create: `components/help/PageHelp.tsx`, `components/help/PageHelp.test.tsx`
- Modify: `app/entidad/[slug]/layout.tsx`, `app/paraguas/[slug]/layout.tsx`, `app/plataforma/layout.tsx` (+ sus tres `layout.test.tsx`), `CLAUDE.md`, `AGENTS.md`

- [ ] **Step 1: Tests (rojo)** — `PageHelp.test.tsx` (mock de `usePathname` de `next/navigation`; comprobar si `test-utils/nextNavigationMock.ts` ya lo expone y ampliarlo si no): sin entrada (`/login`) no renderiza nada; con `/entidad/x/personas` renderiza un botón `aria-label="Ayuda: Personas"` con `aria-haspopup="dialog"` y `aria-expanded="false"`; al pulsar se abre un diálogo (`role="dialog"`) titulado «Personas» con el `summary`, la lista «Qué puedes hacer aquí» con las `actions` y «Quién la ve: …»; `Escape` lo cierra y el foco vuelve al botón; `axe` sin violaciones con el diálogo abierto y cerrado. Los tres `layout.test.tsx`: existe el botón de ayuda (`getByRole('button', {name: /^Ayuda:/})`) — mockear `usePathname` al inicio de cada área.
- [ ] **Step 2**: rojo → implementar: `PageHelp` (`"use client"`, `useId` para `titleId`, `useState(open)`, `Dialog` con `widthClassName="max-w-xl"`, botón redondo 40×40 con borde `border-primary-700` y «?» en `text-primary-700 font-semibold`, `aria-hidden` en el signo); insertar `<PageHelp />` justo antes de `<LogoutButton />` en los tres layouts (dentro de un `div className="flex items-center gap-3"` si hace falta para alinear). Verde.
- [ ] **Step 3: Docs** — `CLAUDE.md` y `AGENTS.md`: sección «Ayuda por pantalla» (dónde está el registro, cómo se resuelve, el test de completitud que obliga a dar texto a toda pantalla nueva, las cinco decisiones). Verificación completa.
- [ ] **Step 4: Commits** `feat(help): botón de ayuda con el resumen de cada pantalla en las tres cabeceras` y `docs: ayuda por pantalla`.

---

## Autorrevisión

Petición cubierta: signo de interrogación visible en cada pantalla (cabecera de área, T2) y resumen de para qué es (T1, 32 textos: 19 entidad, 2 paraguas, 11 plataforma). Nombres consistentes (`PAGE_HELP`, `matchPageHelp`, `routeToRegExp`, `PageHelp`). El test de completitud es el que garantiza «cada pantalla». Fuera de alcance, anotado: `/login`, `/accesibilidad`, `/elegir-entidad`, `/`.
