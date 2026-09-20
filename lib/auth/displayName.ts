/**
 * Nombre a mostrar de la cuenta propia (`Me.first_name`/`last_name`, los
 * dos opcionales en el esquema): «Nombre Apellidos», o `null` si la
 * cuenta no tiene ninguno — quien lo pinta (`components/layout/UserMenu.tsx`)
 * enseña entonces solo el email. Nunca el `username`: es un identificador
 * técnico, no un nombre.
 */
export function displayName(me: {
  first_name?: string | null;
  last_name?: string | null;
}): string | null {
  const name = [me.first_name, me.last_name]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  return name || null;
}
