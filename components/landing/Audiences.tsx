import { useTranslations } from "next-intl";

import { contactEmail } from "@/lib/config/site";

import { SECONDARY_LINK_CLASS } from "./linkStyles";
import { mailtoHref } from "./mailto";
import { StoreLinks } from "./StoreLinks";

/**
 * «Para quién es» (spec §4, bloque 3): cuatro tarjetas con 2-3 beneficios
 * y su llamada. Los beneficios salen de lo que el producto hace hoy, sin
 * ninguna cifra ni cliente inventados.
 *
 * Las claves se enumeran en un array **literal** (`AUDIENCES`), no
 * construidas por concatenación: es el mapa explícito que permite la
 * convención de i18n de este repo («nunca claves dinámicas salvo un mapa
 * con todas las variantes»).
 *
 * La tarjeta de personas no lleva `mailto:`: su llamada son los botones
 * de tienda, que desaparecen enteros (etiqueta incluida) si todavía no
 * hay ficha publicada. Las otras tres usan como asunto la clave de
 * `landing.contact.subject` que se llama igual que el propio público
 * (`associations`/`administrations`/`professionals`), a la que TypeScript
 * llega solo: dentro del `else` del ternario, `audience` ya está
 * estrechada a esas tres.
 */
const AUDIENCES = ["people", "associations", "administrations", "professionals"] as const;

export function Audiences() {
  const t = useTranslations("landing.audiences");
  const tSubject = useTranslations("landing.contact.subject");
  const email = contactEmail();

  return (
    <section aria-labelledby="landing-audiences" className="mx-auto max-w-5xl px-4 py-12">
      <h2 id="landing-audiences" className="mb-4 text-2xl font-semibold text-text-base">
        {t("title")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {AUDIENCES.map((audience) => {
          // `t.raw` devuelve el array del catálogo tal cual (sin formateo
          // ICU: ninguno de estos beneficios lleva parámetros), mismo uso
          // que `components/help/PageHelp.tsx`.
          const benefits = t.raw(`${audience}.benefits`) as string[];

          return (
            <article key={audience} className="rounded-lg border border-border bg-white p-3">
              <h3 className="mb-2 text-lg font-semibold text-text-base">
                {t(`${audience}.title`)}
              </h3>
              <ul className="mb-3 flex list-disc flex-col gap-1 pl-4 text-sm text-text-secondary">
                {benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
              {audience === "people" ? (
                <StoreLinks label={t("people.cta")} />
              ) : (
                <a href={mailtoHref(email, tSubject(audience))} className={SECONDARY_LINK_CLASS}>
                  {t(`${audience}.cta`)}
                </a>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
