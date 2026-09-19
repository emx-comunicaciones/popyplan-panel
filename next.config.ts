import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { imageRemotePatterns } from "./lib/config/imagePatterns";
import { securityHeaders } from "./lib/config/securityHeaders";

/**
 * `next-intl` sin enrutado de idioma (spec de diseño
 * `2026-09-19-i18n-es-eu-ca`, decisión 7): sin segmento `[locale]` en las
 * rutas, así que el middleware de sesión, los layouts y los e2e no
 * cambian de estructura — el plugin solo conecta `i18n/request.ts`
 * (idioma por cookie `pp_lang`) con el resto del árbol de Next.
 */
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/**
 * La lógica de ambas piezas vive en `lib/config/*` para poder probarla
 * con Vitest (`lib/config/{imagePatterns,securityHeaders}.test.ts`) y
 * documentar ahí el porqué de cada valor: los hosts de imagen permitidos
 * (el logo de la entidad lo sirve el backend o su almacenamiento; un CDN
 * distinto se declara en `NEXT_PUBLIC_MEDIA_HOSTS`) y las cabeceras de
 * seguridad (sin CSP todavía: Next inyecta scripts inline y una CSP con
 * nonce es trabajo aparte).
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: imageRemotePatterns(),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders(),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
