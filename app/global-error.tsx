"use client";

/**
 * Frontera de error del layout raíz (hallazgo B7): se usa solo cuando lo
 * que falla es `app/layout.tsx` mismo, así que reemplaza al documento
 * entero y tiene que pintar su propio `<html>`/`<body>` — no puede
 * apoyarse en los componentes del panel, que dependen de los estilos que
 * carga ese layout. De ahí el contenido mínimo, con estilos en línea.
 *
 * **Límite conocido de i18n (tarea 2):** este límite sustituye al
 * `NextIntlClientProvider` del layout raíz (el fallo puede ser el propio
 * layout), así que no hay forma de leer la cookie `pp_lang` desde aquí —
 * un componente de cliente sin árbol de servidor por encima no puede
 * llamar a `getLocale()`. Monta su propio `NextIntlClientProvider` con
 * el catálogo `es` a secas: esta pantalla siempre sale en español,
 * documentado aquí en vez de intentar adivinar el idioma.
 */
import { NextIntlClientProvider, useTranslations } from "next-intl";

import es from "@/messages/es.json";

function GlobalErrorContent({ reset }: { reset: () => void }) {
  const t = useTranslations("pages.globalError");

  return (
    <main style={{ maxWidth: "32rem", margin: "0 auto", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.25rem" }}>{t("title")}</h1>
      <p>{t("description")}</p>
      <button type="button" onClick={() => reset()}>
        {t("retry")}
      </button>
    </main>
  );
}

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "2rem" }}>
        <NextIntlClientProvider locale="es" messages={es}>
          <GlobalErrorContent reset={reset} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
