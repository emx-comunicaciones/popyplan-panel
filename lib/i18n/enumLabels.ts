/**
 * Etiquetas traducidas de los valores internos del contrato (roles,
 * tipos de objetivo…) que antes se pintaban tal cual —`owner`,
 * `moderator`, `comment`— en las pantallas (informe del panel, error 51).
 * Mapas `valor → clave` como en el resto del panel (nunca una clave
 * construida por concatenación); `enumLabel` cae al valor crudo si el
 * backend añade uno nuevo que aquí no se conoce.
 */
export const ORG_ROLE_LABEL_KEYS: Record<string, string> = {
  titular: "enums.orgRole.titular",
  moderador: "enums.orgRole.moderador",
  dinamizador: "enums.orgRole.dinamizador",
  analista: "enums.orgRole.analista",
  referente: "enums.orgRole.referente",
  voluntario: "enums.orgRole.voluntario",
};

export const COMMUNITY_ROLE_LABEL_KEYS: Record<string, string> = {
  owner: "enums.communityRole.owner",
  moderator: "enums.communityRole.moderator",
  member: "enums.communityRole.member",
};

export const REPORT_TARGET_LABEL_KEYS: Record<string, string> = {
  user: "enums.reportTarget.user",
  community: "enums.reportTarget.community",
  event: "enums.reportTarget.event",
  post: "enums.reportTarget.post",
  comment: "enums.reportTarget.comment",
  message: "enums.reportTarget.message",
  organization: "enums.reportTarget.organization",
};

export const ORG_TYPE_LABEL_KEYS: Record<string, string> = {
  asociacion: "plataforma.entidades.orgTypeAsociacion",
  ong: "plataforma.entidades.orgTypeOng",
  administracion: "plataforma.entidades.orgTypeAdministracion",
};

export function enumLabel(keys: Record<string, string>, value: string, t: (key: string) => string): string {
  const key = keys[value];
  return key ? t(key) : value;
}
