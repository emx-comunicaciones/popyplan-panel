/**
 * Menú lateral del panel de plataforma (decisión «Panel de plataforma»,
 * plan de Fase 5). En W1 lo ven igual los cuatro roles de
 * `safety.PlatformRole` (`superadmin`, `verifier`, `moderator`,
 * `support`): filtrar qué sección puede *usar* cada uno (p. ej. Roles
 * solo `superadmin`) es tarea de las páginas de plataforma (P5-P7), no de
 * esta plantilla.
 */
export const PLATAFORMA_MENU_ITEMS = [
  "inicio",
  "entidades",
  "reportes",
  "ayuda",
  "verificaciones",
  "roles",
  "auditoria",
  "metricas",
] as const;

export type PlataformaMenuItem = (typeof PLATAFORMA_MENU_ITEMS)[number];

export const PLATAFORMA_MENU_LABELS: Record<PlataformaMenuItem, string> = {
  inicio: "Inicio",
  entidades: "Entidades",
  reportes: "Reportes",
  ayuda: "Ayuda",
  verificaciones: "Verificaciones",
  roles: "Roles",
  auditoria: "Auditoría",
  metricas: "Métricas",
};
