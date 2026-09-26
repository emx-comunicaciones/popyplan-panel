# Entrenamiento: catálogo en Nomencladores y nivel de actividad (2026-09-26)

Spec: `~/Code/popyplan/docs/superpowers/specs/2026-09-26-entrenamiento-design.md`.
Contrato: `~/Code/popyplan/docs/PANEL.md` §17 (backend `b03324d`,
`training/`). Parte del panel del módulo de entrenamiento: el resto
(registrar entrenos, rutinas, perfil deportivo, publicar en el muro) es de
la app móvil.

## Regla que manda

**El entrenamiento es privado.** El panel no tiene ni un endpoint, ni un
tipo, ni una pantalla contra entrenos (`/api/training/workouts/`), rutinas
propias (`?scope=mine`), perfil deportivo (`/api/training/profile/`) ni
historial (`/api/training/stats/`). `lib/api/endpoints.ts::TRAINING` solo
declara disciplinas, ejercicios y plantillas, y `useSystemTemplates` pide
siempre `?scope=system` (test que comprueba que nunca sale `scope=mine`).
El texto de ayuda y la pista de Plantillas lo dicen en pantalla.

## Nomencladores → Entrenamiento (solo superadmin)

El selector de `NomencladoresPanel.tsx` gana un `<optgroup>`
«Entrenamiento» con tres catálogos. No caben en `CATALOG_CONFIG` de
`hooks/useCatalogs.ts` (nombres traducibles, ejercicios ordenados dentro
de una plantilla), así que cada uno es su propio componente en
`components/plataforma/nomencladores/`:

- `DisciplinasCatalog.tsx` — código, nombres es/eu/ca, tipo de medida
  (`strength|endurance|route` → Fuerza/Resistencia/Ruta), icono, orden,
  activo. Borrar una en uso → 409 «Está en uso y no se puede borrar;
  desactívalo en su lugar.», pintado literal dentro del `ConfirmDialog`.
- `EjerciciosCatalog.tsx` — filtro por disciplina (`?discipline=<id>`),
  alta con la disciplina del filtro, escritura con `discipline_id`,
  métrica (`weight_reps|reps|time|distance`) y grupo muscular opcional.
  Borrar nunca da 409 (plantillas y entrenos usan `SET_NULL` y guardan
  copia del nombre).
- `PlantillasEntrenamientoCatalog.tsx` — plantillas de Popyplan con su
  lista ordenada de ejercicios: del catálogo de la disciplina (solo los
  activos, más el ya elegido) o nombre libre + métrica; series (1-50) y
  los valores por defecto que tocan según la métrica (`weight_reps` →
  repeticiones y peso; `reps` → repeticiones; `time` → segundos;
  `distance` → distancia y segundos). Subir/bajar/quitar/añadir. La
  lógica pura vive en `lib/training/templateForm.ts` (100 % de líneas).
- `trainingShared.tsx` — clases, mapas de etiquetas y los tres campos de
  nombre.

Hook: `hooks/useTrainingCatalog.ts` (`TrainingCatalogError` con `kind`
`invalido|sin_acceso|no_encontrado|en_uso|demasiadas_paginas|desconocido`
y `detail` literal en 400/403/409). Los tres listados **paginan** de
verdad (26 ejercicios sembrados = dos páginas) y se recorren con tope que
lanza. Cualquier escritura invalida todo el prefijo
`panel-training-catalog`.

### Decisiones

- **Nombres**: se leen los crudos `name_es`/`name_eu`/`name_ca` y se
  escribe `name` (castellano), `name_eu`, `name_ca`. Las tablas pintan
  `name_es`; la disciplina anidada de ejercicios/plantillas (`DisciplineRef`
  solo trae `name`) sale en el idioma de la interfaz.
- **Cambiar la disciplina de una plantilla** convierte sus ejercicios del
  catálogo en ejercicios libres (mismo nombre y métrica) en vez de
  borrarlos: el backend rechazaría ejercicios de otra disciplina (400).
- **`discipline_id` al editar solo si cambió**: el backend solo acepta
  disciplinas activas, y reenviar la de una plantilla cuya disciplina se
  desactivó daría 400 sin motivo. Una disciplina inactiva no se ofrece en
  los selects salvo la ya elegida.
- **Solo los valores de la métrica viajan**: un peso tecleado y luego
  pasado a «tiempo» no se cuela en la plantilla. Coma decimal aceptada;
  los decimales viajan como cadena con punto.
- Con un ejercicio del catálogo no se manda `name` (el backend copia el
  del catálogo).

## Nivel de actividad

`events.Event.level` (`""|beginner|intermediate|advanced`, `""` = todos
los niveles, §17.6): select «Nivel» en `ActividadForm.tsx` (alta y
edición; al crear, `""` no se manda; al editar solo viaja si cambió, con
`""` para quitarlo) y una fila «Nivel» en el detalle de actividad de
plataforma. Valores y claves en `lib/events/level.ts`; etiquetas en
`events.levels.*`.

## Mismatches esquema ↔ backend

- `TemplateItem.metric` sale opcional en el esquema; al leer siempre viene
  → `TrainingTemplateItem` lo estrecha.
- `PatchedWorkoutTemplateWriteRequest.system` y `TemplateItemRequest.sets`
  salen obligatorios (quirk de spectacular con `default`) → tipos de
  escritura manuales (`TrainingTemplateWrite`, `TrainingTemplateItemWrite`).
- `EntityEventRow` (`GET /api/panel/entidad/{id}/events/`) **no trae
  `level`**: la tabla de Actividades de la entidad no lo enseña (haría falta
  pedir el detalle de cada fila). Pendiente del backend: añadir `level` a
  `panel/serializers.py::EntityEventRowSerializer`.
- `DELETE` de una plantilla de Popyplan no captura `ProtectedError`, pero
  hoy no hay nada que proteja una plantilla (`Workout.template` es
  `SET_NULL`), así que no hay 500 posible.

## Verificado contra el backend real

`next start` en :3500 contra el backend sembrado: superadmin cambió
series y peso del primer ejercicio de «Pecho + tríceps» (PATCH 200, lista
de 6 ejercicios reemplazada) y lo restauró (4 series, sin peso); borrar
«Gimnasio» dio el 409 literal dentro del diálogo; los 26 ejercicios se
cargaron (dos páginas). Titular de Asociación Bidasoa creó una actividad
con nivel «Intermedio» (201, `level: "intermediate"`), el formulario de
edición lo precargó y se canceló después (200).

## i18n

Claves nuevas en los cuatro catálogos: `plataforma.nomencladores.training.*`,
`plataforma.nomencladores.groups.*`, `errors.trainingCatalog.*`,
`events.levels.*`, `entidad.actividadForm.levelLabel`,
`plataforma.actividades.levelHeader`; ayuda de Nomencladores y
Actividades ampliada. `eu`/`ca` de métricas, tipos, grupos musculares y
niveles copiados del `.po` del backend; el resto, traducción asistida
pendiente de revisión nativa (`docs/i18n/PENDIENTES.md`).
