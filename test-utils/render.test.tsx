/**
 * Prueba del patrón de tests de i18n que fija la tarea de infraestructura
 * (`docs/superpowers/plans/2026-09-19-i18n-panel.md`, tarea 1): un
 * componente de cliente con `useTranslations` recibe el catálogo real de
 * `messages/es.json` a través de `render()`; un Server Component
 * `async` que use `getTranslations`/`getLocale` de `next-intl/server`
 * (mockeado en `vitest.setup.ts`, ver su docstring) se sigue probando con
 * `await Componente(...)` — `renderServer` es el envoltorio de esas dos
 * líneas.
 */
import { describe, expect, it } from "vitest";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { render, renderServer, screen } from "./render";

function ClientDemo() {
  const t = useTranslations("common");
  return <button>{t("cancel")}</button>;
}

async function ServerDemo() {
  const t = await getTranslations("common");
  return <p>{t("noAccess")}</p>;
}

describe("render()", () => {
  it("provee el catálogo es real: common.cancel se pinta como «Cancelar»", () => {
    render(<ClientDemo />);

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });
});

describe("renderServer()", () => {
  it("await Componente() + render(), para un Server Component que use getTranslations", async () => {
    await renderServer(ServerDemo());

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });
});
