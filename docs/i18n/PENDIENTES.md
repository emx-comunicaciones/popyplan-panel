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
- **`lib/reports/labels.ts` con cuatro funciones a la vez** — **cerrado
  en la Tarea 5**: `ReportesQueuePlataforma.tsx` ya usa
  `reasonLabelKey`/`statusLabelKey`; `reasonLabel`/`statusLabel`
  (`REASON_LABELS`/`STATUS_LABELS`) se borraron con sus tests al
  quedarse sin consumidor.

La Tarea 5 anota dos puntos, ninguno de redacción en español:

- **Cabeceras del CSV de Auditoría** (`plataforma.auditoria.csv{Id,Actor,
  Action,TargetType,TargetId,Metadata,CreatedAt}`, `AuditoriaPanel::downloadCsv`):
  se mantienen **iguales en los cuatro idiomas a propósito** — son
  identificadores técnicos del contrato (`id`, `actor`, `action`,
  `target_type`, `target_id`, `metadata`, `created_at`), no prosa de
  interfaz, y alguien podría reimportar ese CSV en una hoja de cálculo o
  un script esperando esos nombres de columna. Pasan por el catálogo (y
  por `t()` en el momento de la llamada, como pide el brief) para que la
  cabecera siga siendo una única fuente junto al resto de textos de la
  pantalla, pero su valor no cambia entre `en`/`es`/`eu`/`ca`.
- **`CONTRACT_STATUS_LABEL_KEYS`/`INVOICE_STATUS_LABEL_KEYS` en
  `EntidadDetail.tsx`** siguen tipados como `Record<string, string>`
  (no `Record<ContractStatus, string>`/`Record<InvoiceStatus, string>`),
  igual que las constantes de texto que sustituyen: es defensa contra un
  valor que el backend añadiera y el panel no conociera todavía (antes
  se pintaba el valor crudo sin traducir; ahora cae a la clave de
  «Borrador», que es una aproximación, no una traducción de ese valor
  nuevo). No es una redacción pendiente — es el mismo comportamiento
  defensivo que ya tenía el código en español, documentado aquí porque
  el `??` ya no cae a un valor crudo sino a una clave fija.
