import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRenderUnwrapped } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { axe } from "@/test-utils/axe";
import { createTestQueryClient, render, screen } from "@/test-utils/render";
import { routerMock } from "@/test-utils/nextNavigationMock";
import { resetAccessTokenForTests, setAccessToken } from "@/lib/auth/tokenStore";
import es from "@/messages/es.json";

const mutateAsyncMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const useUpdatePreferredLanguageMock = vi.hoisted(() => vi.fn(() => ({ mutateAsync: mutateAsyncMock })));
vi.mock("@/hooks/useUpdatePreferredLanguage", () => ({
  useUpdatePreferredLanguage: useUpdatePreferredLanguageMock,
}));

import { LanguageSwitcher } from "./LanguageSwitcher";

const fetchMock = vi.fn();

/**
 * `test-utils/render.tsx::render` fija `locale="es"` sin posibilidad de
 * cambiarlo — necesario aquí para comprobar `aria-pressed` con otro
 * idioma activo. Mismo patrón que `PageHelp.test.tsx` (RTL sin envolver
 * + `NextIntlClientProvider` a mano); `QueryClientProvider` se mantiene
 * por si `useUpdatePreferredLanguage` deja de estar mockeado algún día
 * (el hook real usa `useMutation`, que exige ese contexto).
 */
function renderWithLocale(locale: string) {
  const queryClient = createTestQueryClient();
  return rtlRenderUnwrapped(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={es}>
        <LanguageSwitcher />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

/** Igual que `renderWithLocale`, pero expone el `queryClient` (M12: hace
 * falta para comprobar `getQueryState(...).isInvalidated` tras un
 * cambio de idioma, mismo patrón que `hooks/useMarkAttendance.test.tsx`).
 */
function renderWithQueryClient() {
  const queryClient = createTestQueryClient();
  rtlRenderUnwrapped(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="es" messages={es}>
        <LanguageSwitcher />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({ ok: true, status: 204 });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  mutateAsyncMock.mockReset();
  mutateAsyncMock.mockResolvedValue(null);
  resetAccessTokenForTests();
});

describe("LanguageSwitcher", () => {
  it("pinta tres botones, cada uno con su código y su nombre completo como aria-label", () => {
    render(<LanguageSwitcher />);

    const esButton = screen.getByRole("button", { name: "Español" });
    const euButton = screen.getByRole("button", { name: "Euskara" });
    const caButton = screen.getByRole("button", { name: "Català" });

    expect(esButton).toHaveTextContent("ES");
    expect(euButton).toHaveTextContent("EU");
    expect(caButton).toHaveTextContent("CA");
  });

  it("con locale es (por defecto de los tests), el botón ES aparece pulsado", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Euskara" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Català" })).toHaveAttribute("aria-pressed", "false");
  });

  it("con locale eu, el botón EU aparece pulsado", () => {
    renderWithLocale("eu");

    expect(screen.getByRole("button", { name: "Euskara" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "false");
  });

  it("al pulsar un idioma distinto, fija la cookie con /api/lang y refresca", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "Euskara" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/lang", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: "eu" }),
    });
    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("con sesión (token en memoria), también guarda la preferencia en la cuenta", async () => {
    setAccessToken("token-1");
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "Català" }));

    expect(mutateAsyncMock).toHaveBeenCalledWith("ca");
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("sin sesión (sin token en memoria), no llama a la mutación de cuenta", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "Euskara" }));

    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("pulsar el idioma ya activo no hace nada", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "Español" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("un fallo al fijar la cookie (red caída) no refresca ni rompe", async () => {
    fetchMock.mockRejectedValueOnce(new Error("red caída"));
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "Euskara" }));

    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("un fallo inesperado de la mutación de cuenta no impide refrescar (la cookie ya se fijó)", async () => {
    setAccessToken("token-1");
    mutateAsyncMock.mockRejectedValueOnce(new Error("red caída"));
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "Euskara" }));

    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(<LanguageSwitcher />);

    expect(await axe(container)).toHaveNoViolations();
  });

  /**
   * I3 de la revisión final de la rama: el botón activo usaba
   * `variant="primary"` (`bg-primary-700`), invisible sobre la cabecera
   * de entidad por defecto (también `primary-700`, 1,00:1 de contraste
   * de superficie). Mismo arreglo que `PageHelp.tsx` en `a41bde5`: fondo
   * blanco fijo para los tres botones, y el activo se distingue por algo
   * más que el color (aquí `font-semibold` + un borde marcado, además de
   * `aria-pressed`, que ya era correcto).
   */
  it("los tres botones tienen fondo blanco (I3): el activo no se confunde con la cabecera de marca", () => {
    render(<LanguageSwitcher />);

    const esButton = screen.getByRole("button", { name: "Español" });
    const euButton = screen.getByRole("button", { name: "Euskara" });
    const caButton = screen.getByRole("button", { name: "Català" });

    expect(esButton.className).toContain("bg-white");
    expect(euButton.className).toContain("bg-white");
    expect(caButton.className).toContain("bg-white");
  });

  it("el botón activo se distingue del resto por algo más que el color (I3)", () => {
    render(<LanguageSwitcher />);

    const esButton = screen.getByRole("button", { name: "Español" });
    const euButton = screen.getByRole("button", { name: "Euskara" });

    expect(esButton.className).toContain("font-semibold");
    expect(euButton.className).not.toContain("font-semibold");
  });

  /**
   * M12 de la revisión final de la rama: cambiar de idioma solo hacía
   * `router.refresh()` (Server Components), sin tocar la caché de
   * TanStack Query — los `detail` verbatim del backend que
   * `errorKindText` prioriza (y que con la i18n del backend llegarán
   * traducidos) se quedaban en el idioma anterior hasta que la query se
   * refrescara por otro motivo.
   */
  it("al cambiar de idioma con éxito, invalida la caché de TanStack Query antes de refrescar (M12)", async () => {
    const queryClient = renderWithQueryClient();
    const someKey = ["panel-entity-events", 7, "since=2026-01-01&until=2026-01-31"];
    queryClient.setQueryData(someKey, []);
    expect(queryClient.getQueryState(someKey)?.isInvalidated).toBe(false);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Euskara" }));

    await vi.waitFor(() => {
      expect(queryClient.getQueryState(someKey)?.isInvalidated).toBe(true);
    });
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("un fallo al fijar la cookie no invalida la caché (no hay nada que refrescar)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("red caída"));
    const queryClient = renderWithQueryClient();
    const someKey = ["panel-entity-events", 7, "since=2026-01-01&until=2026-01-31"];
    queryClient.setQueryData(someKey, []);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Euskara" }));

    expect(queryClient.getQueryState(someKey)?.isInvalidated).toBe(false);
  });
});
