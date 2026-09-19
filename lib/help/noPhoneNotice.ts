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
 * **i18n (tarea 3):** `NO_PHONE_NOTICE_KEY` (`common.noPhoneNotice`) es
 * la clave de traducción — los dos componentes que la pintan son de las
 * tareas 4 y 5, así que todavía no llaman a `t()`; mientras tanto,
 * `NO_PHONE_NOTICE` sigue existiendo con el mismo valor que antes, pero
 * leído del propio catálogo (`messages/es.json`) en vez de repetido a
 * mano, para que sea de verdad una única fuente — cuando esas tareas
 * traduzcan sus pantallas, sustituyen `{NO_PHONE_NOTICE}` por
 * `{t(NO_PHONE_NOTICE_KEY)}` (con `useTranslations("common")`) y esta
 * constante deja de hacer falta.
 */
import es from "@/messages/es.json";

export const NO_PHONE_NOTICE_KEY = "common.noPhoneNotice";

export const NO_PHONE_NOTICE: string = es.common.noPhoneNotice;
