# Historial — Métricas, exportación y comparativa

> Texto trasladado tal cual desde el `CLAUDE.md` raíz (2026-09-26) para no cargarlo en cada sesión. Las referencias a «más arriba/abajo» apuntan al `CLAUDE.md` original; busca la sección en `docs/historial/`.

## Vista del financiador: métricas y exportación (tarea W2)

`GET /api/panel/{entidad,paraguas,plataforma}/*/metrics/` y
`GET /api/panel/{entidad,paraguas,plataforma}/*/export/` (`docs/PANEL.md`
§1-§2) tienen un esquema de respuesta fijo (`people`, `events`,
`attendance`, `communities`, `by_place`, `by_weekday_hour`, `series`) y
un solo `group_by` por petición: pedir a la vez «por municipio» y «por
entidad» (paraguas) requiere dos llamadas distintas
(`hooks/useMetrics.ts::useMetrics(scope, orgId, period, groupBy)`), una
por cada `group_by`, más una sin `group_by` para las tarjetas. El panel
de paraguas (`components/metrics/ParaguasMetricsDashboard.tsx`) hace
cuatro llamadas por periodo: base, `place`, `organization` y `month`. El
de plataforma (`PlataformaMetricsDashboard.tsx`) hace tres, con un
selector territorio/entidad que decide si la llamada de desglose usa
`place` u `organization`.

**Regla de renderizado de la supresión** (`PANEL_MIN_GROUP_SIZE=5`,
`docs/PANEL.md` §1.5): una celda que cuenta personas llega como
`value: null, suppressed: true` cuando el grupo tiene menos de 5
personas distintas. `lib/metrics/format.ts` (`formatCount`/`formatPct`)
es el único sitio que decide qué pintar (`'<5'` cuando `suppressed`,
`'—'` cuando `value` es `null` sin supresión, si no el valor formateado
con separador de miles/coma decimal, locale `es-ES`); los componentes de
`components/metrics/*` (`StatCard`, `MetricsTable`) siempre reciben ya
la cadena formateada, nunca deciden por sí mismos si algo está
suprimido — así la regla no se puede duplicar ni desincronizar entre
tarjetas y tablas.

Componentes compartidos: `components/metrics/{StatCard,PeriodSelector,
MetricsTable,SeriesChart,ExportButtons,ExportPanel}.tsx` (`SeriesChart`
usa `recharts`; los tests mockean `ResponsiveContainer` en
`vitest.setup.ts` porque jsdom no implementa `ResizeObserver`).
`lib/metrics/period.ts` calcula los presets (mes en curso, últimos 3/12
meses, plurianual — ver «Comparativa entre ámbitos y memoria plurianual»
más abajo) y valida `since<=until` y ≤1461 días (misma regla que el
backend, `PERIODO_MAX_DIAS`); `lib/metrics/format.ts` formatea. `hooks/useExport.ts` hace el
`fetch` del fichero a mano (no `lib/api/client.ts::apiFetch`, que
siempre espera JSON) y dispara la descarga con un `<a download>`
temporal; 503 (WeasyPrint no disponible, `docs/PANEL.md` §2.3) →
`ExportError('pdf_unavailable')`, 403 → `ExportError('forbidden')`.

Desviación conocida: el brief pedía una columna «asistencia %» en la
tabla «Por municipio», pero `ByPlaceRow` (`docs/PANEL.md` §1.4) no lleva
una tasa de asistencia por fila (solo `events`/`people`) — la tabla
muestra Municipio, Código INE, Eventos y Personas; la asistencia global
solo está en la tarjeta «Asistencia» de la sección base.

## Comparativa entre ámbitos y memoria plurianual (tarea W2, Fase 6)

`docs/PANEL.md` §11 (contrato del backend, tarea B2): `GET
/api/panel/paraguas/{org_id}/compare/?since&until&group_by=comarca|
organization|place` y `GET /api/panel/plataforma/compare/?since&until&
group_by=comarca|province|organization` comparan el periodo pedido con
el inmediatamente anterior de igual longitud. A diferencia de métricas,
aquí `group_by` es **obligatorio** (400 con `{"group_by": "Desglose
obligatorio: …"}` si falta o no es uno de los tres valores de esa ruta).

- **`hooks/useCompare.ts`** (`useCompare(scope, orgId, period, groupBy)`,
  mismo patrón que `useMetrics`): traduce 400/403 a `CompareError` con
  `kind` (`periodo_invalido`/`sin_acceso`/`desconocido`).
  `lib/api/endpoints.ts::METRICS.COMPARE_PARAGUAS(orgId)`/
  `COMPARE_PLATAFORMA()`.
- **`components/metrics/ComparativaTable.tsx`** (`<ComparativaTable
  data={CompareResponse} />`): columnas Ámbito · Actividades (actual/
  anterior/Δ) · Personas (actual/anterior/Δ) · % asistencia (actual/
  anterior/Δ), con `<caption>` («Comparativa por `<desglose>`») y la
  leyenda del periodo anterior («frente a 1 ene – 31 mar 2026»,
  `lib/metrics/compare.ts::previousPeriodLabel`). `current`/`previous`
  reutilizan `formatCount`/`formatPct` tal cual (misma «<5» que el resto
  del panel); `delta` es propio de esta tarea
  (`lib/metrics/compare.ts::formatDeltaCount`/`formatDeltaPct`, signo
  `+`/`-`) — una diferencia suprimida (`delta.suppressed`, el «o» de los
  dos periodos) se pinta «—» con `aria-label="No disponible por umbral de
  agregación"`, **nunca** «<5» (no hay una cifra parcial que enseñar,
  solo indisponibilidad; `delta.events` sí es siempre un número real, los
  eventos nunca se suprimen).
- **Dashboards** (`{Paraguas,Plataforma}MetricsDashboard.tsx`): bloque
  «Comparativa» bajo las tarjetas/tabla existentes, con un `<select>`
  (label visible «Desglose de la comparativa») para elegir el desglose —
  por defecto `comarca` en paraguas, `province` en plataforma (la
  diputación compara comarcas, la plataforma compara provincias).

**Memoria plurianual (`group_by=year`, §11.4)**: añadido a
`hooks/useMetrics.ts::MetricsGroupBy` y a `EXPORT_GROUP_BY_CHOICES` del
backend — una fila por año (`SeriesRow.year`) en vez de por mes
(`.month`) en `series`, tanto en métricas como en exportación (que además
deja vacía «Por municipio» y renombra la sección a «Por año»).
`components/metrics/SeriesChart.tsx` detecta solo mirando las propias
filas (`row.year !== undefined` en todas) y cambia su `aria-label` a
«Serie anual…»; `ExportPanel.tsx` gana un `<select>` propio («Desglose
del informe») con la opción «Por año (memoria plurianual)», que
**sustituye** (nunca combina) al `groupBy` que le pase el dashboard que
lo envuelve — el backend nunca acepta los dos desgloses a la vez.

**`PeriodPreset += "plurianual"` (actualizado en la tarea W2b, Fase 6)**:
al escribir la tarea W2 original, `panel/viewsets.py::_periodo` (backend)
aplicaba el mismo tope duro de 366 días a `since`/`until` en todas las
rutas, así que el preset «últimos 3 años naturales completos + el
actual» que pedía el brief literal era matemáticamente imposible en una
sola petición (tocar 4 años naturales exige más de 1000 días) —
`presetPeriod('plurianual')` se quedaba en los 365 días de calendario
anteriores a hoy, rozando como mucho dos años naturales. La tarea B4
(en paralelo a W2b) subió `PERIODO_MAX_DIAS` a **1461** (~4 años)
precisamente para destrabar esto; W2b actualiza `MAX_DAYS` de
`lib/metrics/period.ts` a 1461 y reescribe el preset de forma literal:
desde el 1 de enero de hace 3 años hasta hoy (`presetPeriod('plurianual')`
= `{since: 1-ene-(año actual − 3), until: hoy}`), que siempre cae dentro
del nuevo tope (como mucho ~1461 días si hoy es 31 de diciembre). Ya no
hace falta la petición fusionada por años que quedó pendiente en la
versión anterior de esta nota.
