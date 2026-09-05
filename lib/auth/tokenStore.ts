/**
 * Almacén en memoria del access token (nunca en localStorage/sessionStorage:
 * decisión «Login del panel» del plan de Fase 5). Vive fuera de React para
 * que `lib/api/client.ts` pueda leerlo y actualizarlo sin pasar por
 * contexto; `hooks/useAuth.ts` lo expone de forma reactiva con
 * `useSyncExternalStore`.
 */

type Listener = (token: string | null) => void;

let currentToken: string | null = null;
const listeners = new Set<Listener>();

export function getAccessToken(): string | null {
  return currentToken;
}

export function setAccessToken(token: string | null): void {
  if (token === currentToken) return;
  currentToken = token;
  for (const listener of listeners) listener(currentToken);
}

export function subscribeAccessToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Solo para tests: vuelve al estado inicial entre casos. */
export function resetAccessTokenForTests(): void {
  currentToken = null;
  listeners.clear();
}
