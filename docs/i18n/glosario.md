# Glosario de i18n (en / es / eu / ca)

Copia del glosario del repo backend (`~/Code/popyplan`,
`docs/i18n/glosario.md`, rama `feature/i18n-es-eu-ca`) — término de
dominio de Popyplan, usados como referencia al traducir los `msgid`
(inglés, cadena fuente) a `es`/`eu`/`ca` en los tres repos (backend,
`popyplan-mobile`, `popyplan-panel`). Euskera en batua (Euskaltzaindia);
catalán en la forma general del IEC (no valenciana). Ver
`~/Code/popyplan/docs/superpowers/specs/2026-09-19-i18n-es-eu-ca-design.md`
§1-2 para las decisiones que fijan este glosario y el criterio de
vocabulario que no presupone adicción. Si el glosario del backend cambia,
actualizar esta copia — es la única fuente que usan las tareas de
extracción de este repo (2-6).

| en | es | eu | ca |
|---|---|---|---|
| entity | entidad | erakunde | entitat |
| umbrella entity | entidad paraguas | erakunde aterki | entitat paraigua |
| community | comunidad | komunitate | comunitat |
| plan / activity | plan / actividad | plana / jarduera | pla / activitat |
| on-call (guard) | guardia | txanda | guàrdia |
| referent | referente | erreferente | referent |
| support network | red de apoyo | laguntza-sarea | xarxa de suport |
| supporter | persona de apoyo | laguntzailea | persona de suport |
| families space | espacio de familias | familien espazioa | espai de famílies |
| "I'm having a bad day" | «Hoy lo llevo mal» | «Gaur txarto nago» | «Avui ho porto malament» |
| sign up (for a plan) | inscribirse | izena eman | inscriure's |
| attended | asistió | joan da | ha assistit |
| announcement | comunicación | jakinarazpena | comunicació |
| survey | encuesta | inkesta | enquesta |
| resource | recurso | baliabidea | recurs |
| program | programa | programa | programa |
| report (moderation) | reporte | salaketa | informe (moderació) |
| help request | solicitud de ayuda | laguntza-eskaera | sol·licitud d'ajuda |
| invitation | invitación | gonbidapena | invitació |
| code (verification/check-in) | código | kodea | codi |
| member | miembro | kide | membre |
| moderator | moderador/a | moderatzailea | moderador/a |
| cancel | cancelar | utzi | cancel·la |
| accept | aceptar | onartu | accepta |
| close | cerrar | itxi | tanca |
| save | guardar | gorde | desa |
| retry | reintentar | saiatu berriro | torna-ho a provar |
| loading | cargando | kargatzen | carregant |
| no access | sin acceso | sarbiderik ez | sense accés |
| back to home | volver al inicio | itzuli hasierara | torna a l'inici |
| language | idioma | hizkuntza | idioma |
| Spanish (the language) | español | gaztelania | castellà |
| Basque (the language) | euskara | euskara | basc |
| Catalan (the language) | catalán | katalana | català |

## Notas

- **«report»** en el dominio de moderación (`safety.Report`) se traduce
  distinto en catalán (`informe`, para no chocar con `informe` = *report*
  del panel de métricas/exportación, que en este glosario usa el inglés
  *report* con otro sentido) — quien traduzca una pantalla de moderación
  en catalán no debe reutilizar sin pensar la palabra que usa el panel de
  métricas para «informe descargable».
- **«plan»** es el nombre de dominio para lo que en la interfaz de
  usuario se llama «actividad»; los dos msgid en inglés (`plan`,
  `activity`) pueden aparecer indistintamente según el contexto de
  código heredado — la traducción es la misma en los tres idiomas.
- **Idioma del panel para «español»**: euskera y catalán no traducen el
  nombre del idioma de la misma forma que el resto del glosario de
  dominio (`gaztelania`/`castellà` en vez de `espainiera`/`espanyol`),
  siguiendo el uso habitual de software localizado a esos dos idiomas
  para referirse al castellano.
- Vocabulario que no presupone adicción (decisión 2 del diseño, §2): al
  traducir un texto de onboarding o de ayuda que en español sonara a
  «tienes un problema», se reformula en los tres idiomas de forma
  neutra — ninguna de las cadenas de esta tarea (`common.*`,
  `language.*`) lo necesitaba.
