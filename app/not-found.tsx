import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Página no encontrada" };

/**
 * 404 de toda la aplicación (hallazgo B7): sin esta ruta, Next pinta su
 * página por defecto en inglés y sin el lenguaje visual del panel.
 * Server Component: no necesita estado ni interacción, solo la salida
 * hacia la raíz, que ya reparte por área (`app/page.tsx`).
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <EmptyState
        title="Página no encontrada"
        description="La dirección que has abierto no existe o ya no está disponible."
        action={
          <Link
            href="/"
            className="text-sm font-medium text-primary-700 underline focus-visible:outline-3 focus-visible:outline-primary-700"
          >
            Volver al inicio
          </Link>
        }
      />
    </main>
  );
}
