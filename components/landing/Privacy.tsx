import { useTranslations } from "next-intl";

/**
 * «Privacidad por diseño» (spec §4, bloque 5): los compromisos que el
 * sistema **ya** cumple (invariantes 1 y 9, umbral de agregación de 5,
 * encuestas anónimas, tres idiomas). Ninguna promesa que el código no
 * respalde.
 */
export function Privacy() {
  const t = useTranslations("landing.privacy");
  const items = t.raw("items") as string[];

  return (
    <section aria-labelledby="landing-privacy" className="mx-auto max-w-5xl px-4 py-12">
      <h2 id="landing-privacy" className="mb-4 text-2xl font-semibold text-text-base">
        {t("title")}
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-text-secondary">
        {items.map((item, index) => (
          // Índice y no el texto traducido, mismo motivo que en
          // `Audiences`/`HowItWorks`: la lista es estática.
          <li key={index}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
