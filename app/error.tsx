"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Frontera de error de toda la aplicación (hallazgo B7): cualquier
 * excepción no capturada de un Server o Client Component acaba aquí en
 * vez de en la pantalla de error por defecto de Next (en inglés, y en
 * producción sin ninguna salida). «Reintentar» vuelve a renderizar el
 * segmento (`reset()`); el enlace a `/login` es la salida cuando lo que
 * ha fallado es la sesión.
 *
 * Tiene que ser un Client Component: Next le pasa `reset`, una función.
 */
export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("pages.error");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <ErrorState
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" onClick={() => reset()}>
              {t("retry")}
            </Button>
            <Link
              href="/login"
              className="text-sm font-medium text-primary-700 underline"
            >
              {t("loginLink")}
            </Link>
          </div>
        }
      />
    </main>
  );
}
