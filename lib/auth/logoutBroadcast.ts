/**
 * Aviso de «he cerrado sesión» entre pestañas del mismo navegador
 * (informe del panel, error 38). Cerrar sesión borra la cookie, pero las
 * otras pestañas conservan su access token en memoria y siguen pintando
 * datos hasta que caduca. `BroadcastChannel` las avisa al instante; si el
 * navegador no lo tiene, cae al evento `storage` de `localStorage`
 * (solo se escribe una marca de tiempo, nunca datos de sesión).
 */
const CHANNEL_NAME = "pp-session";
const STORAGE_KEY = "pp-logout";
/**
 * Identifica esta pestaña: un `BroadcastChannel` también entrega el mensaje
 * a otros canales de la MISMA página, y la pestaña que cierra sesión ya
 * navega a `/login` por su cuenta (perdería el aviso de sesión caducada si
 * recargara).
 */
const TAB_ID = Math.random().toString(36).slice(2);

export function broadcastLogout(): void {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: "logout", from: TAB_ID });
      channel.close();
      return;
    }
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Best-effort: sin canal, las otras pestañas caducan por su cuenta.
  }
}

/** Escucha el cierre de sesión de OTRA pestaña. Devuelve la función de baja. */
export function onLogoutElsewhere(listener: () => void): () => void {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; from?: string } | null;
      if (data?.type === "logout" && data.from !== TAB_ID) listener();
    };
    return () => channel.close();
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
