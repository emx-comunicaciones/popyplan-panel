/**
 * `GET .../people/?include_invited=true` (`docs/PANEL.md` §3b.7, tarea
 * W3b) mezcla filas `PersonRow` (personas ya de alta) con
 * `InvitedPersonRow` (invitaciones `pending`) en el mismo listado
 * paginado. Ninguna de las dos formas se puede distinguir por su tipo en
 * tiempo de ejecución sin mirar sus campos: `InvitedPersonRow` es la
 * única que lleva `invitation_id`, así que ese campo es el discriminador.
 */
import type { InvitedPersonRow, PersonListRow } from "@/lib/api/types";

export function isInvitedPersonRow(row: PersonListRow): row is InvitedPersonRow {
  return "invitation_id" in row;
}
