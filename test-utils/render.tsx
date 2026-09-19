import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import es from "@/messages/es.json";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/**
 * `es` es el idioma por defecto de los tests (spec de diseño
 * `2026-09-19-i18n-es-eu-ca`, decisión 2: «el idioma por defecto en tests
 * es `es`, así las aserciones de texto existentes no cambian»). Un
 * componente de cliente que use `useTranslations`/`useFormatter` de
 * `next-intl` recibe el catálogo real de `messages/es.json` — nunca un
 * mock de las cadenas, para que una traducción que se quede sin clave (o
 * un valor vacío) rompa el test que la usa, igual que ya haría con un
 * literal.
 */
export function render(ui: ReactElement, options?: RenderOptions) {
  const queryClient = createTestQueryClient();
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="es" messages={es}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
    options,
  );
}

/**
 * Patrón para probar un Server Component (`page.tsx`) que use
 * `getTranslations`/`getMessages`/`getLocale` de `next-intl/server`:
 * esas funciones **no** se pueden ejecutar de verdad bajo Vitest+jsdom
 * (el paquete resuelve a su condición `react-client`, que lanza
 * `` `getRequestConfig` is not supported in Client Components ``, algo
 * verificado al escribir esta tarea) — por eso `vitest.setup.ts` mockea
 * el módulo entero `next-intl/server` contra el catálogo real de
 * `messages/es.json`, igual que ya se mockea `next/navigation`. Con eso
 * mockeado, un `page.tsx` async que llame a `getTranslations()` se sigue
 * probando con el mismo patrón que ya usan las páginas de servidor de
 * este repo (`const element = await Page({ params }); render(element)`,
 * ver p. ej. `app/entidad/[slug]/page.test.tsx`) — `renderServer` es solo
 * el envoltorio de esas dos líneas para no repetirlas en cada test.
 */
export async function renderServer(elementPromise: Promise<ReactElement>, options?: RenderOptions) {
  const element = await elementPromise;
  return render(element, options);
}

export * from "@testing-library/react";
