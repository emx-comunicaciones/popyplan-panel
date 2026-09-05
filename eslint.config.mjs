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
    ],
  },
];

export default eslintConfig;
