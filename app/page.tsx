import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { AppAccountScreen } from "@/components/landing/AppAccountScreen";
import { Landing } from "@/components/landing/Landing";
import { resolveArea } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";
import { siteUrl } from "@/lib/config/site";
import { DEFAULT_LANGUAGE, isSupportedLanguage } from "@/lib/i18n/languages";
import { localeFor } from "@/lib/i18n/locale";

/**
 * Metadatos de la web pública (spec §6). `title.absolute` y no una cadena
 * a secas: el layout raíz aplica la plantilla `"%s · Popyplan"` a todo
 * título de página, y aquí el título ya lleva la marca — sin `absolute`
 * saldría «Popyplan — planes… · Popyplan».
 *
 * `openGraph.locale` va en la forma `idioma_TERRITORIO` que pide el
 * protocolo (`es_ES`), derivada del mismo mapa que usa el resto del panel
 * (`lib/i18n/locale.ts`), no de una tabla nueva.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.meta");
  const locale = await getLocale();
  const language = isSupportedLanguage(locale) ? locale : DEFAULT_LANGUAGE;
  const title = t("title");
  const description = t("description");
  const url = siteUrl();

  return {
    // `metadataBase` es imprescindible para que la ruta relativa de la
    // imagen que genera `app/opengraph-image.tsx` (y que Next añade sola
    // a `openGraph`/`twitter`, por eso aquí no hay ningún `images`) se
    // resuelva contra el host real: sin él, Next cae en silencio a
    // `http://localhost:3000` en producción (aviso de build
    // "metadataBase property in metadata export is not set").
    // `siteUrl()` nunca devuelve algo que `new URL()` rechace (I1).
    metadataBase: new URL(url),
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Popyplan",
      locale: localeFor(language).replace("-", "_"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/**
 * Raíz pública: la web de presentación y, con sesión, el reparto por área
 * (spec de diseño `2026-09-20-landing-login-unico-design.md` §3.1).
 *
 * - **Sin sesión** pinta `<Landing />`. Ya no redirige a `/login`: el
 *   enfoque aprobado (enfoque 1 de la spec) es que la raíz siga
 *   resolviendo la sesión y, cuando no la hay, enseñe la web — mover el
 *   resolutor a `/entrar` obligaba a tocar los cinco `redirect("/")` del
 *   panel y el `returnTo` del login por una ventaja marginal.
 * - **Con sesión** redirige al área que resuelve `resolveArea`, igual que
 *   siempre.
 * - **Con sesión y `sin-acceso`** pinta `<AppAccountScreen />` (§5): la
 *   cuenta es válida, su sitio es la app.
 *
 * Depende del middleware: `getServerSession()` solo lee la cabecera
 * interna `x-pp-access-token` que pone `middleware.ts` tras refrescar la
 * cookie, así que esta ruta **tiene que estar en su `matcher`** (hallazgo
 * A2) — y desde la landing, ese middleware deja pasar la raíz sin sesión
 * en vez de mandarla al login (§3.2).
 */
export default async function Home() {
  const session = await getServerSession();
  if (!session) {
    return <Landing />;
  }

  const area = resolveArea(session.me, session.platformRole);

  if (area === "plataforma") {
    redirect("/plataforma");
  }
  if (area !== "sin-acceso") {
    if (area.kind === "entidad") redirect(`/entidad/${area.slug}`);
    if (area.kind === "paraguas") redirect(`/paraguas/${area.slug}`);
    redirect("/elegir-entidad");
  }

  return <AppAccountScreen />;
}
