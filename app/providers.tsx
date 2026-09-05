"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { SessionExpiredHandler } from "@/components/SessionExpiredHandler";
import { restoreSession } from "@/hooks/useAuth";
import { registerBootRestore } from "@/lib/auth/bootSession";

export function Providers({ children }: { children: React.ReactNode }) {
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
  // que `apiFetch` la espere si hace falta.
  //
  // El `typeof window` es imprescindible: este mismo inicializador corre
  // también durante el renderizado en servidor de una página estática
  // (p. ej. `/login`, prerenderizada en `next build`), donde `fetch` no
  // sabe resolver una URL relativa (`/api/session/refresh`) y el build
  // fallaría. En el navegador (incluida la hidratación) sí se ejecuta,
  // que es lo único que importa para evitar la carrera.
  useState(() => {
    if (typeof window !== "undefined") {
      registerBootRestore(restoreSession());
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <SessionExpiredHandler />
      {children}
    </QueryClientProvider>
  );
}
