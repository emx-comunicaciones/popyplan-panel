import { useTranslations } from "next-intl";

import { Table, type TableColumn } from "@/components/ui/Table";
import type { ByPlaceRow } from "@/lib/api/types";
import { formatCount } from "@/lib/metrics/format";

export interface MetricsTableProps {
  caption: string;
  rows: ByPlaceRow[];
  /** Cabecera de la columna con el nombre («Municipio», «Entidad»…). */
  nameHeader: string;
  /**
   * Cabecera de la columna con el código (`key`, p. ej. INE): se omite
   * la columna si no se pasa (la tabla «Por entidad» no tiene un código
   * legible que mostrar, solo un id interno).
   */
  codeHeader?: string;
  /**
   * Con las dos props, la tabla añade al final una columna de acciones
   * con un botón por fila. Es lo que hace que el mapa de Territorio no
   * tenga ninguna acción exclusiva: pulsar una burbuja y pulsar este
   * botón abren la misma ficha, y este sí es alcanzable con el teclado.
   * Sin ellas, la tabla se comporta exactamente como antes (así la usan
   * los dos dashboards de paraguas y plataforma).
   */
  onSelectRow?: (key: string) => void;
  selectRowLabel?: string;
}

/**
 * Tabla genérica para las filas de `by_place` (`docs/PANEL.md` §1.4):
 * sirve tanto para «Por municipio» (`group_by=place`, con código INE)
 * como para «Por entidad» (`group_by=organization`). `people` respeta la
 * regla de supresión (`<5` cuando `row.suppressed`); `events` nunca se
 * suprime.
 */
export function MetricsTable({
  caption,
  rows,
  nameHeader,
  codeHeader,
  onSelectRow,
  selectRowLabel,
}: MetricsTableProps) {
  const t = useTranslations("metrics.table");
  const tCommon = useTranslations("common");
  const columns: TableColumn<ByPlaceRow>[] = [
    { key: "label", header: nameHeader, render: (row) => row.label },
    ...(codeHeader
      ? [{ key: "key", header: codeHeader, render: (row: ByPlaceRow) => row.key }]
      : []),
    { key: "events", header: t("eventsHeader"), render: (row) => formatCount(row.events, false) },
    { key: "people", header: t("peopleHeader"), render: (row) => formatCount(row.people, row.suppressed) },
    ...(onSelectRow && selectRowLabel
      ? [
          {
            key: "actions",
            // Cabecera solo para lectores de pantalla: una `<th>` vacía
            // incumple `empty-table-header` de axe (hallazgo B27).
            header: <span className="sr-only">{tCommon("actions")}</span>,
            render: (row: ByPlaceRow) => (
              <button
                type="button"
                onClick={() => onSelectRow(row.key)}
                className="text-primary-700 underline focus-visible:outline-primary-700"
              >
                {selectRowLabel}
              </button>
            ),
          },
        ]
      : []),
  ];

  return <Table caption={caption} columns={columns} rows={rows} getRowKey={(row) => row.key} />;
}
