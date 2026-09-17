"use client";

/**
 * Frontera de error del layout raíz (hallazgo B7): se usa solo cuando lo
 * que falla es `app/layout.tsx` mismo, así que reemplaza al documento
 * entero y tiene que pintar su propio `<html>`/`<body>` — no puede
 * apoyarse en los componentes del panel, que dependen de los estilos que
 * carga ese layout. De ahí el contenido mínimo, con estilos en línea.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "2rem" }}>
        <main style={{ maxWidth: "32rem", margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem" }}>Algo ha fallado</h1>
          <p>No hemos podido cargar el panel. Puedes reintentarlo.</p>
          <button type="button" onClick={() => reset()}>
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
