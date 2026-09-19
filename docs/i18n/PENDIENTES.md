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

La Tarea 4 anota dos puntos, ninguno de redacción en español:

- **`errors.programReport.sesionCaducada`** (`hooks/useProgramReport.ts`,
  ampliada tras la revisión de fix round 1 de la Tarea 4): el hook
  real sigue construyendo `.message` como
  `error.message || SESSION_EXPIRED_MESSAGE` (texto potencialmente
  dinámico de la propia `ApiError`), pero ahora **sí** lleva un campo
  `detail`, poblado con `detailOf(error)` igual que el resto de ramas de
  `ProgramReportError` — `ProgramaDetalle.tsx` (vía `errorKindText`)
  prioriza ese `detail` sobre la traducción fija por `kind`, como en
  cualquier otro hook del panel. La comprobación (`hooks/
  useProgramReport.test.tsx`) confirma que en la práctica `detail` queda
  siempre `undefined` para esta rama: el cuerpo de un 401 de
  `requestWithAuth` (`lib/api/client.ts`) es siempre `null`, así que
  `detailOf` nunca encuentra nada real ahí y la traducción fija por
  `kind` (`"Tu sesión ha caducado."`, idéntica a `SESSION_EXPIRED_MESSAGE`)
  es lo que se ve siempre. El campo queda por si el contrato cambiara
  algún día a mandar un cuerpo en el 401 — no es una redacción pendiente,
  solo un caso sin ejercitar hoy.
- **`lib/reports/labels.ts` con cuatro funciones a la vez**
  (`reasonLabel`/`statusLabel` de texto, `reasonLabelKey`/`statusLabelKey`
  de clave): no es una redacción pendiente, es una convivencia temporal
  — `components/plataforma/ReportesQueuePlataforma.tsx` (tarea 5) sigue
  llamando a las de texto; cuando esa tarea traduzca esa pantalla debe
  cambiar a las de clave y las dos funciones de texto quedan sin
  consumidor (borrarlas entonces, no antes).
