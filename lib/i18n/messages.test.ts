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
 */
import { describe, expect, it } from "vitest";

import ca from "../../messages/ca.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import eu from "../../messages/eu.json";

type MessageTree = { [key: string]: string | MessageTree };

function flatten(tree: MessageTree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
    } else {
      Object.assign(out, flatten(value, path));
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
});
