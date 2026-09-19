# Estado de las traducciones (panel)

Borrador automático de Claude: las traducciones a euskera y catalán de
este repo se generan a partir del inglés fuente con el glosario
(`docs/i18n/glosario.md`, copia del glosario del backend) y **no las ha
revisado todavía una persona euskaldun o catalanoparlante**. Decisión
del propietario (2026-09-19): «yo revisaré las traducciones una vez
estén publicadas, tú traduce y súbelo» — por eso la integración no
espera a esa revisión. Cuando el propietario revise un catálogo, que
actualice esta tabla (fecha + `revisado`) y anote en
`docs/i18n/PENDIENTES.md` lo que haya que corregir sin bloquear lo ya
integrado.

## Catálogos

| Fecha | Tarea | Catálogo | eu | ca | Notas |
|---|---|---|---|---|---|
| 2026-09-19 | Tarea 1 (infraestructura `next-intl`, cookie de idioma, `Accept-Language`, formateadores, paridad y patrón de tests) | `messages/{es,eu,ca}.json` (`common.*`: cancelar/aceptar/cerrar/guardar/reintentar/cargando/sin acceso/volver al inicio; `language.*`: título y los tres gentilicios de idioma) | borrador sin revisar | borrador sin revisar | `es` es la traducción original, literal a los textos que ya existían en los componentes del panel antes de esta tarea (`Cancelar`, `Aceptar`, `Cerrar`, `Guardar`, `Reintentar`, `Cargando…`, `Sin acceso`, `Volver al inicio`) — no es un borrador nuevo, es el texto de producción. |
| 2026-09-19 | Tarea 2 (compartidos, acceso, menús, títulos de página y páginas sueltas) | `messages/{es,eu,ca}.json` (`common.confirm`; `ui.*`: enlace «saltar al contenido», textos de `PageHelp`; `auth.*`: cerrar sesión, formulario de login y sus errores; `menu.*`: las 14+2+9 etiquetas de los tres menús de área más sus `navLabel`; `layout.*`: marca de la cabecera de plataforma, avisos de carga fallida de las cabeceras de entidad/paraguas, enlace del pie; `pages.*`: los 35 títulos de `<title>` más el contenido de Inicio (sin acceso), error/404/error global, login y «Elige una entidad»; `accessibility.*`: las seis secciones de la declaración) | borrador sin revisar | borrador sin revisar | `es` es literal a los textos que ya existían; las etiquetas de menú se comprobaron contra las constantes `*_MENU_LABELS` de `lib/auth/{entidadMenu,plataformaMenu,paraguasMenu}.ts`, que ahora guardan la clave de traducción en vez del texto. |
| 2026-09-19 | Tarea 3 (entidad 1/2: Inicio, Personas, ficha de persona, Comunidades, Actividades, Asistencia) | `messages/{es,eu,ca}.json` (`entidad.{inicio,personas,personaFicha,comunidades,actividades,asistencia,attendanceStatus}.*`; `people.*`: `AddPersonDialog`/`ImportPeopleDialog`; `support.relationship.*`; `errors.*`: los 15 hooks de datos de estas seis pantallas, `kind` → clave, ver «Errores de `hooks/`» en `CLAUDE.md`; `common.noPhoneNotice` y `auth.login.errors.sessionExpired`, huecos que dejó la tarea 2) | borrador sin revisar | borrador sin revisar | `es` es literal a los textos que ya existían salvo las concatenaciones convertidas a plural ICU (p. ej. «N inscritos»/«N plazas», «N invitación(es) pendiente(s)», los badges de comunidad), donde antes el singular quedaba mal formado (`1 inscritos`) — la propia regla de la tarea (`CLAUDE.md`) permite ese cambio de forma sin considerarlo una reescritura de contenido. `common.noPhoneNotice` está en el catálogo pero `GuardiaPanel.tsx`/`AyudaPendienteList.tsx` (tareas 4/5) todavía pintan la constante `NO_PHONE_NOTICE` sin `t()` — sigue siendo la misma cadena porque esa constante ahora se lee del propio catálogo `es.json` en vez de repetirla a mano, ver el docstring de `lib/help/noPhoneNotice.ts`. |
| 2026-09-19 | Tarea 4 (entidad 2/2: Comunicaciones, Encuestas, Recursos, Familias, Programas, Reportes, Guardia, Configuración) | `messages/{es,eu,ca}.json` (`entidad.{comunicaciones,encuestas,encuestaResultados,recursos,familias,programas,programaFicha,reportes,reporteDetalle,guardia,configuracion}.*`; `reports.{reason,status,resolution}.*` y `programs.{status,errors}.*`, namespaces nuevos compartidos con la plataforma —ver más abajo—; `errors.*`: ~25 hooks de estas ocho pantallas, mismo patrón `kind`/`detail` → `errorKindText`; `common.actions`, hueco que dejó la tarea 3) | borrador sin revisar | borrador sin revisar | `es` es literal a los textos que ya existían salvo las concatenaciones convertidas a plural ICU (invitaciones/destinatarios/preguntas/apoyos pendientes de familias, mismo criterio que la tarea 3). `common.noPhoneNotice`: `GuardiaPanel.tsx` ya pinta `{t(NO_PHONE_NOTICE_KEY)}` de verdad; `components/plataforma/AyudaPendienteList.tsx` (tarea 5) sigue pintando la constante `NO_PHONE_NOTICE` sin traducir — el puente de `lib/help/noPhoneNotice.ts` **no se cierra** hasta que esa tarea la toque (queda un único consumidor, documentado en el propio fichero). `lib/reports/labels.ts` gana `reasonLabelKey`/`statusLabelKey` (clave) sin borrar `reasonLabel`/`statusLabel` (texto): `components/plataforma/ReportesQueuePlataforma.tsx` (tarea 5) sigue llamando a las segundas, así que las cuatro funciones conviven hasta que esa tarea cambie de una a otra. |
| 2026-09-19 | Tarea 5 (plataforma, métricas y ayuda por pantalla) | `messages/{es,eu,ca}.json` (`help.*`: las 203 cadenas del registro de ayuda por pantalla, `lib/help/pageHelp.ts`, un `title`/`summary`/`audience`/array `actions` por cada una de las 32 pantallas; `metrics.{period,table,groupBy,stats,dashboard,comparativa,series,export}.*`: `components/metrics/*` y los dos dashboards de paraguas/plataforma; `plataforma.{ayuda,entidades,roles,verificaciones,reportes,auditoria,inicio,metricas,contratos,entidadFicha}.*`; `errors.*`: los ~20 hooks de esta área, mismo patrón `kind`/`detail` → `errorKindText`, incluidos varios que ganan `kind` por primera vez en esta tarea —`AcknowledgeHelpRequestGlobalError`, `DecideVerificationReviewError`, `PlatformRolesError`, `OrganizationsError`, `BillingError` (campo `detail`)—) | borrador sin revisar | borrador sin revisar | `es` es literal a los textos que ya existían salvo los mismos dos tipos de cambio de forma que las tareas 3-4 (concatenaciones → plural ICU, p. ej. «N facturas» en `plataforma.contratos.pendingAmountValue`). Cierra los dos puentes que dejó la tarea 4: `lib/help/noPhoneNotice.ts` (`AyudaPendienteList.tsx` ya usa `t(NO_PHONE_NOTICE_KEY)`, se borra `NO_PHONE_NOTICE`) y `lib/reports/labels.ts` (`ReportesQueuePlataforma.tsx` ya usa `reasonLabelKey`/`statusLabelKey`, se borran `reasonLabel`/`statusLabel`). Las siete cabeceras del CSV de Auditoría (`plataforma.auditoria.csv*`) se mantienen iguales en los cuatro idiomas a propósito (identificadores técnicos del contrato, no prosa) — ver `docs/i18n/PENDIENTES.md`. |
| 2026-09-19 | Tarea 6 (cierre: selector de idioma, idioma de la cuenta, regla ESLint, e2e y docs) | `messages/{es,eu,ca}.json` (`entidad.informes.*`, hueco que las tareas 2-5 dejaron sin tocar — ver más abajo; el resto de esta tarea no añade claves nuevas, `language.*` de la Tarea 1 ya cubría el selector) | borrador sin revisar | borrador sin revisar | `entidad.informes.{heading,noAccessDescription}` = «Informes»/«Tu rol no tiene acceso a Informes.», copiado literal de `paraguas.informes` (mismo texto exacto, `app/paraguas/[slug]/informes/page.tsx`) porque `app/entidad/[slug]/informes/page.tsx` seguía con los dos literales sin extraer — lo destapó la regla ESLint de esta tarea (`react/jsx-no-literals`, ver «Regla ESLint» en `CLAUDE.md`), no una traducción nueva de contenido. `components/layout/LanguageSwitcher.tsx` no necesita catálogo propio: sus tres botones usan `language.{title,es,eu,ca}` (ya traducidos en la Tarea 1) tal cual — «ES»/«EU»/«CA» en el botón salen de `lang.toUpperCase()` en código, nunca un literal de catálogo. |

## Contenido legal o de alto impacto (prioridad de revisión)

- **Declaración de accesibilidad** (`app/accesibilidad/page.tsx`,
  catálogo `accessibility.*`, texto conforme al RD 1112/2018): extraída
  en la tarea 2, párrafo a párrafo, con las etiquetas `<strong>`/
  `<code>`/`<email>`/`<rd>` resueltas con `t.rich()`. **Prioridad alta**
  de revisión en euskera y catalán — es contenido legal con valor
  probatorio (procedimiento de reclamación, artículo 13 del RD
  1112/2018), no una cadena de interfaz cualquiera.
- **Formulario de login y sus mensajes de error** (`auth.login.*`):
  segunda prioridad — es el primer texto que ve cualquier persona que
  entra al panel en euskera o catalán.

## Cierre del plan (2026-09-19, Tarea 6)

Las seis tareas del plan (`docs/superpowers/plans/2026-09-19-i18n-panel.md`)
están cerradas: infraestructura, extracción por área (compartidos,
entidad ×2, plataforma/métricas/ayuda) y este cierre (selector, idioma de
la cuenta, regla ESLint, e2e). Verificación completa en verde:
`npm run typecheck && npm run lint && npm run test:coverage && npm run
build` (99,88 % de líneas, 1716 tests, 176 ficheros — ver «Cierre de
i18n» en `CLAUDE.md`) y `npm run e2e` completo contra un backend local
(13 specs verdes, `e2e/analista.spec.ts` saltado por el motivo ya
documentado —503 de WeasyPrint no disponible—, sin ningún 429 de límite
de login). Nada de lo integrado espera la revisión del propietario para
funcionar: los borradores de `eu`/`ca` de la tabla de arriba son
completos y consistentes (paridad verde en las cuatro columnas de
`messages/*.json`), solo pendientes de que un hablante nativo confirme
la redacción — empezando por el contenido de «prioridad de revisión» de
arriba.
