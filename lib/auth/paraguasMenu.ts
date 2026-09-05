/**
 * Menú lateral del panel de paraguas (tarea W2): «Inicio» (métricas
 * agregadas) e «Informes» (exportación CSV/PDF). Todos los roles de
 * `OrgMembership` con `ver_panel` que resuelven a una entidad paraguas
 * ven las mismas dos secciones en esta tarea; filtrar por rol (si algún
 * día hace falta) es un cambio en este fichero, como en
 * `lib/auth/entidadMenu.ts`.
 */
export const PARAGUAS_MENU_ITEMS = ["inicio", "informes"] as const;

export type ParaguasMenuItem = (typeof PARAGUAS_MENU_ITEMS)[number];

export const PARAGUAS_MENU_LABELS: Record<ParaguasMenuItem, string> = {
  inicio: "Inicio",
  informes: "Informes",
};
