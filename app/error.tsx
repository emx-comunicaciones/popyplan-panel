"use client";

import Link from "next/link";

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
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <ErrorState
        title="Algo ha fallado"
        description="No hemos podido cargar esta página. Puedes reintentarlo o volver a iniciar sesión."
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" onClick={() => reset()}>
              Reintentar
            </Button>
            <Link
              href="/login"
              className="text-sm font-medium text-primary-700 underline focus-visible:outline-3 focus-visible:outline-primary-700"
            >
              Ir al inicio de sesión
            </Link>
          </div>
        }
      />
    </main>
  );
}
