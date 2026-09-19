# Red de apoyo — plan de implementación del panel web

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la entidad vea en su panel lo poco que la red de apoyo le concierne: el referente ve la red efectiva de las personas que acompaña, Familias muestra tres contadores agregados y el aviso «crea tu comunidad de familias», Recursos admite la categoría «Cómo acompañar» y Comunicaciones ofrece la plantilla «Bienvenida a la red de apoyo». Nunca una lista de quién acompaña a quién.

**Architecture:** Consumo del contrato ya implementado (`~/Code/popyplan/docs/PANEL.md` §14.5, rama `feature/red-de-apoyo-backend`, PR #2, más el `GET /api/support/consent/` de la Tarea 0 del plan móvil). Tipos regenerados con `npm run gen:types` desde `../popyplan/docs/schema.yaml`; un hook nuevo (`usePersonSupport`) con el patrón `ApiError → kind`; una sección condicional en `PersonSheet`; tres `StatCard` y un aviso en `FamiliasPanel`; una etiqueta en `RecursosPanel`; un botón de plantilla en `ComunicacionesPanel`. Un spec e2e contra el backend real con el referente de la demo.

**Tech Stack:** Next.js 15 App Router, TypeScript estricto, TanStack Query 5, Tailwind 4, Vitest + Testing Library + vitest-axe, Playwright.

**Spec:** `~/Code/popyplan/docs/superpowers/specs/2026-09-18-red-de-apoyo-design.md` §7 (lado de la entidad). **Contrato:** `~/Code/popyplan/docs/PANEL.md` §14.5 (referente y contadores de Familias), §14.6 (datos de demo).

## Global Constraints

- Textos de UI en español; identificadores en inglés. Convenciones de `CLAUDE.md`/`AGENTS.md` del panel (los dos ficheros son copia: **si se actualiza uno, se actualiza el otro**).
- **Regla de supresión** (`CLAUDE.md`, «Regla de renderizado de la supresión»): `lib/metrics/format.ts::formatCount(value, suppressed)` es el único sitio que decide qué pintar; los componentes reciben la cadena ya formateada.
- **Invariante 9**: ninguna vista de personas/familias pinta email, teléfono, documentos ni notas. La sección «Red de apoyo» de la ficha pinta solo `supporter.public_name`, la relación y si recibe avisos — exactamente lo que da el contrato.
- **Nunca** una lista de quién acompaña a quién fuera de la ficha que ve el referente (spec §7, PANEL §14.5).
- Test de consumo (`lib/api/consumption.test.ts`): todo endpoint de `lib/api/endpoints.ts` se usa y está citado en un test; `lib/api/consumption-allowlist.json` sigue en `total: 0`.
- Cada `page.tsx` tocada mantiene su `page.test.tsx` con aserciones de comportamiento; los `page.test.tsx` cubiertos por `axe` (`grep -rln toHaveNoViolations app components`) siguen pasando; la ficha de persona gana un test de `axe` propio (hoy está en la excepción documentada).
- Cobertura Vitest de líneas ≥ umbral de `vitest.config.ts` (99.7 sobre `lib/**`, `hooks/**`, `app/**/*.ts`, `middleware.ts`): todo `hooks/*.ts` y `lib/*.ts` nuevo con todas sus ramas testeadas.
- Verificación antes de cada commit: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`. `npm run e2e` al cerrar (backend local sembrado con la rama de la red de apoyo, ver «E2E» abajo).
- Commits en español (`feat(support):`/`fix:`/`docs:`), terminando en `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. **Rama `feature/red-de-apoyo-panel` desde `develop` (addeb2e)**; la integración la decide el usuario al final.

### Decisiones de este plan (ya tomadas)

1. **404 de la red = «no se pinta nada»**, sin mensaje (spec §7). `usePersonSupport` traduce 404 y 403 a `kind: 'sin_acceso'` y `PersonSheet` no monta la sección en ese caso; cualquier otro error sí muestra un `ErrorState` **dentro** de la sección (no rompe la ficha).
2. **La sección solo se consulta si quien mira es `referente`**: el Server Component de la ficha ya calcula `canAssignReferent` por rol; se añade `isReferent = membership.role === 'referente'` y `PersonSheet` solo llama a `usePersonSupport` con `enabled: isReferent`. Así titular/moderador no gastan una petición que el backend responderá 404 a propósito.
3. **Tipos regenerados, no a mano**: `npm run gen:types` con el `schema.yaml` de la rama del backend (ya incluye `people_with_support_network`, `missing_families_space_supporters` y `accompany`). Se elimina la ampliación manual de `FamiliesSummary` en `lib/api/types.ts` **solo si** el esquema regenerado ya trae `members_count` como `number | null` con `suppressed`; si no, se mantiene tal cual (comprobar antes de borrar).
4. **Aviso de comunidad de familias pendiente** en Familias: si `missing_families_space_supporters > 0` **y** `communities.length === 0`, un aviso con `role="status"` y el botón existente «Nueva comunidad de familias» (solo `canManage`); si hay comunidad pero el contador es > 0 (carrera de la señal diferida), el aviso dice que el alta se completará sola.
5. **Plantilla de bienvenida**: un botón «Usar plantilla: Bienvenida a la red de apoyo» en el formulario de redacción, visible solo cuando `hasFamilies`; rellena título y cuerpo (texto fijo en `lib/communications/templates.ts`) y selecciona audiencia `families`; no envía nada. Si el título o el cuerpo ya tienen texto, pide confirmación con `ConfirmDialog` antes de sobrescribir.
6. **`accompany`** entra en `CATEGORY_ORDER` tras `families` y en `CATEGORY_LABELS` como «Cómo acompañar». `Record<ResourceCategory, string>` deja de compilar hasta hacerlo: ese es el RED.

---

## Mapa de ficheros

| Fichero | Responsabilidad |
|---|---|
| `lib/api/types.generated.ts` | regenerado (`npm run gen:types`) |
| `lib/api/types.ts` | `PersonSupportRow`, `FamiliesSummary` con los cuatro contadores |
| `lib/api/endpoints.ts` | `PANEL.PERSON_SUPPORT(orgId, userId)` |
| `hooks/usePersonSupport.ts` (+ test) | `GET …/people/{user}/support/`, `PersonSupportError{kind}` |
| `lib/support/relationshipLabel.ts` (+ test) | etiquetas de `relationship` (mismas que el móvil) |
| `components/entidad/PersonSheet.tsx` (+ test) | sección «Red de apoyo» |
| `app/entidad/[slug]/personas/[userId]/page.tsx` (+ test) | prop `isReferent`, test de `axe` |
| `components/entidad/FamiliasPanel.tsx` (+ test) | 3 `StatCard` + aviso |
| `hooks/useFamiliesSummary.ts` (+ test) | normaliza los contadores nuevos |
| `components/entidad/RecursosPanel.tsx` (+ test) | categoría `accompany` |
| `lib/communications/templates.ts` (+ test), `components/entidad/ComunicacionesPanel.tsx` (+ test) | plantilla de bienvenida |
| `e2e/red-de-apoyo.spec.ts`, `e2e/helpers.ts` | referente ve la red; titular ve contadores |
| `CLAUDE.md`, `AGENTS.md`, `docs/preguntas-diseno.md` | documentación |

---

### Task 1: Tipos regenerados, endpoint y hook `usePersonSupport`

**Files:**
- Modify: `lib/api/types.generated.ts` (regenerado), `lib/api/types.ts`, `lib/api/endpoints.ts`
- Create: `hooks/usePersonSupport.ts`, `hooks/usePersonSupport.test.ts`, `lib/support/relationshipLabel.ts`, `lib/support/relationshipLabel.test.ts`, `test-utils/fixtures/support.ts`

**Interfaces (Produces):**
```ts
// lib/api/endpoints.ts (bloque PANEL, junto a PERSON)
PERSON_SUPPORT: (orgId: number | string, userId: number | string) =>
  `/api/panel/entidad/${orgId}/people/${userId}/support/`,
```
```ts
// lib/api/types.ts
export type PersonSupportRow = components["schemas"]["PersonSupportRow"]; // si el esquema lo nombra distinto, usar el nombre real y anotarlo
// FamiliesSummary: asegurar que expone people_with_support_network / active_supporters / supporters_notified_on_help
// como { value: number | null; suppressed: boolean } y missing_families_space_supporters: number.
```
```ts
// hooks/usePersonSupport.ts
export type PersonSupportErrorKind = "sin_acceso" | "desconocido";
export class PersonSupportError extends Error { kind: PersonSupportErrorKind }
export function usePersonSupport(orgId: number, userId: string, enabled: boolean):
  UseQueryResult<PersonSupportRow[], PersonSupportError>
// queryKey ["panel-person-support", orgId, String(userId)] (string, como usePerson — ver el bug documentado de useProgram)
// 403/404 → kind 'sin_acceso'; resto → 'desconocido' con el detail del backend (lib/api/drfError.ts::detailOf)
```
```ts
// lib/support/relationshipLabel.ts
export const RELATIONSHIP_LABELS: Record<SupportRelationship, string> = { parent: 'Madre o padre', partner: 'Pareja', sibling: 'Hermano o hermana', relative: 'Otro familiar', friend: 'Amistad', legal_guardian: 'Tutor o tutora legal', trusted_other: 'Otra persona de confianza', unspecified: 'Sin indicar' };
export function relationshipLabel(r: string): string; // reserva al valor crudo si llega uno nuevo (patrón lib/reports/labels.ts)
```

- [ ] **Step 1**: `npm run gen:types` (con `../popyplan` en la rama `feature/red-de-apoyo-backend`; comprobar con `git -C ../popyplan branch --show-current`). Revisar el diff de `types.generated.ts`: debe aparecer el esquema de la fila de red (`grep -n "relationship" lib/api/types.generated.ts`), `people_with_support_network`, `missing_families_space_supporters` y `accompany`. Si el esquema regenerado ya trae `members_count` nullable, quitar la ampliación manual de `FamiliesSummary` (decisión 3); si no, dejarla.
- [ ] **Step 2: Tests (rojo)** — `hooks/usePersonSupport.test.ts` (patrón `hooks/usePerson.test.ts`: `server`/`msw` o mock de `apiFetch`, el que use ese test): 200 → filas; 404 → `kind 'sin_acceso'`; 403 → `'sin_acceso'`; 500 con `{detail}` → `'desconocido'` con ese mensaje; `enabled: false` → no llama (`fetchStatus === 'idle'`). Citar literalmente `PANEL.PERSON_SUPPORT` (consumo). `relationshipLabel.test.ts`: las ocho etiquetas y la reserva al valor crudo.
- [ ] **Step 3**: rojo → implementar → verde. `npm run typecheck && npm run lint && npx vitest run hooks lib/support lib/api`.
- [ ] **Step 4: Commit** `feat(support): tipos regenerados, endpoint y hook de la red de apoyo (PANEL.md §14.5)`.

### Task 2: Sección «Red de apoyo» en la ficha de persona

**Files:**
- Modify: `components/entidad/PersonSheet.tsx`, `components/entidad/PersonSheet.test.tsx` (crear si no existe — `grep -l PersonSheet components/entidad/*.test.tsx`), `app/entidad/[slug]/personas/[userId]/page.tsx`, `app/entidad/[slug]/personas/[userId]/page.test.tsx`

- [ ] **Step 1: Tests (rojo)** — página: con rol `referente` se pasa `isReferent` y, con el hook mockeado a dos filas, se pinta el `<h2>` «Red de apoyo», «Miren · Madre o padre · Recibe avisos» y «Jon · Amistad · Sin avisos»; con 404 (`sin_acceso`) **no** existe el heading y no hay `ErrorState`; con error `desconocido` hay `ErrorState` dentro de la sección y el resto de la ficha sigue; con rol `titular` el hook se llama con `enabled: false` y no hay sección; línea fija bajo la lista: «Solo tú, como referente, ves esta red. Popyplan no guarda teléfonos: contacta con la persona por el chat de la app.»; ningún texto con `@`; test «no tiene violaciones de accesibilidad (axe)» como primer test del `describe` (patrón de `personas/page.test.tsx`).
- [ ] **Step 2**: rojo → implementar: `PersonSheetProps` gana `isReferent: boolean`; `usePersonSupport(orgId, userId, isReferent)`; sección `<section aria-labelledby="red-apoyo-heading">` con `<ul>`; `page.tsx` calcula `isReferent`. Verde, `axe` verde.
- [ ] **Step 3: Commit** `feat(support): sección «Red de apoyo» en la ficha de persona, solo para el referente`.

### Task 3: Contadores y aviso en Familias

**Files:**
- Modify: `hooks/useFamiliesSummary.ts` (+ test), `components/entidad/FamiliasPanel.tsx`, `app/entidad/[slug]/familias/FamiliasPanel.test.tsx`, `test-utils/fixtures/*` (fixture de Familias con los cuatro contadores)

- [ ] **Step 1: Tests (rojo)** — tres `StatCard` nuevas: «Personas con red de apoyo», «Apoyos activos», «Apoyos que reciben avisos», pintadas con `formatCount(value, suppressed)` (`<5` cuando `suppressed`); aviso cuando `missing_families_space_supporters > 0` y sin comunidades: `role="status"`, texto «N personas de la red de apoyo esperan a que crees la comunidad de familias.» (singular con 1) y el botón «Nueva comunidad de familias» presente solo con `canManage`; con comunidades y contador > 0: «El alta en la comunidad de familias se completará automáticamente.»; con 0: sin aviso; `axe` sigue verde; ningún nombre de apoyo en el árbol.
- [ ] **Step 2**: rojo → implementar (`useFamiliesSummary` normaliza `{value, suppressed}` por si el esquema trae solo `number`) → verde.
- [ ] **Step 3: Commit** `feat(support): contadores de la red de apoyo y aviso de comunidad de familias pendiente`.

### Task 4: Categoría «Cómo acompañar» y plantilla de bienvenida

**Files:**
- Modify: `components/entidad/RecursosPanel.tsx` (+ su test), `components/entidad/ComunicacionesPanel.tsx`, `components/entidad/ComunicacionesPanel.test.tsx`
- Create: `lib/communications/templates.ts`, `lib/communications/templates.test.ts`

**Interfaces:**
```ts
// lib/communications/templates.ts
export const SUPPORT_WELCOME_TEMPLATE = {
  title: 'Bienvenida a la red de apoyo',
  body: 'Gracias por acompañar a alguien de nuestra entidad. En este espacio de familias encontrarás actividades, formación y recursos pensados para ti. Recuerda: no verás las conversaciones, la actividad privada ni la ubicación de la persona a la que acompañas; solo lo que ella decida compartir con su red. Si necesitas hablar con la entidad, escribe a su referente desde la app.',
} as const;
export function applyTemplate(current: {title: string; body: string}, t: typeof SUPPORT_WELCOME_TEMPLATE): {title: string; body: string; overwritten: boolean};
```

- [ ] **Step 1: Tests (rojo)** — `RecursosPanel`: un recurso `category: 'accompany'` aparece bajo «Cómo acompañar» tras «Familias»; el select del formulario ofrece la opción. `templates.test.ts`: `applyTemplate` con campos vacíos → `overwritten: false`; con texto → `true`. `ComunicacionesPanel`: con `hasFamilies` y `canCompose`, botón «Usar plantilla: Bienvenida a la red de apoyo» → rellena título/cuerpo y audiencia «Familias»; con título ya escrito → `ConfirmDialog` («Se reemplazará el texto actual») y solo tras confirmar se rellena; sin `hasFamilies` → botón ausente.
- [ ] **Step 2**: rojo → implementar → verde.
- [ ] **Step 3: Commit** `feat(support): categoría «Cómo acompañar» y plantilla «Bienvenida a la red de apoyo»`.

### Task 5: E2E, documentación y verificación completa

**Files:**
- Create: `e2e/red-de-apoyo.spec.ts`
- Modify: `e2e/helpers.ts` (`REFERENTE_BIDASOA_EMAIL = 'panel-referente-asociacion-bidasoa@test.com'`, `TITULAR_TXIKIA_EMAIL = 'panel-titular-elkartea-txikia@test.com'`), `CLAUDE.md`, `AGENTS.md`, `docs/preguntas-diseno.md`

- [ ] **Step 1: Spec e2e** — (a) login referente Bidasoa por API → `/entidad/asociacion-bidasoa/personas/<id de p01>` (resolver el id con `GET .../people/?search=` o el helper que exista) → visible «Red de apoyo» con «Miren» o el `public_name` real de `panel-demo-apoyo-01` (leerlo por API con el login del apoyo, no hardcodear); (b) login titular Bidasoa → misma ficha → **no** existe «Red de apoyo»; (c) login titular Elkartea Txikia → `/entidad/elkartea-txikia/familias` → aviso de comunidad pendiente con «1 persona» y botón «Nueva comunidad de familias». Respetar el límite de 5 logins/min (`pop.settings_e2e` en CI; en local espaciar).
- [ ] **Step 2: Docs** — `CLAUDE.md` y `AGENTS.md` (idénticos): sección «Red de apoyo (Fase 7)» con el contrato consumido, las decisiones 1-6, el hook, la lista de `axe` actualizada (la ficha de persona sale de la excepción) y las cuentas de demo; `docs/preguntas-diseno.md` gana una sección con las preguntas abiertas (¿debe el titular ver al menos el recuento de apoyos de una persona?; ¿plantilla editable por la entidad?).
- [ ] **Step 3: Verificación** — `npm run typecheck && npm run lint && npm run test:coverage && npm run build`; `npm run e2e` con el backend local en :8001 (rama del backend con `support`, `seed_panel_demo` ejecutado).
- [ ] **Step 4: Commits** `test(e2e): red de apoyo en la ficha del referente y en Familias` y `docs: red de apoyo (Fase 7) en CLAUDE.md/AGENTS.md`.

---

## Autorrevisión del plan

Spec §7 cubierto: ficha (T2, 404 silencioso), Familias tres contadores + aviso (T3), categoría `accompany` (T4), plantilla de bienvenida (T4), Encuestas sin cambios (nada que hacer), contacto con la entidad es del móvil (fuera). Nombres consistentes entre tareas (`usePersonSupport`, `PANEL.PERSON_SUPPORT`, `relationshipLabel`, `SUPPORT_WELCOME_TEMPLATE`, `isReferent`). Las dos comprobaciones «según lo que traiga el esquema» (nombre del tipo de fila; `members_count` nullable) están acotadas con el comando para resolverlas.
