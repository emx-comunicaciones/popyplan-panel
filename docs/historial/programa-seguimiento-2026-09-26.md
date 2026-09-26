# Programa de seguimiento en el panel (2026-09-26)

Spec: `~/Code/popyplan/docs/superpowers/specs/2026-09-26-programa-seguimiento-design.md`.
Contrato: `~/Code/popyplan/docs/PANEL.md` §18 (backend `develop` 5e3d0c7,
apps `program` y `habits`). Este repo cubre la parte del panel de la
fase 1 (interruptor de plataforma; alta, cambios y baja) y la vista del
referente de la fase 2. La sección «Programa» con cifras agregadas
(supresión <5) sigue pendiente: el backend todavía no tiene esa ruta.

**Datos de salud (categoría especial del RGPD).** La regla que manda en
todo el panel: no revelar el programa a quien no puede usarlo. El backend
responde 404 (nunca 403) y el panel lo imita.

## Qué se construyó

- **Plataforma → Entidades → ficha → Datos**
  (`components/plataforma/TrackingProgramCard.tsx`,
  `hooks/useSetTrackingProgram.ts`): interruptor `role="switch"` solo para
  `superadmin`, que pide confirmación (`ConfirmDialog`) al encender
  (explica el tratamiento de datos de salud) y al apagar (las inscripciones
  quedan en suspenso, nada se borra). `PATCH /api/organizations/{id}/
  {tracking_program_enabled}`; el 400 («solo asociaciones u ONG
  verificadas») se pinta literal dentro del diálogo. El resto de roles de
  plataforma ve el estado en solo lectura en la `<dl>` (si la clave viene).
- **Menú de entidad**: sección nueva `seguimiento` («Programa de
  seguimiento», tras «Programas»), solo titular/moderador y solo con
  `trackingEnabled` (`EntidadMenuContext`, calculado en el layout con la
  ficha ya pedida). `app/entidad/[slug]/seguimiento/page.tsx` →
  `SeguimientoPanel`: listado (array plano) con estado, tipo, referente y
  alta, filtro por estado y enlace a la ficha. **`notFound()`** para
  cualquier otro rol o sin servicio (el resto de gates pintan «Sin acceso»;
  aquí no, para no confirmar que el programa existe).
- **Ficha de persona, titular/moderador con servicio**
  (`TrackingEnrollmentSection.tsx`, `hooks/useProgramEnrollments.ts`):
  estado de la inscripción abierta (pendiente de aceptar / activo) o la
  última cerrada, «Dar de alta en el programa» (tipo + descripción con
  «Otro» + referente), «Cambiar tipo o referente» (solo manda lo que
  cambió) y «Dar de baja» con confirmación. Errores de mutación dentro del
  diálogo, con el texto del backend (400/409).
- **Ficha de persona, referente** (`SharedTrackingSection.tsx`,
  `hooks/useSharedTracking.ts`): «Seguimiento compartido» con solo las
  secciones que llegan distintas de `null` (estado general, check-ins sin
  nota, ganas con el título según el tipo, objetivos, participación), la
  línea fija «Solo ves lo que la persona ha decidido compartir contigo;
  cada consulta queda registrada.» y «Proponer objetivo semanal». El hook
  solo se dispara con `role === 'referente'` **y** el servicio encendido
  (cada lectura va a `AuditLog`); en vuelo o con 404/403 no se pinta nada.

## Decisiones

- **El referente es una `OrgMembership`**: el select manda `m.id`, no
  `m.user` (igual que `Reference.referent`). La lista sale de
  `useOrgMembers`, que es solo-titular: un moderador la ve vacía con aviso
  y puede dar de alta sin referente; al editar se conserva siempre el
  referente actual como opción aunque no esté en la lista.
- **Alta y cambios en la ficha, no en el listado**: ahí ya está el
  contexto de quién es la persona; el listado enlaza a Personas.
- **`isTrackingProgramEnabled`** (`lib/auth/organization.ts`) solo se
  consulta en la ficha para titular/moderador/referente; el resto ni
  recibe las props del programa.
- **Ayuda**: entrada nueva `entidad.seguimiento` (solo la ven quienes
  llegan a la página) y una frase en `help.entidad.personaFicha.details`
  sin vocabulario de adicciones.

## Mismatches con el esquema

- Ninguno que obligue a un tipo manual. Todos los tipos nuevos de
  `lib/api/types.ts` son alias del esquema regenerado. Anotado: en
  `SharedData`, `consent` sale con los cinco booleanos opcionales
  (`ConsentSerializer` los declara `required=False` para las escrituras),
  pero la respuesta real siempre trae los cinco; y `tracking_type`,
  `mood`, `urge` y `last_mood` son `string` a secas (`CharField`), así que
  se etiquetan con reserva al valor crudo (`lib/tracking/labels.ts`).
- `GET .../program/enrollments/` es un array plano de verdad (verificado
  contra el backend sembrado).

## Verificado contra el backend real

Superadmin ve el interruptor encendido en Asociación Bidasoa; titular ve
«Programa de seguimiento» en el menú, el listado con Persona 01 pendiente
de aceptar y el bloque en su ficha; referente no ve el menú, recibe 404 en
`/entidad/asociacion-bidasoa/seguimiento` y en la ficha de Persona 01 no
aparece nada del programa (la inscripción sigue pendiente: 404 correcto).
No se tocó el estado de la inscripción de la demo.
