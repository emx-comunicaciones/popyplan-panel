import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import jsxA11y from "eslint-plugin-jsx-a11y";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // `next/core-web-vitals` ya registra el plugin `jsx-a11y` (con sus
  // reglas "recommended"); solo añadimos las reglas de `strict` encima,
  // sin volver a declarar el plugin (ESLint 9 no permite redefinirlo).
  { rules: jsxA11y.flatConfigs.strict.rules },
  // Regla que impide literales de UI nuevos sin pasar por `t()`
  // (spec de diseño `2026-09-19-i18n-es-eu-ca`, decisión 8; plan de i18n,
  // tarea 6): `next/core-web-vitals` ya registra el plugin `react` (mismo
  // motivo que `jsx-a11y` arriba, no se vuelve a declarar), así que solo
  // hace falta activar la regla. Ámbito `app/**/*.tsx` y
  // `components/**/*.tsx` — el resto del árbol (`lib/**`, `hooks/**`) no
  // pinta JSX; los ficheros de test quedan fuera porque sus aserciones
  // comparan contra el texto ya traducido tal cual (`getByText("Cancelar")`),
  // no generan UI nueva.
  //
  // **`ignoreProps: true`, no `false`** (desviación deliberada de la nota
  // de la tarea, documentada aquí y en `CLAUDE.md`): con `ignoreProps:
  // false` la regla marca *cualquier* valor de atributo JSX literal, sin
  // distinguir un texto de interfaz (`aria-label="Cerrar"`) de marcado
  // puramente técnico (`className="flex gap-2"`, `type="button"`,
  // `htmlFor="email"`) — el propio código de la regla
  // (`node_modules/eslint-plugin-react/lib/rules/jsx-no-literals.js`,
  // visitor `JSXAttribute`) no tiene forma de acotar por nombre de
  // atributo. Probado en este árbol: 1835 errores, casi todos
  // `className`. Con `ignoreProps: true` la regla sigue marcando todo
  // literal como **hijo** de un elemento JSX (el caso real que esta tarea
  // quiere impedir: un `<p>Texto nuevo</p>` sin pasar por `t()`) y deja
  // en paz los atributos — de los cuales, tras una auditoría completa de
  // `app/**`/`components/**`, ninguno quedaba con texto de interfaz sin
  // traducir (las tareas 2-5 ya los cubrieron); el único caso real que
  // apareció con `ignoreProps: true` (10 literales) fue un `<h1>` y un
  // `<EmptyState>` de `informes/page.tsx` que las tareas anteriores
  // habían dejado sin tocar, ya extraído en el mismo commit que esta
  // regla. `allowedStrings` cubre solo separadores y glifos decorativos,
  // nunca una palabra: `–` (guion medio de un rango de fechas,
  // `ProgramaDetalle`/`ProgramasPanel`), `#`/`(#`/`) —` (referencias de
  // id — `#<id>`, `(#<id>)` — en `RolesPanel`/`VerificacionesQueue`; los
  // dos últimos son un solo nodo de texto JSX porque no hay separación
  // real entre los caracteres), `?` (el signo de `PageHelp`, ya
  // `aria-hidden`) y `×` (el cierre de `Dialog`, idem).
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: [
            " ",
            "·",
            "—",
            "–",
            "%",
            "€",
            "/",
            ":",
            "(",
            ")",
            "-",
            "+",
            "•",
            "<5",
            "…",
            "#",
            "(#",
            ") —",
            "?",
            "×",
          ],
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "lib/api/types.generated.ts",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      // Árbol de trabajo aparte del servidor de demo del propietario
      // (ignorado por git, `.git/info/exclude`): su propio `.next/` y
      // `node_modules/` no encajan con los patrones de arriba salvo que
      // se ignoren explícitamente. No afecta a CI (el checkout no trae
      // `.worktrees/`).
      ".worktrees/**",
    ],
  },
];

export default eslintConfig;
