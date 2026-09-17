/**
 * Coalescencia de operaciones idénticas en vuelo («single-flight»).
 *
 * El refresco de sesión **rota** el refresh token y deja el anterior en
 * lista negra (`ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`,
 * `docs/PANEL.md` §0): si dos peticiones concurrentes con la misma cookie
 * llaman cada una al backend, la segunda recibe 401 y destruye la sesión
 * de quien acababa de entrar. Tanto `middleware.ts` como
 * `app/api/session/refresh/route.ts` evitan eso compartiendo la misma
 * promesa, indexada por el valor del refresh token; esta función es esa
 * mecánica, sin duplicarla en los dos sitios.
 *
 * La entrada se elimina en el `finally`: el mapa nunca crece más allá de
 * las operaciones realmente en curso.
 */
export function singleFlight<K, V>(
  inFlight: Map<K, Promise<V>>,
  key: K,
  run: () => Promise<V>,
): Promise<V> {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = run().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
