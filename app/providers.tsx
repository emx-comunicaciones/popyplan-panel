"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { SessionExpiredHandler } from "@/components/SessionExpiredHandler";
import { applyAccountLanguage, bootRestoreSession, type SessionData } from "@/hooks/useAuth";
import { registerBootRestore } from "@/lib/auth/bootSession";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
      }),
  );

  // Arranca la restauración del access token en memoria (tras una recarga
  // completa de página: el Server Component ya validó la cookie al
  // renderizar, esto solo repone el estado del lado del cliente) dentro del
  // inicializador perezoso de `useState`, que se ejecuta durante el
  // render — antes de que ningún componente hijo monte su propio efecto y
  // dispare una petición con el token todavía vacío (bug crítico de demo,
  // ver `lib/api/client.ts`). `registerBootRestore` la deja disponible para
  // que `apiFetch` la espere si hace falta. `bootRestoreSession` memoiza
  // la promesa a nivel de módulo: el StrictMode de React ejecuta este
  // inicializador dos veces en desarrollo, y sin esa memoización salían
  // dos refrescos concurrentes con la misma cookie.
  //
  // El `typeof window` es imprescindible: este mismo inicializador corre
  // también durante el renderizado en servidor de una página estática
  // (p. ej. `/login`, prerenderizada en `next build`), donde `fetch` no
  // sabe resolver una URL relativa (`/api/session/refresh`) y el build
  // fallaría. En el navegador (incluida la hidratación) sí se ejecuta,
  // que es lo único que importa para evitar la carrera.
  //
  // Guarda la propia promesa (en vez de solo registrarla) para que el
  // `useEffect` de abajo pueda encadenar la sincronización del idioma de
  // la cuenta sin relanzar la restauración — sigue siendo la misma
  // promesa memoizada de `bootRestoreSession`, creada aquí (durante el
  // render, antes de cualquier efecto hijo) por la razón de arriba.
  const [bootPromise] = useState<ReturnType<typeof bootRestoreSession> | null>(() => {
    if (typeof window === "undefined") return null;
    const promise = bootRestoreSession();
    registerBootRestore(promise);
    return promise;
  });

  // Idioma de la cuenta al restaurar la sesión (spec de diseño
  // `2026-09-19-i18n-es-eu-ca`, decisión 2, último párrafo): a
  // diferencia del login (`LoginForm.tsx`, que ya tiene la sesión nueva
  // en la mano tras `await login()`), la restauración es asíncrona y
  // corre fuera de cualquier gestor de eventos, así que el
  // `router.refresh()` condicional vive en un efecto aparte en vez de en
  // el inicializador de arriba (un efecto sí puede ser async sin romper
  // las reglas de los hooks). `cancelled` evita actuar sobre una
  // recarga después de que el componente se haya desmontado.
  useEffect(() => {
    if (!bootPromise) return;
    let cancelled = false;
    bootPromise.then(async (session: SessionData | null) => {
      if (cancelled || !session) return;
      if (await applyAccountLanguage(session.user)) {
        router.refresh();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bootPromise, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionExpiredHandler />
      {children}
    </QueryClientProvider>
  );
}
