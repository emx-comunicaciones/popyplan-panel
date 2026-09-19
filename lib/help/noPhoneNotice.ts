/**
 * Recordatorio fijo bajo los avisos de «hoy lo llevo mal», en la guardia
 * de la entidad (`components/entidad/GuardiaPanel.tsx`) y en la Ayuda de
 * plataforma (`components/plataforma/AyudaPendienteList.tsx`):
 * Popyplan no guarda teléfonos de las personas (invariante 9), así que
 * quien atiende un aviso tiene que saber por dónde contactar antes de
 * buscar un número que no existe.
 *
 * Es una constante compartida, y no una cadena por componente, porque
 * las dos vistas tienen que decir exactamente lo mismo: con dos copias,
 * cambiar el canal de contacto en una dejaba la otra mintiendo.
 *
 * **i18n (tarea 3, actualizado en la tarea 4):** `NO_PHONE_NOTICE_KEY`
 * (`common.noPhoneNotice`) es la clave de traducción.
 * `components/entidad/GuardiaPanel.tsx` (tarea 4) ya pinta
 * `{t(NO_PHONE_NOTICE_KEY)}` directamente — no consume `NO_PHONE_NOTICE`.
 * `components/plataforma/AyudaPendienteList.tsx` (tarea 5, área de
 * plataforma, todavía sin tocar) sigue siendo el único consumidor de
 * `NO_PHONE_NOTICE`, que por eso se mantiene con el mismo valor que
 * antes, leído del propio catálogo (`messages/es.json`) en vez de
 * repetido a mano, para que siga siendo una única fuente mientras dure el
 * puente. Cuando la tarea 5 traduzca esa pantalla, sustituye
 * `{NO_PHONE_NOTICE}` por `{t(NO_PHONE_NOTICE_KEY)}` y esta constante — y
 * el puente entero — dejan de hacer falta.
 */
import es from "@/messages/es.json";

export const NO_PHONE_NOTICE_KEY = "common.noPhoneNotice";

export const NO_PHONE_NOTICE: string = es.common.noPhoneNotice;
