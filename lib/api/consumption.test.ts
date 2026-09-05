import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Test de consumo, portado de
 * `popyplan-mobile/app/_constants/__tests__/consumption.test.ts`:
 *
 * 1. Todo endpoint exportado en `lib/api/endpoints.ts` (como
 *    `BLOQUE.NOMBRE`) se usa en algún fichero fuera del propio
 *    `endpoints.ts` — si no, es un endpoint muerto y el test falla con
 *    la lista.
 * 2. Todo endpoint usado aparece citado en algún `*.test.ts`/`*.test.tsx`
 *    — si no, hace falta que esté en `consumption-allowlist.json` (con
 *    motivo).
 * 3. Esa lista solo puede encoger: su tamaño no puede superar `total`, y
 *    ninguna entrada puede referirse a una constante que ya tiene test o
 *    que ya no existe.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const ENDPOINTS_FILE = path.join(ROOT, "lib", "api", "endpoints.ts");
const ALLOWLIST_FILE = path.join(__dirname, "consumption-allowlist.json");
const SCAN_DIRS = ["app", "components", "hooks", "lib"];
const EXCLUDED_FILES = new Set([
  ENDPOINTS_FILE,
  path.join(ROOT, "lib", "api", "types.generated.ts"),
]);

interface Allowlist {
  total: number;
  entries: Record<string, string>;
}

/** Igual que en el móvil: recorre `export const BLOQUE = {...}` línea a línea. */
function parseDeclaredEndpoints(source: string): string[] {
  const lines = source.split("\n");
  const constants: string[] = [];
  const stack: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const topMatch = line.match(/^export const ([A-Z][A-Z0-9_]*) = \{$/);
    if (topMatch) {
      stack.length = 0;
      stack.push(topMatch[1]);
      continue;
    }

    if (stack.length === 0) continue;

    if (line === "} as const;" || line === "};") {
      stack.length = 0;
      continue;
    }
    if (line === "},") {
      stack.pop();
      continue;
    }

    const nestedMatch = line.match(/^([A-Z][A-Z0-9_]*): \{$/);
    if (nestedMatch) {
      stack.push(nestedMatch[1]);
      continue;
    }

    const leafMatch = line.match(/^([A-Z][A-Z0-9_]*):/);
    if (leafMatch) {
      constants.push([...stack, leafMatch[1]].join("."));
    }
  }

  return constants;
}

function walk(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !EXCLUDED_FILES.has(full)) {
      files.push(full);
    }
  }
  return files;
}

function isTestFile(file: string): boolean {
  return /\.test\.(ts|tsx)$/.test(file);
}

const allFiles = SCAN_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
const usageFiles = allFiles.filter((f) => !isTestFile(f));
const testFiles = allFiles.filter((f) => isTestFile(f));

const fileContents = new Map<string, string>();
function readFile(file: string): string {
  let content = fileContents.get(file);
  if (content === undefined) {
    content = fs.readFileSync(file, "utf8");
    fileContents.set(file, content);
  }
  return content;
}

function usedIn(files: string[], constant: string): boolean {
  const escaped = constant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`);
  return files.some((f) => pattern.test(readFile(f)));
}

const endpointsSource = fs.readFileSync(ENDPOINTS_FILE, "utf8");
const declared = parseDeclaredEndpoints(endpointsSource);

describe("consumo de endpoints (lib/api/endpoints.ts)", () => {
  it("declara al menos un endpoint (el parser no se ha quedado a cero)", () => {
    expect(declared.length).toBeGreaterThan(0);
  });

  it("no declara endpoints que nadie use (endpoints muertos)", () => {
    const dead = declared.filter((c) => !usedIn(usageFiles, c));
    expect(dead).toEqual([]);
  });

  it("todo endpoint usado tiene test, o está en la allowlist con motivo", () => {
    const used = declared.filter((c) => usedIn(usageFiles, c));
    const allowlist: Allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, "utf8"));
    const withoutTest = used.filter(
      (c) => !usedIn(testFiles, c) && !Object.prototype.hasOwnProperty.call(allowlist.entries, c),
    );
    expect(withoutTest).toEqual([]);
  });

  it("la allowlist de consumo solo puede encoger", () => {
    const allowlist: Allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, "utf8"));
    const entryNames = Object.keys(allowlist.entries);

    expect(entryNames.length).toBeLessThanOrEqual(allowlist.total);

    const declaredSet = new Set(declared);
    const stale = entryNames.filter((name) => {
      const stillDeclared = declaredSet.has(name);
      const nowTested = stillDeclared && usedIn(testFiles, name);
      return !stillDeclared || nowTested;
    });
    expect(stale).toEqual([]);
  });
});
