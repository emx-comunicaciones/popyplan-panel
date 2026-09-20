import Link from "next/link";
import { useTranslations } from "next-intl";

import { PRIMARY_LINK_CLASS } from "./linkStyles";
import { StoreLinks } from "./StoreLinks";

/**
 * Portada (spec §4, bloque 2). Fondo `primary-100`: es una superficie
 * decorativa, así que puede usar el tono de marca claro — el texto
 * encima sigue siendo `text-base`, par ya auditado en
 * `lib/a11y/tokens.test.ts` (16,93:1).
 */
export function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section className="bg-primary-100">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="mb-3 max-w-3xl text-3xl font-semibold leading-tight text-text-base md:text-4xl">
          {t("title")}
        </h1>
        <p className="mb-6 max-w-2xl text-base text-text-secondary">{t("subtitle")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Link href="/login" className={PRIMARY_LINK_CLASS}>
            {t("ctaPanel")}
          </Link>
          <StoreLinks />
        </div>
      </div>
    </section>
  );
}
