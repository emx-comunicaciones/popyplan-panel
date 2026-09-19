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
}

/**
 * Tabla genérica para las filas de `by_place` (`docs/PANEL.md` §1.4):
 * sirve tanto para «Por municipio» (`group_by=place`, con código INE)
 * como para «Por entidad» (`group_by=organization`). `people` respeta la
 * regla de supresión (`<5` cuando `row.suppressed`); `events` nunca se
 * suprime.
 */
export function MetricsTable({ caption, rows, nameHeader, codeHeader }: MetricsTableProps) {
  const t = useTranslations("metrics.table");
  const columns: TableColumn<ByPlaceRow>[] = [
    { key: "label", header: nameHeader, render: (row) => row.label },
    ...(codeHeader
      ? [{ key: "key", header: codeHeader, render: (row: ByPlaceRow) => row.key }]
      : []),
    { key: "events", header: t("eventsHeader"), render: (row) => formatCount(row.events, false) },
    { key: "people", header: t("peopleHeader"), render: (row) => formatCount(row.people, row.suppressed) },
  ];

  return <Table caption={caption} columns={columns} rows={rows} getRowKey={(row) => row.key} />;
}
