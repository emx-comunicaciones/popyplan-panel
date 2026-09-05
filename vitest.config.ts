import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": dirname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "lib/**/*.{ts,tsx}",
        "hooks/**/*.{ts,tsx}",
        "app/**/*.ts",
      ],
      exclude: [
        "lib/api/types.generated.ts",
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
      ],
      thresholds: {
        // Ratchet: solo sube. Cobertura real de líneas al cerrar W1: 100 %
        // (ver CLAUDE.md/README); el umbral se fija a ese valor menos 0.3.
        lines: 99.7,
      },
    },
  },
});
