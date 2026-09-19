/**
 * Formateo de las celdas de `docs/PANEL.md` §1.4/§1.5. Regla de
 * supresión (documentada también en `CLAUDE.md`): una celda que cuenta
 * personas distintas llega como `value: null, suppressed: true` cuando
 * el ámbito de agregación tiene menos de `PANEL_MIN_GROUP_SIZE` (5)
 * personas; el panel nunca la pinta como `0` ni en blanco — siempre
 * `<5`, para no sugerir que no hay datos. `formatCount`/`formatPct`
 * concentran esa regla en un solo sitio: los componentes de
 * `components/metrics/*` nunca deciden por sí mismos si algo está
 * suprimido, solo pintan la cadena que estas funciones ya han resuelto.
 *
 * **Fix de carry-over (tarea W6, hallazgo documentado por la tarea
 * W3):** el esquema (`docs/PANEL.md` §1.5) lleva un único `suppressed`
 * por *sección* (`people.suppressed`, `attendance.suppressed`…), no uno
 * por celda — es el «o» de las celdas suprimibles de esa sección. Con
 * una combinación real de celdas mixtas (p. ej. `attendance.attended: 8`
 * visible junto a `attendance.registered: null` suprimido en la misma
 * respuesta, ver el ejemplo de `docs/PANEL.md` §1.4), pasar el
 * `suppressed` de la sección a **todas** sus celdas pintaba «<5» hasta
 * en la que sí tenía valor. La regla correcta: una celda solo es «<5»
 * cuando su **propio valor** llega `null` (nunca cuando solo `value` es
 * `null` porque no hay denominador, como `attendance.rate` sin
 * registros) *y* la sección está marcada `suppressed`; con `value` no
 * nulo, se pinta el valor real sea cual sea el `suppressed` de la
 * sección.
 *
 * **Idioma del formateador (spec de diseño `2026-09-19-i18n-es-eu-ca`,
 * decisión 4):** el locale de `Intl.NumberFormat` sale de
 * `lib/i18n/locale.ts::activeLanguage`/`localeFor` en vez de fijarse a
 * `es-ES`, con un formateador por idioma cacheado en un `Map` (se
 * construye una sola vez cada uno). El comportamiento visible no
 * cambia — `es-ES`, `eu-ES` y `ca-ES` usan el mismo separador de
 * millares (`.`) y decimal (`,`), comprobado antes de escribir este
 * módulo — pero así el idioma correcto queda cableado por si algún día
 * alguno de los tres divergiera.
 */
import { activeLanguage, localeFor } from "@/lib/i18n/locale";

const integerFormatters = new Map<string, Intl.NumberFormat>();
function integerFormatter(): Intl.NumberFormat {
  const locale = localeFor(activeLanguage());
  let formatter = integerFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
      useGrouping: "always",
    });
    integerFormatters.set(locale, formatter);
  }
  return formatter;
}

const percentFormatters = new Map<string, Intl.NumberFormat>();
function percentFormatter(): Intl.NumberFormat {
  const locale = localeFor(activeLanguage());
  let formatter = percentFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    percentFormatters.set(locale, formatter);
  }
  return formatter;
}

/**
 * `formatCount(1284) → '1.284'`; `formatCount(null, true) → '<5'`;
 * `formatCount(8, true) → '8'` (la propia celda no está suprimida,
 * aunque la sección sí lo esté por otra celda hermana — ver el fix de
 * arriba).
 */
export function formatCount(value: number | null, suppressed = false): string {
  if (value === null) return suppressed ? "<5" : "—";
  return integerFormatter().format(value);
}

/** `formatPct(0.75) → '75,0 %'`; `formatPct(null, true) → '<5'`. */
export function formatPct(value: number | null, suppressed = false): string {
  if (value === null) return suppressed ? "<5" : "—";
  return `${percentFormatter().format(value * 100)} %`;
}
