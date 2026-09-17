/**
 * Cabeceras de seguridad que `next.config.ts::headers()` aplica a todas
 * las respuestas del panel (`/(.*)`, hallazgo M3). El panel no las
 * declaraba en ninguna parte.
 *
 * - `X-Content-Type-Options: nosniff` — sin adivinar el tipo de un
 *   fichero servido (un informe exportado, el logo de una entidad).
 * - `Referrer-Policy: strict-origin-when-cross-origin` — las rutas del
 *   panel llevan slug de entidad e ids en la URL; fuera de nuestro origen
 *   solo viaja el origen.
 * - `X-Frame-Options: DENY` — el panel nunca se embebe; sin esto, una
 *   página ajena podría enmarcarlo (clickjacking sobre acciones como
 *   «Revocar» o «Cerrar programa»).
 * - `Permissions-Policy` — **la cámara sigue permitida en el propio
 *   origen**: el check-in por QR de Asistencia
 *   (`components/entidad/AttendanceView.tsx`) llama a `getUserMedia`.
 *   Micrófono y geolocalización, que el panel no usa, van cerrados.
 * - `Strict-Transport-Security` solo en producción: en desarrollo el
 *   panel se sirve por http en `localhost`, y una HSTS ahí deja el
 *   navegador forzando https contra el puerto local durante dos años.
 *
 * **Sin CSP en esta tarea, a propósito**: Next inyecta scripts inline
 * (hidratación, flight data), así que una CSP útil exige nonce por
 * respuesta desde `middleware.ts` — trabajo aparte, no un valor que se
 * pueda dejar aquí a medias.
 */
export interface SecurityHeader {
  key: string;
  value: string;
}

export function securityHeaders(): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  ];

  if (process.env.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  }

  return headers;
}
