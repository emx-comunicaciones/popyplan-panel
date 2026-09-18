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
 */
export const NO_PHONE_NOTICE =
  "Popyplan no guarda teléfonos: contacta con la persona por el chat de la app o a través de su referente.";
