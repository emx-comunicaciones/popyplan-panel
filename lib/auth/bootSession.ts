/**
 * Puerta de arranque de sesión (bug crítico de demo, 2026-09-05): tras una
 * recarga completa el access token en memoria (`lib/auth/tokenStore.ts`)
 * empieza vacío. Si varias peticiones autenticadas se disparan en el mismo
 * instante (p. ej. los varios `useQuery` de `EntityHomeDashboard`), todas
 * verían el token vacío y cada una arrancaría su propio 401 →
 * `/api/session/refresh`; `lib/api/client.ts` ya evita el 401 en sí
 * esperando esta puerta antes de la primera petición cuando aún no hay
 * token, y de rebote también evita el segundo bug (varios refresh
 * concurrentes contra la misma cookie, ver `sessionEvents.ts`/`client.ts`).
 *
 * `app/providers.tsx` registra aquí la promesa de `restoreSession()` nada
 * más renderizar (en el inicializador perezoso de un `useState`, que se
 * ejecuta durante el render, antes de que ningún hijo monte su propio
 * efecto) con `registerBootRestore`. `apiFetch` la espera con
 * `awaitBootRestore()` solo si todavía no hay token — así el arranque no
 * añade latencia a peticiones posteriores, ya con sesión resuelta.
 */

let bootPromise: Promise<void> | null = null;

/** Llamado una sola vez por `app/providers.tsx` (cliente). Ignora llamadas repetidas. */
export function registerBootRestore(promise: Promise<unknown>): void {
  if (bootPromise) return;
  bootPromise = promise.then(
    () => undefined,
    () => undefined,
  );
}

/** `apiFetch` espera esto antes de la primera petición si no hay token aún. */
export function awaitBootRestore(): Promise<void> {
  return bootPromise ?? Promise.resolve();
}

/** Solo para tests: vuelve al estado inicial entre casos. */
export function resetBootRestoreForTests(): void {
  bootPromise = null;
}
