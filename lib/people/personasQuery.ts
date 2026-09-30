/**
 * Filtros de la tabla de Personas en la URL (informe del panel, error 30):
 * al abrir una ficha y volver (con «Atrás» o con el enlace «Volver a
 * Personas» de la ficha) la tabla reaparece tal como se dejó. Solo viajan
 * los valores con contenido; cualquier clave que no sea de esta lista se
 * descarta, así que un enlace manipulado no puede colar nada más.
 */
export interface PersonasUrlState {
  search: string;
  community: string;
  referent: string;
  activeSince: string;
  joinedSince: string;
  includeInvited: boolean;
  page: number;
}

export const EMPTY_PERSONAS_URL_STATE: PersonasUrlState = {
  search: "",
  community: "",
  referent: "",
  activeSince: "",
  joinedSince: "",
  includeInvited: false,
  page: 1,
};

const PARAMS = {
  search: "q",
  community: "comunidad",
  referent: "referente",
  activeSince: "activa_desde",
  joinedSince: "alta_desde",
  includeInvited: "invitadas",
  page: "pagina",
} as const;

/** Estado de la tabla a partir de una query (`URLSearchParams` o su texto). */
export function parsePersonasQuery(source: URLSearchParams | string | null | undefined): PersonasUrlState {
  const params = typeof source === "string" ? new URLSearchParams(source) : (source ?? new URLSearchParams());
  const page = Number.parseInt(params.get(PARAMS.page) ?? "", 10);
  const referent = params.get(PARAMS.referent) ?? "";
  return {
    search: params.get(PARAMS.search) ?? "",
    community: params.get(PARAMS.community) ?? "",
    referent: /^\d+$/.test(referent) ? referent : "",
    activeSince: params.get(PARAMS.activeSince) ?? "",
    joinedSince: params.get(PARAMS.joinedSince) ?? "",
    includeInvited: params.get(PARAMS.includeInvited) === "1",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** Query (sin `?`) con solo los filtros activos; vacía si no hay ninguno. */
export function buildPersonasQuery(state: PersonasUrlState): string {
  const params = new URLSearchParams();
  if (state.search) params.set(PARAMS.search, state.search);
  if (state.community) params.set(PARAMS.community, state.community);
  if (state.referent) params.set(PARAMS.referent, state.referent);
  if (state.activeSince) params.set(PARAMS.activeSince, state.activeSince);
  if (state.joinedSince) params.set(PARAMS.joinedSince, state.joinedSince);
  if (state.includeInvited) params.set(PARAMS.includeInvited, "1");
  if (state.page > 1) params.set(PARAMS.page, String(state.page));
  return params.toString();
}

/** Deja pasar solo las claves de los filtros: para el `?volver=` de la ficha. */
export function sanitizePersonasQuery(raw: string | null | undefined): string {
  return buildPersonasQuery(parsePersonasQuery(raw ?? ""));
}
