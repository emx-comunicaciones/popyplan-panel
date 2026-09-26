# Historial — Área de plataforma (W5) y suscripciones

> Texto trasladado tal cual desde el `CLAUDE.md` raíz (2026-09-26) para no cargarlo en cada sesión. Las referencias a «más arriba/abajo» apuntan al `CLAUDE.md` original; busca la sección en `docs/historial/`.

## Área de plataforma: Inicio, Entidades, Reportes, Ayuda, Verificaciones, Roles, Auditoría (tarea W5)

`docs/SEGURIDAD_Y_MODERACION.md` (§1 roles de plataforma, §4 reportes,
§5 ayuda, §7 verificación, §8 organizaciones) y `docs/PANEL.md` (§1
métricas de plataforma, dashboard-stats). Páginas bajo `app/plataforma/`,
Server Component con sesión + `plataformaMenuFor(role)` (redirect si no
está en el menú de ese rol → `EmptyState` «Sin acceso»; el layout ya
filtra el propio menú lateral con la misma función).

**Matriz de visibilidad** (`lib/auth/plataformaMenu.ts::plataformaMenuFor`,
sacada del permiso real de cada endpoint, no inventada): `superadmin` ve
todas las secciones (las 8 de W5, más Suscripciones —antes «Contratos»—
desde W4 de Fase 6, `support` también la ve, ver «Suscripciones y
facturación de plataforma» más abajo; y Usuarios/Bloqueos desde el
bloque 1 del admin de plataforma, **solo** `superadmin`, ver «Admin de
plataforma: usuarios y bloqueos» más abajo; y Comunidades/Actividades/
Reseñas/Chats/Notificaciones/Nomencladores desde el bloque 3, también
**solo** `superadmin`, ver «Admin de plataforma: el resto del admin
antiguo» más abajo; y Búsqueda del tesoro desde el bloque 2, **solo**
`superadmin`, ver «Admin de plataforma: búsqueda del tesoro» más abajo);
`verifier` solo Inicio/Entidades/Verificaciones
(`organization-list/create/verify` y `verification-review-*` piden
`verifier`/`superadmin`); `moderator` y `support` ven Inicio/Reportes/
Ayuda/Métricas (`safety/services/reports.py::queue` y
`PlataformaMetricsView` admiten `moderator`/`superadmin`/`support`, nunca
`verifier`); Auditoría es solo `superadmin` en los cuatro roles.

- **Inicio** (`page.tsx` → `PlataformaHomeDashboard`): tarjetas de `GET
  /api/admin/dashboard-stats/` (usuarios activos, actividades
  programadas — `IsAdminUser`/`is_staff`, que hoy solo tiene
  `superadmin`; `hooks/useDashboardStats.ts` traduce un 403 a `null` y
  la tarjeta se oculta, igual que el resto de contadores tolerantes del
  panel), reportes pendientes (`useReportsQueue(undefined, {status:
  'pending'})`, cola global) y solicitudes de ayuda pendientes
  (`usePlatformPendingHelpRequests`, ver el hueco de contrato más abajo)
  — ambas ocultas si esa sección no está en el menú del rol — y
  entidades verificadas/pendientes (`useOrganizations`, abierto a
  cualquier autenticado).
- **Entidades** (`entidades/page.tsx` → `EntidadesTable` + «Nueva
  entidad» → `NuevaEntidadDialog`, `hooks/useOrganizations.ts`): listado
  paginado con filtros `verified`/`search` (`parent` no tiene selector en
  la lista, solo se usa para «hijas» en la ficha); alta
  (`POST /api/organizations/`, `verifier`/`superadmin`, nace sin
  verificar). **Ficha** (`entidades/[id]/page.tsx` → `EntidadDetail`,
  seis secciones con un simple selector de botones, mismo patrón que el
  `group_by` de `PlataformaMetricsDashboard` — sin ARIA tabs, el panel no
  tenía ese patrón todavía): Datos (lectura + «Verificar»,
  `verifier`/`superadmin`), Paraguas (cambiar `parent`, solo
  `superadmin`, más lista de hijas), Ámbito (ampliar `scope`, solo
  `superadmin` desde plataforma — el titular lo hace desde su propia
  entidad), Equipo (alta/baja de `OrgMembership` y referencias),
  Métricas (`useMetrics('entidad', orgId, …)`) y Comunidades y
  actividades (recuentos). **Límite de contrato documentado in situ**:
  Equipo y Métricas normalmente devuelven 403 para la plataforma —
  `entities/permissions.py::puede` y `PuedeEnEntidad('ver_panel')` solo
  miran `OrgMembership`, sin excepción para roles de plataforma; se
  muestran de todos modos (con un aviso «Sin acceso» explícito, nunca
  fingiendo datos) por si la plataforma además tiene membresía propia en
  esa entidad.
- **Reportes** (`reportes/page.tsx` → `ReportesQueuePlataforma`,
  `reportes/[reportId]/page.tsx` → `ReporteDetail` reutilizado del panel
  de entidad con la prop nueva `readOnly`): cola global
  (`useReportsQueue(undefined, filters)` — el hook ahora admite `orgId`
  opcional, sin romper al panel de entidad, que siempre lo pasa),
  columna «Entidad» (`Entidad #<id>`/`Global`, sin nombre — no hay
  `GET /api/organizations/{id}/` en lote, y resolverlo uno a uno por
  fila sería una petición por reporte listado; documentado como mejora
  futura) y una insignia «Escalado» (`escalated_at`). El detalle admite
  asignar/resolver/escalar igual que en la entidad, **ocultas** cuando
  `readOnly` (`support`: `can_view` sin `can_act`,
  `safety/services/reports.py`).
- **Ayuda** (`ayuda/page.tsx` → `AyudaPendienteList`,
  `hooks/usePlatformPendingHelpRequests.ts`): **hueco de contrato**
  documentado en el propio hook — `GET
  /api/safety/help-requests/pending/` exige `?organization=<id>` y solo
  autoriza a la guardia de esa entidad o a su `titular`/`moderador`
  (`safety/viewsets.py::HelpRequestViewSet.pending`); **ningún** rol de
  `PlatformRole` pasa esa comprobación por sí solo. El hook recorre todas
  las entidades (`useOrganizations`, todas las páginas) y pide `pending`
  de cada una, tolerando 403/400 por entidad — en la práctica, para
  quien solo tiene rol de plataforma sin `OrgMembership` en ninguna
  entidad, la lista queda vacía casi siempre. Ver pregunta de diseño en
  `docs/preguntas-diseno.md` (sección «Task W5»): falta una ruta
  agregada de plataforma para esto, análoga a `report-queue` sin
  `organization`.
- **Verificaciones** (`verificaciones/page.tsx` → `VerificacionesQueue`,
  `hooks/useVerificationReviewsQueue.ts`/`useDecideVerificationReview.ts`):
  cola `pending` de `VerificationReview` con el recurso de la persona
  (`appeal_text`) y el motivo del proveedor (`reason`); aprobar/rechazar
  con nota (`verifier`/`superadmin`).
- **Roles** (`roles/page.tsx` → `RolesPanel`, `hooks/usePlatformRoles.ts`):
  lista de `PlatformRole` vigentes, conceder (buscador de cuentas por
  email/usuario vía `GET /api/users/users/?search=` —
  `hooks/useUserSearch.ts`, `IsAdminUser`, hoy solo `superadmin` la usa
  y solo `superadmin` llega a esta página, así que en la práctica
  siempre funciona; un 403 cae a lista vacía en vez de romper el
  formulario, con el id de usuario como alternativa siempre disponible)
  y revocar con `ConfirmDialog` (acción de alto impacto: quita acceso a
  la plataforma).
- **Auditoría** (`auditoria/page.tsx` → `AuditoriaPanel`,
  `hooks/useAuditLog.ts`): filtros `actor`/`action`/`target_type`/
  `target_id`/`since`/`until`, tabla con `metadata` legible (`clave=valor`
  por entrada) y exportación CSV **del cliente** (la página actual, no
  auditada por sí misma — una exportación auditada de todo el listado
  es una ruta de backend aparte, fuera del alcance de esta tarea).
  **Pendiente de backend al escribir esta tarea**: `GET
  /api/safety/audit/` (`AuditLogViewSet`, tarea P6 del backend) existía
  ya en el árbol de trabajo del backend pero sin commitear y sin
  documentar en `docs/PANEL.md` — se integró contra la forma confirmada
  leyendo directamente `safety/serializers.py::AuditLogSerializer`
  (`{id, actor: {id, public_name}, action, target_type, target_id,
  metadata, ip?, created_at}`, filtros `actor/action/target_type/
  target_id/since/until`), con el hook y los tipos documentando esa
  procedencia (`lib/api/types.ts::AuditLogEntry`). Si el contrato final
  cambia al documentarse en `docs/PANEL.md`, revisar
  `hooks/useAuditLog.ts` y `lib/api/types.ts` primero.

## Suscripciones y facturación de plataforma (tarea W4, Fase 6; sección renombrada en el bloque 1 de territorio)

`docs/PANEL.md` §13 (contrato del backend, tarea B4): app `billing`,
exclusiva del área de plataforma — ninguna entidad la ve, ni siquiera su
titular. Tres modelos: `PricingTier` (tramo de precio anual por rango de
población), `Contract` (`draft -> active -> ended`, siempre hacia
adelante) e `Invoice` (`status` calculado: `paid`/`pending`/`overdue`).
Invariante 7 extendida (docstring del propio backend, `billing/models.py`):
un contrato `ended` no condiciona ninguna función de la entidad, la
plataforma solo lo ve en su lista para gestionar el cobro.

- **`lib/api/endpoints.ts::BILLING`** — `TIERS`, `TIER`, `CONTRACTS`,
  `CONTRACT`, `CONTRACT_ACTIVATE`, `CONTRACT_END`, `CONTRACT_INVOICES`,
  `INVOICE_PAY`, `SUMMARY`. `lib/api/types.ts` toma `PricingTier`/
  `Contract`/`ContractStatus`/`Invoice`/`BillingSummary` del esquema
  generado sin discrepancias; dos tipos manuales:
  `PricingTierUpdateRequest` (el generado `PatchedPricingTierInputRequest`
  marca `min_population`/`is_active` como obligatorios pese al
  `partial=True` real — mismo quirk de drf-spectacular ya documentado en
  `ProgramWriteFields` para Programas, un campo con `default` no de solo
  lectura sale como requerido) e `InvoiceStatus` (`Invoice.status` es una
  propiedad calculada que el esquema tipa como `string` a secas).
- **`hooks/useBilling.ts`**: un solo fichero para lectura y escritura
  (`useBillingSummary`/`useTiers`/`useContracts(filters)`/
  `useInvoices(contractId)`; `useCreateTier`/`useUpdateTier`/
  `useCreateContract`/`useUpdateContract`/`useActivateContract`/
  `useEndContract`/`useCreateInvoice`/`usePayInvoice`), mismo patrón
  `detailOf`/`BillingError{kind}` que `useProgramMutations.ts`.
- **`components/plataforma/ContratosPanel.tsx`**: tres pestañas con el
  mismo selector de botones que `EntidadDetail.tsx` (sin ARIA tabs) —
  **Contratos** (filtros entidad/estado, alta/edición/activar/finalizar),
  **Tramos** (`TierForm`, componente local — no un fichero aparte, el
  formulario es pequeño) y **Facturas** (selector de contrato, alta y
  «Marcar pagada» con fecha embebida en un `ConfirmDialog`, mismo patrón
  que «Cerrar programa» pide notas de cierre). `canManage = role ===
  "superadmin"`: los botones de escritura se **ocultan** para `support`,
  nunca se deshabilitan. `components/plataforma/{ContratoForm,
  FacturaForm}.tsx` son los formularios de alta/edición de contrato y
  alta de factura; `eurosToCents`/`formatEuros` se reutilizan tal cual de
  `lib/programs/money.ts` (mismo formateador es-ES, sin duplicarlo en un
  `lib/billing/money.ts` propio).
- **Menú y visibilidad** (`lib/auth/plataformaMenu.ts`): «Suscripciones»
  (antes «Contratos» — el objeto de dominio `Contract` y la pestaña
  interna «Contratos» de `ContratosPanel.tsx` no cambian de nombre, solo
  la sección del menú y su ruta, `/plataforma/suscripciones` con 308
  desde `/plataforma/contratos`; ver «Administraciones multinivel y
  territorio» más abajo) visible para `superadmin` y `support` (los dos
  roles con lectura real de `billing`,
  `HasPlatformRole('superadmin', 'support')`); ni `moderator` ni
  `verifier` la ven. El menú pasa de 8 a 9 secciones.
- **Inicio de plataforma** (`PlataformaHomeDashboard.tsx`): tres tarjetas
  del `summary` («Contratos vigentes», «Valor anual contratado» con
  `Intl.NumberFormat("es-ES", {style:"currency", currency:"EUR"})`,
  «Facturas vencidas»), visibles solo si el menú del rol trae
  «suscripciones».
- **Ficha de entidad de plataforma** (`EntidadDetail.tsx`): séptima
  pestaña «Contrato» — tramo, vigencia y última factura (por
  `issued_on`) de la entidad, de solo lectura; prioriza el contrato
  `active` si hay varios (histórico); 403 (`verifier`) se traduce a «Sin
  acceso», mismo patrón que Equipo/Métricas.
- **Límite conocido**: el selector de entidad de `ContratoForm` usa
  `useOrganizations()` sin filtro, solo la primera página — suficiente
  para el volumen de entidades de esta fase; paginar el propio selector
  queda para quien amplíe esta pantalla.
