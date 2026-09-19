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

## Contenido legal o de alto impacto (prioridad de revisión)

Ninguno todavía extraído en esta tarea. La declaración de accesibilidad
(`app/accesibilidad/page.tsx`, texto conforme al RD 1112/2018) se
extraerá en la tarea 2 (`docs/superpowers/plans/2026-09-19-i18n-panel.md`)
y quedará listada aquí como prioritaria en cuanto tenga catálogo propio,
tal y como fija la decisión 8 del diseño
(`~/Code/popyplan/docs/superpowers/specs/2026-09-19-i18n-es-eu-ca-design.md`).
