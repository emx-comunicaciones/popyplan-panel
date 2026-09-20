import { ImageResponse } from "next/og";

import es from "@/messages/es.json";

/**
 * Imagen de compartir de la web pública (spec §6): la que ven LinkedIn,
 * WhatsApp o Slack al pegar el enlace de la landing.
 *
 * Se **genera** con `ImageResponse` de `next/og` (que viene con Next 15,
 * sin añadir ninguna dependencia: Satori + resvg rasterizan este JSX a
 * PNG) en vez de servir un `public/og.png` estático. La versión anterior
 * era un rectángulo liso del color de marca porque se creía que nada en
 * el árbol sabía rasterizar texto; sí sabe, y una tarjeta con un bloque
 * turquesa vacío se lee peor que no declarar `og:image` en absoluto.
 * Next inyecta sola la ruta de esta imagen en `openGraph`/`twitter` de
 * `app/page.tsx`, así que ahí no hace falta declarar ningún `images`.
 *
 * **Los textos salen del catálogo español** (`messages/es.json`), no de
 * `getTranslations`: un fichero de imagen de metadatos no tiene contexto
 * de petición, así que no puede resolver el idioma de quien comparte —
 * y `alt`, además, es una constante de módulo. El español es el idioma
 * por defecto del producto (`lib/i18n/languages.ts`), que es el criterio
 * correcto para una imagen fija.
 */
const BRAND = es.landing.header.brand;
const TITLE = es.landing.hero.title;

/** `#0e7c78` es `--color-primary-700` (`app/globals.css`), el tono de
 * marca legible: con blanco encima da 5,03:1, uno de los pares ya
 * auditados en `lib/a11y/tokens.test.ts`. Literal hexadecimal y no
 * `var(--…)` por el mismo motivo que `lib/metrics/mapScale.ts`: aquí no
 * hay hoja de estilos que resolver, Satori solo entiende estilos en
 * línea. */
const BRAND_COLOR = "#0e7c78";

export const alt = `${BRAND} — ${TITLE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 32,
          padding: 96,
          background: BRAND_COLOR,
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>{BRAND}</div>
        <div style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.15 }}>{TITLE}</div>
      </div>
    ),
    size,
  );
}
