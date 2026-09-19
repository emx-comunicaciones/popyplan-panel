# Pendientes de redacción (i18n)

Lista de cadenas cuya redacción en español había que revisar o mejorar,
descubiertas de paso al traducir para esta tarea, pero que no se
corrigen aquí para no mezclar una migración de infraestructura (i18n)
con un cambio de contenido (regla de la cadena fuente, `CLAUDE.md`:
«el valor de `es.json` es exactamente el literal anterior; nada se
reescribe en esta migración»).

La Tarea 1 no dejó nada pendiente aquí (ver commit de esa tarea). La
Tarea 2 anota un punto de traducción, no de redacción en español (la
regla de la cadena fuente no aplica a `eu`/`ca`, que sí son traducción
nueva de esta tarea):

- **`menu.entidad.reportes` vs. `menu.entidad.informes` en catalán**:
  el glosario (`docs/i18n/glosario.md`) distingue «reporte» (moderación,
  `safety.Report`) de «informe» (exportación de métricas) precisamente
  para que no choquen en catalán, donde los dos conceptos podrían
  traducirse igual. `menu.entidad.reportes` usa «Informes (moderació)»
  (con el calificador entre paréntesis) y `menu.entidad.informes` usa
  «Informes» a secas — visualmente parecidos en el mismo menú lateral.
  Un hablante nativo podría preferir un término más distintivo para la
  cola de moderación (p. ej. «Queixes» o «Denúncies») en vez del
  calificador entre paréntesis; se ha dejado la traducción literal del
  glosario por ahora, sin inventar un término de dominio nuevo sin que
  el propietario lo revise.
