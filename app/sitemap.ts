import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/config/site";

/**
 * `/sitemap.xml` (spec §6): las dos únicas rutas públicas del panel.
 *
 * Sin `lastModified` a propósito: no hay ninguna fecha real de
 * publicación que dar (el contenido son textos de catálogo, que cambian
 * con cada despliegue), y poner `new Date()` haría que el sitemap
 * afirmara que todo se modificó justo ahora en cada petición — además de
 * dejar el test sin nada estable que comprobar.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/accesibilidad`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
