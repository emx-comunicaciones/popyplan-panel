import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `app/layout.tsx` importa fuentes, CSS y `Providers` a nivel de
// módulo/render — nada de eso resuelve bajo Vitest+jsdom sin ayuda (no
// es el build real de Next: las fuentes de `next/font/google` no tienen
// implementación de test, y `Providers` arrastra `bootRestoreSession`,
// que dispararía peticiones de red reales). Se mockean para poder
// probar `generateMetadata` y el propio `RootLayout` sin levantar el
// resto del árbol — mismo motivo por el que este fichero no existía
// hasta el hallazgo M17 de la revisión final de la rama de i18n: nadie
// había necesitado importar `layout.tsx` en un test.
vi.mock("./globals.css", () => ({}));
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));
vi.mock("./providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => children,
}));

import RootLayout, { generateMetadata } from "./layout";

describe("RootLayout metadata (M17)", () => {
  it("description viene del catálogo, no de un literal fijo", async () => {
    const metadata = await generateMetadata();
    expect(metadata.description).toBe("Panel web de entidades, paraguas y plataforma de Popyplan");
  });

  it("mantiene el título/plantilla estáticos", async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toEqual({ default: "Popyplan · Panel", template: "%s · Popyplan" });
  });
});

describe("RootLayout", () => {
  it("pinta <html lang> con el idioma de la petición (es en los tests) y los hijos", async () => {
    const element = await RootLayout({ children: <p>contenido</p> });
    const { container } = render(element);

    expect(document.documentElement.lang).toBe("es");
    expect(container).toHaveTextContent("contenido");
  });
});
