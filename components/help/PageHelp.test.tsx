import userEvent from "@testing-library/user-event";
import { render as rtlRenderUnwrapped } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { axe } from "@/test-utils/axe";
import { fireEvent, render, screen } from "@/test-utils/render";
import { routerMock, setPathname } from "@/test-utils/nextNavigationMock";
import es from "@/messages/es.json";

import { PageHelp } from "./PageHelp";

describe("PageHelp", () => {
  it("sin entrada para la ruta actual, no renderiza nada", () => {
    setPathname("/login");
    const { container } = render(<PageHelp />);

    expect(container).toBeEmptyDOMElement();
  });

  it("con una ruta conocida, pinta el botón de ayuda cerrado", () => {
    setPathname("/entidad/alfaville/personas");
    render(<PageHelp />);

    const button = screen.getByRole("button", { name: "Ayuda: Personas" });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("al pulsar el botón abre el diálogo con el resumen, las acciones y la audiencia", async () => {
    setPathname("/entidad/alfaville/personas");
    const user = userEvent.setup();
    render(<PageHelp />);

    await user.click(screen.getByRole("button", { name: "Ayuda: Personas" }));

    const dialog = screen.getByRole("dialog", { name: "Personas" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ayuda: Personas" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByText(
        "Las personas que participan en tu entidad, con sus comunidades, su actividad reciente y su referente. Nunca muestra datos de contacto: Popyplan trabaja con alias.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Qué puedes hacer aquí" })).toBeInTheDocument();
    expect(
      screen.getByText("Invitar a una persona o importar un Excel/CSV (titular y moderador)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "Quién la ve: Titular, moderador y referente."),
    ).toBeInTheDocument();
  });

  it("tiene fondo blanco para ser legible sobre cualquier cabecera de color", () => {
    setPathname("/entidad/alfaville/personas");
    render(<PageHelp />);

    const button = screen.getByRole("button", { name: "Ayuda: Personas" });
    expect(button.className).toContain("bg-white");
  });

  it("cambiar de pathname cierra el diálogo abierto", () => {
    // `render` de test-utils envuelve en <QueryClientProvider>; su
    // `rerender` sustituiría ese wrapper por completo si le pasáramos
    // <PageHelp /> a secas, desmontando y remontando el componente (lo
    // que resetearía `open` por sí solo, sin probar nada). PageHelp no
    // usa TanStack Query, así que aquí se monta con el `render` sin
    // envolver de Testing Library para que `rerender` actualice el
    // mismo árbol de verdad, sin remontar.
    setPathname("/entidad/alfaville/personas");
    const { rerender } = rtlRenderUnwrapped(
      <NextIntlClientProvider locale="es" messages={es}>
        <PageHelp />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ayuda: Personas" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    setPathname("/entidad/alfaville/actividades");
    rerender(
      <NextIntlClientProvider locale="es" messages={es}>
        <PageHelp />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape cierra el diálogo y devuelve el foco al botón", async () => {
    setPathname("/entidad/alfaville/personas");
    const user = userEvent.setup();
    render(<PageHelp />);

    const button = screen.getByRole("button", { name: "Ayuda: Personas" });
    await user.click(button);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });

  it("no tiene violaciones de accesibilidad (axe), cerrado y abierto", async () => {
    setPathname("/entidad/alfaville/personas");
    const user = userEvent.setup();
    const { container } = render(<PageHelp />);

    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Ayuda: Personas" }));

    expect(await axe(container)).toHaveNoViolations();
  });

  /**
   * Mensajes con `help.entidad.personas` ampliado localmente: el catálogo
   * real ya incluye `details`/`tips`/`related`, pero este fixture fija texto
   * concreto (p. ej. una relacionada no navegable de otra área) sin depender
   * de la redacción vigente — si cambia el catálogo, estos tests no se
   * mueven. Inyectado con un merge en el provider, sin tocar el JSON.
   */
  const messagesConAmpliacion = {
    ...es,
    help: {
      ...es.help,
      entidad: {
        ...es.help.entidad,
        personas: {
          ...es.help.entidad.personas,
          details:
            "El listado mezcla personas activas con las invitaciones pendientes cuando marcas «Incluir invitadas»; cada fila enlaza a su ficha de participación.",
          tips: [
            "Combina la búsqueda de texto con el filtro de comunidad para acotar de verdad.",
            "El filtro «Participación desde» cuenta solo actividades del mes en curso.",
          ],
          related: ["entidad.actividades", "entidad.personaFicha", "plataforma.roles"],
        },
      },
    },
  };

  /**
   * Mensajes con `help.entidad.personas` SIN el contenido ampliado: el
   * catálogo real ya lo trae, así que para probar el render defensivo
   * (secciones ausentes cuando no hay contenido) hay que quitarlo aquí en
   * el provider en vez de montar `messages/es.json` tal cual.
   */
  const messagesSinAmpliacion = JSON.parse(JSON.stringify(es)) as typeof es;
  delete (messagesSinAmpliacion.help.entidad.personas as Partial<
    (typeof es.help.entidad)["personas"]
  >).details;
  delete (messagesSinAmpliacion.help.entidad.personas as Partial<
    (typeof es.help.entidad)["personas"]
  >).tips;
  delete (messagesSinAmpliacion.help.entidad.personas as Partial<
    (typeof es.help.entidad)["personas"]
  >).related;

  function renderConAmpliacion(pathname: string) {
    setPathname(pathname);
    return rtlRenderUnwrapped(
      <NextIntlClientProvider locale="es" messages={messagesConAmpliacion}>
        <PageHelp />
      </NextIntlClientProvider>,
    );
  }

  function renderSinAmpliacion(pathname: string) {
    setPathname(pathname);
    return rtlRenderUnwrapped(
      <NextIntlClientProvider locale="es" messages={messagesSinAmpliacion}>
        <PageHelp />
      </NextIntlClientProvider>,
    );
  }

  it("con contenido ampliado, pinta «Cómo funciona», «Consejos» y «Pantallas relacionadas»", async () => {
    const user = userEvent.setup();
    renderConAmpliacion("/entidad/alfaville/personas");

    await user.click(screen.getByRole("button", { name: "Ayuda: Personas" }));

    expect(
      screen.getByRole("heading", { level: 3, name: "Cómo funciona" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "El listado mezcla personas activas con las invitaciones pendientes cuando marcas «Incluir invitadas»; cada fila enlaza a su ficha de participación.",
      ),
    ).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 3, name: "Consejos" })).toBeInTheDocument();
    expect(
      screen.getByText("Combina la búsqueda de texto con el filtro de comunidad para acotar de verdad."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("El filtro «Participación desde» cuenta solo actividades del mes en curso."),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { level: 3, name: "Pantallas relacionadas" }),
    ).toBeInTheDocument();
    // Resoluble: misma área, solo `[slug]` → se pinta con el slug actual.
    expect(screen.getByRole("button", { name: "Actividades" })).toBeInTheDocument();
    // Estática de plataforma: se navega tal cual.
    expect(screen.getByRole("button", { name: "Roles" })).toBeInTheDocument();
    // Ficha (`[userId]`): nunca es destino de navegación, no pinta botón.
    expect(
      screen.queryByRole("button", { name: "Ficha de la persona" }),
    ).not.toBeInTheDocument();
  });

  it("una relacionada de otra área no pinta botón", async () => {
    const messagesPlataforma = {
      ...es,
      help: {
        ...es.help,
        plataforma: {
          ...es.help.plataforma,
          roles: {
            ...es.help.plataforma.roles,
            details: "Concede y revoca los roles de plataforma sobre las cuentas del buscador.",
            tips: ["Revocar un rol es inmediato: pide confirmación antes."],
            related: ["entidad.personas"],
          },
        },
      },
    };
    setPathname("/plataforma/roles");
    const user = userEvent.setup();
    rtlRenderUnwrapped(
      <NextIntlClientProvider locale="es" messages={messagesPlataforma}>
        <PageHelp />
      </NextIntlClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Ayuda: Roles" }));

    expect(
      screen.getByRole("heading", { level: 3, name: "Pantallas relacionadas" }),
    ).toBeInTheDocument();
    // `entidad.personas` usa `[slug]` y plataforma no tiene slug que portar.
    expect(screen.queryByRole("button", { name: "Personas" })).not.toBeInTheDocument();
  });

  it("clic en una relacionada resoluble navega a su ruta y cierra el diálogo", async () => {
    const user = userEvent.setup();
    renderConAmpliacion("/entidad/alfaville/personas");

    await user.click(screen.getByRole("button", { name: "Ayuda: Personas" }));
    await user.click(screen.getByRole("button", { name: "Actividades" }));

    expect(routerMock.push).toHaveBeenCalledWith("/entidad/alfaville/actividades");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ayuda: Personas" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("sin el contenido nuevo en el catálogo, no pinta las secciones vacías", async () => {
    const user = userEvent.setup();
    renderSinAmpliacion("/entidad/alfaville/personas");

    await user.click(screen.getByRole("button", { name: "Ayuda: Personas" }));

    expect(screen.queryByRole("heading", { name: "Cómo funciona" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Consejos" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Pantallas relacionadas" }),
    ).not.toBeInTheDocument();
  });

  it("con todo el contenido abierto, no tiene violaciones de accesibilidad (axe)", async () => {
    const user = userEvent.setup();
    const { container } = renderConAmpliacion("/entidad/alfaville/personas");

    await user.click(screen.getByRole("button", { name: "Ayuda: Personas" }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
