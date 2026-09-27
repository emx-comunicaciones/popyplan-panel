import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Los personajes de prueba (`manage.py seed_personas` del backend): los
 * mismos emails, contraseña e ids que usan la app móvil y los bots de
 * `scripts/simulate_users.py`. Se leen de `personas.json`, nunca se
 * escriben a mano.
 *
 * Ruta: `PERSONAS_JSON`, o `test_data/personas.json` del checkout del
 * backend junto al del panel (`~/Code/popyplan` al lado de
 * `~/Code/popyplan-panel`), también desde un worktree del panel.
 */
export interface Persona {
  email: string;
  password: string;
  alias: string;
  id: number | null;
  area_panel: "entidad" | "paraguas" | "plataforma" | null;
  slug: string | null;
}

export interface Mundo {
  api_url: string;
  password: string;
  personas: Record<string, Persona>;
  entidades: Record<"asociacion" | "ayuntamiento", { id: number; slug: string; name: string }>;
  comunidades: Record<string, { id: string; name: string; visibility: string }>;
  actividades: Record<string, { id: string; title: string }>;
  vecinas: { email: string; id: number }[];
}

function raizDelPanel(): string {
  // En un worktree `--git-common-dir` apunta al `.git` del checkout
  // principal: su padre es la raíz del panel de verdad.
  const comun = execSync("git rev-parse --path-format=absolute --git-common-dir", {
    cwd: __dirname,
  })
    .toString()
    .trim();
  return path.dirname(comun);
}

export function rutaPersonas(): string {
  return (
    process.env.PERSONAS_JSON ??
    path.resolve(raizDelPanel(), "..", "popyplan", "test_data", "personas.json")
  );
}

let cache: Mundo | null = null;

export function mundo(): Mundo {
  if (!cache) {
    try {
      cache = JSON.parse(readFileSync(rutaPersonas(), "utf-8")) as Mundo;
    } catch {
      throw new Error(
        `No encuentro ${rutaPersonas()}: ejecuta antes scripts/test-env.sh en el backend ` +
          "o define PERSONAS_JSON.",
      );
    }
  }
  return cache;
}

export function persona(clave: string): Persona {
  const p = mundo().personas[clave];
  if (!p) throw new Error(`No hay personaje «${clave}» en personas.json`);
  return p;
}

/** Personajes que entran al panel (tienen área) más la usuaria de la app. */
export const PERSONAJES_DEL_PANEL = ["asociacion", "moderadora", "ayuntamiento", "plataforma"];
export const PERSONAJES_CON_SESION = [...PERSONAJES_DEL_PANEL, "usuaria"];

export function rutaSesion(clave: string): string {
  return path.join(__dirname, ".auth", `${clave}.json`);
}
