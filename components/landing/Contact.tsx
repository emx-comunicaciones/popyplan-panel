import { useTranslations } from "next-intl";

import { contactEmail } from "@/lib/config/site";

import { PRIMARY_LINK_CLASS } from "./linkStyles";
import { mailtoHref } from "./mailto";

/**
 * «Habla con nosotros» (spec §4, bloque 6, y decisión 5): un `mailto:`
 * con asunto genérico. Las tres llamadas por público viven en sus propias
 * tarjetas (`Audiences.tsx`), cada una con su asunto.
 */
export function Contact() {
  const t = useTranslations("landing.contact");

  return (
    <section aria-labelledby="landing-contact" className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h2 id="landing-contact" className="mb-2 text-lg font-semibold text-text-base">
          {t("title")}
        </h2>
        <p className="mb-4 max-w-2xl text-sm text-text-secondary">{t("body")}</p>
        <a href={mailtoHref(contactEmail(), t("subject.other"))} className={PRIMARY_LINK_CLASS}>
          {t("cta")}
        </a>
      </div>
    </section>
  );
}
