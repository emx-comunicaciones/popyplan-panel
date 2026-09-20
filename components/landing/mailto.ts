/**
 * `mailto:` con asunto para las llamadas de la web pública (spec de
 * diseño `2026-09-20-landing-login-unico-design.md` §2, decisión 5: un
 * correo ahora, un formulario guardado en plataforma en la fase de alta
 * desde la web).
 *
 * El asunto va por `encodeURIComponent`: es texto traducido y lleva
 * espacios, tildes y comillas según el idioma — sin codificar, el cliente
 * de correo corta el asunto en el primer carácter raro.
 */
export function mailtoHref(email: string, subject: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
