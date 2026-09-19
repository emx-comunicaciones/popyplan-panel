import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { matchPageHelp, PAGE_HELP, routeToRegExp } from "./pageHelp";

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

  it.each(PAGE_HELP.map((entry) => [entry.route, entry] as const))(
    "%s tiene title, summary, audience no vacíos y entre 1 y 4 actions",
    (_route, entry) => {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.summary.length).toBeGreaterThan(0);
      expect(entry.audience.length).toBeGreaterThan(0);
      expect(entry.actions.length).toBeGreaterThanOrEqual(1);
      expect(entry.actions.length).toBeLessThanOrEqual(4);
      for (const action of entry.actions) {
        expect(action.length).toBeGreaterThan(0);
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

  it("no casa un segmento dinámico vacío", () => {
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

  // Con las 32 rutas reales nunca hay dos plantillas que casen con el
  // mismo pathname a la vez: el patrón ancla el número de segmentos
  // exacto, así que dos plantillas que casen con el mismo pathname
  // tienen siempre el mismo número de segmentos entre sí. Este caso usa
  // un registro de prueba propio (parámetro `entries`, sustituible solo
  // en test) para ejercitar de verdad el `reduce` interno con más de un
  // candidato — aquí con el mismo número de segmentos en las dos
  // plantillas, así que gana la primera que casa (empate, sin ganador
  // más específico que la otra) en vez de romper o devolver `undefined`.
  it("con varias plantillas que casan a la vez, la función no rompe y devuelve una de ellas", () => {
    const entries = [
      { ...PAGE_HELP[0], route: "/entidad/[slug]/asistencia" },
      { ...PAGE_HELP[0], route: "/entidad/[slug]/[tab]" },
    ];
    const match = matchPageHelp("/entidad/x/asistencia", entries);
    expect(match?.route).toBe("/entidad/[slug]/asistencia");
  });
});
