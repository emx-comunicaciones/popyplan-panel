/**
 * Puerta de calidad de i18n (spec de diseño `2026-09-19-i18n-es-eu-ca`,
 * decisión 9): los cuatro catálogos (`messages/{en,es,eu,ca}.json`)
 * tienen exactamente las mismas claves hoja, ningún valor vacío y los
 * mismos parámetros ICU por clave. `en` es la cadena fuente (decisión 2
 * del diseño) y entra en la comparación igual que los otros tres: una
 * clave nueva sin traducir a los tres idiomas ofrecidos rompe este test,
 * nunca solo un aviso.
 *
 * Este test se mantiene en verde al final de cada tarea de extracción
 * (2-6): según crezcan los catálogos con mensajes ICU de verdad
 * (`{count, plural, one {…} other {…}}`), `extractIcuArgs` solo recoge
 * los parámetros de nivel superior (el nombre justo después de cada `{`
 * que abre), nunca el texto literal de las ramas internas del plural.
 *
 * **Arrays (tarea 5, `help.*`):** un array de strings (las `actions` de
 * cada entrada de ayuda por pantalla) se aplana como si cada posición
 * fuera una clave más (`help.entidad.inicio.actions.0`,
 * `.actions.1`…) — así una traducción con menos o más acciones que las
 * otras tres rompe la comprobación de «mismas claves hoja» sin lógica
 * nueva, y cada acción individual entra en la comprobación de «ningún
 * valor vacío» igual que cualquier otra cadena.
 */
import { describe, expect, it } from "vitest";

import ca from "../../messages/ca.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import eu from "../../messages/eu.json";

type MessageTree = { [key: string]: string | readonly string[] | MessageTree };

function flatten(tree: MessageTree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        out[`${path}.${index}`] = item;
      });
    } else {
      Object.assign(out, flatten(value as MessageTree, path));
    }
  }
  return out;
}

/**
 * Nombres de los parámetros ICU de nivel superior de un mensaje
 * (`"Hola {name}"` → `["name"]`; `"{count, plural, one {# día} other {#
 * días}}"` → `["count"]`, sin fijarse en el texto de las ramas
 * `one`/`other`). Cuenta llaves para saltar de un tirón el contenido de
 * cada placeholder de nivel superior hasta su cierre, así el texto
 * interno de una rama de plural nunca se confunde con otro parámetro.
 */
function extractIcuArgs(value: string): string[] {
  const args: string[] = [];
  let i = 0;
  while (i < value.length) {
    if (value[i] === "{") {
      let nameEnd = i + 1;
      while (nameEnd < value.length && /\w/.test(value[nameEnd])) nameEnd++;
      const name = value.slice(i + 1, nameEnd);
      if (name) args.push(name);

      let depth = 1;
      let j = i + 1;
      while (j < value.length && depth > 0) {
        if (value[j] === "{") depth++;
        else if (value[j] === "}") depth--;
        j++;
      }
      i = j;
    } else {
      i++;
    }
  }
  return args.sort();
}

const CATALOGS: Record<string, MessageTree> = { en, es, eu, ca };

describe("paridad de catálogos (en/es/eu/ca)", () => {
  const flattened = Object.fromEntries(
    Object.entries(CATALOGS).map(([lang, tree]) => [lang, flatten(tree)]),
  );

  it("las cuatro tienen exactamente las mismas claves hoja", () => {
    const referenceKeys = Object.keys(flattened.en).sort();
    expect(referenceKeys.length).toBeGreaterThan(0);

    for (const lang of Object.keys(CATALOGS)) {
      expect(Object.keys(flattened[lang]).sort(), `claves de ${lang}`).toEqual(referenceKeys);
    }
  });

  it("ningún valor está vacío", () => {
    for (const [lang, messages] of Object.entries(flattened)) {
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim(), `${lang}.${key} está vacío`).not.toBe("");
      }
    }
  });

  it("los mismos parámetros ICU por clave en los cuatro idiomas", () => {
    const referenceKeys = Object.keys(flattened.en);

    for (const key of referenceKeys) {
      const argsByLang = Object.entries(flattened).map(
        ([lang, messages]) => [lang, extractIcuArgs(messages[key])] as const,
      );
      const [, referenceArgs] = argsByLang[0];
      for (const [lang, args] of argsByLang) {
        expect(args, `parámetros de "${key}" en ${lang}`).toEqual(referenceArgs);
      }
    }
  });

  /**
   * I5 de la revisión final de la rama: `messages/eu.json` usaba la
   * palabra castellana «pendiente»/«pendienteak» en 11 claves («Abisu
   * pendienteak», «Gonbidatua (pendiente)»…) en vez del batua «zain».
   * Guarda de regresión léxica, no de estructura — el resto del test de
   * este fichero no mira el contenido de las cadenas, solo su forma.
   */
  it("eu no usa el castellanismo «pendiente» (I5)", () => {
    const values = Object.values(flattened.eu);
    const withPendiente = values.filter((value) => /pendient/i.test(value));
    expect(withPendiente).toEqual([]);
  });

  /**
   * M7 de la revisión final de la rama: `ca.json` mezclaba «tauler» (11
   * claves) y «panell» (8 claves) para *panel* — el glosario
   * (`docs/i18n/glosario.md`) fija «tauler», que es el término que usa
   * el texto legal (`accessibility.*`).
   */
  it("ca no mezcla «panell» y «tauler» para «panel» (M7)", () => {
    const values = Object.values(flattened.ca);
    const withPanell = values.filter((value) => /\bpanell\b/i.test(value));
    expect(withPanell).toEqual([]);
  });

  /**
   * M9 de la revisión final de la rama:
   * `accessibility.nonAccessible.list` en catalán decía «Informes» para
   * tres conceptos distintos — la cola de moderación (dos veces) y la
   * exportación de métricas (una vez) — cuando el propio glosario
   * distingue los dos («Informes (moderació)» en `menu.entidad.reportes`
   * frente a «Informes» a secas en `menu.entidad.informes`). Las dos
   * ocurrencias de moderación pasan a llevar el mismo calificador; la de
   * exportación (paraguas) se queda como estaba.
   */
  it("ca distingue Reportes (moderación) de Informes (exportación) en la declaración de accesibilidad (M9)", () => {
    const list = flattened.ca["accessibility.nonAccessible.list"];
    expect((list.match(/Informes \(moderació\)/g) ?? []).length).toBe(2);
    expect(list).toContain("Informes del tauler d'entitat paraigua");
  });

  /**
   * M16 de la revisión final de la rama: las siete cabeceras del CSV de
   * Auditoría son identificadores del contrato, no prosa —
   * `docs/i18n/PENDIENTES.md` dice que se mantienen iguales en los
   * cuatro idiomas a propósito, para que un traductor que abra `ca.json`
   * no las «corrija». Sin este test, nada más lo garantiza.
   */
  /**
   * M18 de la revisión final de la rama: las ramas `one` de tres
   * plurales en euskera posponían el numeral («galdera #», que se lee
   * «galdera 1»), imitando «galdera bat» pero sin ser lo que se escribe
   * con cifra — el resto del catálogo eu (p. ej. `# kide`) sí antepone
   * el numeral en las dos ramas.
   */
  it("eu antepone el numeral en todas las ramas de sus plurales (M18)", () => {
    // Recorre todo el catálogo eu, no solo las tres claves de la revisión:
    // la re-revisión encontró el mismo patrón en otras siete (`hartzaile #`,
    // `erakunde #`, `Pertsona #-i`…). Cualquier rama `one`/`other` con una
    // `#` final o con sufijo pegado («galdera 1», «#-i») falla.
    const checked: string[] = [];
    for (const [key, value] of Object.entries(flattened.eu)) {
      if (!value.includes("plural,")) continue;
      for (const branch of value.matchAll(/\b(?:one|other) \{([^}]*)\}/g)) {
        checked.push(key);
        // Un «#» tiene que ir seguido del sustantivo («# hartzaile»); si va
        // al final de la rama o pegado a un sufijo («hartzaile #», «#-i»)
        // es que el numeral se ha pospuesto.
        expect(
          /#(?! [A-Za-zñÑ])/.test(branch[1]),
          `${key}: "${branch[1]}" pospone el numeral`,
        ).toBe(false);
      }
    }
    expect(checked).toContain("entidad.encuestas.questionCount");
    expect(checked).toContain("entidad.familias.announcementSentOn");
  });

  it("las cabeceras del CSV de Auditoría valen lo mismo en los cuatro idiomas (M16)", () => {
    const csvKeys = [
      "plataforma.auditoria.csvId",
      "plataforma.auditoria.csvActor",
      "plataforma.auditoria.csvAction",
      "plataforma.auditoria.csvTargetType",
      "plataforma.auditoria.csvTargetId",
      "plataforma.auditoria.csvMetadata",
      "plataforma.auditoria.csvCreatedAt",
    ];

    for (const key of csvKeys) {
      const valuesByLang = Object.entries(flattened).map(([lang, messages]) => [lang, messages[key]] as const);
      const [, referenceValue] = valuesByLang[0];
      expect(referenceValue, `${key} no debería estar vacío`).toBeTruthy();
      for (const [lang, value] of valuesByLang) {
        expect(value, `${key} en ${lang}`).toBe(referenceValue);
      }
    }
  });
});
