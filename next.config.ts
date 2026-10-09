import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { imageRemotePatterns } from "./lib/config/imagePatterns";
import { permanentRedirects } from "./lib/config/redirects";
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
  // Plan de rendimiento 2026-10-07 (2.10): AVIF antes que WebP para quien lo
  // admite, y una semana de caché de las imágenes optimizadas (por defecto,
  // 60 s: cada minuto se volvían a pedir y a recodificar). Las subidas del
  // backend llevan nombre propio, así que una foto nueva nunca hereda la
  // caché de la anterior. `recharts` solo se carga en dos gráficas:
  // `optimizePackageImports` evita meter el paquete entero en su bundle.
  images: {
    remotePatterns: imageRemotePatterns(),
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 7 * 24 * 60 * 60,
  },
  experimental: {
    optimizePackageImports: ["recharts"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders(),
      },
    ];
  },
  async redirects() {
    return permanentRedirects();
  },
};

export default withNextIntl(nextConfig);
