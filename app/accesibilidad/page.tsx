import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Footer } from "@/components/layout/Footer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.accessibility");
  return { title: t("title") };
}

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_A11Y_CONTACT || "accesibilidad@popyplan.com";

/**
 * Declaración de accesibilidad (tarea W1, Fase 6), conforme al RD
 * 1112/2018. Página pública, sin sesión: no depende de
 * `getServerSession` ni redirige nunca. Enlazada desde el pie de los
 * tres layouts de área y del login (`components/layout/Footer.tsx`).
 *
 * «Situación de cumplimiento» se mantiene en «parcialmente conforme»
 * hasta el cierre de la tarea W5 de esta fase (e2e de teclado +
 * cobertura completa de axe); pasar a «plenamente conforme» es una
 * frase de esta página, no un cambio de código.
 *
 * Texto legal (tarea i18n 2): extraído a `messages/*.json::accessibility.*`
 * párrafo a párrafo, con las etiquetas `<strong>`/`<code>`/`<email>`/`<rd>`
 * resueltas con `t.rich()` — el valor de `es.json` es exactamente el
 * texto que había antes de esta tarea. Listado como prioridad de
 * revisión en `docs/i18n/ESTADO.md`.
 */
export default async function AccesibilidadPage() {
  const t = await getTranslations("accessibility");

  return (
    <>
      <main className="mx-auto max-w-2xl p-4">
        <h1 className="mb-4 text-xl font-semibold text-text-base">{t("heading")}</h1>

        <section aria-labelledby="alcance" className="mb-4">
          <h2 id="alcance" className="mb-2 text-lg font-semibold text-text-base">
            {t("scope.heading")}
          </h2>
          <p className="text-sm text-text-secondary">
            {t.rich("scope.body", { strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </section>

        <section aria-labelledby="situacion" className="mb-4">
          <h2 id="situacion" className="mb-2 text-lg font-semibold text-text-base">
            {t("status.heading")}
          </h2>
          <p className="text-sm text-text-secondary">
            {t.rich("status.body", { strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </section>

        <section aria-labelledby="no-accesible" className="mb-4">
          <h2 id="no-accesible" className="mb-2 text-lg font-semibold text-text-base">
            {t("nonAccessible.heading")}
          </h2>
          <p className="mb-2 text-sm text-text-secondary">{t("nonAccessible.intro")}</p>
          <p className="text-sm text-text-secondary">
            {t.rich("nonAccessible.list", { code: (chunks) => <code>{chunks}</code> })}
          </p>
        </section>

        <section aria-labelledby="preparacion" className="mb-4">
          <h2 id="preparacion" className="mb-2 text-lg font-semibold text-text-base">
            {t("preparation.heading")}
          </h2>
          <p className="text-sm text-text-secondary">
            {t.rich("preparation.body", { code: (chunks) => <code>{chunks}</code> })}
          </p>
        </section>

        <section aria-labelledby="contacto" className="mb-4">
          <h2 id="contacto" className="mb-2 text-lg font-semibold text-text-base">
            {t("contact.heading")}
          </h2>
          <p className="text-sm text-text-secondary">
            {t.rich("contact.body", {
              contactEmail: CONTACT_EMAIL,
              email: (chunks) => (
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary-700 underline">
                  {chunks}
                </a>
              ),
            })}
          </p>
        </section>

        <section aria-labelledby="procedimiento">
          <h2 id="procedimiento" className="mb-2 text-lg font-semibold text-text-base">
            {t("procedure.heading")}
          </h2>
          <p className="text-sm text-text-secondary">
            {t.rich("procedure.body", {
              rd: (chunks) => (
                <a
                  href="https://www.boe.es/eli/es/rd/2018/09/07/1112"
                  className="font-medium text-primary-700 underline"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
