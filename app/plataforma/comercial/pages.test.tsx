/**
 * Lo común de las 15 pantallas del CRM comercial (cada una tiene además su
 * propio `page.test.tsx` con su comportamiento): título, sesión, quién entra.
 */
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { render, screen } from "@/test-utils/render";
import { NextNotFoundSignal, NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

import * as Dashboard from "./page";
import * as Entidades from "./entidades/page";
import * as EntidadFicha from "./entidades/[id]/page";
import * as Contactos from "./contactos/page";
import * as Pipeline from "./pipeline/page";
import * as Actividades from "./actividades/page";
import * as Tareas from "./tareas/page";
import * as Calendario from "./calendario/page";
import * as Mapa from "./mapa/page";
import * as Oportunidades from "./oportunidades/page";
import * as OportunidadFicha from "./oportunidades/[id]/page";
import * as Documentos from "./documentos/page";
import * as Informes from "./informes/page";
import * as Atencion from "./atencion/page";
import * as Configuracion from "./configuracion/page";

type PageModule = {
  default: (props: { params: Promise<{ id: string }> }) => Promise<React.ReactElement>;
  generateMetadata: () => Promise<{ title?: unknown }>;
};

const PAGES: [string, PageModule, string][] = [
  ["dashboard", Dashboard as unknown as PageModule, "Comercial"],
  ["entidades", Entidades as unknown as PageModule, "Entidades"],
  ["ficha de entidad", EntidadFicha as unknown as PageModule, "Ficha de entidad"],
  ["contactos", Contactos as unknown as PageModule, "Contactos"],
  ["pipeline", Pipeline as unknown as PageModule, "Pipeline"],
  ["actividades", Actividades as unknown as PageModule, "Actividades"],
  ["tareas", Tareas as unknown as PageModule, "Tareas y recordatorios"],
  ["calendario", Calendario as unknown as PageModule, "Calendario"],
  ["mapa", Mapa as unknown as PageModule, "Mapa comercial"],
  ["oportunidades", Oportunidades as unknown as PageModule, "Oportunidades"],
  ["ficha de oportunidad", OportunidadFicha as unknown as PageModule, "Oportunidad"],
  ["documentos", Documentos as unknown as PageModule, "Documentos"],
  ["informes", Informes as unknown as PageModule, "Informes"],
  ["necesitan atención", Atencion as unknown as PageModule, "Necesitan atención"],
  ["configuración", Configuracion as unknown as PageModule, "Configuración"],
];

const props = { params: Promise.resolve({ id: "1" }) };

afterEach(() => {
  getServerSessionMock.mockReset();
});

function session(role: string | null) {
  return { token: "t", me: buildMe({ org_memberships: [] }), platformRole: buildPlatformRole(role as never) };
}

describe("pantallas del CRM comercial", () => {
  it.each(PAGES)("%s tiene su título", async (_name, page, title) => {
    expect((await page.generateMetadata()).title).toBe(title);
  });

  it.each(PAGES)("%s sin sesión manda al login", async (_name, page) => {
    getServerSessionMock.mockResolvedValue(null);
    await expect(page.default(props)).rejects.toBeInstanceOf(NextRedirectSignal);
  });

  it.each(PAGES)("%s: un rol de plataforma sin CRM no entra", async (_name, page) => {
    getServerSessionMock.mockResolvedValue(session("moderator"));
    render(await page.default(props));
    expect(screen.getByText(/El CRM comercial es solo para/)).toBeInTheDocument();
  });

  it.each([["ficha de entidad", EntidadFicha], ["ficha de oportunidad", OportunidadFicha]])(
    "%s con un id que no es un número da 404",
    async (_name, page) => {
      getServerSessionMock.mockResolvedValue(session("sales"));
      await expect(
        (page as unknown as PageModule).default({ params: Promise.resolve({ id: "abc" }) }),
      ).rejects.toBeInstanceOf(NextNotFoundSignal);
    },
  );
});
