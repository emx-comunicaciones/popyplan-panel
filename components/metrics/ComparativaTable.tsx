import { useTranslations } from "next-intl";

import { Table, type TableColumn } from "@/components/ui/Table";
import type { CompareResponse, CompareRow } from "@/lib/api/types";
import {
  formatDeltaCount,
  formatDeltaPct,
  groupByLabelKey,
  previousPeriodLabel,
} from "@/lib/metrics/compare";
import { formatCount, formatPct } from "@/lib/metrics/format";

export interface ComparativaTableProps {
  data: CompareResponse;
}

/**
 * Celda de `delta` (`docs/PANEL.md` §11.3): «—» accesible cuando la
 * fila está suprimida (`row.delta.suppressed`, el «o» de los dos
 * periodos), el valor real con signo si no. El guion va en un
 * `role="img"` con `aria-label`: un `aria-label` sobre un `<span>` sin
 * rol cuelga de un elemento genérico y los lectores de pantalla no
 * tienen por qué anunciarlo (la especificación ARIA no permite nombrar
 * un rol genérico), así que el motivo de la ausencia se perdía. A
 * diferencia de `current`/`previous` (que reutilizan `formatCount`/
 * `formatPct` y pintan «<5»), una diferencia suprimida nunca es «<5»:
 * no hay una cifra parcial que mostrar, es directamente «no disponible».
 */
function DeltaCell({
  value,
  suppressed,
  format,
  notAvailableLabel,
}: {
  value: number | null;
  suppressed: boolean;
  format: (value: number | null, suppressed: boolean) => string;
  notAvailableLabel: string;
}) {
  if (suppressed) {
    return (
      <span role="img" aria-label={notAvailableLabel}>
        —
      </span>
    );
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
  const t = useTranslations();
  const notAvailableLabel = t("metrics.comparativa.notAvailable");
  // `metrics.groupBy.*` guarda la forma capitalizada (encabezados de
  // columna, opciones de `<select>`); dentro de la frase «Comparativa
  // por…» va en minúscula, igual que el texto original
  // (`GROUP_BY_LABELS` tenía sus cuatro valores ya en minúscula) — se
  // pasa por `toLowerCase()` en vez de duplicar la clave en el catálogo.
  const groupByKey = groupByLabelKey(data.group_by);
  const groupByName = groupByKey ? t(groupByKey).toLowerCase() : data.group_by;

  const columns: TableColumn<CompareRow>[] = [
    { key: "label", header: t("metrics.comparativa.scope"), render: (row) => row.label },
    {
      key: "events-current",
      header: t("metrics.comparativa.eventsCurrent"),
      render: (row) => formatCount(row.current.events, false),
    },
    {
      key: "events-previous",
      header: t("metrics.comparativa.eventsPrevious"),
      render: (row) => formatCount(row.previous.events, false),
    },
    {
      key: "events-delta",
      header: t("metrics.comparativa.eventsDelta"),
      render: (row) => formatDeltaCount(row.delta.events, false),
    },
    {
      key: "people-current",
      header: t("metrics.comparativa.peopleCurrent"),
      render: (row) => formatCount(row.current.people, row.current.suppressed),
    },
    {
      key: "people-previous",
      header: t("metrics.comparativa.peoplePrevious"),
      render: (row) => formatCount(row.previous.people, row.previous.suppressed),
    },
    {
      key: "people-delta",
      header: t("metrics.comparativa.peopleDelta"),
      render: (row) => (
        <DeltaCell
          value={row.delta.people}
          suppressed={row.delta.suppressed}
          format={formatDeltaCount}
          notAvailableLabel={notAvailableLabel}
        />
      ),
    },
    {
      key: "attendance-current",
      header: t("metrics.comparativa.attendanceCurrent"),
      render: (row) => formatPct(row.current.attendance_rate, row.current.suppressed),
    },
    {
      key: "attendance-previous",
      header: t("metrics.comparativa.attendancePrevious"),
      render: (row) => formatPct(row.previous.attendance_rate, row.previous.suppressed),
    },
    {
      key: "attendance-delta",
      header: t("metrics.comparativa.attendanceDelta"),
      render: (row) => (
        <DeltaCell
          value={row.delta.attendance_rate}
          suppressed={row.delta.suppressed}
          format={formatDeltaPct}
          notAvailableLabel={notAvailableLabel}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-secondary">
        {previousPeriodLabel(data.previous, t("metrics.comparativa.previousPeriodPrefix"))}
      </p>
      <Table
        caption={t("metrics.comparativa.captionPrefix", { groupBy: groupByName })}
        columns={columns}
        rows={data.rows}
        getRowKey={(row) => row.key}
      />
    </div>
  );
}
