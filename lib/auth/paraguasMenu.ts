/**
 * Menú lateral del panel de paraguas.
 *
 * Bloque 1 de territorio (spec §4.1): el área de paraguas pasa a ser el
 * **área de administración** y su menú de 2 a 4 secciones — Inicio,
 * Territorio (observatorio del territorio declarado), Red financiada
 * (el dashboard de paraguas de siempre, sobre el árbol `parent`) e
 * Informes. La ruta no cambia (`/paraguas/[slug]`), para no romper
 * marcadores ni los e2e existentes. Las tres primeras solo piden
 * `ver_panel`, así que las ven los cinco roles; Informes sigue acotada a
 * `exportar_informes` (`titular`/`moderador`/`analista`).
 */
import { isEntidadPanelRole, type EntidadPanelRole } from "./area";

export const PARAGUAS_MENU_ITEMS = ["inicio", "territorio", "red-financiada", "informes"] as const;

export type ParaguasMenuItem = (typeof PARAGUAS_MENU_ITEMS)[number];

/**
 * Claves de traducción de cada sección (tarea i18n 2), no el texto en
 * español: `app/paraguas/[slug]/layout.tsx` (Server Component) resuelve
 * `t(PARAGUAS_MENU_LABELS[item])` con `getTranslations()`. Mismo patrón
 * que `lib/auth/entidadMenu.ts::ENTIDAD_MENU_LABELS` — las claves reales
 * viven en `messages/*.json::menu.paraguas.*`.
 */
export const PARAGUAS_MENU_LABELS: Record<ParaguasMenuItem, string> = {
  inicio: "menu.paraguas.inicio",
  territorio: "menu.paraguas.territorio",
  "red-financiada": "menu.paraguas.redFinanciada",
  informes: "menu.paraguas.informes",
};

/** Roles con `exportar_informes` (`docs/PANEL.md` §2.1). */
const EXPORTA_INFORMES: readonly string[] = ["titular", "moderador", "analista"];

export function paraguasMenuFor(role: EntidadPanelRole | string): ParaguasMenuItem[] {
  if (!isEntidadPanelRole(role)) return [];

  return PARAGUAS_MENU_ITEMS.filter(
    (item) => item !== "informes" || EXPORTA_INFORMES.includes(role),
  );
}
