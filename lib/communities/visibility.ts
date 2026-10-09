import type { CommunityVisibility } from "@/lib/api/types";

/** Todas, en el orden en que se ofrecen. */
export const ALL_VISIBILITIES: readonly CommunityVisibility[] = ["open", "on_request", "private_listed", "private"];

/** Clave del texto de cada visibilidad (`entidad.familias.*`). */
export const VISIBILITY_LABEL_KEY: Record<CommunityVisibility, string> = {
  open: "entidad.familias.visibilityOpen",
  on_request: "entidad.familias.visibilityOnRequest",
  private_listed: "entidad.familias.visibilityPrivateListed",
  private: "entidad.familias.visibilityPrivate",
};

/**
 * Visibilidades que se pueden elegir. El espacio de familias es siempre
 * privado (decisión del propietario, 2026-10-01; el backend responde 400 a
 * cualquier otra): solo «Privada», más la actual si una comunidad antigua
 * estaba abierta, para que se pueda editar sin tocarla o cerrarla.
 */
export function visibilityOptions(
  space: "members" | "families" | string | undefined,
  current?: CommunityVisibility,
): CommunityVisibility[] {
  if (space !== "families") return [...ALL_VISIBILITIES];
  return current && current !== "private" ? [current, "private"] : ["private"];
}
