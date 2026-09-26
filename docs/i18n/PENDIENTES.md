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

La Tarea 6 (cierre) anota tres puntos, ninguno de redacción en español:

- **`eslint.config.mjs::react/jsx-no-literals` con `ignoreProps: true`,
  no `false`** (la nota de la propia tarea pedía `false`): probado tal
  cual sobre `app/**`/`components/**`, `ignoreProps: false` marca
  **cualquier** valor de atributo JSX literal sin distinguir texto de
  interfaz de marcado técnico — 1835 errores, la inmensa mayoría
  `className`. El código de la regla
  (`eslint-plugin-react/lib/rules/jsx-no-literals.js`, visitor
  `JSXAttribute`) no tiene forma de acotar por nombre de atributo, así
  que no hay una lista de `allowedStrings` razonable que lo arregle. Con
  `ignoreProps: true` la regla sigue marcando lo que de verdad importa
  para esta tarea (un literal como **hijo** de un elemento JSX, el caso
  real que «impide literales nuevos» pretende impedir) y deja en paz los
  atributos; el resultado (10 literales reales en todo `app/`+
  `components/`) confirma que las tareas 2-5 ya habían extraído
  prácticamente todo — nada de esto es una redacción pendiente, es una
  decisión de configuración de la herramienta, documentada también en
  `eslint.config.mjs` con el conteo exacto. **Cerrado en la ronda final
  de correcciones** (hallazgo I4 de `final-review-report.md`): con
  `ignoreProps: true`, un `aria-label`/`placeholder`/`title`/`alt` sin
  traducir en una pantalla nueva no habría saltado en el lint (los
  atributos quedaban sin blindar, solo el contenido como hijo de un
  elemento JSX). `eslint.config.mjs::no-restricted-syntax` añade esa
  guarda acotada a los cinco atributos que llevan texto de interfaz, sin
  reabrir los 1835 falsos positivos de `ignoreProps: false` — ya no
  queda ningún atributo de texto sin blindar. **Límite conocido de la
  guarda**: el selector solo casa con un `Literal` hijo directo del
  atributo, así que un texto movido a una constante y pasado como
  `placeholder={CONSTANTE}` se le escapa (así es como
  `AuditoriaPanel.tsx` pasa sus dos ejemplos técnicos a propósito). No
  es hermética contra un literal sin traducir aliado en una `const`; la
  red para eso sigue siendo la revisión.
- **`app/entidad/[slug]/informes/page.tsx` con dos literales sin
  extraer** (`"Sin acceso"`/`"Tu rol no tiene acceso a Informes."`/
  `"Informes"`): la única extracción de contenido real que hizo falta
  para llegar a 0 errores con la regla activa — ni la Tarea 2 (páginas
  sueltas) ni ninguna posterior había tocado este fichero, a diferencia
  de su gemelo `app/paraguas/[slug]/informes/page.tsx`, que sí estaba
  traducido. Corregido reusando literalmente las claves de
  `paraguas.informes` en un `entidad.informes` nuevo (mismo texto exacto
  en español, `eu` y `ca`), sin inventar redacción nueva.
- **`components/layout/LanguageSwitcher.tsx` sin catálogo propio**: sus
  tres botones («ES»/«EU»/«CA») y sus `aria-label` (nombre completo del
  idioma) reutilizan `language.*`, ya traducido en la Tarea 1 — el
  código en mayúsculas del botón (`lang.toUpperCase()`) no es una cadena
  de catálogo, es la propia clave del idioma (`es`/`eu`/`ca`)
  transformada en JavaScript, igual en los tres idiomas de interfaz por
  ser un código ISO, no una palabra.

## Ronda final de correcciones (revisión de `feature/i18n-es-eu-ca`)

Aparcado a propósito por `final-fix-brief.md` (no es redacción en
español, y no se toca en esta ronda):

- **Tamaño del catálogo que viaja al cliente (M3 de `final-review-report.md`)**:
  `app/layout.tsx` serializa el catálogo entero (`getMessages()` +
  `NextIntlClientProvider messages={messages}`) en el payload RSC de
  **todas** las rutas — unos 80 KB (~19 KB gzip) por `messages/<locale>.json`.
  El namespace `help.*` (203 cadenas del registro de ayuda por pantalla,
  `lib/help/pageHelp.ts`) es solo el ~40 % de ese fichero y solo hace
  falta cuando alguien abre el diálogo de `PageHelp.tsx`. Arreglo
  propuesto (no aplicado aquí, es arquitectónico): pasar un subconjunto
  con `pick` de next-intl (todo menos `help`) y montar `help` en un
  `NextIntlClientProvider` anidado dentro de `PageHelp`, o cargarlo con
  `import()` al abrir el diálogo.
- **E2E del idioma de la cuenta distinto del navegador (M11 de
  `final-review-report.md`)**: `e2e/idioma.spec.ts` resetea
  `preferred_language` a `""` antes de cada ejecución (necesario para que
  el spec sea determinista contra un backend local que persiste entre
  ejecuciones), así que la rama real de la decisión 2 del diseño («el
  idioma de la cuenta manda al entrar, aunque el selector de `/login`
  acabe de marcar otro justo antes de enviar el formulario») está
  cubierta a nivel unidad (`app/(auth)/login/page.test.tsx`,
  `app/providers.test.tsx`) pero **nunca** se ejercita de extremo a
  extremo contra Next. Caso pendiente para quien retome el e2e: dejar
  `preferred_language: "ca"` en un segundo caso del spec y comprobar que,
  tras entrar con el navegador en otro idioma, `html[lang="ca"]` gana —
  o, más robusto, sustituir la combinación `router.refresh()` +
  `router.replace()` de `LoginForm.tsx` por `window.location.assign(...)`
  cuando el idioma de la cuenta difiere del recién elegido, que garantiza
  un documento nuevo en vez de depender del orden de asentamiento de las
  dos llamadas de Next. No se ha tocado el e2e en esta ronda (fuera de
  alcance: la tarea solo permite lectura/documentación del hueco, no
  ejecutar `npm run e2e`).
- **Contenido nuevo de la ayuda por pantalla (tarea «ayuda ampliada»)**:
  las secciones `details`/`tips`/`related` añadidas a las 34 entradas de
  `help.*` (y los summaries/actions reescritos donde eran pobres) fueron
  redactadas en `en` (fuente) y traducidas a `es`/`eu`/`ca` de forma
  asistida. El `es` recibió pasada de revisión; el `eu` y el `ca` siguen
  el glosario y las guardas léxicas de `lib/i18n/messages.test.ts`, pero
  **merecen una revisión nativa** (registro, matices de tuteo y
  terminología de acompañamiento en adicciones) antes de darlas por
  cerradas.
- **Admin de plataforma, bloque 1 (usuarios y bloqueos, 2026-09-26)**:
  las claves nuevas de `menu.plataforma.{usuarios,bloqueos}`,
  `pages.plataforma.{usuarios,usuarioFicha,bloqueos}`,
  `plataforma.{usuarios,usuarioFicha,bloqueos}.*`,
  `errors.{platformUsers,platformProfile,platformUserMutation,blocksAdmin}.*`
  y `help.plataforma.{usuarios,usuarioFicha,bloqueos}.*` se escribieron en
  `es` y `en` y se tradujeron a `eu`/`ca` de forma asistida («tauler»
  para *panel* en catalán, como fija el glosario). **Pendientes de
  revisión nativa**, igual que la ayuda ampliada. Dudas concretas: en
  euskera, «Baliogabetu» para *revocar* un bloqueo y «Erabiltzaileak»
  en el menú frente a «Kontuak» en el título de la página (el castellano
  hace la misma distinción, «Usuarios»/«Cuentas», a propósito).
- **Admin de plataforma, bloque 3 (el resto del admin antiguo,
  2026-09-26)**: las claves nuevas de
  `menu.plataforma.{comunidades,actividades,resenas,chats,notificaciones,nomencladores}`,
  `pages.plataforma.{comunidades,comunidadFicha,actividades,resenas,chats,chatFicha,notificaciones,nomencladores}`,
  sus `plataforma.*`, sus `errors.*` y sus `help.plataforma.*` se
  escribieron en `es`/`en` y se tradujeron a `eu`/`ca` de forma asistida.
  **Pendientes de revisión nativa.** Dudas concretas: «Nomencladores»
  (término de backoffice) como «Katalogoak»/«Nomenclàtors», e «Iritziak»
  para *reseñas* en euskera; los nombres de los tipos de notificación
  (`notification_type`) y de las categorías de actividad
  (`category_type`), que son etiquetas de un contrato técnico.
- **Admin de plataforma, bloque 2 (búsqueda del tesoro, 2026-09-26)**:
  las claves nuevas de `menu.plataforma.buscaDelTesoro`,
  `pages.plataforma.{tesoro,tesoroFicha}`,
  `plataforma.{tesoro,tesoroFicha}.*`, `errors.treasureHunt.*` y
  `help.plataforma.{tesoro,tesoroFicha}.*` se escribieron en `es` y `en`
  y se tradujeron a `eu`/`ca` de forma asistida. **Pendientes de revisión
  nativa.** Dudas concretas: el nombre del juego —«Altxorraren bila» en
  euskera y «Caça del tresor» en catalán—, «Baliozkotzeak» para
  *validaciones* y «Sailkapena»/«Classificació» para *ranking*.
- **Entrenamiento (catálogo en Nomencladores y nivel de actividad,
  2026-09-26)**: las claves nuevas de `plataforma.nomencladores.training.*`,
  `plataforma.nomencladores.groups.*`, `errors.trainingCatalog.*`,
  `events.levels.*`, `entidad.actividadForm.levelLabel`,
  `plataforma.actividades.levelHeader` y las ampliaciones de
  `help.plataforma.nomencladores`/`help.entidad.actividades` se escribieron
  en `es`/`en`. En `eu`/`ca`, los tipos de medida, métricas, grupos
  musculares y niveles se copiaron del `.po` del backend (ya revisados
  allí); el resto es traducción asistida. **Pendientes de revisión
  nativa.** Dudas concretas: «Neurketa mota»/«Tipus de mesura» para *tipo
  de medida*, «Core-a» en euskera y el orden «{n}. ariketa» en las
  etiquetas de cada ejercicio de plantilla.
- **Programa de seguimiento (2026-09-26)**: las claves nuevas de
  `menu.entidad.seguimiento`, `pages.entidad.seguimiento`, `tracking.*`,
  `entidad.seguimiento.*`, `plataforma.entidadFicha.tracking*`,
  `errors.{enrollments,enrollmentMutation,sharedTracking,proposeGoal,setTrackingProgram}.*`,
  `help.entidad.seguimiento.*` y la frase añadida a
  `help.entidad.personaFicha.details` se escribieron en `es`/`en` y se
  tradujeron a `eu`/`ca` de forma asistida. **Pendientes de revisión
  nativa** (y del texto de datos de salud, que revisará un abogado antes de
  producción). Dudas concretas: «Jarraipen-programa» / «Programa de
  seguiment», «Kontsumitzeko gogoa» / «Ganes de consumir» para las ganas,
  y las casillas del check-in en tercera persona («Ondo lo egin zuen»,
  «Va quedar amb algú»); conviene alinearlas con los textos de la app.
