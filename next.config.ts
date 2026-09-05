import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // El logo de cada entidad (`Organization.logo`) es una URL cualquiera
    // que sirve el backend Django (local o el almacenamiento de fichero
    // que toque en despliegue): sin patrón fijo que fijar aquí.
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
