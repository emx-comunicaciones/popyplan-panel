# Admin de plataforma: lo que tenía el admin antiguo (2026-09-26)

Encargo del propietario (2026-09-25/26): «en el popyplan antiguo teníamos un
admin para todos los usuarios y opciones de hacer el juego de busca del
tesoro. Esto no lo tenemos en el panel nuevo. Mira el antiguo y cópialo en
este, añadiendo a lo que ya tenemos». Sobre la búsqueda del tesoro: «es una
forma de hacer marketing creando nosotros un juego y hacer publi en redes con
un tesoro bueno; después la gente seguiría usando la app. La idea sería
implementarla como una actividad un poco más compleja». Instrucción de
trabajo: por bloques, sin pararse, decidiendo con criterio propio.

Origen: `~/Code/admin-popylop` (Next.js 16, un solo commit de 2026-07-23)
contra el backend antiguo `~/Code/POP`. Inventario completo hecho el
2026-09-26 (usuarios, búsqueda del tesoro, chats, comunidades, eventos,
notificaciones, reseñas, sorteos, gamificación, nomencladores).

## Qué se porta y qué no

Ya cubierto en `/plataforma`: reportes (`safety/reports`), verificaciones,
métricas/inicio (`dashboard-stats`), suscripciones (los «payment-plans» del
antiguo eran datos fijos). No se porta: sorteos y gamificación (apps
aparcadas en el backend), nomencladores de citas (géneros, orientación,
objetivos de relación… — ya no existen en el backend nuevo, el producto dejó
de ser de citas), login `admin-login` (retirado a propósito; el panel entra
por el login único).

## Bloque 1 — Usuarios y bloqueos (solo panel)

- `/plataforma/usuarios`: listado paginado (`GET /api/users/users/`,
  búsqueda y filtros `is_active`/`is_verified`), alta
  (`POST /api/auth/admin-register/`), ficha `/plataforma/usuarios/[id]`
  (`GET/PATCH/DELETE /api/users/{id}/`): datos de perfil, desactivar /
  reactivar (`is_active`), borrar con `ConfirmDialog`.
- `/plataforma/bloqueos`: bloqueos entre personas
  (`GET /api/safety/blocks/admin/`, revocar `DELETE .../{id}/admin/`).
- Visibilidad: solo `superadmin` (los endpoints exigen `is_staff`, que hoy
  solo tiene `superadmin`; mismo razonamiento que `dashboard-stats`).
- Invariante 9 se mantiene para el panel de **entidad**; el admin de
  plataforma sí ve el email de la cuenta (es gestión de cuentas, no de
  personas de una entidad) pero nunca documentos ni notas.

## Bloque 2 — Búsqueda del tesoro como actividad

**Backend (`~/Code/popyplan/treasure_hunt`)** — reconectar la app:

1. `Game.event` (OneToOne a `events.Event`, nullable) sustituye a
   `Game.plan`. Crear un juego crea su `Event` (título, descripción, imagen,
   `starts_at = start_time`, `ends_at = start_time + duration_minutes`,
   `organizer = created_by`, `audience = 'anyone'`, aforo
   `max_participants`), y editarlo lo mantiene sincronizado; borrar el juego
   borra su actividad. Así el juego aparece en la agenda y el descubrimiento
   de la app como cualquier actividad. `Game.plan` se deja en el modelo sin
   uso (se retira en una migración aparte cuando se retire la app `plans`).
2. Unirse a un juego inscribe también en la actividad (`EventAttendance`);
   salir la retira.
3. Fuera la dependencia de `UserMatch`: ya no hay emparejamiento. Invitar o
   unirse a un equipo solo se rechaza si hay un bloqueo entre las dos
   personas (`safety`). `access-options` pierde la lista de «matches».
4. Juegos de pago: fuera de esta versión. Crear o editar con
   `is_paid=True` responde 400 con un mensaje claro; el flujo de
   `payments` no se toca.
5. Permiso de administración: `is_staff` **o** `PlatformRole` superadmin.
6. `router.register('treasure-hunt', …)`, tests de cada ruta viva,
   `docs/schema.yaml` regenerado.

**Panel** — `/plataforma/busca-del-tesoro` (listado, alta/edición/borrado)
y ficha `/plataforma/busca-del-tesoro/[id]` con pestañas Datos
(abrir/empezar/terminar), Pruebas (CRUD de pistas con ubicación y tipo de
prueba), Premios (tramos), Participantes (filtro por estado,
aprobar/rechazar) y Ranking. Solo `superadmin`.

**App móvil** — en la ficha de una actividad que es un juego, una tarjeta
«Búsqueda del tesoro» con unirse y «Jugar»: pantalla con la pista actual,
pista extra, enviar respuesta (texto o ubicación por GPS según el tipo de
prueba), progreso y ranking. Primera versión solo individual; equipos y
pago quedan para después.

## Bloque 3 — El resto de secciones del admin antiguo

Todas solo `superadmin`, sobre endpoints que ya existen:

- **Comunidades** (`/plataforma/comunidades`): listado global, ficha con
  miembros, publicaciones (ocultar/borrar) y desactivar.
- **Actividades** (`/plataforma/actividades`): listado global de
  `/api/events/`, cancelar.
- **Notificaciones** (`/plataforma/notificaciones`): enviar a una persona o
  a todas (`notifications/send/`) y plantillas (`notification-templates`).
- **Reseñas** (`/plataforma/resenas`): listado y borrar.
- **Chats** (`/plataforma/chats`): el soporte lee una conversación y
  responde como Popyplan (`/api/admin/chats/`).
- **Nomencladores** (`/plataforma/nomencladores`): CRUD de los catálogos
  que siguen vivos (aficiones, categorías de afición, idiomas, categorías y
  subcategorías de comunidad y de actividad).

## Reglas comunes

Mismos patrones del panel (CLAUDE.md): Server Component con gate por
`plataformaMenuFor`, hooks con `kind` de error, i18n en los cuatro
catálogos, `axe` en las páginas nuevas, ayuda por pantalla en `PAGE_HELP`,
cobertura por encima del umbral, e2e cuando aporte.
