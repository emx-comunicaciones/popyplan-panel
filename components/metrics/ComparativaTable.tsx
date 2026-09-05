import { Table, type TableColumn } from "@/components/ui/Table";
import type { CompareResponse, CompareRow } from "@/lib/api/types";
import { formatDeltaCount, formatDeltaPct, groupByLabel, previousPeriodLabel } from "@/lib/metrics/compare";
import { formatCount, formatPct } from "@/lib/metrics/format";

export interface ComparativaTableProps {
  data: CompareResponse;
}

const NOT_AVAILABLE_LABEL = "No disponible por umbral de agregación";

/**
 * Celda de `delta` (`docs/PANEL.md` §11.3): «—» accesible (con
 * `aria-label`) cuando la fila está suprimida (`row.delta.suppressed`,
 * el «o» de los dos periodos), el valor real con signo si no. A
 * diferencia de `current`/`previous` (que reutilizan `formatCount`/
 * `formatPct` y pintan «<5»), una diferencia suprimida nunca es «<5»:
 * no hay una cifra parcial que mostrar, es directamente «no disponible».
 */
function DeltaCell({
  value,
  suppressed,
  format,
}: {
  value: number | null;
  suppressed: boolean;
  format: (value: number | null, suppressed: boolean) => string;
}) {
  if (suppressed) {
    return <span aria-label={NOT_AVAILABLE_LABEL}>—</span>;
  }
  return <>{format(value, false)}</>;
}

/**
 * Tabla de la comparativa entre ámbitos (`docs/PANEL.md` §11): una fila
 * por clave de desglose (comarca/entidad/municipio/provincia según la
 * ruta), con Actividades/Personas/% asistencia en tres columnas cada una
 * (actual, anterior, Δ). `delta.events` nunca se suprime (los eventos no
 * cuentan personas); `delta.people`/`delta.attendance_rate` sí, ver
 * `DeltaCell` arriba.
 */
export function ComparativaTable({ data }: ComparativaTableProps) {
  const columns: TableColumn<CompareRow>[] = [
    { key: "label", header: "Ámbito", render: (row) => row.label },
    {
      key: "events-current",
      header: "Actividades (actual)",
      render: (row) => formatCount(row.current.events, false),
    },
    {
      key: "events-previous",
      header: "Actividades (anterior)",
      render: (row) => formatCount(row.previous.events, false),
    },
    {
      key: "events-delta",
      header: "Actividades (Δ)",
      render: (row) => formatDeltaCount(row.delta.events, false),
    },
    {
      key: "people-current",
      header: "Personas (actual)",
      render: (row) => formatCount(row.current.people, row.current.suppressed),
    },
    {
      key: "people-previous",
      header: "Personas (anterior)",
      render: (row) => formatCount(row.previous.people, row.previous.suppressed),
    },
    {
      key: "people-delta",
      header: "Personas (Δ)",
      render: (row) => (
        <DeltaCell value={row.delta.people} suppressed={row.delta.suppressed} format={formatDeltaCount} />
      ),
    },
    {
      key: "attendance-current",
      header: "% asistencia (actual)",
      render: (row) => formatPct(row.current.attendance_rate, row.current.suppressed),
    },
    {
      key: "attendance-previous",
      header: "% asistencia (anterior)",
      render: (row) => formatPct(row.previous.attendance_rate, row.previous.suppressed),
    },
    {
      key: "attendance-delta",
      header: "% asistencia (Δ)",
      render: (row) => (
        <DeltaCell
          value={row.delta.attendance_rate}
          suppressed={row.delta.suppressed}
          format={formatDeltaPct}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-secondary">{previousPeriodLabel(data.previous)}</p>
      <Table
        caption={`Comparativa por ${groupByLabel(data.group_by)}`}
        columns={columns}
        rows={data.rows}
        getRowKey={(row) => row.key}
      />
    </div>
  );
}
