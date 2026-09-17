/**
 * Menú lateral del panel de paraguas (tarea W2): «Inicio» (métricas
 * agregadas) e «Informes» (exportación CSV/PDF).
 *
 * Visibilidad por rol (corrección de auditoría, hallazgo M2): «Informes»
 * exporta con `PuedeEnEntidad('exportar_informes')` (`docs/PANEL.md`
 * §2.1), permiso que solo tienen `titular`, `moderador` y `analista` —
 * mismo criterio que `lib/auth/entidadMenu.ts`, donde Informes está
 * fuera del menú de `dinamizador` y `referente`. «Inicio» solo pide
 * `ver_panel`, así que la ven los cinco roles de panel.
 */
import { isEntidadPanelRole, type EntidadPanelRole } from "./area";

export const PARAGUAS_MENU_ITEMS = ["inicio", "informes"] as const;

export type ParaguasMenuItem = (typeof PARAGUAS_MENU_ITEMS)[number];

export const PARAGUAS_MENU_LABELS: Record<ParaguasMenuItem, string> = {
  inicio: "Inicio",
  informes: "Informes",
};

/** Roles con `exportar_informes` (`docs/PANEL.md` §2.1). */
const EXPORTA_INFORMES: readonly string[] = ["titular", "moderador", "analista"];

export function paraguasMenuFor(role: EntidadPanelRole | string): ParaguasMenuItem[] {
  if (!isEntidadPanelRole(role)) return [];

  return PARAGUAS_MENU_ITEMS.filter(
    (item) => item !== "informes" || EXPORTA_INFORMES.includes(role),
  );
}
