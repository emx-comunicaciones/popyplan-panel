import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/config/site";

/**
 * `/robots.txt` (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §6).
 *
 * Solo la web pública y la declaración de accesibilidad son indexables.
 * Todo el panel queda fuera: sus rutas exigen sesión y devolverían una
 * redirección al login a cualquier rastreador, que es ruido puro en un
 * índice de búsqueda. `/login` tampoco se indexa (no aporta nada a quien
 * busca) ni `/api` (route handlers de sesión e idioma).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/accesibilidad"],
        disallow: ["/entidad", "/paraguas", "/plataforma", "/elegir-entidad", "/login", "/api"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
