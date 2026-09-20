import { useTranslations } from "next-intl";

/**
 * «Lo que nos diferencia» (rediseño 2026-09-20, bloque 5 del brief):
 * tres tarjetas con lo que hace distinta a Popyplan — planes sin
 * alcohol ni drogas, gente real con asistencia por QR y privacidad.
 *
 * Ninguna promesa que el producto no cumpla ya: el panel no muestra
 * teléfonos (invariante 9), no guarda datos de salud y la asistencia se
 * pasa con el QR de la app (`docs/PANEL.md` §4).
 *
 * Claves en un array **literal**, mismo criterio que `Features`.
 */
const VALUES = ["clean", "real", "privacy"] as const;

const TITLE_KEYS = {
  clean: "cleanTitle",
  real: "realTitle",
  privacy: "privacyTitle",
} as const;

const BODY_KEYS = {
  clean: "cleanBody",
  real: "realBody",
  privacy: "privacyBody",
} as const;

export function Values() {
  const t = useTranslations("landing.values");

  return (
    <section className="relative pt-16 lg:pt-24">
      <div className="mx-auto w-full max-w-[1440px] px-4 lg:px-12">
        <h2 className="mb-10 text-center font-display text-[24px] font-bold text-text-base sm:text-[32px]">
          {t("title")}
        </h2>
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map((value) => (
            <article
              key={value}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-6 shadow-sm"
            >
              <h3 className="font-display text-[20px] font-bold leading-tight text-text-base">
                {t(TITLE_KEYS[value])}
              </h3>
              <p className="text-[17px] leading-snug text-text-base">{t(BODY_KEYS[value])}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
