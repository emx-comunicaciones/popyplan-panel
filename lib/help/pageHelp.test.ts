import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import ca from "@/messages/ca.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import eu from "@/messages/eu.json";

import { ENTIDAD_MENU_ITEMS } from "@/lib/auth/entidadMenu";
import { PARAGUAS_MENU_ITEMS } from "@/lib/auth/paraguasMenu";
import { PLATAFORMA_MENU_ITEMS } from "@/lib/auth/plataformaMenu";

import { dynamicSegments, matchPageHelp, menuSectionFor, PAGE_HELP, resolveRelatedRoute, routeToRegExp } from "./pageHelp";

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
    "%s (help.%s, %s) tiene title, summary, details, audience no vacíos, entre 1 y 4 actions y entre 1 y 3 tips y related",
    (_route, key, lang) => {
      const entry = resolveHelpEntry(CATALOGS[lang], key) as
        | {
            title?: unknown;
            summary?: unknown;
            details?: unknown;
            audience?: unknown;
            actions?: unknown;
            tips?: unknown;
            related?: unknown;
          }
        | undefined;

      expect(entry, `help.${key} falta en ${lang}.json`).toBeDefined();
      expect(typeof entry?.title).toBe("string");
      expect((entry?.title as string).length).toBeGreaterThan(0);
      expect(typeof entry?.summary).toBe("string");
      expect((entry?.summary as string).length).toBeGreaterThan(0);
      expect(typeof entry?.details).toBe("string");
      expect((entry?.details as string).length).toBeGreaterThan(0);
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

      expect(Array.isArray(entry?.tips), `help.${key}.tips en ${lang}.json`).toBe(true);
      const tips = entry?.tips as unknown[];
      expect(tips.length).toBeGreaterThanOrEqual(1);
      expect(tips.length).toBeLessThanOrEqual(3);
      for (const tip of tips) {
        expect(typeof tip).toBe("string");
        expect((tip as string).length).toBeGreaterThan(0);
      }

      expect(Array.isArray(entry?.related), `help.${key}.related en ${lang}.json`).toBe(true);
      const related = entry?.related as unknown[];
      expect(related.length).toBeGreaterThanOrEqual(1);
      expect(related.length).toBeLessThanOrEqual(3);
      for (const relatedKey of related) {
        expect(typeof relatedKey).toBe("string");
        expect((relatedKey as string).length).toBeGreaterThan(0);
      }
    },
  );

  /**
   * Cruce de `related` con el registro (fase 1 de la ampliación): cada
   * clave tiene que apuntar a otra entrada de `PAGE_HELP` — nunca a sí
   * misma, nunca repetida dentro del mismo array — y esa entrada no puede
   * tener segmentos dinámicos distintos de `[slug]`: las fichas
   * (`[userId]`, `[eventId]`, `[id]`) no tienen una ruta navegable sin
   * conocer el recurso concreto, así que jamás son destino del botón
   * «Pantallas relacionadas». Se lee en `en` (catálogo fuente): las
   * cuatro lenguas comparten las mismas claves por paridad de catálogos.
   */
  it.each(PAGE_HELP.map((entry) => [entry.key] as const))(
    "help.%s: related solo apunta a entradas navegables del registro",
    (key) => {
      const entry = resolveHelpEntry(CATALOGS.en, key) as { related?: unknown };
      const related = entry?.related as unknown[];
      expect(Array.isArray(related), `help.${key}.related falta en en.json`).toBe(true);

      for (const relatedKey of related) {
        expect(relatedKey, `help.${key}.related se relaciona consigo misma`).not.toBe(key);
        const relatedEntry = PAGE_HELP.find((candidate) => candidate.key === relatedKey);
        expect(
          relatedEntry,
          `help.${key}.related apunta a la clave desconocida "${String(relatedKey)}"`,
        ).toBeDefined();
        // `expect` no estrecha tipos: sin entrada, el `expect` de arriba
        // ya ha fallado el test y este throw solo satisface a `tsc`.
        if (!relatedEntry) throw new Error(`related sin entrada: ${String(relatedKey)}`);
        for (const segment of dynamicSegments(relatedEntry.route)) {
          expect(
            segment,
            `help.${key}.related → "${String(relatedKey)}" (${relatedEntry.route}) tiene un segmento dinámico que no es [slug]`,
          ).toBe("[slug]");
        }
      }

      expect(
        new Set(related).size,
        `help.${key}.related tiene claves duplicadas`,
      ).toBe(related.length);
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
  /**
   * `related` no es texto traducible: son **claves** del registro. El
   * cruce de arriba solo lee `en` (catálogo fuente), y el test de
   * paridad (`lib/i18n/messages.test.ts`) compara rutas de clave, no
   * valores — así que una errata en `es`/`eu`/`ca` pasaría los dos y el
   * botón desaparecería **solo en ese idioma** (`PAGE_HELP.find`
   * devuelve `undefined` y `PageHelp` no pinta nada). Aquí se exige que
   * las cuatro lenguas lleven exactamente las mismas claves, en el mismo
   * orden.
   */
  it.each(PAGE_HELP.map((entry) => [entry.key] as const))(
    "help.%s: related es idéntico en los cuatro catálogos",
    (key) => {
      const esperado = (resolveHelpEntry(CATALOGS.en, key) as { related?: unknown }).related;
      for (const lang of ["es", "eu", "ca"] as const) {
        const entry = resolveHelpEntry(CATALOGS[lang], key) as { related?: unknown };
        expect(entry?.related, `help.${key}.related difiere en ${lang}.json`).toEqual(esperado);
      }
    },
  );
});

describe("menuSectionFor", () => {
  it("la raíz de cada área es su Inicio", () => {
    expect(menuSectionFor("/plataforma")).toBe("inicio");
    expect(menuSectionFor("/entidad/[slug]")).toBe("inicio");
    expect(menuSectionFor("/paraguas/[slug]")).toBe("inicio");
  });

  it("una ficha comparte sección con su listado", () => {
    expect(menuSectionFor("/entidad/[slug]/personas/[userId]")).toBe("personas");
    expect(menuSectionFor("/plataforma/entidades/[id]")).toBe("entidades");
    expect(menuSectionFor("/entidad/[slug]/asistencia/[eventId]")).toBe("asistencia");
  });

  it("toma el primer segmento literal tras el área", () => {
    expect(menuSectionFor("/plataforma/roles")).toBe("roles");
    expect(menuSectionFor("/paraguas/[slug]/red-financiada")).toBe("red-financiada");
  });

  /**
   * La sección que devuelve tiene que ser una de las que de verdad
   * devuelven `entidadMenuFor`/`paraguasMenuFor`/`plataformaMenuFor`: si
   * no, el filtro por rol de `PageHelp` escondería *todos* los botones de
   * esa pantalla sin que nadie se enterase (un filtro que no casa nunca
   * es indistinguible de «este rol no la ve»).
   */
  it.each(PAGE_HELP.map((entry) => [entry.route, entry.key] as const))(
    "%s (help.%s) cae en una sección real del menú de su área",
    (route) => {
      const area = route.split("/").filter(Boolean)[0];
      const items =
        area === "entidad"
          ? ENTIDAD_MENU_ITEMS
          : area === "paraguas"
            ? PARAGUAS_MENU_ITEMS
            : PLATAFORMA_MENU_ITEMS;
      expect(items as readonly string[]).toContain(menuSectionFor(route));
    },
  );
});

describe("dynamicSegments", () => {
  it("recoge solo los segmentos dinámicos, en orden", () => {
    expect(dynamicSegments("/entidad/[slug]/personas/[userId]")).toEqual(["[slug]", "[userId]"]);
    expect(dynamicSegments("/plataforma/roles")).toEqual([]);
    expect(dynamicSegments("/entidad/[slug]")).toEqual(["[slug]"]);
  });
});

describe("resolveRelatedRoute", () => {
  const personas = PAGE_HELP.find((entry) => entry.key === "entidad.personas")!;
  const actividades = PAGE_HELP.find((entry) => entry.key === "entidad.actividades")!;
  const personasFicha = PAGE_HELP.find((entry) => entry.key === "entidad.personaFicha")!;
  const plataformaRoles = PAGE_HELP.find((entry) => entry.key === "plataforma.roles")!;

  it("una ruta estática se navega tal cual, sin slug que portar", () => {
    expect(
      resolveRelatedRoute("/entidad/alfaville/personas", personas, plataformaRoles),
    ).toBe("/plataforma/roles");
  });

  it("con [slug] en la misma área, porta el slug del pathname actual", () => {
    expect(
      resolveRelatedRoute("/entidad/alfaville/personas", personas, actividades),
    ).toBe("/entidad/alfaville/actividades");
  });

  it("con [slug] pero pathname de otra área, no hay ruta resoluble", () => {
    expect(
      resolveRelatedRoute("/paraguas/dipu/personas", personas, actividades),
    ).toBeNull();
  });

  it("una ficha (otro segmento dinámico) nunca es destino de navegación", () => {
    expect(
      resolveRelatedRoute("/entidad/alfaville/personas", personas, personasFicha),
    ).toBeNull();
    expect(
      resolveRelatedRoute("/entidad/alfaville/personas", personasFicha, personas),
    ).toBe("/entidad/alfaville/personas");
  });

  it("sin slug en el pathname actual, [slug] no se puede resolver", () => {
    const plataformaInicio = PAGE_HELP.find((entry) => entry.key === "plataforma.inicio")!;
    expect(
      resolveRelatedRoute("/plataforma", plataformaInicio, personas),
    ).toBeNull();
  });

  it("desde plataforma, el segundo segmento del pathname es un literal, no un slug", () => {
    expect(
      resolveRelatedRoute("/plataforma/roles", plataformaRoles, personas),
    ).toBeNull();
  });
});
