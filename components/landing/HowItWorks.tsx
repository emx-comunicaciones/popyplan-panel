import { useTranslations } from "next-intl";

/** «Cómo funciona» (spec §4, bloque 4): tres pasos, en orden. */
export function HowItWorks() {
  const t = useTranslations("landing.how");
  const steps = t.raw("steps") as string[];

  return (
    <section aria-labelledby="landing-how" className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h2 id="landing-how" className="mb-4 text-2xl font-semibold text-text-base">
          {t("title")}
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-4 text-sm text-text-secondary">
          {steps.map((step, index) => (
            // Índice y no el texto traducido: lista estática que nunca
            // se reordena, y dos pasos idénticos en cualquiera de los
            // cuatro catálogos darían una clave repetida.
            <li key={index}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
