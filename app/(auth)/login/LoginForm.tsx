"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Footer } from "@/components/layout/Footer";
import { ApiError } from "@/lib/api/client";
import { resolveArea } from "@/lib/auth/area";
import { consumeSessionExpiredMessage } from "@/lib/auth/sessionEvents";
import { login } from "@/hooks/useAuth";

function areaPath(area: ReturnType<typeof resolveArea>): string {
  if (area === "plataforma") return "/plataforma";
  if (area === "sin-acceso") return "/";
  if (area.kind === "entidad") return `/entidad/${area.slug}`;
  if (area.kind === "paraguas") return `/paraguas/${area.slug}`;
  return "/elegir-entidad";
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 401) {
      return "Usuario o contraseña incorrectos.";
    }
    if (error.status === 429) {
      return "Demasiados intentos; espera un minuto.";
    }
    return "No se pudo iniciar sesión. Inténtalo de nuevo.";
  }
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}

/**
 * Formulario de login, componente cliente (`useState`/`useRouter`).
 * Carry-over de accesibilidad (tarea W6): separado de `page.tsx` para
 * que la página pueda ser un Server Component con su propio `<title>`
 * (`export const metadata`, imposible en un Client Component) — patrón
 * estándar de Next.js App Router.
 */
export function LoginForm() {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  // Si venimos de un cierre de sesión forzado (`SessionExpiredHandler`,
  // refresco fallido en `lib/api/client.ts`), pinta ese mensaje de entrada,
  // igual que cualquier otro error de este formulario.
  const [error, setError] = useState<string | null>(() => consumeSessionExpiredMessage());
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await login(usernameOrEmail, password);
      const area = resolveArea(session.user, session.platformRole);
      router.replace(areaPath(area));
    } catch (caught) {
      setError(errorMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-border-light">
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-text-base">Popyplan · Panel</h1>
          <p className="mb-6 text-sm text-text-secondary">
            Inicia sesión con tu cuenta de Popyplan.
          </p>
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="username_or_email" className="mb-1 block text-sm font-medium text-text-form">
                Usuario o email
              </label>
              <input
                id="username_or_email"
                name="username_or_email"
                type="text"
                autoComplete="username"
                required
                value={usernameOrEmail}
                onChange={(event) => setUsernameOrEmail(event.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-text-base focus-visible:outline-primary-700"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-text-form">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-text-base focus-visible:outline-primary-700"
              />
            </div>
            {error ? (
              <p role="alert" className="mb-4 text-sm text-error">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
