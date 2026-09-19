import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * M17 de la revisión final de la rama de i18n: `description` era un
 * literal fijo en español, el único `metadata` sin traducir (los 34
 * títulos de página ya pasaron a `generateMetadata` con `getTranslations`
 * en tareas anteriores). El `title.default`/`template` se quedan como
 * objeto estático — no dependen del idioma (el sufijo « · Popyplan» y la
 * marca son iguales en los tres, ver `auth.login.brand`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.root");
  return {
    title: {
      default: "Popyplan · Panel",
      // Cada página pone su propio título (accesibilidad: cada ruta debe
      // tener un `<title>` único, ver CLAUDE.md «Accesibilidad»); esta
      // plantilla añade el sufijo común a todos.
      template: "%s · Popyplan",
    },
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Idioma de la petición (spec de diseño `2026-09-19-i18n-es-eu-ca`,
  // decisión 3): `getLocale()`/`getMessages()` leen la misma resolución
  // que `i18n/request.ts` (cookie `pp_lang` → `Accept-Language` → `es`).
  // `<html lang>` es la fuente que luego usan `lib/api/client.ts`
  // (`document.documentElement.lang`) y `lib/i18n/locale.ts::activeLanguage`
  // para formatear números en el cliente con el idioma correcto.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
