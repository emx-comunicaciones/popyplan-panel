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
import { subscribeSessionExpired } from "@/lib/auth/sessionEvents";

export function SessionExpiredHandler(): null {
  const router = useRouter();

  useEffect(() => {
    return subscribeSessionExpired(() => {
      void logout().finally(() => {
        router.replace("/login");
      });
    });
  }, [router]);

  return null;
}
