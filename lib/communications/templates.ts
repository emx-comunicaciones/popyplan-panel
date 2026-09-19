/**
 * Plantillas de comunicaciones oficiales (tarea 4 de «red de apoyo»,
 * `docs/PANEL.md` §14): hoy solo la de bienvenida a quien acompaña, que
 * `ComunicacionesPanel.tsx::ComposeForm` ofrece cuando la entidad tiene
 * espacio de familias. El texto es literal (verificado con el brief):
 * quien lo edite debe hacerlo aquí, la única fuente de esa cadena.
 */
export const SUPPORT_WELCOME_TEMPLATE = {
  title: "Bienvenida a la red de apoyo",
  body: "Gracias por acompañar a alguien de nuestra entidad. En este espacio de familias encontrarás actividades, formación y recursos pensados para ti. Recuerda: no verás las conversaciones, la actividad privada ni la ubicación de la persona a la que acompañas; solo lo que ella decida compartir con su red. Si necesitas hablar con la entidad, escribe a su referente desde la app.",
} as const;

/**
 * Aplica la plantilla al título/cuerpo actuales del formulario.
 * `overwritten` indica si había texto no vacío antes de sustituirlo —
 * quien la llama lo usa para pedir confirmación (`ConfirmDialog`) antes
 * de perder un borrador en curso.
 */
export function applyTemplate(
  current: { title: string; body: string },
  t: typeof SUPPORT_WELCOME_TEMPLATE,
): { title: string; body: string; overwritten: boolean } {
  const overwritten = current.title.trim().length > 0 || current.body.trim().length > 0;
  return { title: t.title, body: t.body, overwritten };
}
