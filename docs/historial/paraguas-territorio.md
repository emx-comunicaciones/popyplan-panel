# Historial — Paraguas, regla de área y territorio

> Texto trasladado tal cual desde el `CLAUDE.md` raíz (2026-09-26) para no cargarlo en cada sesión. Las referencias a «más arriba/abajo» apuntan al `CLAUDE.md` original; busca la sección en `docs/historial/`.

## Qué es

Tres áreas por rol, cada una bajo su propia ruta:

- **`/entidad/[slug]`** — panel de una asociación/ONG/administración con
  rol de `OrgMembership` (`titular`, `moderador`, `dinamizador`,
  `analista`, `referente`). Menú de 14 secciones (Inicio, Personas,
  Comunidades, Actividades, Asistencia, Comunicaciones, Encuestas,
  Biblioteca, Familias, Programas, Reportes, Guardia, Informes,
  Configuración), con visibilidad por rol (`lib/auth/entidadMenu.ts`;
  «Guardia» además la ve la persona de guardia de la entidad sea cual sea
  su rol — ver «Auditoría de integración» más abajo).
- **`/paraguas/[slug]`** — **área de administración**: el panel de una
  entidad paraguas (p. ej. una diputación o un ayuntamiento) sobre su
  territorio declarado y sobre sus entidades hijas. Menú de **cuatro**
  secciones — Inicio (resumen de los dos bloques siguientes), Territorio
  (observatorio del territorio declarado), Red financiada (el dashboard
  agregado de siempre sobre el árbol `parent`/`children`) e Informes
  (exportación) — con visibilidad por rol (`lib/auth/paraguasMenu.ts`).
  Territorio ≠ árbol de entidades: el territorio es la geografía que la
  administración declara sobre sí misma (una CCAA, provincia, comarca o
  lista de municipios — `Organization.territory_kind`/`territory_code`),
  mientras que «Red financiada» sigue mirando qué entidades hijas cuelgan
  de ella (`parent`), sin relación necesaria con su territorio. Ver
  «Administraciones multinivel y territorio (bloque 1)» más abajo.
- **`/plataforma`** — panel del equipo de Popyplan (`safety.PlatformRole`:
  `superadmin`, `verifier`, `moderator`, `support`). Menú de 18 secciones
  (Inicio, Entidades, Usuarios, Comunidades, Actividades, Reportes,
  Bloqueos, Reseñas, Chats, Notificaciones, Ayuda, Verificaciones, Roles,
  Auditoría, Métricas, Suscripciones, Nomencladores, Búsqueda del
  tesoro), con visibilidad por rol
  (`lib/auth/plataformaMenu.ts`) —
  ver «Área de plataforma» más abajo.

`lib/auth/area.ts::resolveArea(me, platformRole)` decide el área: el rol
de plataforma manda sobre cualquier rol de entidad; con varias entidades
elegibles, `/elegir-entidad` deja escoger.

**Regla de paraguas (al día, 2026-09):** `GET /api/users/users/me/`
(`OrgMembershipRefSerializer`, `users/profile_serializers.py` en el
backend) **sí** dice el tipo de organización de cada membresía, en el
campo `organization_type` (`source='organization.org_type'`, desde la
ronda de cierre de Fase 5; `OrgMembershipRef.organization_type: string`
en `docs/schema.yaml`, y el backend seedeado devuelve
`"organization_type": "administracion"` para `panel-analista-gfa@test.com`).
`lib/auth/area.ts::isParaguas` lo lee de ahí, así que una `analista` o
`titular` de una diputación aterriza en `/paraguas/{slug}` sin pasar por
`/elegir-entidad` (con varias membresías paraguas se resuelve a la
primera del array; decisión fijada por `lib/auth/area.test.ts`).

`isParaguas` acepta además un `org_type === 'administracion'` heredado,
el nombre que la nota original de la tarea W1 daba por bueno y que el
backend nunca ha usado: `OrgMembershipForArea` (`lib/api/types.ts`) lo
declara como campo opcional y varios fixtures de test lo usan, así que
la rama se mantiene como respaldo. Las dos notas que este fichero
arrastraba (W1: «el backend no expone el tipo»; W5: «el campo llegó con
otro nombre y no se corrige») quedan **obsoletas**: el fix de una línea
que describían está aplicado desde la primera ronda de la auditoría
estática. `e2e/analista.spec.ts` y `e2e/comparativa.spec.ts` siguen
navegando a mano a `/paraguas/...`, ahora a propósito (así el flujo bajo
prueba no depende de la resolución de área).

## Contratos que consume (repo backend `~/Code/popyplan`)

- `POST /api/auth/login/` (`users/auth_viewsets.py::AuthViewSet.login`):
  `{username_or_email, password}` → `{key, refresh, user}` (`refresh`
  desde la tarea W3, `docs/PANEL.md` §0).
- `POST /api/auth/token/refresh/` (`docs/PANEL.md` §0): `{refresh}` →
  `{access, refresh}` (rotado). Ver «Diseño de sesión» más abajo.
- `GET /api/users/users/me/` — perfil propio + `org_memberships`.
- `GET /api/safety/platform-roles/me/` — `{role: string|null}`.
- `GET /api/organizations/{id}/` — ficha de la entidad (nombre, logo,
  `primary_color`/`secondary_color`) para la cabecera del panel.
- `docs/SEGURIDAD_Y_MODERACION.md` (§1, §5, §8) y `docs/PANEL.md` (§1
  métricas, §2 exportación, §3 personas/actividades, §4 check-in QR)
  documentan el resto.

## Administraciones multinivel y territorio (bloque 1)

Spec de diseño `2026-09-19-territorio-administraciones-design.md`
(repo backend `~/Code/popyplan`, plan de 8 tareas de este repo:
`docs/superpowers/plans/2026-09-19-territorio-panel.md`). El backend
declara un territorio sobre una administración pública (diputación,
ayuntamiento, mancomunidad, gobierno autonómico) para poder observarlo
agregado — municipios con y sin actividad, no solo las entidades que ya
usan Popyplan — y una vista previa/ficha de plataforma para dar de alta
esa geografía. Cinco rutas nuevas del backend, todas ya en
`docs/PANEL.md` §15 del repo backend: `GET /api/panel/territorio/{org_id}/
metrics/`, `GET .../compare/`, `GET .../export/` (mismo esquema fijo que
el resto de `panel/`, ámbito `territorio`), `GET .../places/{ine_code}/`
(ficha de un municipio) y `GET /api/places/` (catálogo de municipios,
solo lectura, con los filtros de código añadidos por decisión del
coordinador del bloque: `ccaa_code`/`prov_code`/`comarca_code`, además de
`ine_code`/`search`).

- **Dos renombres, con redirección permanente**
  (`lib/config/redirects.ts`, spec §4.5): «Recursos» de la entidad pasa a
  llamarse **Biblioteca** (`/entidad/[slug]/biblioteca`, antes
  `/recursos`) y «Contratos» de plataforma pasa a **Suscripciones**
  (`/plataforma/suscripciones`, antes `/contratos`) — un marcador o un
  enlace viejo no se quedan en 404, la ruta anterior redirige con 308
  (`permanent: true`). **Decisión 2 del plan, ya aplicada de origen**:
  solo cambian el nombre visible del menú y la ruta del panel; la API no
  cambia (`/api/panel/entidad/{id}/resources/` sigue igual, la app
  `billing` del backend también), ni el fichero de componente
  (`RecursosPanel.tsx`, `ContratosPanel.tsx` siguen llamándose así) ni el
  *namespace* interno de catálogo de i18n (`entidad.recursos.*`,
  `plataforma.contratos.*` en `messages/*.json` — solo `menu.*`/`pages.*`/
  `help.*` usan ya el nombre nuevo). Quien busque «Contratos» en el
  código encontrará el componente y el modelo de dominio intactos: es a
  propósito.
- **El área de administración, cuatro secciones**
  (`lib/auth/paraguasMenu.ts::paraguasMenuFor`): `/paraguas/[slug]` pasa
  de 2 a 4 secciones — **Inicio** (`ParaguasHomeDashboard`, un resumen de
  dos bloques, «Tu territorio» y «Red financiada», cada uno con sus
  tarjetas y un enlace «Ver el territorio»/«Ver la red financiada», sin
  selector de periodo propio), **Territorio** (`TerritorioDashboard`, el
  observatorio nuevo de este bloque, ver más abajo), **Red financiada**
  (`ParaguasMetricsDashboard`, el dashboard de paraguas de siempre sobre
  el árbol `parent`/`children` — mismo componente de la tarea W2/W2b,
  solo cambia de ruta) e **Informes** (`ExportPanel` con
  `scopeChoices={["territorio", "paraguas"]}`, ver más abajo). Las tres
  primeras solo piden `ver_panel`, así que las ven los cinco roles de
  entidad; Informes sigue acotada a `exportar_informes`
  (`titular`/`moderador`/`analista`), igual que documentaba W6.
  **Territorio ≠ árbol de entidades**: una administración declara su
  territorio sobre sí misma (geografía), mientras que «Red financiada»
  sigue mirando qué entidades cuelgan de ella (`parent`) — las dos cosas
  son independientes, una diputación puede tener territorio declarado
  sin financiar ninguna entidad todavía, o al revés.
- **`isParaguas` por `is_administration`, con precedencia sobre
  `organization_type`** (`lib/auth/area.ts`): el backend deriva
  `OrgMembershipRef.is_administration` de `org_type` (spec §3.5) para que
  el panel deje de comparar cadenas; `isParaguas` lo mira primero, **con
  precedencia incluso cuando vale `false` explícito** (un backend que ya
  sirve el campo es la autoridad, un `organization_type` heredado no
  puede contradecirlo), y solo cae al respaldo histórico por
  `organization_type`/`org_type` (el de la tarea W1) cuando el campo
  **no viene en absoluto** — un backend anterior al despliegue de este
  bloque. `lib/api/types.ts::OrgMembershipForArea` re-ensancha
  `is_administration` a opcional a propósito para ese respaldo, aunque el
  esquema regenerado ya lo declara obligatorio (ver «Tipos regenerados»
  más abajo): es el caso de prueba que `lib/auth/area.test.ts` fija
  explícitamente, no un descuido.
- **El mapa** (`components/metrics/TerritoryMap.tsx` +
  `TerritoryMapCanvas.tsx`): `react-leaflet` cargado con
  `next/dynamic({ssr: false})` (Leaflet toca `window` al importarse, no
  sobrevive a un render de servidor) y mockeado entero en
  `vitest.setup.ts` (Vitest no tiene un DOM real de Leaflet). El
  contenedor es `role="img"` con `aria-label` describiendo el periodo, y
  lleva `zoomControl={false}`/`keyboard={false}`/`attributionControl={false}`
  — el mapa **nunca** es la única puerta a la información: la tabla «Por
  municipio» de debajo es la alternativa completa, con un botón «Ver
  ficha de `<municipio>`» por fila que abre el mismo panel lateral que un
  clic en una burbuja. La atribución de OpenStreetMap se pinta aparte,
  como un `<a>` real **fuera** del `role="img"` (si no, sería contenido
  interactivo escondido dentro de una imagen para el árbol de
  accesibilidad). `lib/metrics/mapScale.ts` calcula radio (raíz cuadrada
  del área, para que el ojo lea «el doble de actividades» y no «cuatro
  veces más») y color: la rampa de tres tonos y el gris de supresión son
  **literales hexadecimales**, no `var(--…)` — Leaflet 1.9.4 escribe
  `stroke`/`fill` como atributos de presentación SVG, y ningún navegador
  resuelve una variable CSS dentro de un atributo de presentación (hallazgo
  crítico C1 de la revisión final de rama);
  `lib/metrics/mapScale.test.ts` ata esos literales a `app/globals.css`
  con un test automático, mismo patrón que `lib/a11y/tokens.test.ts` —
  el mapa es la única superficie del panel cuyo color no sale de un
  token, y es a propósito, documentado ahí mismo.
- **Desviación documentada (decisión 1 del plan, misma clase que la de
  W2)**: la tabla «Por municipio» de Territorio no lleva una columna de
  tasa de asistencia — `ByPlaceRow` no la trae, igual que en la tabla «Por
  municipio» de W2. `PlaceSheetPanel` (la ficha de un municipio) sí
  enseña «Asistencia» porque `PlaceSheet.attendance` es un campo propio
  de esa ruta, distinto de `ByPlaceRow`.
- **El 409 `sin_territorio`** (`hooks/useMetrics.ts`, `useCompare.ts`,
  `useExport.ts`): el único ámbito que puede responder 409 es
  `territorio` (spec §3.1) — una administración sin territorio
  declarado, que no es un fallo de la pantalla sino una configuración que
  falta. Los tres hooks lo traducen a su propio `kind`
  (`sin_territorio`), y `TerritorioDashboard`/`ExportPanel` lo pintan con
  un `EmptyState` (nunca un `ErrorState`) que explica qué falta y, cuando
  hay permiso, enlaza a la ficha de plataforma para declararlo.
- **Plataforma: sede, nivel y territorio, solo `superadmin`** (decisión 4
  del plan, `components/plataforma/{SedeSelector,TerritorioForm}.tsx`,
  pestaña Datos de `EntidadDetail.tsx`): el nivel administrativo
  (`admin_level`) y el territorio (`territory_kind`/`territory_code`,
  `entities.services.territory.set_territory` en el backend) solo los
  edita la plataforma, nunca el titular — una administración no se
  autoasigna territorio (spec §2.3). Con cualquier otro rol de
  plataforma, `EntidadDetail` sigue pintando los mismos datos en solo
  lectura dentro de su `<dl>` (nunca oculto sin más, decisión del
  coordinador del bloque). **Vista previa «N municipios»**
  (`hooks/usePlaces.ts::usePlacesCount`, con retardo de
  `useDebouncedValue`): con `municipios` se cuentan los códigos ya
  escritos en el cliente (exacto, no toca la red); con uno de los tres
  atajos (`ccaa`/`provincia`/`comarca`) se pide el `count` de
  `GET /api/places/` filtrado por su código — los tres filtros de código
  ya los expone el backend de este mismo bloque, no es uno de los
  pendientes de abajo. Mientras no haya código escrito, o justo después
  de guardar, se muestra `territory_places_count` (el valor ya guardado,
  que el backend recalcula al expandir el `OrgScope`).
- **Sede obligatoria** (`SedeSelector.tsx`, spec §2.1/§4.3): buscador de
  municipio por nombre (nunca el código INE crudo, resuelto con
  `usePlacesByIne`/`placeLabelState`), compartido por el alta de entidad
  (`NuevaEntidadDialog`, obligatoria desde el primer `POST`), la ficha de
  plataforma (`EntidadDetail`) y **Configuración de la entidad**
  (`ConfiguracionPanel.tsx`, el propio titular edita su sede). El
  `<select>` no ofrece «Sin municipio»: el backend rechaza
  `PATCH {place: null}` con `allow_null: False` desde este bloque
  (confirmado en `entities/serializers.py`); una entidad legado sin sede
  se ve como «Sin municipio» de todos modos (el modelo sí admite
  `place=NULL` para las que no se tocaron), pero guardar exige elegir una
  antes.
- **Tipos regenerados** (`npm run gen:types` contra el backend fusionado
  de este bloque): `AdminLevel`/`OrganizationCreateInput` pasan a ser
  alias directos del esquema generado (`AdminLevelEnum | BlankEnum`, y
  `OrganizationCreateRequest` sin ensanchar — el generado ya marca
  `place` obligatorio). Tres siguen manuales, con el motivo real
  documentado en `lib/api/types.ts` junto a cada uno: `TerritoryKind`
  (el `Organization.territory_kind` generado no incluye la variante en
  blanco pese a que el backend la sirve para cualquier organización sin
  territorio — confirmado leyendo `entities/models.py`/`entities/
  services/territory.py`, no solo el esquema); `Organization.place`
  (sigue nullable a mano: el generado lo marca `string` a secas, pero el
  modelo admite `place=NULL` para una entidad legado, y `allow_null:
  False` del serializer solo bloquea **escribir** `null`, no que un `GET`
  lo devuelva). `PlaceSheetPlace` **dejó de ser manual** en el cierre del
  bloque: el esquema documentaba mal `PlaceSheet.place` (apuntaba al
  `PlaceRef` recortado de `users/profile_serializers.py` por una colisión
  de nombre de clase con el serializador real de `panel/serializers.py`),
  el backend renombró el suyo a `PlaceSheetPlaceSerializer` y el tipo es
  ya un alias de `components["schemas"]["PlaceSheetPlace"]`. `PlaceRow`/
  `PaginatedPlaceList` se quedan manuales por los mismos quirks ya
  documentados para otros listados paginados de este fichero
  (envoltorio con todos los campos opcionales) y por una nulabilidad de
  `latitude`/`longitude` deliberadamente más defensiva que el contrato
  (el modelo nunca las guarda a `null`, pero `lib/metrics/mapScale.ts`
  ya sabía descartar en silencio una coordenada corrupta, y esa
  cobertura no se retira solo porque el esquema sea más estricto).

**Pendientes conocidos, del backend (no de este repo):**

- **No hay un agregado de «organizaciones con sede en el territorio»**
  (decisión 5 del plan): `PlaceSheet.organizations_based_here` cuenta
  entidades con sede en **un** municipio, pero no existe una ruta que
  agregue ese recuento para todo el territorio declarado a la vez —
  quien quiera esa cifra hoy tiene que sumar ficha a ficha.
- **`ByPlaceRow` sigue sin tasa de asistencia por fila** (decisión 1,
  arrastrado de W2): la tabla «Por municipio» de Territorio tiene la
  misma limitación que la de W2, por el mismo motivo.

Verificado contra el backend real, no solo contra `docs/schema.yaml`
(`e2e/territorio.spec.ts`, analista GFA — provincia 20, 88 municipios):
la tabla pinta filas reales con al menos una celda `<5`/`—`, el mapa es
`role="img"` con su `aria-label`, y la ficha de un municipio (Irun) nunca
nombra personas ni entidades — solo agregados, con el aviso literal de
invariante 1 siempre visible.
