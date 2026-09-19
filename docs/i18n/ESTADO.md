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
