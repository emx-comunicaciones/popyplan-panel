# Auditoría de producto y seguridad — 2026-09-27

Ámbito: `popyplan-panel`, diff `fd81786~1..HEAD` (2026-09-24 → 2026-09-27, 15 commits,
161 ficheros, ~46,6k líneas añadidas). Cubre los fixes posteriores a la auditoría de
2026-09-24, «privada pero visible» en comunidades, el admin de plataforma en tres
bloques (usuarios/bloqueos, búsqueda del tesoro, resto del admin), el catálogo de
entrenamiento y nivel de actividad, y el programa de seguimiento (fase 1 + vista del
referente).

Método: 7 cortes independientes (fixes/comunidades, admin bloques 1 y 3, tesoro,
entrenamiento, seguimiento, y transversal de menús/permisos/i18n/ayuda) auditados
contra los invariantes de `CLAUDE.md`, leyendo el código real y, donde el contrato
lo requería, el backend (`~/Code/popyplan`). No se reporta lo ya anotado como
mismatch pendiente del backend en `docs/historial/`.

**Resultado: 0 bloqueantes, 0 altos, 2 medios, 11 bajos.** Los invariantes de
seguridad (9: sin datos de contacto; 3: sin altas desde entidad; familias separadas;
red de apoyo; ConfirmDialog en destructivas; botones ocultos por rol; gates con la
función de menú) se cumplen en todo el ámbito. El corte transversal (menús, gates,
PAGE_HELP, paridad i18n, endpoints, tipos, contraste) salió limpio.

## Medios

### M1 — Una comunidad «privada pero visible» se etiqueta como «Privada»

`components/entidad/ComunidadesPanel.tsx:137-141` (`CommunityCard`): el ternario solo
distingue `open`/`on_request` y cae a «Privada» para todo lo demás, así que
`private_listed` es indistinguible de `private` en la tarjeta. La clave
`visibilityPrivateListed` existe solo bajo `entidad.familias` y
`plataforma.comunidades` (`messages/es.json`), no bajo `entidad.comunidades`.
Implicación de privacidad: la persona gestora no sabe que su comunidad es visible en
la app. La tabla de plataforma sí la distingue (`ComunidadesPlataformaTable.tsx:37-42`).
Fix: añadir la clave a `entidad.comunidades.*` y el tercer caso en el ternario.

### M2 — Callejón sin salida: «privada pero visible» no muestra nunca su código

El backend exige código para entrar a `private_listed`
(`VISIBILIDADES_CON_CODIGO = ('private', 'private_listed')`,
`communities/models.py:43`), pero `invite-code` responde 400 a cualquier comunidad
con `visibility != 'private'` (`communities/unified_viewset.py:597`). El panel,
correctamente según CLAUDE.md («no montes el hook con otra visibilidad: 400»), no
monta `InviteCode` para `private_listed` (`ComunidadesPanel.tsx:512`). Resultado:
quien crea una comunidad «privada pero visible» desde el panel no puede ver ni
repartir el código, y nadie puede entrar. **El arreglo duradero es del backend**
(servir el código también en `private_listed`); mientras tanto, el panel vende una
opción cuya mecánica de acceso oculta. Relacionado (pre-existente):
`FamiliasPanel.tsx` tampoco muestra el código de una comunidad de familias `private`.

## Bajos

1. **`NuevaComunidadDialog.tsx:68-74`** — `resetForm` deja la visibilidad en
   «Abierta» para `space === 'families'`; el estado inicial respeta «las familias
   nacen `private`» (línea 59-61) pero el reset no. Reabrir el diálogo tras cancelar
   rompe el invariante en la práctica. Pre-existente al diff.
2. **`lib/metrics/period.ts:183-185`** — en husos al oeste de UTC el recorte de
   `periodIncluding` mide 1462 días (`parseIsoDate` ancla a UTC, `toIso` lee local)
   y el backend lo rechaza (tope 1461). En España no ocurre; construir el recorte
   con `toISOString().slice(0,10)`.
3. **`BloqueosPanel.tsx:121-123`** — pinta «Bloqueos de la cuenta n.º {id}» al
   abrir sin `?email=`, incumpliendo «nunca ids de cuenta en crudo». Alcanzable
   desde el enlace «Ver bloqueos» de `UsuarioDetail.tsx:205-214`.
4. **`hooks/usePlatformUsers.ts:116-124`** — `usePlatformAccount` inspecciona solo
   la página 1 de las dos búsquedas (`search` es `icontains`, PAGE_SIZE 20); con
   ≥20 coincidencias la ficha dice «No se encontró la cuenta» para una cuenta
   existente o calcula `isActive` sobre un subconjunto.
5. **`UsuariosTable.tsx:80-81` / `UsuarioDetail.tsx:93`** — si `usePlatformRoles()`
   falla, la columna «Rol» pinta «—» sin `role="alert"`, indistinguible de «sin
   rol» (convención: una consulta auxiliar que falla avisa).
6. **`useUserSearch.ts:31-34`** (afecta a `NotificacionesPanel.tsx:207-224` y
   `BloqueosPanel.tsx:101`) — el error se traga a `[]`: «sin resultados» y «la
   búsqueda falló» son indistinguibles. Mejor distinguir 403 (→ `[]`) de otros
   errores (→ estado pintable) en el hook, no en cada consumidor.
7. **`useCatalogs.ts:240-245`** — un 500 en la **lectura** de un nomenclador se
   pinta con el hint de escritura («puede que el elemento esté en uso…»): causa
   falsa para el superadmin. `toError` debería recibir el hint según lectura/escritura.
8. **`TesoroJuegoForm.tsx:76-90`** — duración no entera/<1 o aforo inválido dejan
   el botón «Guardar» deshabilitado sin `<p role="alert">` que explique el motivo
   (la fecha pasada sí tiene mensaje). El formulario queda «muerto» sin indicación.
9. **`TesoroDatosTab.tsx:171-175`** — `update.isSuccess` nunca se resetea: el
   «Guardado» persiste indefinidamente tras el primer guardado.
10. **`lib/events/validation.ts:31-36`** — docblock huérfano del antiguo
    `validateEventStartsAt` quedó delante del docblock real de `sameMinute` tras el
    refactor; asocia documentación errónea a `sameMinute`.
11. **Familias nunca muestran su código de invitación** (`FamiliasPanel.tsx` no
    monta `InviteCode` en ningún sitio) — mismo fallo de clase que M2 para el
    espacio `families`; entrada privada de familias sin mecánica visible de acceso.
    (Pre-existente; se soluciona con el mismo arreglo de backend que M2.)

## Verificado correcto (lo más relevante)

- **Fixes del 24-09** sin regresión: `sameMinute` aplica el mismo criterio que la
  app móvil en los dos sitios; `level` y `starts_at` solo viajan si cambian; al
  editar nunca se mandan `audience`/`community`/`owner_org`; el periodo solo se
  amplía tras éxito en la creación.
- **Programa de seguimiento**: 9/9 — 404-nunca-403 consistente en hooks y UI, gates
  por `trackingEnabled`, titular/moderador nunca ven datos de salud, seguimiento
  compartido solo referente + servicio y nada en vuelo/404, referente = id de
  `OrgMembership`, interruptor solo superadmin con ConfirmDialog, sin caché que
  evite el AuditLog (staleTime 0).
- **Entrenamiento**: solo catálogo y plantillas `?scope=system`, nombres
  name_es/name_eu/name_ca → name/name_eu/name_ca, 409 `en_uso` literal, `items`
  entero y `discipline_id` condicional, nivel `""` = todos.
- **Admin de plataforma**: gates `plataformaMenuFor` + EmptyState en las 14 páginas
  nuevas, alta de cuenta sin `is_staff`/`is_superuser` y es la única creación de
  cuentas, `is_active` nunca asumido, bloqueos como array plano, chats con cuenta
  propia de staff, plantillas nuevas inactivas, `conflicto_servidor` en unicidad.
- **Tesoro**: invariante 9 en participantes/validaciones/ranking (tipos no traen
  contacto), ConfirmDialog en todas las destructivas, claves de caché con
  `String(id)`, `detailOf` único lector.
- **Transversal**: paridad i18n en los 4 catálogos (test en verde), PAGE_HELP de
  las 14 entradas nuevas con `related` idénticas y en orden, sin literales crudos,
  sin `text-primary`/`bg-primary` desnudos, claves de caché normalizadas, errores
  DRF solo vía `detailOf`.
