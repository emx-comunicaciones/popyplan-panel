/**
 * Plantillas de comunicaciones oficiales (tarea 4 de «red de apoyo»,
 * `docs/PANEL.md` §14): hoy solo la de bienvenida a quien acompaña, que
 * `ComunicacionesPanel.tsx::ComposeForm` ofrece cuando la entidad tiene
 * espacio de familias.
 *
 * **i18n (tarea 4 del plan de i18n):** el texto ya no vive aquí como
 * cadena a secas — este fichero es `.ts` plano (no puede llamar a
 * `t()`), así que `SUPPORT_WELCOME_TEMPLATE_KEYS` guarda las **claves**
 * de traducción (`entidad.comunicaciones.template.*`); quien llama
 * (`ComposeForm`, que sí tiene `t()`) resuelve el texto real antes de
 * pasárselo a `applyTemplate`, cuya forma no cambia: sigue recibiendo un
 * `{title, body}` ya resuelto y no sabe nada de i18n.
 */
export const SUPPORT_WELCOME_TEMPLATE_KEYS = {
  title: "entidad.comunicaciones.template.title",
  body: "entidad.comunicaciones.template.body",
} as const;

/**
 * Aplica la plantilla (ya traducida por quien llama) al título/cuerpo
 * actuales del formulario. `overwritten` indica si había texto no vacío
 * antes de sustituirlo — quien la llama lo usa para pedir confirmación
 * (`ConfirmDialog`) antes de perder un borrador en curso.
 */
export function applyTemplate(
  current: { title: string; body: string },
  template: { title: string; body: string },
): { title: string; body: string; overwritten: boolean } {
  const overwritten = current.title.trim().length > 0 || current.body.trim().length > 0;
  return { title: template.title, body: template.body, overwritten };
}
