# Densidad («minimalista») + selector de idioma desplegable — encargo aprobado por el propietario (2026-09-20)

Palabras del usuario: «quiero que el selector de idiomas sea una desplegable y los diseños más minimalistas del panel, está todo enorme» → «hazlo como tú veas mejor».

## 1. Selector de idioma como desplegable
- `components/layout/LanguageSwitcher.tsx`: sustituir los tres `Button` (ES/EU/CA) por un `<select>` compacto con las tres opciones por nombre completo (Castellano / Euskara / Català, ya existen las claves `language.*`), `<label>` solo para lectores de pantalla («Idioma»), valor = `useLocale()`, `onChange` con la MISMA lógica actual (POST /api/lang → PATCH del idioma de la cuenta si hay sesión → `queryClient.invalidateQueries()` → `router.refresh()`). Mantener `aria-*` correctos, foco visible, fondo blanco sobre cabeceras de color (regla del repo: `text-primary-700` solo sobre blanco). En la cabecera de las tres áreas y en `LoginForm.tsx` (misma posición que hoy).
- Adaptar `LanguageSwitcher.test.tsx`, los `layout.test.tsx` de las tres áreas, el test del login y `e2e/idioma.spec.ts` (ahora `selectOption` en vez de click en botón; no ejecutar el e2e, solo dejarlo coherente). Sin nuevas claves salvo la etiqueta «Idioma» si no existe (en/es/eu/ca).

## 2. Pasada de densidad — en tokens y componentes compartidos, NO página a página
Medidas objetivo (el navegador base sigue en 16px; usar clases Tailwind o tokens en `app/globals.css`):
| Elemento | Ahora | Objetivo |
|---|---|---|
| Cabecera de área (3 layouts) | ~72px alto, título 18px | 48px, título 15px semibold, controles de 32px |
| `Button` (todas las variantes) y campos (`input`, `select`, `textarea` compartidos y los de páginas si usan clases comunes) | 40px | 32px alto, texto 13px, padding horizontal 12px |
| Menú lateral (3 layouts) | filas 40px, 16px, ~220px ancho | filas 30px, 13px, ancho 200px, activo con fondo tenue en vez de solo color |
| `<h1>` de página | 24px + subtítulo | 18px semibold; subtítulos solo si aportan (quitar el genérico «Panel de <entidad>.» del Inicio de entidad si existe) |
| `Card` / `StatCard` | padding 16px, sombra | padding 12px, borde 1px `--color-border`, sin sombra, radio 8px |
| Cifra de `StatCard` | 28px | 20px semibold; etiqueta 12px `text-secondary` |
| `Table` compartida y tablas propias (`PersonasTable`, colas, `MetricsTable`, `ComparativaTable`) | filas ~37px, 14-15px | filas 32px, texto 13px, padding celda 8px 12px, cabecera 12px uppercase-less |
| Separación entre bloques (`gap`, `mb`) | 24px | 16px; entre tarjetas 12px |
| `Dialog` | padding 24px | 16px, título 16px |
| `Badge`, `EmptyState`, `ErrorState`, `PeriodSelector`, `ExportButtons` | — | reducir en proporción (texto 12-13px) |
Pie de página (`Footer`) y `PageHelp` (botón «?», mantener 32px con fondo blanco).

Reglas: mantener los tokens de color y los contrastes auditados (`lib/a11y/tokens.test.ts` no debe cambiar); ningún objetivo interactivo por debajo de 32px de alto; `:focus-visible` intacto; texto nunca por debajo de 12px; todo el texto sigue en catálogos (no introducir literales). Preferir cambiar la fuente de cada estilo (componente compartido o token) y ajustar solo las páginas que llevan clases de tamaño propias (`text-2xl`, `p-6`, `gap-6`, `h-10`, `py-2.5`… — hacer un `grep` y recortarlas en la misma proporción). Los tests que fijan clases (`PageHelp.test.tsx` `bg-white`, algún `Button` variant, `Dialog` `rounded-lg`) se ajustan al nuevo valor, nunca se borran.

## 3. Verificación y entrega
`npm run typecheck && npm run lint && npx vitest run --coverage` (líneas ≥ 99,7 %). Generar capturas ANTES/DESPUÉS a 1440×900 de `/login`, el Inicio de entidad (`/entidad/asociacion-bidasoa`) y `/entidad/asociacion-bidasoa/personas` con Playwright contra el dev server de :3100? NO: :3100 sirve develop desde otro checkout. Arrancar tu propio `next dev --port 3102` desde este worktree con `NEXT_PUBLIC_API_URL=http://localhost:8001` (backend :8001 ya arriba), login `panel-titular-asociacion-bidasoa@test.com` / `panel-pass-1234` (UN solo login, límite 5/min/IP), guardar en `.superpowers/sdd/2026-09-20-densidad/shots/after-{login,inicio,personas}.png`, y parar el servidor al terminar. Las capturas «antes» ya están en `/Users/mikelerrasti/.claude/jobs/f2be1ebd/tmp/shot-{login,inicio,personas}.png` (cópialas a `shots/before-*.png`).
Commits en español (`feat(ui): …` / `refactor(ui): …`) con trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Nunca `git stash`. No tocar `/Users/mikelerrasti/Code/popyplan-panel` (checkout principal) ni `.worktrees/territorio`.
Informe: `report.md` en este directorio (qué cambió por componente, medidas finales, tests ajustados y por qué, rutas de las capturas).
