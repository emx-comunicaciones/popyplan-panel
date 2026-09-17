import type { Metadata } from "next";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión" };

/**
 * Render dinámico: `LoginForm` lee `?returnTo=` con `useSearchParams()`
 * (destino guardado por `middleware.ts`). En una página prerenderizada,
 * Next exige envolver ese hook en un `<Suspense>` y prerrenderiza el
 * fallback, con el parpadeo consiguiente en la primera pantalla que ve
 * quien entra; esta página no tiene nada que ganar del prerender, así que
 * se renderiza por petición y el formulario llega completo.
 */
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
