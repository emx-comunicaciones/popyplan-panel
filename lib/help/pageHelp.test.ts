import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import ca from "@/messages/ca.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import eu from "@/messages/eu.json";

import { matchPageHelp, PAGE_HELP, routeToRegExp } from "./pageHelp";

type HelpCatalog = {
  help?: Record<string, unknown>;
};

const CATALOGS: Record<string, HelpCatalog> = { en, es, eu, ca };

/** Navega `help.<key>` (p. ej. `"entidad.inicio"`) dentro de un catálogo. */
function resolveHelpEntry(catalog: HelpCatalog, key: string): unknown {
  const segments = key.split(".");
  let node: unknown = catalog.help;
  for (const segment of segments) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

/**
 * Recorre `app/entidad`, `app/paraguas` y `app/plataforma` buscando cada
 * `page.tsx` y lo convierte en la plantilla de ruta equivalente (misma
 * forma que `PageHelpEntry.route`): quita el prefijo `app`, la cola
 * `/page.tsx` y normaliza la raíz de cada área (`app/plataforma/page.tsx`
 * → `/plataforma`, nunca `/plataforma/`).
 */
function findPageRoutes(root: string): string[] {
  const routes: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.name !== "page.tsx") continue;

      const relative = path
        .relative(process.cwd(), fullPath)
        .split(path.sep)
        .join("/");
      const withoutPrefix = relative.replace(/^app/, "");
      const route = withoutPrefix.replace(/\/page\.tsx$/, "") || "/";
      routes.push(route);
    }
  }

  walk(root);
  return routes;
}

describe("PAGE_HELP", () => {
  it("tiene exactamente una entrada por cada page.tsx real de entidad/paraguas/plataforma", () => {
    const areas = ["app/entidad", "app/paraguas", "app/plataforma"];
    const realRoutes = areas
      .flatMap((area) => findPageRoutes(path.join(process.cwd(), area)))
      .sort();

    const registeredRoutes = PAGE_HELP.map((entry) => entry.route)
      .slice()
      .sort();

    expect(registeredRoutes).toEqual(realRoutes);
  });

  it("no tiene entradas duplicadas", () => {
    const routes = PAGE_HELP.map((entry) => entry.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("no tiene dos entradas con la misma key", () => {
    const keys = PAGE_HELP.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(
    PAGE_HELP.flatMap((entry) =>
      (["en", "es", "eu", "ca"] as const).map((lang) => [entry.route, entry.key, lang] as const),
    ),
  )(
    "%s (help.%s, %s) tiene title, summary, audience no vacíos y entre 1 y 4 actions",
    (_route, key, lang) => {
      const entry = resolveHelpEntry(CATALOGS[lang], key) as
        | { title?: unknown; summary?: unknown; audience?: unknown; actions?: unknown }
        | undefined;

      expect(entry, `help.${key} falta en ${lang}.json`).toBeDefined();
      expect(typeof entry?.title).toBe("string");
      expect((entry?.title as string).length).toBeGreaterThan(0);
      expect(typeof entry?.summary).toBe("string");
      expect((entry?.summary as string).length).toBeGreaterThan(0);
      expect(typeof entry?.audience).toBe("string");
      expect((entry?.audience as string).length).toBeGreaterThan(0);

      expect(Array.isArray(entry?.actions)).toBe(true);
      const actions = entry?.actions as unknown[];
      expect(actions.length).toBeGreaterThanOrEqual(1);
      expect(actions.length).toBeLessThanOrEqual(4);
      for (const action of actions) {
        expect(typeof action).toBe("string");
        expect((action as string).length).toBeGreaterThan(0);
      }
    },
  );
});

describe("routeToRegExp", () => {
  it("casa un pathname real sin barra final", () => {
    const regExp = routeToRegExp("/entidad/[slug]/personas/[userId]");
    expect(regExp.test("/entidad/asociacion-bidasoa/personas/42")).toBe(true);
  });

  it("casa el mismo pathname con barra final", () => {
    const regExp = routeToRegExp("/entidad/[slug]/personas/[userId]");
    expect(regExp.test("/entidad/x/personas/42/")).toBe(true);
  });

  it("no casa con menos segmentos de los que pide la plantilla", () => {
    const regExp = routeToRegExp("/entidad/[slug]/personas/[userId]");
    expect(regExp.test("/entidad/x/personas")).toBe(false);
  });

  it("no casa con segmentos de más al final", () => {
    const regExp = routeToRegExp("/entidad/[slug]/personas/[userId]");
    expect(regExp.test("/entidad/x/personas/42/algo")).toBe(false);
  });

  it("no casa con una barra doble al final (segundo segmento dinámico vacío)", () => {
    const regExp = routeToRegExp("/entidad/[slug]/personas/[userId]");
    expect(regExp.test("/entidad/x/personas//")).toBe(false);
  });

  it("una plantilla sin segmentos dinámicos casa solo esa ruta exacta", () => {
    const regExp = routeToRegExp("/plataforma/roles");
    expect(regExp.test("/plataforma/roles")).toBe(true);
    expect(regExp.test("/plataforma/roles/")).toBe(true);
    expect(regExp.test("/plataforma/roles/algo")).toBe(false);
    expect(regExp.test("/plataforma/rolesx")).toBe(false);
  });
});

describe("matchPageHelp", () => {
  it("devuelve null cuando ninguna plantilla casa", () => {
    expect(matchPageHelp("/login")).toBeNull();
  });

  it("con varias plantillas que casarían, gana la más específica (más segmentos)", () => {
    const match = matchPageHelp(
      "/entidad/x/asistencia/3f2a1c4e-aaaa-bbbb-cccc-000000000000",
    );
    expect(match?.route).toBe("/entidad/[slug]/asistencia/[eventId]");
  });

  it("con menos segmentos, casa la plantilla menos específica", () => {
    const match = matchPageHelp("/entidad/x/asistencia");
    expect(match?.route).toBe("/entidad/[slug]/asistencia");
  });

  it("admite una barra final en el pathname real", () => {
    const match = matchPageHelp("/entidad/x/asistencia/");
    expect(match?.route).toBe("/entidad/[slug]/asistencia");
  });

  it("devuelve la entrada exacta para una ruta raíz de área", () => {
    expect(matchPageHelp("/plataforma")?.route).toBe("/plataforma");
    expect(matchPageHelp("/paraguas/x")?.route).toBe("/paraguas/[slug]");
  });
});
