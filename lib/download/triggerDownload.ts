/**
 * Dispara la descarga de un `Blob` con un `<a download>` temporal,
 * compartido por las dos descargas del panel (`hooks/useExport.ts`,
 * `hooks/useProgramReport.ts`), que antes llevaban cada una su copia.
 *
 * El enlace pasa por el documento antes de pincharlo: un `<a>` suelto no
 * dispara la descarga en todos los navegadores. La URL del blob se
 * libera en el siguiente turno del bucle de eventos, no en la misma
 * vuelta: revocarla mientras el navegador aún está resolviendo el click
 * cancela la descarga (bug clásico de Safari y de Chrome con ficheros
 * grandes).
 *
 * La limpieza va en un `finally`: si el navegador bloquea el click (una
 * política de descargas, una extensión), el error sube a quien llamó —
 * que lo pinta como error de la descarga — pero ni el `<a>` se queda
 * huérfano en el `<body>` ni la URL del blob viva hasta recargar.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
