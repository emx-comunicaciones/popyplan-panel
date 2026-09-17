/**
 * Validación del parámetro `returnTo` del login (hallazgo B1 de la
 * auditoría 2026-09-18): con `SameSite=Strict` un enlace profundo llegado
 * desde fuera (correo, chat) no manda la cookie, así que el middleware
 * redirige a `/login?returnTo=<destino>` y el formulario vuelve allí tras
 * entrar. Un `returnTo` sin validar es una redirección abierta de manual,
 * así que aquí se acepta **solo** una ruta interna del panel.
 *
 * Reglas (todas deben cumplirse):
 *
 * - empieza por `/` y no por `//` (una ruta «protocol-relative»
 *   `//evil.example` es absoluta para el navegador);
 * - sin `\` (varios navegadores lo normalizan a `/`, así que `/\evil`
 *   acabaría siendo `//evil`);
 * - sin esquema (`://`) ni caracteres de control;
 * - su primer segmento es una de las tres áreas del panel o la pantalla
 *   de elección de entidad — nunca `/login` (bucle) ni cualquier otra.
 */
const ALLOWED_FIRST_SEGMENTS = new Set(["entidad", "paraguas", "plataforma", "elegir-entidad"]);

/** Sin expresión regular: `no-control-regex` prohíbe escribir esos rangos. */
function hasControlChars(value: string): boolean {
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
}

/** La ruta interna a la que volver, o `null` si el valor no es de fiar. */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value === "") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || value.includes("://") || hasControlChars(value)) return null;

  // `value` empieza por una sola `/`, así que ambos índices existen.
  const pathname = value.split(/[?#]/)[0];
  const firstSegment = pathname.split("/")[1];
  if (!ALLOWED_FIRST_SEGMENTS.has(firstSegment)) return null;

  return value;
}
