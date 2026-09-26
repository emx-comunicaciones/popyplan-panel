import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

const getServerSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));

import { ApiError } from "@/lib/api/client";
import type { TreasureGameDetail } from "@/lib/api/types";
import { render, screen, waitFor, within } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextNotFoundSignal, NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe } from "@/test-utils/fixtures/me";
import { buildPlatformRole } from "@/test-utils/fixtures/platformRole";
import {
  EVENT_ID,
  GAME_ID,
  buildTreasureCompletion,
  buildTreasureGameDetail,
  buildTreasureParticipant,
  buildTreasurePrizeTier,
  buildTreasureRankingRow,
  buildTreasureStep,
} from "@/test-utils/fixtures/treasureHunt";

import PlataformaTesoroDetailPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  apiFetchMock.mockReset();
});

const BASE = `/api/treasure-hunt/${GAME_ID}/`;
type Handler = (options?: { method?: string; body?: unknown }) => unknown;

interface Backend {
  game?: TreasureGameDetail | (() => unknown);
  routes?: Record<string, Handler>;
}

/** Router de mocks: `"METHOD path"` → respuesta; por defecto listas vacías. */
function mockBackend({ game = buildTreasureGameDetail(), routes = {} }: Backend = {}) {
  apiFetchMock.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
    const method = options?.method ?? "GET";
    const handler = routes[`${method} ${path}`];
    if (handler) return handler(options);
    if (method === "GET" && path === BASE) return typeof game === "function" ? game() : game;
    if (method === "GET" && path.startsWith(BASE)) return [];
    if (method === "GET" && path === `/api/events/${EVENT_ID}/`) {
      return { id: EVENT_ID, title: "Búsqueda del tesoro de Donostia", status: "scheduled", starts_at: "2030-10-10T10:00:00Z" };
    }
    if (method !== "GET") return { detail: "ok" };
    throw new Error(`sin mock para ${method} ${path}`);
  });
}

function superadmin() {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({ org_memberships: [] }),
    platformRole: buildPlatformRole("superadmin"),
  });
}

async function renderPage(id = GAME_ID) {
  return render(await PlataformaTesoroDetailPage({ params: Promise.resolve({ id }) }));
}

async function openTab(name: string) {
  await userEvent.click(await screen.findByRole("button", { name }));
}

const calls = (method: string, path: string) =>
  apiFetchMock.mock.calls.filter(([p, o]) => p === path && (o?.method ?? "GET") === method);

describe("PlataformaTesoroDetailPage", () => {
  it("no tiene violaciones de accesibilidad (axe), en Datos con la confirmación abierta y en Pruebas con el diálogo", async () => {
    mockBackend({ routes: { [`GET ${BASE}steps/list/`]: () => [buildTreasureStep()] } });
    superadmin();
    const { container } = await renderPage();
    await screen.findByRole("button", { name: "Abrir inscripciones" });
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: "Abrir inscripciones" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    await openTab("Pruebas");
    await screen.findByText("Donde el peine del viento canta");
    await userEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expone el título vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Ficha del juego");
  });

  it("un id que no es UUID es 404 sin pedir nada", async () => {
    await expect(PlataformaTesoroDetailPage({ params: Promise.resolve({ id: "123" }) })).rejects.toBeInstanceOf(
      NextNotFoundSignal,
    );
    expect(getServerSessionMock).not.toHaveBeenCalled();
  });

  it("gates: sin sesión a /login, sin rol a /, moderator «Sin acceso»", async () => {
    getServerSessionMock.mockResolvedValue(null);
    await expect(PlataformaTesoroDetailPage({ params: Promise.resolve({ id: GAME_ID }) })).rejects.toEqual(
      expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>),
    );
    getServerSessionMock.mockResolvedValue({ token: "t", me: buildMe(), platformRole: buildPlatformRole(null) });
    await expect(PlataformaTesoroDetailPage({ params: Promise.resolve({ id: GAME_ID }) })).rejects.toEqual(
      expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>),
    );
    getServerSessionMock.mockResolvedValue({ token: "t", me: buildMe(), platformRole: buildPlatformRole("moderator") });
    await renderPage();
    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("un juego que no existe tiene su estado vacío, y un fallo su error", async () => {
    mockBackend({
      game: () => {
        throw new ApiError(404, null);
      },
    });
    superadmin();
    const first = await renderPage();
    expect(await screen.findByText("Este juego no existe o se ha borrado")).toBeInTheDocument();
    first.unmount();

    mockBackend({
      game: () => {
        throw new ApiError(500, null);
      },
    });
    await renderPage();
    expect(await screen.findByText("No se pudo cargar el juego")).toBeInTheDocument();
  });

  describe("Datos", () => {
    it("un borrador explica que no tiene actividad y abre inscripciones con confirmación", async () => {
      mockBackend();
      superadmin();
      await renderPage();
      expect(await screen.findByText(/un borrador no se publica/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Volver a los juegos" })).toHaveAttribute("href", "/plataforma/busca-del-tesoro");
      await userEvent.click(screen.getByRole("button", { name: "Abrir inscripciones" }));
      const dialog = screen.getByRole("alertdialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Abrir inscripciones" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(calls("POST", `${BASE}open/`)).toHaveLength(1);
    });

    it("abierto sin pruebas no deja empezar; con actividad la enseña", async () => {
      mockBackend({ game: buildTreasureGameDetail({ status: "open", event_id: EVENT_ID, steps_count: 0 }) });
      superadmin();
      await renderPage();
      expect(await screen.findByRole("button", { name: "Empezar el juego" })).toBeDisabled();
      expect(screen.getByText("Añade al menos una prueba antes de empezar.")).toBeInTheDocument();
      expect(await screen.findByText("Programada")).toBeInTheDocument();
      expect(screen.getByText(EVENT_ID)).toBeInTheDocument();
    });

    it("un error del ciclo de vida se pinta dentro del diálogo", async () => {
      mockBackend({
        game: buildTreasureGameDetail({ status: "in_progress", steps_count: 2 }),
        routes: {
          [`POST ${BASE}finish/`]: () => {
            throw new ApiError(400, { detail: "Solo se pueden finalizar juegos en progreso." });
          },
        },
      });
      superadmin();
      await renderPage();
      await userEvent.click(await screen.findByRole("button", { name: "Terminar el juego" }));
      const dialog = screen.getByRole("alertdialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Terminar el juego" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Solo se pueden finalizar juegos en progreso.");
      await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("un juego terminado no ofrece más pasos; la actividad que no carga lo dice", async () => {
      mockBackend({
        game: buildTreasureGameDetail({ status: "finished", event_id: EVENT_ID }),
        routes: {
          [`GET /api/events/${EVENT_ID}/`]: () => {
            throw new ApiError(500, null);
          },
        },
      });
      superadmin();
      await renderPage();
      expect(await screen.findByText(/no quedan pasos/)).toBeInTheDocument();
      expect(await screen.findByText("No se pudo cargar la actividad enlazada.")).toBeInTheDocument();
    });

    it("editar sin tocar la fecha no manda start_time", async () => {
      let current = buildTreasureGameDetail();
      mockBackend({
        game: () => current,
        routes: {
          [`PATCH ${BASE}`]: () => {
            current = buildTreasureGameDetail({ name: "Nuevo nombre" });
            return current;
          },
        },
      });
      superadmin();
      await renderPage();
      const name = await screen.findByLabelText("Nombre");
      await userEvent.clear(name);
      await userEvent.type(name, "Nuevo nombre");
      await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
      expect(await screen.findByText("Cambios guardados.")).toBeInTheDocument();
      const [[, options]] = calls("PATCH", BASE) as [[string, { body: Record<string, unknown> }]];
      expect(options.body.name).toBe("Nuevo nombre");
      expect(options.body).not.toHaveProperty("start_time");
      expect(options.body).not.toHaveProperty("game_mode");
      expect(screen.getByLabelText("Nombre")).toHaveValue("Nuevo nombre");
    });

    it("un juego heredado por equipos lo avisa", async () => {
      mockBackend({ game: buildTreasureGameDetail({ game_mode: "teams", image: "/media/x.png" }) });
      superadmin();
      await renderPage();
      expect(await screen.findByText(/se creó por equipos/)).toBeInTheDocument();
      expect(screen.getByText(/se conserva la actual/)).toBeInTheDocument();
    });
  });

  describe("Pruebas", () => {
    it("crea una prueba de respuesta: la respuesta es obligatoria y viaja", async () => {
      mockBackend({ routes: { [`GET ${BASE}steps/list/`]: () => [buildTreasureStep()] } });
      superadmin();
      await renderPage();
      await openTab("Pruebas");
      await screen.findByText("Donde el peine del viento canta");
      await userEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByLabelText("Orden")).toHaveValue(2);
      await userEvent.type(within(dialog).getByLabelText("Pista"), "Busca el reloj");
      await userEvent.click(within(dialog).getByRole("button", { name: "Añadir prueba" }));
      expect(within(dialog).getByRole("alert")).toHaveTextContent("Las pruebas de respuesta necesitan la respuesta correcta.");
      await userEvent.type(within(dialog).getByLabelText("Respuesta correcta"), "Reloj");
      await userEvent.click(within(dialog).getByRole("button", { name: "Añadir prueba" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      const [[, options]] = calls("POST", `${BASE}steps/`) as [[string, { body: Record<string, unknown> }]];
      expect(options.body).toMatchObject({ order: 2, clue: "Busca el reloj", challenge_type: "answer", correct_answer: "Reloj" });
    });

    it("crea una prueba de ubicación con coordenadas formateadas; rechaza un orden repetido", async () => {
      mockBackend({ routes: { [`GET ${BASE}steps/list/`]: () => [buildTreasureStep()] } });
      superadmin();
      await renderPage();
      await openTab("Pruebas");
      await userEvent.click(await screen.findByRole("button", { name: "Nueva prueba" }));
      const dialog = screen.getByRole("dialog");
      await userEvent.selectOptions(within(dialog).getByLabelText("Tipo de prueba"), "location");
      await userEvent.type(within(dialog).getByLabelText("Pista"), "El faro");
      await userEvent.clear(within(dialog).getByLabelText("Orden"));
      await userEvent.type(within(dialog).getByLabelText("Orden"), "1");
      await userEvent.type(within(dialog).getByLabelText("Latitud"), "43,3183");
      await userEvent.type(within(dialog).getByLabelText("Longitud"), "-1.9812");
      await userEvent.click(within(dialog).getByRole("button", { name: "Añadir prueba" }));
      expect(within(dialog).getByRole("alert")).toHaveTextContent("Ya hay otra prueba con ese orden.");
      await userEvent.clear(within(dialog).getByLabelText("Orden"));
      await userEvent.type(within(dialog).getByLabelText("Orden"), "2");
      await userEvent.clear(within(dialog).getByLabelText("Radio (metros)"));
      await userEvent.type(within(dialog).getByLabelText("Radio (metros)"), "50");
      await userEvent.click(within(dialog).getByRole("button", { name: "Añadir prueba" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      const [[, options]] = calls("POST", `${BASE}steps/`) as [[string, { body: Record<string, unknown> }]];
      expect(options.body).toMatchObject({
        challenge_type: "location",
        latitude: "43.318300",
        longitude: "-1.981200",
        location_radius_meters: 50,
      });
    });

    it("editar una de respuesta conserva la guardada; los números malos se avisan; un 400 se pinta", async () => {
      mockBackend({
        routes: {
          [`GET ${BASE}steps/list/`]: () => [
            buildTreasureStep(),
            buildTreasureStep({
              id: "a2222222-1111-4111-8111-111111111111",
              order: 2,
              clue: "Foto en la playa",
              challenge_type: "photo",
              latitude: 43.3,
              longitude: -1.98,
            }),
          ],
          [`PATCH ${BASE}steps/a1111111-1111-4111-8111-111111111111/`]: () => {
            throw new ApiError(400, { non_field_errors: ["Pista no válida."] });
          },
        },
      });
      superadmin();
      await renderPage();
      await openTab("Pruebas");
      expect(await screen.findByText("43.30000, -1.98000 · 100 m")).toBeInTheDocument();
      expect(screen.getByText("Foto")).toBeInTheDocument();
      await userEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText(/se conserva la respuesta guardada/)).toBeInTheDocument();
      await userEvent.clear(within(dialog).getByLabelText("Puntos"));
      await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
      expect(within(dialog).getByRole("alert")).toHaveTextContent("Puntos, tiempo y radio");
      await userEvent.type(within(dialog).getByLabelText("Puntos"), "20");
      await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
      expect(await within(dialog).findByText("Pista no válida.")).toBeInTheDocument();
      const [[, options]] = calls("PATCH", `${BASE}steps/a1111111-1111-4111-8111-111111111111/`) as [
        [string, { body: Record<string, unknown> }],
      ];
      expect(options.body).not.toHaveProperty("correct_answer");
      await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("una prueba de foto avisa de la revisión a mano", async () => {
      mockBackend();
      superadmin();
      await renderPage();
      await openTab("Pruebas");
      expect(await screen.findByText("Este juego no tiene pruebas")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Nueva prueba" }));
      await userEvent.selectOptions(screen.getByLabelText("Tipo de prueba"), "social");
      expect(screen.getByText(/se revisan a mano/)).toBeInTheDocument();
    });

    it("borra con confirmación y error dentro; un fallo de carga tiene su estado", async () => {
      let fail = true;
      mockBackend({
        routes: {
          [`GET ${BASE}steps/list/`]: () => [buildTreasureStep()],
          [`DELETE ${BASE}steps/a1111111-1111-4111-8111-111111111111/`]: () => {
            if (fail) throw new ApiError(404, { detail: "Pista no encontrada." });
            return undefined;
          },
        },
      });
      superadmin();
      await renderPage();
      await openTab("Pruebas");
      await userEvent.click(await screen.findByRole("button", { name: "Borrar" }));
      const dialog = screen.getByRole("alertdialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Pista no encontrada.");
      fail = false;
      await userEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    });

    it("un fallo al cargar las pruebas", async () => {
      mockBackend({
        routes: {
          [`GET ${BASE}steps/list/`]: () => {
            throw new ApiError(500, null);
          },
        },
      });
      superadmin();
      await renderPage();
      await openTab("Pruebas");
      expect(await screen.findByText("No se pudieron cargar las pruebas")).toBeInTheDocument();
    });
  });

  describe("Premios", () => {
    it("valida el solape en el cliente, crea y borra", async () => {
      mockBackend({ routes: { [`GET ${BASE}prize-tiers/`]: () => [buildTreasurePrizeTier({ rank_to: 3 })] } });
      superadmin();
      await renderPage();
      await openTab("Premios");
      expect(await screen.findByText("Del 1.º al 3.º")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Nuevo premio" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByLabelText("Desde la posición")).toHaveValue(4);
      await userEvent.clear(within(dialog).getByLabelText("Desde la posición"));
      await userEvent.type(within(dialog).getByLabelText("Desde la posición"), "2");
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "El rango de posiciones se solapa con un tramo de premio existente.",
      );
      await userEvent.clear(within(dialog).getByLabelText("Desde la posición"));
      await userEvent.type(within(dialog).getByLabelText("Desde la posición"), "5");
      expect(within(dialog).getByRole("alert")).toHaveTextContent("La posición inicial no puede ser mayor que la final.");
      await userEvent.clear(within(dialog).getByLabelText("Hasta la posición"));
      await userEvent.type(within(dialog).getByLabelText("Hasta la posición"), "10");
      await userEvent.type(within(dialog).getByLabelText("Nombre del premio"), "Camiseta");
      await userEvent.click(within(dialog).getByRole("button", { name: "Añadir premio" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls("POST", `${BASE}prize-tiers/`)[0][1].body).toEqual({
        rank_from: 5,
        rank_to: 10,
        tier_name: "Camiseta",
        description: "",
      });

      await userEvent.click(screen.getByRole("button", { name: "Borrar" }));
      await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Borrar" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(calls("DELETE", `${BASE}prize-tiers/b2222222-2222-4222-8222-222222222222/`)).toHaveLength(1);
    });

    it("edita un tramo y pinta el 400 del backend; vacío y error de carga", async () => {
      mockBackend({
        routes: {
          [`GET ${BASE}prize-tiers/`]: () => [buildTreasurePrizeTier()],
          [`PATCH ${BASE}prize-tiers/b2222222-2222-4222-8222-222222222222/`]: () => {
            throw new ApiError(400, { non_field_errors: ["El rango de posiciones se solapa con un tramo de premio existente."] });
          },
          [`DELETE ${BASE}prize-tiers/b2222222-2222-4222-8222-222222222222/`]: () => {
            throw new ApiError(500, null);
          },
        },
      });
      superadmin();
      const first = await renderPage();
      await openTab("Premios");
      expect(await screen.findByText("1.º")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Editar" }));
      const dialog = screen.getByRole("dialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
      expect(await within(dialog).findByText("El rango de posiciones se solapa con un tramo de premio existente.")).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
      await userEvent.click(screen.getByRole("button", { name: "Borrar" }));
      const confirm = screen.getByRole("alertdialog");
      await userEvent.click(within(confirm).getByRole("button", { name: "Borrar" }));
      expect(await within(confirm).findByRole("alert")).toBeInTheDocument();
      await userEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
      first.unmount();

      mockBackend();
      const second = await renderPage();
      await openTab("Premios");
      expect(await screen.findByText("Este juego no tiene premios por posición")).toBeInTheDocument();
      second.unmount();

      mockBackend({
        routes: {
          [`GET ${BASE}prize-tiers/`]: () => {
            throw new ApiError(500, null);
          },
        },
      });
      await renderPage();
      await openTab("Premios");
      expect(await screen.findByText("No se pudieron cargar los premios")).toBeInTheDocument();
    });
  });

  describe("Participantes", () => {
    it("filtra por estado, aprueba y rechaza con confirmación", async () => {
      mockBackend({
        routes: {
          [`GET ${BASE}participants/`]: () => [
            buildTreasureParticipant(),
            buildTreasureParticipant({ id: 8, username: "p02", full_name: "", status: "accepted", team_name: "p02" }),
          ],
          [`GET ${BASE}participants/?status=accepted`]: () => [],
        },
      });
      superadmin();
      await renderPage();
      await openTab("Participantes");
      expect(await screen.findByText("Persona Uno")).toBeInTheDocument();
      expect(screen.getAllByText("p02")).toHaveLength(3);
      await userEvent.click(screen.getByRole("button", { name: "Aprobar" }));
      await waitFor(() => expect(calls("POST", `${BASE}participants/7/approve/`)).toHaveLength(1));

      await userEvent.click(screen.getByRole("button", { name: "Rechazar" }));
      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByText(/Persona Uno no podrá volver/)).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole("button", { name: "Rechazar" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(calls("POST", `${BASE}participants/7/reject/`)).toHaveLength(1);

      await userEvent.selectOptions(screen.getByLabelText("Estado"), "accepted");
      expect(await screen.findByText("Nadie con este estado")).toBeInTheDocument();
    });

    it("un error al aprobar se pinta, y con el juego en marcha no se ofrece decidir", async () => {
      mockBackend({
        routes: {
          [`GET ${BASE}participants/`]: () => [buildTreasureParticipant()],
          [`POST ${BASE}participants/7/approve/`]: () => {
            throw new ApiError(400, { detail: "El juego ha alcanzado el máximo de participantes." });
          },
          [`POST ${BASE}participants/7/reject/`]: () => {
            throw new ApiError(400, { detail: "Este participante no tiene una solicitud pendiente." });
          },
        },
      });
      superadmin();
      const first = await renderPage();
      await openTab("Participantes");
      await userEvent.click(await screen.findByRole("button", { name: "Aprobar" }));
      expect(await screen.findByText("El juego ha alcanzado el máximo de participantes.")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Rechazar" }));
      const dialog = screen.getByRole("alertdialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Rechazar" }));
      expect(await within(dialog).findByText("Este participante no tiene una solicitud pendiente.")).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
      first.unmount();

      mockBackend({
        game: buildTreasureGameDetail({ status: "in_progress" }),
        routes: { [`GET ${BASE}participants/`]: () => [buildTreasureParticipant()] },
      });
      const second = await renderPage();
      await openTab("Participantes");
      await screen.findByText("Persona Uno");
      expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
      second.unmount();

      mockBackend({
        routes: {
          [`GET ${BASE}participants/`]: () => {
            throw new ApiError(500, null);
          },
        },
      });
      await renderPage();
      await openTab("Participantes");
      expect(await screen.findByText("No se pudieron cargar los participantes")).toBeInTheDocument();
    });
  });

  describe("Validaciones", () => {
    it("aprueba con puntos, rechaza con confirmación y abre fotos de otro host aparte", async () => {
      mockBackend({
        routes: {
          [`GET ${BASE}completions/`]: () => [
            buildTreasureCompletion({ answer: "Hecho" }),
            buildTreasureCompletion({
              id: "c9999999-3333-4333-8333-333333333333",
              challenge_type: "social",
              photo: "https://otro.example.com/f.jpg",
            }),
            buildTreasureCompletion({ id: "c8888888-3333-4333-8333-333333333333", photo: null }),
          ],
        },
      });
      superadmin();
      await renderPage();
      await openTab("Validaciones");
      expect(await screen.findAllByText("Prueba n.º 2 · Persona Uno")).toHaveLength(3);
      expect(screen.getByRole("img", { name: "Foto enviada por Persona Uno" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Abrir la foto" })).toHaveAttribute("href", "https://otro.example.com/f.jpg");
      expect(screen.getByText("Sin foto.")).toBeInTheDocument();
      expect(screen.getByText("Hecho")).toBeInTheDocument();

      const [firstPoints] = screen.getAllByLabelText("Puntos (opcional)");
      await userEvent.type(firstPoints, "25");
      await userEvent.click(screen.getAllByRole("button", { name: "Aprobar" })[0]);
      await waitFor(() =>
        expect(calls("POST", `${BASE}completions/c3333333-3333-4333-8333-333333333333/validate/`)[0][1].body).toEqual({
          is_valid: true,
          points_override: 25,
        }),
      );

      await userEvent.click(screen.getAllByRole("button", { name: "Aprobar" })[1]);
      await waitFor(() =>
        expect(calls("POST", `${BASE}completions/c9999999-3333-4333-8333-333333333333/validate/`)[0][1].body).toEqual({
          is_valid: true,
        }),
      );

      await userEvent.click(screen.getAllByRole("button", { name: "Rechazar" })[2]);
      const dialog = screen.getByRole("alertdialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Rechazar" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(calls("POST", `${BASE}completions/c8888888-3333-4333-8333-333333333333/validate/`)[0][1].body).toEqual({
        is_valid: false,
      });
    });

    it("errores dentro de la tarjeta y del diálogo; vacío y fallo de carga", async () => {
      mockBackend({
        routes: {
          [`GET ${BASE}completions/`]: () => [buildTreasureCompletion()],
          [`POST ${BASE}completions/c3333333-3333-4333-8333-333333333333/validate/`]: () => {
            throw new ApiError(404, { detail: "Envío no encontrado o ya validado." });
          },
        },
      });
      superadmin();
      const first = await renderPage();
      await openTab("Validaciones");
      await userEvent.click(await screen.findByRole("button", { name: "Aprobar" }));
      expect(await screen.findByText("Envío no encontrado o ya validado.")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Rechazar" }));
      const dialog = screen.getByRole("alertdialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Rechazar" }));
      expect(await within(dialog).findByText("Envío no encontrado o ya validado.")).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
      first.unmount();

      mockBackend();
      const second = await renderPage();
      await openTab("Validaciones");
      expect(await screen.findByText("No hay envíos pendientes")).toBeInTheDocument();
      second.unmount();

      mockBackend({
        routes: {
          [`GET ${BASE}completions/`]: () => {
            throw new ApiError(500, null);
          },
        },
      });
      await renderPage();
      await openTab("Validaciones");
      expect(await screen.findByText("No se pudieron cargar los envíos")).toBeInTheDocument();
    });
  });

  describe("Ranking", () => {
    it("pinta la tabla, el vacío y el error", async () => {
      mockBackend({ routes: { [`GET ${BASE}ranking/`]: () => [buildTreasureRankingRow()] } });
      superadmin();
      const first = await renderPage();
      await openTab("Ranking");
      const table = await screen.findByRole("table", { name: "Ranking del juego" });
      expect(within(table).getByText("35")).toBeInTheDocument();
      expect(within(table).getByText("Persona Uno")).toBeInTheDocument();
      first.unmount();

      mockBackend();
      const second = await renderPage();
      await openTab("Ranking");
      expect(await screen.findByText("Todavía no hay ranking")).toBeInTheDocument();
      second.unmount();

      mockBackend({
        routes: {
          [`GET ${BASE}ranking/`]: () => {
            throw new ApiError(500, null);
          },
        },
      });
      await renderPage();
      await openTab("Ranking");
      expect(await screen.findByText("No se pudo cargar el ranking")).toBeInTheDocument();
    });
  });
});
