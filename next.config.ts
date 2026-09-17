import type { NextConfig } from "next";

import { imageRemotePatterns } from "./lib/config/imagePatterns";
import { securityHeaders } from "./lib/config/securityHeaders";

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

export default nextConfig;
