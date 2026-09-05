"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { restoreSession } from "@/hooks/useAuth";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
      }),
  );

  useEffect(() => {
    // Restaura el access token en memoria tras una recarga completa de
    // página: el Server Component ya validó la cookie al renderizar, así
    // que esto solo repone el estado del lado del cliente.
    restoreSession();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
