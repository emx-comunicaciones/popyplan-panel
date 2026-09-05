/**
 * Aviso global de sesión caducada. `lib/api/client.ts` lo dispara cuando
 * un refresco de sesión falla de verdad (no un simple 401 puntual, sino
 * que `/api/session/refresh` también ha fallado): en vez de que cada
 * hook que estuviera pidiendo datos se las apañe por su cuenta, avisa una
 * vez a quien esté escuchando (`components/SessionExpiredHandler.tsx`,
 * montado en `app/providers.tsx`) para que cierre sesión y redirija a
 * `/login` con el mensaje del contrato.
 */

export const SESSION_EXPIRED_MESSAGE = "Tu sesión ha caducado.";

type Listener = () => void;

const listeners = new Set<Listener>();
let pendingMessage: string | null = null;

export function notifySessionExpired(message: string = SESSION_EXPIRED_MESSAGE): void {
  pendingMessage = message;
  for (const listener of listeners) listener();
}

export function subscribeSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Se consume una sola vez (p. ej. al pintar `/login`): borra el mensaje pendiente. */
export function consumeSessionExpiredMessage(): string | null {
  const message = pendingMessage;
  pendingMessage = null;
  return message;
}

/** Solo para tests. */
export function resetSessionEventsForTests(): void {
  listeners.clear();
  pendingMessage = null;
}
