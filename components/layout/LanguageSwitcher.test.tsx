import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render as rtlRenderUnwrapped } from "@testing-library/react";
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
 * cambiarlo — necesario aquí para comprobar el valor del `<select>` con
 * otro idioma activo. Mismo patrón que `PageHelp.test.tsx` (RTL sin envolver
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
  it("pinta un <select> con etiqueta «Idioma» y las tres opciones por nombre completo", () => {
    render(<LanguageSwitcher />);

    const select = screen.getByLabelText("Idioma");

    expect(select.tagName).toBe("SELECT");
    expect(
      Array.from(select.querySelectorAll("option")).map((option) => option.textContent),
    ).toEqual(["Español", "Euskara", "Català"]);
  });

  it("la etiqueta «Idioma» es solo para lectores de pantalla", () => {
    const { container } = render(<LanguageSwitcher />);

    const label = container.querySelector("label");

    expect(label).not.toBeNull();
    expect(label?.className).toContain("sr-only");
  });

  it("con locale es (por defecto de los tests), el valor seleccionado es «es»", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByLabelText("Idioma")).toHaveValue("es");
  });

  it("con locale eu, el valor seleccionado es «eu»", () => {
    renderWithLocale("eu");

    expect(screen.getByLabelText("Idioma")).toHaveValue("eu");
  });

  it("al elegir un idioma distinto, fija la cookie con /api/lang y refresca", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.selectOptions(screen.getByLabelText("Idioma"), "eu");

    expect(fetchMock).toHaveBeenCalledWith("/api/lang", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: "eu" }),
    });
    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("mientras la petición está en vuelo, el select muestra ya el idioma elegido", async () => {
    // Sin el estado optimista, un `<select>` controlado por `useLocale()`
    // volvería al idioma anterior hasta que `router.refresh()` repintara
    // el árbol de servidor: el cambio parecía no haber ocurrido.
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.selectOptions(screen.getByLabelText("Idioma"), "ca");

    expect(screen.getByLabelText("Idioma")).toHaveValue("ca");
  });

  it("con sesión (token en memoria), también guarda la preferencia en la cuenta", async () => {
    setAccessToken("token-1");
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.selectOptions(screen.getByLabelText("Idioma"), "ca");

    expect(mutateAsyncMock).toHaveBeenCalledWith("ca");
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("sin sesión (sin token en memoria), no llama a la mutación de cuenta", async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.selectOptions(screen.getByLabelText("Idioma"), "eu");

    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("elegir el idioma ya activo no hace nada", async () => {
    render(<LanguageSwitcher />);

    // `selectOptions` sobre la opción ya seleccionada puede no disparar
    // `change`: se fuerza el evento a mano para ejercitar la guarda del
    // propio componente pase lo que pase en jsdom.
    fireEvent.change(screen.getByLabelText("Idioma"), { target: { value: "es" } });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("un fallo al fijar la cookie (red caída) no refresca ni rompe", async () => {
    fetchMock.mockRejectedValueOnce(new Error("red caída"));
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.selectOptions(screen.getByLabelText("Idioma"), "eu");

    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("un fallo al fijar la cookie devuelve el select al idioma activo", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.selectOptions(screen.getByLabelText("Idioma"), "eu");

    expect(screen.getByLabelText("Idioma")).toHaveValue("es");
  });

  it("un fallo inesperado de la mutación de cuenta no impide refrescar (la cookie ya se fijó)", async () => {
    setAccessToken("token-1");
    mutateAsyncMock.mockRejectedValueOnce(new Error("red caída"));
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.selectOptions(screen.getByLabelText("Idioma"), "eu");

    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    const { container } = render(<LanguageSwitcher />);

    expect(await axe(container)).toHaveNoViolations();
  });

  /**
   * I3 de la revisión final de la rama de i18n (se conserva con el
   * `<select>` de la pasada de densidad): el control vive sobre la
   * cabecera de marca, que con la entidad por defecto es `primary-700`.
   * Fondo blanco propio, como `PageHelp` y «Cerrar sesión», para que
   * funcione sobre cualquier color de cabecera.
   */
  it("el select tiene fondo blanco: no se confunde con la cabecera de marca", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByLabelText("Idioma").className).toContain("bg-white");
  });

  /**
   * Densidad (2026-09-20): la cabecera de área mide 48px y sus controles
   * 32px. El `<select>` es uno de ellos y no puede bajar de ahí (objetivo
   * interactivo mínimo).
   */
  it("el select mide 32px de alto (h-8), como el resto de controles de la cabecera", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByLabelText("Idioma").className).toContain("h-8");
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
    await user.selectOptions(screen.getByLabelText("Idioma"), "eu");

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
    await user.selectOptions(screen.getByLabelText("Idioma"), "eu");

    expect(queryClient.getQueryState(someKey)?.isInvalidated).toBe(false);
  });
});
