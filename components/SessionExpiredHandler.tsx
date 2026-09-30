"use client";

/**
 * Escucha `lib/auth/sessionEvents.ts` (montado una vez en
 * `app/providers.tsx`): cuando `lib/api/client.ts` no consigue refrescar la
 * sesión, cierra sesión y redirige a `/login`, que lee el mensaje
 * pendiente (`consumeSessionExpiredMessage`) para pintarlo como si fuera
 * un error de login más.
 */
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { logout } from "@/hooks/useAuth";
import { onLogoutElsewhere } from "@/lib/auth/logoutBroadcast";
import { subscribeSessionExpired } from "@/lib/auth/sessionEvents";
import { setAccessToken } from "@/lib/auth/tokenStore";
import { hardNavigate } from "@/lib/navigation/hardNavigate";

export function SessionExpiredHandler(): null {
  const router = useRouter();

  useEffect(() => {
    return subscribeSessionExpired(() => {
      void logout().finally(() => {
        router.replace("/login");
      });
    });
  }, [router]);

  // Otra pestaña cerró sesión: la cookie ya está borrada, así que solo
  // hay que olvidar el token en memoria y salir (error 38 del informe).
  useEffect(() => {
    return onLogoutElsewhere(() => {
      setAccessToken(null);
      hardNavigate("/login");
    });
  }, []);

  return null;
}
