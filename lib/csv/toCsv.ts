/**
 * Serialización a CSV de las exportaciones que arma el propio panel en
 * el cliente (hoy solo `components/plataforma/AuditoriaPanel.tsx`; las
 * exportaciones de informes las genera el backend, `hooks/useExport.ts`).
 *
 * Dos reglas, las dos con motivo:
 *
 * 1. **Toda celda va entrecomillada** y con las comillas internas
 *    duplicadas (RFC 4180), así el separador `;`, los saltos de línea y
 *    las comillas de un `metadata` cualquiera no parten la fila.
 * 2. **Inyección de fórmulas** (CSV injection): una celda que empieza por
 *    `=`, `+`, `-`, `@`, tabulador o retorno de carro la interpreta como
 *    fórmula la hoja de cálculo que abra el fichero, no este panel — y
 *    su contenido lo escribe quien genera las acciones auditadas, no
 *    nosotros. Se antepone un apóstrofo, que las hojas de cálculo tratan
 *    como «esto es texto» y no muestran como parte del valor.
 *
 * El separador es `;` (no `,`) y el fichero lleva BOM: es lo que espera
 * un Excel en configuración regional española, igual que las
 * exportaciones del backend.
 */

/** Caracteres con los que una hoja de cálculo empieza a leer una fórmula. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

const SEPARATOR = ";";

const BOM = "﻿";

export type CsvValue = string | number | boolean | null | undefined;

/** Una celda ya escapada, lista para concatenar (comillas incluidas). */
export function csvCell(value: CsvValue): string {
  const text = value == null ? "" : String(value);
  const safe = FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix)) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Filas de celdas → texto CSV (sin BOM: lo añade `csvBlob`). */
export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return rows.map((row) => row.map(csvCell).join(SEPARATOR)).join("\n");
}

/** El mismo CSV como `Blob` con BOM, listo para `triggerDownload`. */
export function csvBlob(rows: readonly (readonly CsvValue[])[]): Blob {
  return new Blob([`${BOM}${toCsv(rows)}`], { type: "text/csv;charset=utf-8" });
}
