/**
 * Registro estático de ayuda por pantalla: una entrada por cada
 * `page.tsx` de `app/entidad/[slug]/**`, `app/paraguas/[slug]/**` y
 * `app/plataforma/**` (las cuatro páginas fuera de esas tres áreas —
 * login, elegir-entidad, accesibilidad, error/not-found — no tienen
 * botón de ayuda, decisión 3 del plan de «ayuda por pantalla»). Los
 * textos son los del brief de la tarea, transcritos literalmente.
 *
 * `lib/help/pageHelp.test.ts::"tiene exactamente una entrada por cada
 * page.tsx real..."` recorre `app/` de verdad y falla si una página
 * nueva no tiene entrada aquí, o si una entrada sobra sin fichero.
 */
export interface PageHelpEntry {
  /** Plantilla de ruta tal y como está en `app/` (con `[slug]`, `[userId]`…). */
  route: string;
  /** Nombre de la pantalla, tal y como aparece en el menú o en su <h1>. */
  title: string;
  /** Una o dos frases: para qué sirve. */
  summary: string;
  /** Qué se puede hacer aquí (2-4 puntos). */
  actions: readonly string[];
  /** Quién la ve (roles), una frase. */
  audience: string;
}

export const PAGE_HELP: readonly PageHelpEntry[] = [
  // Entidad (`/entidad/[slug]/…`)
  {
    route: "/entidad/[slug]",
    title: "Inicio",
    summary:
      "Vista general de tu entidad para hoy: actividades del día, avisos pendientes y las métricas del mes en curso.",
    actions: [
      "Ver las actividades de hoy y entrar en su lista de asistencia",
      "Ver cuántos avisos de ayuda y reportes hay pendientes (solo quien modera o está de guardia)",
      "Consultar personas, actividades y asistencia del mes",
    ],
    audience: "Todos los roles de la entidad.",
  },
  {
    route: "/entidad/[slug]/personas",
    title: "Personas",
    summary:
      "Las personas que participan en tu entidad, con sus comunidades, su actividad reciente y su referente. Nunca muestra datos de contacto: Popyplan trabaja con alias.",
    actions: [
      "Buscar y filtrar por comunidad, referente o fecha de alta",
      "Invitar a una persona o importar un Excel/CSV (titular y moderador)",
      "Abrir la ficha de cada persona",
      "Incluir las invitaciones pendientes y reenviarlas o revocarlas",
    ],
    audience: "Titular, moderador, dinamizador y referente.",
  },
  {
    route: "/entidad/[slug]/personas/[userId]",
    title: "Ficha de la persona",
    summary:
      "Resumen de la participación de una persona en tu entidad: comunidades, actividades del periodo y próxima actividad. Sin email, teléfono ni notas: la relación es siempre a través de la app.",
    actions: [
      "Asignar o cambiar su referente (titular y moderador)",
      "Ver su red de apoyo (solo su referente)",
      "Revisar a qué actividades se apuntó y si asistió",
    ],
    audience: "Titular, moderador, dinamizador y el referente de esa persona.",
  },
  {
    route: "/entidad/[slug]/comunidades",
    title: "Comunidades",
    summary:
      "Las comunidades de tu entidad y sus miembros: quién forma parte, quién modera y las solicitudes de entrada pendientes.",
    actions: [
      "Crear comunidades y elegir su visibilidad",
      "Aceptar o rechazar solicitudes de entrada",
      "Nombrar moderadores o expulsar a alguien (titular y moderador)",
    ],
    audience: "Titular, moderador y dinamizador.",
  },
  {
    route: "/entidad/[slug]/actividades",
    title: "Actividades",
    summary:
      "Las actividades del periodo con sus inscritos, asistentes y responsable.",
    actions: [
      "Filtrar por estado",
      "Entrar en la lista de asistencia de cada actividad",
      "Ver quién es responsable de cada una",
    ],
    audience: "Titular, moderador, dinamizador y referente.",
  },
  {
    route: "/entidad/[slug]/asistencia",
    title: "Asistencia",
    summary: "Elige una actividad para pasar lista o hacer el check-in por QR.",
    actions: [
      "Abrir la lista nominal de una actividad",
      "Marcar asistencia a mano o escanear el QR de la app",
    ],
    audience: "Titular, moderador y dinamizador.",
  },
  {
    route: "/entidad/[slug]/asistencia/[eventId]",
    title: "Lista de asistencia",
    summary:
      "Quién se apuntó a esta actividad y quién ha venido. El check-in por QR solo funciona desde dos horas antes hasta doce después del inicio.",
    actions: [
      "Marcar «asistió» o «no asistió» a cada persona",
      "Escanear el QR que la persona muestra en su app o pegar su código",
    ],
    audience: "Titular, moderador y dinamizador.",
  },
  {
    route: "/entidad/[slug]/comunicaciones",
    title: "Comunicaciones",
    summary:
      "Comunicaciones oficiales de la entidad a todos los miembros, a una comunidad o al espacio de familias, con su historial y el número de destinatarios.",
    actions: [
      "Redactar y enviar una comunicación (titular y moderador)",
      "Usar la plantilla de bienvenida a la red de apoyo cuando exista el espacio de familias",
      "Consultar el historial",
    ],
    audience: "Titular y moderador.",
  },
  {
    route: "/entidad/[slug]/encuestas",
    title: "Encuestas",
    summary:
      "Encuestas anónimas y agregadas: las periódicas que creas tú y las que la app envía sola tras cada actividad.",
    actions: [
      "Crear una encuesta periódica con sus preguntas (titular y moderador)",
      "Ver si está abierta o cerrada y entrar en sus resultados",
    ],
    audience: "Titular, moderador y dinamizador.",
  },
  {
    route: "/entidad/[slug]/encuestas/[surveyId]",
    title: "Resultados de la encuesta",
    summary:
      "Resultados agregados por pregunta. Con menos de cinco respuestas no se muestra el detalle, para que nadie sea identificable.",
    actions: [
      "Ver la media y la distribución de cada pregunta",
      "Leer las respuestas de texto sin orden ni autor",
    ],
    audience: "Titular, moderador y dinamizador.",
  },
  {
    route: "/entidad/[slug]/recursos",
    title: "Recursos",
    summary:
      "La biblioteca de contenidos de la entidad: textos, PDF, vídeos, audios y enlaces, organizados por categoría y dirigidos a miembros, familias o a cualquiera.",
    actions: [
      "Crear, editar o borrar recursos (titular y moderador)",
      "Elegir categoría y audiencia; «Cómo acompañar» es la categoría para la red de apoyo",
    ],
    audience: "Titular, moderador y dinamizador.",
  },
  {
    route: "/entidad/[slug]/familias",
    title: "Familias",
    summary:
      "El espacio de familias de la entidad, separado del de miembros: sus comunidades, próximas actividades, comunicaciones y recursos, y los contadores agregados de la red de apoyo. Nadie declara ser familiar de nadie.",
    actions: [
      "Crear la comunidad de familias (titular y moderador)",
      "Activar o desactivar el cruce de espacios de cada comunidad",
      "Ver cuántas personas tienen red de apoyo y cuántos apoyos esperan a que exista la comunidad",
    ],
    audience: "Titular, moderador y dinamizador.",
  },
  {
    route: "/entidad/[slug]/programas",
    title: "Programas",
    summary:
      "Campañas con fechas cerradas y presupuesto declarado, con su informe final agregado. Un programa nunca lista personas.",
    actions: [
      "Crear, activar y cerrar programas (titular y moderador)",
      "Descargar el informe CSV o PDF (titular, moderador y analista)",
    ],
    audience: "Todos los roles de la entidad.",
  },
  {
    route: "/entidad/[slug]/programas/[programId]",
    title: "Ficha del programa",
    summary: "Estado, fechas, presupuesto y métricas del programa en su periodo.",
    actions: [
      "Editar, activar o cerrar el programa con notas de cierre (titular y moderador)",
      "Descargar su informe",
    ],
    audience: "Todos los roles de la entidad; gestionar solo titular y moderador.",
  },
  {
    route: "/entidad/[slug]/reportes",
    title: "Reportes",
    summary:
      "Cola de reportes de moderación de tu entidad: qué se ha reportado, por qué y en qué estado está.",
    actions: [
      "Abrir cada reporte",
      "Asignarlo, resolverlo o escalarlo a la plataforma",
    ],
    audience: "Titular y moderador.",
  },
  {
    route: "/entidad/[slug]/reportes/[reportId]",
    title: "Detalle del reporte",
    summary:
      "Todo lo que hay que saber de un reporte para decidir: motivo, contenido reportado, historial y quién lo lleva.",
    actions: [
      "Asignar a una persona del equipo",
      "Resolver con una decisión",
      "Escalar a Popyplan si excede a la entidad",
    ],
    audience: "Titular y moderador.",
  },
  {
    route: "/entidad/[slug]/guardia",
    title: "Guardia",
    summary:
      "Los avisos «hoy lo llevo mal» de las personas de tu entidad y la configuración de quién está de guardia. Popyplan no guarda teléfonos: el contacto es por el chat de la app o a través del referente.",
    actions: [
      "Atender un aviso",
      "Elegir la persona de guardia y el teléfono de ayuda de la entidad",
      "Ver si alguien de la red de apoyo de la persona ya se ha hecho cargo",
    ],
    audience: "Titular, moderador y la persona de guardia.",
  },
  {
    route: "/entidad/[slug]/informes",
    title: "Informes",
    summary:
      "Exportación de las métricas de la entidad en CSV o PDF, por periodo y desglose, con la misma regla de agregación que el resto del panel.",
    actions: [
      "Elegir periodo y desglose (municipio, comarca, mes o año)",
      "Descargar el informe",
    ],
    audience: "Titular, moderador y analista.",
  },
  {
    route: "/entidad/[slug]/configuracion",
    title: "Configuración",
    summary:
      "Datos de la entidad, equipo con sus roles y referencias entre referentes y personas.",
    actions: [
      "Dar de alta o baja a alguien del equipo (solo titular)",
      "Asignar referencias",
      "Ajustar los datos y colores de la entidad",
    ],
    audience: "Titular y moderador; el equipo solo lo ve el titular.",
  },

  // Paraguas (`/paraguas/[slug]/…`)
  {
    route: "/paraguas/[slug]",
    title: "Inicio del paraguas",
    summary:
      "Métricas agregadas de todas las entidades de tu territorio: personas, actividades y asistencia por municipio, por entidad y por mes, y la comparativa con el periodo anterior. Nunca ves personas: cualquier grupo con menos de cinco se muestra como «<5».",
    actions: [
      "Cambiar el periodo",
      "Comparar comarcas, entidades o municipios con el periodo anterior",
    ],
    audience: "Titular, moderador y analista de la entidad paraguas.",
  },
  {
    route: "/paraguas/[slug]/informes",
    title: "Informes del paraguas",
    summary: "Exportación agregada del territorio en CSV o PDF.",
    actions: ["Elegir periodo y desglose", "Descargar el informe"],
    audience: "Titular, moderador y analista.",
  },

  // Plataforma (`/plataforma/…`)
  {
    route: "/plataforma",
    title: "Inicio de plataforma",
    summary:
      "Estado general de Popyplan: entidades verificadas y pendientes, reportes escalados, avisos de ayuda sin atender, contratos y facturas.",
    actions: ["Entrar en cada cola desde su tarjeta"],
    audience: "Equipo de Popyplan según su rol.",
  },
  {
    route: "/plataforma/entidades",
    title: "Entidades",
    summary: "Todas las entidades dadas de alta, verificadas o no.",
    actions: [
      "Buscar y filtrar por verificación",
      "Dar de alta una entidad nueva (verificador y superadmin)",
      "Abrir su ficha",
    ],
    audience: "Superadmin y verificador.",
  },
  {
    route: "/plataforma/entidades/[id]",
    title: "Ficha de la entidad",
    summary:
      "Datos, paraguas, ámbito territorial, equipo, métricas, comunidades y contrato de una entidad.",
    actions: [
      "Verificarla",
      "Asignarle un paraguas o ampliar su ámbito (superadmin)",
      "Gestionar su equipo",
    ],
    audience: "Superadmin y verificador; algunas pestañas solo superadmin.",
  },
  {
    route: "/plataforma/reportes",
    title: "Reportes escalados",
    summary: "Cola global de reportes que las entidades han escalado a Popyplan.",
    actions: [
      "Abrir cada reporte",
      "Asignarlo o resolverlo (moderador y superadmin); soporte solo consulta",
    ],
    audience: "Superadmin, moderador y soporte.",
  },
  {
    route: "/plataforma/reportes/[reportId]",
    title: "Detalle del reporte",
    summary:
      "Motivo, contenido, entidad de origen e historial de un reporte escalado.",
    actions: ["Asignar o resolver (moderador y superadmin)"],
    audience: "Superadmin, moderador y soporte.",
  },
  {
    route: "/plataforma/ayuda",
    title: "Avisos de ayuda",
    summary:
      "Avisos «hoy lo llevo mal» pendientes en toda la plataforma, para detectar entidades sin guardia que responda.",
    actions: ["Ver el aviso, su entidad y su referente", "Atenderlo si procede"],
    audience: "Superadmin, moderador y soporte.",
  },
  {
    route: "/plataforma/verificaciones",
    title: "Verificaciones",
    summary:
      "Revisiones de identidad pendientes: el recurso de la persona y el motivo del proveedor.",
    actions: ["Aprobar o rechazar con una nota"],
    audience: "Superadmin y verificador.",
  },
  {
    route: "/plataforma/roles",
    title: "Roles",
    summary: "Quién forma el equipo de Popyplan y con qué rol de plataforma.",
    actions: ["Conceder un rol buscando la cuenta", "Revocarlo"],
    audience: "Solo superadmin.",
  },
  {
    route: "/plataforma/auditoria",
    title: "Auditoría",
    summary:
      "Registro de acciones sensibles de todo el sistema, con filtros por actor, acción, objeto y fechas.",
    actions: ["Filtrar y revisar el registro", "Exportar la página actual a CSV"],
    audience: "Solo superadmin.",
  },
  {
    route: "/plataforma/metricas",
    title: "Métricas",
    summary:
      "Métricas agregadas de toda la plataforma, por territorio o por entidad, con comparativa entre periodos.",
    actions: ["Cambiar periodo y desglose", "Exportar"],
    audience: "Superadmin, moderador y soporte.",
  },
  {
    route: "/plataforma/contratos",
    title: "Contratos",
    summary: "Contratos de Popyplan con cada entidad, tramos de precio y facturas.",
    actions: [
      "Crear y activar contratos, tramos y facturas (superadmin)",
      "Marcar facturas como pagadas",
    ],
    audience: "Superadmin y soporte; soporte solo consulta.",
  },
];

/** Segmentos entre `[` y `]`, p. ej. `[slug]`, `[userId]`, `[eventId]`. */
const DYNAMIC_SEGMENT = /^\[.+\]$/;

/**
 * Convierte `/entidad/[slug]/personas/[userId]` en
 * `/^\/entidad\/[^/]+\/personas\/[^/]+\/?$/`: cada segmento dinámico
 * (`[algo]`) casa con exactamente un segmento no vacío de la ruta real
 * (sin `/`, así que no se cuela un segmento siguiente); los segmentos
 * literales se escapan tal cual. Una barra final opcional para que
 * `/entidad/x/personas/42` y `/entidad/x/personas/42/` casen igual.
 */
export function routeToRegExp(route: string): RegExp {
  const segments = route.split("/").filter((segment) => segment.length > 0);
  const pattern = segments
    .map((segment) =>
      DYNAMIC_SEGMENT.test(segment)
        ? "[^/]+"
        : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("\\/");
  return new RegExp(`^\\/${pattern}\\/?$`);
}

/**
 * Devuelve la entrada cuya plantilla casa con el pathname real, o
 * `null`. Cuando varias plantillas casarían, gana la más específica: la
 * de más segmentos (dos plantillas solo pueden casar con el mismo
 * pathname si tienen el mismo número de segmentos —el ancla `^…$` de
 * `routeToRegExp` lo impone—, así que en la práctica esta regla desempata
 * entre plantillas de igual longitud, quedándose con la primera si hay
 * empate real). Con las 32 rutas reales de `PAGE_HELP` nunca hay dos
 * plantillas que casen con el mismo pathname a la vez; `entries` es
 * sustituible en test para poder ejercitar esa rama sin inventar rutas
 * falsas en el registro real.
 */
export function matchPageHelp(
  pathname: string,
  entries: readonly PageHelpEntry[] = PAGE_HELP,
): PageHelpEntry | null {
  const matches = entries.filter((entry) =>
    routeToRegExp(entry.route).test(pathname),
  );
  if (matches.length === 0) return null;

  return matches.reduce((mostSpecific, candidate) =>
    segmentCount(candidate.route) > segmentCount(mostSpecific.route)
      ? candidate
      : mostSpecific,
  );
}

function segmentCount(route: string): number {
  return route.split("/").filter((segment) => segment.length > 0).length;
}
