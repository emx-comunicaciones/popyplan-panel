/**
 * Comprobación de accesibilidad con `axe-core` (tarea W6), vía
 * `vitest-axe` (`vitest.setup.ts` registra el matcher
 * `toHaveNoViolations` con `vitest-axe/extend-expect`). Uso:
 * `expect(await axe(container)).toHaveNoViolations()` tras un `render`
 * de `@/test-utils/render` (que da acceso a `container`).
 *
 * Reglas desactivadas, con motivo (excepción documentada, tal y como
 * permite el brief de esta tarea):
 * - `region`: axe exige que todo el contenido esté dentro de una región
 *   de referencia (`<header>`/`<nav>`/`<main>`…). Estos tests renderizan
 *   solo el contenido de una página (`page.tsx`), sin el `layout.tsx`
 *   que pone `<nav>`/`<main>` alrededor — el fragmento aislado
 *   incumpliría la regla aunque la página real, servida dentro de su
 *   layout, no tenga ningún problema. La estructura real (con `<main
 *   id="main-content">`, el enlace «Saltar al contenido» y la `<nav>`)
 *   se comprueba en los layouts (`layout.test.tsx`) y en los flujos
 *   Playwright (`e2e/`), que sí renderizan el árbol completo.
 * - `color-contrast`: jsdom no calcula estilos computados reales (no
 *   pinta ni aplica hojas de estilo), así que esta regla no puede leer
 *   los colores de verdad — o no informa nada o da falsos resultados.
 *   El contraste de los tokens de color se comprueba a mano y se
 *   documenta en `CLAUDE.md` («Accesibilidad»).
 */
import { configureAxe } from "vitest-axe";

export const axe = configureAxe({
  rules: {
    region: { enabled: false },
    "color-contrast": { enabled: false },
  },
});
