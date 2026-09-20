import type { ReactNode } from "react";

export interface TableColumn<Row> {
  key: string;
  /**
   * Cabecera de la columna. `ReactNode` (no `string`) para poder pasar
   * un `<span className="sr-only">` en las columnas que no enseñan
   * título —una de acciones o de enlace al detalle—: una `<th>` vacía
   * incumple la regla `empty-table-header` de `axe-core`.
   */
  header: ReactNode;
  render: (row: Row) => ReactNode;
}

export interface TableProps<Row> {
  caption: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
}

/*
 * Densidad (2026-09-20): celdas con 12px de relleno horizontal y 6px
 * vertical, texto de 13px (`text-sm`) — filas de ~31px con el borde
 * incluido, frente a los ~37px de antes. Ninguna celda es en sí un
 * objetivo interactivo: los enlaces de fila siguen siendo texto.
 */
export function Table<Row>({ caption, columns, rows, getRowKey }: TableProps<Row>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-text-secondary">
            {columns.map((column) => (
              <th key={column.key} scope="col" className="px-3 py-1.5 font-semibold">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-b border-border-light">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-1.5 text-text-base">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
