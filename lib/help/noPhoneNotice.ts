/**
 * Recordatorio fijo bajo los avisos de «hoy lo llevo mal», en la guardia
 * de la entidad (`components/entidad/GuardiaPanel.tsx`) y en la Ayuda de
 * plataforma (`components/plataforma/AyudaPendienteList.tsx`):
 * Popyplan no guarda teléfonos de las personas (invariante 9), así que
 * quien atiende un aviso tiene que saber por dónde contactar antes de
 * buscar un número que no existe.
 *
 * `NO_PHONE_NOTICE_KEY` (`common.noPhoneNotice`) es la única fuente de
 * esa clave — las dos vistas la traducen con `t(NO_PHONE_NOTICE_KEY)`,
 * así que cambiar el canal de contacto en el catálogo actualiza las dos
 * a la vez.
 *
 * **i18n (tarea 3, actualizado en la tarea 4, puente cerrado en la tarea
 * 5):** hasta la tarea 5, `AyudaPendienteList.tsx` seguía pintando una
 * constante en español a mano (`NO_PHONE_NOTICE`) mientras
 * `GuardiaPanel.tsx` ya usaba `t(NO_PHONE_NOTICE_KEY)` — el puente entre
 * las dos formas ya no existe: los dos componentes traducen con esta
 * misma clave.
 */
export const NO_PHONE_NOTICE_KEY = "common.noPhoneNotice";
