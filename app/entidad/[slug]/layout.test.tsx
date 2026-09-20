import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import {
  NextRedirectSignal,
  setPathname,
} from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildOrganization } from "@/test-utils/fixtures/organization";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const serverFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({
  getServerSession: getServerSessionMock,
}));
vi.mock("@/lib/api/serverFetch", () => ({ serverFetch: serverFetchMock }));

import EntidadLayout from "./layout";

afterEach(() => {
  getServerSessionMock.mockReset();
  serverFetchMock.mockReset();
  vi.unstubAllEnvs();
});

function session(role: string) {
  return {
    token: "t",
    me: buildMe({
      org_memberships: [
        buildOrgMembership({
          role,
          organization_slug: "alfaville",
          organization_name: "Alfaville",
        }),
      ],
    }),
    platformRole: buildPlatformRole(null),
  };
}

describe("EntidadLayout", () => {
  it("titular ve las 14 secciones del menú", async () => {
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization(),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    render(element);

    for (const label of [
      "Inicio",
      "Personas",
      "Comunidades",
      "Actividades",
      "Programas",
      "Configuración",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(
      screen.getByText("Asociación Vecinal Alfaville"),
    ).toBeInTheDocument();
  });

  it("la cabecera lleva el botón de ayuda de la pantalla actual", async () => {
    setPathname("/entidad/alfaville");
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization(),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    render(element);

    expect(screen.getByRole("button", { name: /^Ayuda:/ })).toBeInTheDocument();
    // Selector de idioma: un `<select>` con etiqueta solo para lectores
    // de pantalla desde la pasada de densidad (2026-09-20), no tres
    // botones.
    // Idioma y «Cerrar sesión» viven dentro del menú de cuenta, cuyo
    // botón lleva el email de la sesión en su nombre accesible.
    expect(
      screen.getByRole("button", { name: /^Cuenta de .+@.+/ }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("analista no ve Personas ni Configuración: solo Inicio e Informes", async () => {
    getServerSessionMock.mockResolvedValue(session("analista"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization(),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    render(element);

    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Informes" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Personas" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Configuración" }),
    ).not.toBeInTheDocument();
  });

  it("dinamizador no ve Configuración, Reportes, Comunicaciones ni Informes (no puede exportar)", async () => {
    getServerSessionMock.mockResolvedValue(session("dinamizador"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization(),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    render(element);

    expect(
      screen.queryByRole("link", { name: "Configuración" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Reportes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Comunicaciones" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Informes" }),
    ).not.toBeInTheDocument();
  });

  it("referente ve Inicio, Personas, Actividades y Programas, nada más", async () => {
    getServerSessionMock.mockResolvedValue(session("referente"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization(),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    render(element);

    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Personas" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Actividades" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Programas" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Comunidades" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Informes" }),
    ).not.toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadLayout({
        children: <p />,
        params: Promise.resolve({ slug: "alfaville" }),
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        url: "/login",
      } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("con rol de plataforma redirige a /plataforma (manda sobre la entidad)", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular" })],
      }),
      platformRole: buildPlatformRole("superadmin"),
    });

    await expect(
      EntidadLayout({
        children: <p />,
        params: Promise.resolve({ slug: "alfaville" }),
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        url: "/plataforma",
      } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("sin membresía en esa entidad redirige a / (que decide el destino real)", async () => {
    getServerSessionMock.mockResolvedValue(session("titular"));

    await expect(
      EntidadLayout({
        children: <p />,
        params: Promise.resolve({ slug: "otra-entidad" }),
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        url: "/",
      } satisfies Partial<NextRedirectSignal>),
    );
  });

  it("con logo en un host permitido pinta la imagen de la entidad", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ logo: "https://api.test/media/logo.png" }),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    const { container } = render(element);

    // El logo es decorativo (`alt=""`), así que no entra en el árbol de
    // accesibilidad: se comprueba por el propio nodo `<img>`.
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("con un logo en un host NO permitido no pinta imagen y el layout sigue en pie", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ logo: "https://host-ajeno.example/logo.png" }),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    const { container } = render(element);

    expect(container.querySelector("img")).toBeNull();
    expect(
      screen.getByText("Asociación Vecinal Alfaville"),
    ).toBeInTheDocument();
  });

  it("con un color de marca claro (#FFFF00), la cabecera usa texto oscuro legible", async () => {
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ primary_color: "#FFFF00" }),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    const { container } = render(element);

    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    expect(header?.style.backgroundColor).toBe("rgb(255, 255, 0)");
    expect(header?.style.color).toBe("rgb(26, 44, 51)");
  });

  it("con un color de marca oscuro (#123456), la cabecera usa texto blanco legible", async () => {
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ primary_color: "#123456" }),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    const { container } = render(element);

    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    expect(header?.style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect(header?.style.color).toBe("rgb(255, 255, 255)");
  });

  it("con un color de marca en forma corta (#0a4) lo usa igual que uno de 6 dígitos", async () => {
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ primary_color: "#0a4" }),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    const { container } = render(element);

    const header = container.querySelector("header");
    expect(header?.style.backgroundColor).toBe("rgb(0, 170, 68)");
    expect(header?.style.color).toBe("rgb(26, 44, 51)");
  });

  it("con un color de marca que no es un hex calculable, la cabecera cae al tinte claro", async () => {
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization({ primary_color: "rojo corporativo" }),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    const { container } = render(element);

    const header = container.querySelector("header");
    expect(header?.style.backgroundColor).toBe("var(--color-primary-100)");
    expect(header?.style.color).toBe("var(--color-text-base)");
    // La franja inferior no repite el color inválido (sería una
    // declaración que el navegador descarta): usa el tono decorativo.
    expect(header?.style.borderBottom).toBe("6px solid var(--color-primary)");
  });

  it("si falla la ficha de la entidad muestra un ErrorState pero no bloquea la página", async () => {
    getServerSessionMock.mockResolvedValue(session("titular"));
    serverFetchMock.mockResolvedValue({ ok: false, status: 500, body: null });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    render(element);

    expect(
      screen.getByText("No se pudo cargar la ficha de la entidad"),
    ).toBeInTheDocument();
  });

  it("con un rol de plataforma desconocido NO va a /plataforma: pinta el panel de su entidad", async () => {
    // `resolveArea` ya no resuelve 'plataforma' con un rol desconocido,
    // así que la raíz manda aquí; si este layout siguiera mirando solo
    // que `role` no sea null, lo devolvería a `/plataforma`, cuyo layout
    // lo manda otra vez a `/` (bucle de redirecciones, revisión de la
    // tarea 2).
    getServerSessionMock.mockResolvedValue({
      ...session("titular"),
      platformRole: { role: "rol-que-el-backend-inventa" },
    });
    serverFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: buildOrganization(),
    });

    const element = await EntidadLayout({
      children: <p>contenido</p>,
      params: Promise.resolve({ slug: "alfaville" }),
    });
    render(element);

    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });
});
