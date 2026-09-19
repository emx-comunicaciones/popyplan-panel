import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.notFound");
  return { title: t("title") };
}

/**
 * 404 de toda la aplicación (hallazgo B7): sin esta ruta, Next pinta su
 * página por defecto en inglés y sin el lenguaje visual del panel.
 * Server Component: no necesita estado ni interacción, solo la salida
 * hacia la raíz, que ya reparte por área (`app/page.tsx`). Async desde
 * la tarea i18n 2 (`getTranslations`); `app/not-found.test.tsx` la llama
 * con el mismo patrón `await NotFound()` que el resto de Server
 * Components del panel.
 */
export default async function NotFound() {
  const t = await getTranslations("pages.notFound");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <EmptyState
        title={t("title")}
        description={t("description")}
        action={
          <Link
            href="/"
            className="text-sm font-medium text-primary-700 underline"
          >
            {t("backLink")}
          </Link>
        }
      />
    </main>
  );
}
