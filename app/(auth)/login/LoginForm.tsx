"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Footer } from "@/components/layout/Footer";
import { ApiError } from "@/lib/api/client";
import { resolveArea } from "@/lib/auth/area";
import { consumeSessionExpiredMessage, SESSION_EXPIRED_MESSAGE } from "@/lib/auth/sessionEvents";
import { safeReturnTo } from "@/lib/auth/returnTo";
import { applyAccountLanguage, login } from "@/hooks/useAuth";

function areaPath(area: ReturnType<typeof resolveArea>): string {
  if (area === "plataforma") return "/plataforma";
  if (area === "sin-acceso") return "/";
  if (area.kind === "entidad") return `/entidad/${area.slug}`;
  if (area.kind === "paraguas") return `/paraguas/${area.slug}`;
  return "/elegir-entidad";
}

/**
 * Traduce el error del intento de login (tarea i18n 2). `t` se recibe
 * como parámetro porque esta función vive fuera del componente (no
 * puede llamar a `useTranslations`, un hook) — mismo patrón que
 * cualquier otra función pura de este panel que necesite traducir.
 */
function errorMessage(
  error: unknown,
  t: (key: "invalidCredentials" | "tooManyAttempts" | "generic") => string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 401) {
      return t("invalidCredentials");
    }
    if (error.status === 429) {
      return t("tooManyAttempts");
    }
    return t("generic");
  }
  return t("generic");
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
  const t = useTranslations("auth.login");
  const tErrors = useTranslations("auth.login.errors");
  // Destino guardado por `middleware.ts` cuando la sesión no llegó a la
  // ruta pedida (enlace profundo con `SameSite=Strict`, refresh caducado).
  // `safeReturnTo` lo descarta si no es una ruta interna del panel: sin
  // esa validación, `?returnTo=//otro.sitio` sería una redirección abierta.
  const searchParams = useSearchParams();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  // Si venimos de un cierre de sesión forzado (`SessionExpiredHandler`,
  // refresco fallido en `lib/api/client.ts`), pinta ese mensaje de entrada,
  // igual que cualquier otro error de este formulario. `lib/auth/
  // sessionEvents.ts` es código plano, sin acceso a `t()`: el único
  // emisor real (`lib/api/client.ts`) siempre manda el mensaje por
  // defecto (`SESSION_EXPIRED_MESSAGE`), así que se compara con esa
  // constante para traducirlo aquí; un mensaje a medida (soportado por
  // `notifySessionExpired`, aunque hoy nadie lo usa) se pinta tal cual.
  const [sessionExpiredMessage] = useState<string | null>(() => consumeSessionExpiredMessage());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const displayedError =
    error ??
    (sessionExpiredMessage
      ? sessionExpiredMessage === SESSION_EXPIRED_MESSAGE
        ? tErrors("sessionExpired")
        : sessionExpiredMessage
      : null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await login(usernameOrEmail, password);
      // Idioma de la cuenta (spec de diseño `2026-09-19-i18n-es-eu-ca`,
      // decisión 2): si difiere del idioma con el que se ha visto este
      // formulario, `router.refresh()` antes de navegar para que el
      // destino ya se pinte en el idioma correcto — sin esto, la cookie
      // quedaría fijada pero la navegación reutilizaría el árbol de
      // Server Components (incluida la raíz, que fija `<html lang>`) ya
      // cacheado del idioma anterior.
      if (await applyAccountLanguage(session.user)) {
        router.refresh();
      }
      const area = resolveArea(session.user, session.platformRole);
      router.replace(safeReturnTo(searchParams.get("returnTo")) ?? areaPath(area));
    } catch (caught) {
      setError(errorMessage(caught, tErrors));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-border-light">
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-white p-6 shadow-sm">
          <div className="mb-4 flex justify-end">
            <LanguageSwitcher />
          </div>
          <h1 className="mb-1 text-xl font-semibold text-text-base">{t("brand")}</h1>
          <p className="mb-6 text-sm text-text-secondary">{t("subtitle")}</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="username_or_email" className="mb-1 block text-sm font-medium text-text-form">
                {t("usernameLabel")}
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
                {t("passwordLabel")}
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
            {displayedError ? (
              <p role="alert" className="mb-4 text-sm text-error">
                {displayedError}
              </p>
            ) : null}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
