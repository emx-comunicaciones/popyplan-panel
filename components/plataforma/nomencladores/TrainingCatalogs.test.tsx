/**
 * Catálogo de entrenamiento en Nomencladores: disciplinas, ejercicios y
 * plantillas de Popyplan, a través del selector real de
 * `NomencladoresPanel`. Los mocks usan la forma real del backend (los tres
 * listados paginan) y `apiFetch` es el único punto mockeado.
 */
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { ApiError } from "@/lib/api/client";
import { axe } from "@/test-utils/axe";
import { render, screen, waitFor, within } from "@/test-utils/render";

import { NomencladoresPanel } from "../NomencladoresPanel";

afterEach(() => {
  apiFetchMock.mockReset();
});

function page<T>(results: T[]) {
  return { count: results.length, next: null, previous: null, results };
}

const GYM = {
  id: 1,
  code: "gym",
  name: "Gimnasio",
  name_es: "Gimnasio",
  name_eu: "Gimnasioa",
  name_ca: "Gimnàs",
  kind: "strength",
  icon: "dumbbell",
  order: 1,
  is_active: true,
};
const RUNNING = { ...GYM, id: 2, code: "running", name: "Correr", name_es: "Correr", name_eu: "Korrika", name_ca: "Córrer", kind: "endurance", icon: "running", order: 2 };
const MOTO = { ...GYM, id: 4, code: "motorbike", name: "Moto", name_es: "Moto", name_eu: "Motoa", name_ca: "Moto", kind: "route", icon: "motorbike", order: 4, is_active: false };

const GYM_REF = { id: 1, code: "gym", name: "Gimnasio", kind: "strength" };

const BENCH = {
  id: 1,
  code: "bench_press",
  name: "Press de banca",
  name_es: "Press de banca",
  name_eu: "Banku-prentsa",
  name_ca: "Press de banca",
  discipline: GYM_REF,
  muscle_group: "chest",
  metric: "weight_reps",
  order: 0,
  is_active: true,
};
const DIPS = { ...BENCH, id: 5, code: "dips", name: "Fondos", name_es: "Fondos", muscle_group: "triceps", metric: "reps", order: 4 };
const PLANK = { ...BENCH, id: 7, code: "plank", name: "Plancha", name_es: "Plancha", muscle_group: "core", metric: "time", order: 6, is_active: false };
const RUN = {
  ...BENCH,
  id: 25,
  code: "continuous_run",
  name: "Carrera continua",
  name_es: "Carrera continua",
  discipline: { id: 2, code: "running", name: "Correr", kind: "endurance" },
  muscle_group: "cardio",
  metric: "distance",
};

const PECHO = {
  id: 1,
  name: "Pecho + tríceps",
  name_es: "Pecho + tríceps",
  name_eu: "Bularra + trizepsa",
  name_ca: "Pit + tríceps",
  description: "",
  discipline: GYM_REF,
  is_system: true,
  duration_minutes: 60,
  distance_km: null,
  order: 0,
  is_active: true,
  items: [
    { id: 1, order: 0, exercise_id: 1, name: "Press de banca", metric: "weight_reps", sets: 4, reps: 8, weight_kg: null, seconds: null, distance_km: null },
    { id: 4, order: 1, exercise_id: 5, name: "Fondos", metric: "reps", sets: 3, reps: 10, weight_kg: null, seconds: null, distance_km: null },
  ],
  created_at: "2026-09-26T08:00:00Z",
  updated_at: "2026-09-26T08:00:00Z",
};

type Writer = (path: string, method: string, body: unknown) => unknown;

function mockBackend(write?: Writer) {
  apiFetchMock.mockImplementation(async (path: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method) return write ? write(path, init.method, init.body) : {};
    if (path === "/api/catalogs/languages/") return [];
    if (path === "/api/training/disciplines/?page=1") return page([GYM, RUNNING, MOTO]);
    if (path === "/api/training/exercises/?page=1") return page([BENCH, DIPS, PLANK, RUN]);
    if (path === "/api/training/exercises/?discipline=1&page=1") return page([BENCH, DIPS, PLANK]);
    if (path === "/api/training/exercises/?discipline=2&page=1") return page([RUN]);
    if (path === "/api/training/templates/?scope=system&page=1") return page([PECHO]);
    throw new Error(`sin mock para ${path}`);
  });
}

async function openCatalog(label: string) {
  render(<NomencladoresPanel />);
  await userEvent.selectOptions(screen.getByLabelText("Nomenclador"), label);
}

function writes() {
  return apiFetchMock.mock.calls.filter(([, init]) => init?.method);
}

describe("Nomencladores — entrenamiento", () => {
  it("no tiene violaciones de accesibilidad (axe), con la plantilla abierta y sus ejercicios", async () => {
    mockBackend();
    await openCatalog("Plantillas de entrenamiento");
    await screen.findByText("Pecho + tríceps");
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar plantilla" });
    await within(dialog).findAllByRole("option", { name: "Press de banca" });
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("el selector agrupa los catálogos generales y los de entrenamiento", () => {
    mockBackend();
    render(<NomencladoresPanel />);
    const select = screen.getByLabelText("Nomenclador");
    const training = within(select).getByRole("group", { name: "Entrenamiento" });
    expect(within(training).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Disciplinas de entrenamiento",
      "Ejercicios",
      "Plantillas de entrenamiento",
    ]);
  });

  describe("disciplinas", () => {
    it("lista con el nombre en castellano, el tipo traducido y el estado", async () => {
      mockBackend();
      await openCatalog("Disciplinas de entrenamiento");
      const table = await screen.findByRole("table", { name: "Disciplinas de entrenamiento" });
      const moto = within(table).getByText("Moto").closest("tr") as HTMLElement;
      expect(within(moto).getByText("Ruta")).toBeInTheDocument();
      expect(within(moto).getByText("Inactivo")).toBeInTheDocument();
      expect(within(table).getByText("Fuerza")).toBeInTheDocument();
      expect(within(table).getByText("Resistencia")).toBeInTheDocument();
      expect(screen.getByText("3 elementos")).toBeInTheDocument();
    });

    it("editar precarga los tres nombres crudos y manda un PATCH completo", async () => {
      mockBackend();
      await openCatalog("Disciplinas de entrenamiento");
      const row = (await screen.findByText("Correr")).closest("tr") as HTMLElement;
      await userEvent.click(within(row).getByRole("button", { name: "Editar" }));
      const dialog = screen.getByRole("dialog", { name: "Editar disciplina" });
      expect(within(dialog).getByLabelText("Nombre (euskera)")).toHaveValue("Korrika");
      expect(within(dialog).getByLabelText("Nombre (catalán)")).toHaveValue("Córrer");
      await userEvent.selectOptions(within(dialog).getByLabelText("Tipo de medida"), "route");
      await userEvent.click(within(dialog).getByRole("checkbox", { name: "Activo" }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(writes()[0]).toEqual([
        "/api/training/disciplines/2/",
        {
          method: "PATCH",
          body: {
            code: "running",
            name: "Correr",
            name_eu: "Korrika",
            name_ca: "Córrer",
            kind: "route",
            icon: "running",
            order: 2,
            is_active: false,
          },
        },
      ]);
    });

    it("alta: exige código y nombre; un 400 se dice dentro del diálogo", async () => {
      mockBackend(() => {
        throw new ApiError(400, { code: ["Ya existe una disciplina con este código."] });
      });
      await openCatalog("Disciplinas de entrenamiento");
      await screen.findByText("Gimnasio");
      await userEvent.click(screen.getByRole("button", { name: "Nueva disciplina" }));
      const dialog = screen.getByRole("dialog", { name: "Nueva disciplina" });
      const save = within(dialog).getByRole("button", { name: "Guardar" });
      expect(save).toBeDisabled();
      await userEvent.type(within(dialog).getByLabelText("Código"), "gym");
      await userEvent.type(within(dialog).getByLabelText("Nombre (castellano)"), "Gimnasio 2");
      await userEvent.click(save);
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ya existe una disciplina con este código.");
      expect(writes()[0][0]).toBe("/api/training/disciplines/");
      expect(writes()[0][1].method).toBe("POST");
    });

    it("borrar una disciplina en uso: el 409 se pinta literal y el diálogo sigue abierto", async () => {
      mockBackend(() => {
        throw new ApiError(409, { detail: "Está en uso y no se puede borrar; desactívalo en su lugar." });
      });
      await openCatalog("Disciplinas de entrenamiento");
      const row = (await screen.findByText("Gimnasio")).closest("tr") as HTMLElement;
      await userEvent.click(within(row).getByRole("button", { name: "Borrar" }));
      const dialog = screen.getByRole("alertdialog");
      expect(within(dialog).getByText(/no se puede borrar: desactívala/)).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Está en uso y no se puede borrar; desactívalo en su lugar.",
      );
      expect(writes()[0]).toEqual(["/api/training/disciplines/1/", { method: "DELETE" }]);
    });

    it("un fallo al cargar se dice con ErrorState", async () => {
      apiFetchMock.mockImplementation(async (path: string) => {
        if (path === "/api/catalogs/languages/") return [];
        throw new ApiError(403, {});
      });
      await openCatalog("Disciplinas de entrenamiento");
      expect(await screen.findByText("No se pudo cargar el nomenclador")).toBeInTheDocument();
      expect(screen.getByText("Solo superadmin gestiona el catálogo de entrenamiento.")).toBeInTheDocument();
    });
  });

  describe("ejercicios", () => {
    it("filtra por disciplina con `?discipline=<id>` y traduce métrica y grupo", async () => {
      mockBackend();
      await openCatalog("Ejercicios");
      const table = await screen.findByRole("table", { name: "Ejercicios" });
      expect(within(table).getByText("Carrera continua")).toBeInTheDocument();
      const bench = within(table).getByText("Press de banca").closest("tr") as HTMLElement;
      expect(within(bench).getByText("Peso y repeticiones")).toBeInTheDocument();
      expect(within(bench).getByText("Pecho")).toBeInTheDocument();

      await userEvent.selectOptions(screen.getByLabelText("Disciplina"), "2");
      await waitFor(() => expect(screen.queryByText("Press de banca")).not.toBeInTheDocument());
      expect(screen.getByText("Carrera continua")).toBeInTheDocument();
      expect(apiFetchMock).toHaveBeenCalledWith("/api/training/exercises/?discipline=2&page=1");
    });

    it("alta con la disciplina del filtro, escribiendo con `discipline_id`", async () => {
      mockBackend(() => ({ id: 30 }));
      await openCatalog("Ejercicios");
      await screen.findByText("Press de banca");
      await userEvent.selectOptions(screen.getByLabelText("Disciplina"), "1");
      await userEvent.click(screen.getByRole("button", { name: "Nuevo ejercicio" }));
      const dialog = screen.getByRole("dialog", { name: "Nuevo ejercicio" });
      expect(within(dialog).getByLabelText("Disciplina")).toHaveValue("1");
      await userEvent.type(within(dialog).getByLabelText("Código"), "burpee");
      await userEvent.type(within(dialog).getByLabelText("Nombre (castellano)"), "Burpee");
      await userEvent.selectOptions(within(dialog).getByLabelText("Métrica"), "reps");
      await userEvent.selectOptions(within(dialog).getByLabelText("Grupo muscular"), "full_body");
      await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(writes()[0]).toEqual([
        "/api/training/exercises/",
        {
          method: "POST",
          body: {
            code: "burpee",
            name: "Burpee",
            name_eu: "",
            name_ca: "",
            discipline_id: 1,
            muscle_group: "full_body",
            metric: "reps",
            order: 0,
            is_active: true,
          },
        },
      ]);
    });

    it("editar y borrar un ejercicio", async () => {
      mockBackend(() => ({}));
      await openCatalog("Ejercicios");
      const row = (await screen.findByText("Fondos")).closest("tr") as HTMLElement;
      await userEvent.click(within(row).getByRole("button", { name: "Editar" }));
      const dialog = screen.getByRole("dialog", { name: "Editar ejercicio" });
      expect(within(dialog).getByLabelText("Grupo muscular")).toHaveValue("triceps");
      await userEvent.selectOptions(within(dialog).getByLabelText("Grupo muscular"), "");
      await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(writes()[0][0]).toBe("/api/training/exercises/5/");
      expect((writes()[0][1].body as { muscle_group: string }).muscle_group).toBe("");

      await userEvent.click(within(row).getByRole("button", { name: "Borrar" }));
      const confirm = screen.getByRole("alertdialog");
      expect(within(confirm).getByText(/conservan su nombre como ejercicio libre/)).toBeInTheDocument();
      await userEvent.click(within(confirm).getByRole("button", { name: "Borrar" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(writes()[1]).toEqual(["/api/training/exercises/5/", { method: "DELETE" }]);
    });
  });

  describe("plantillas", () => {
    it("lista solo las de Popyplan (`scope=system`) con su disciplina y nº de ejercicios", async () => {
      mockBackend();
      await openCatalog("Plantillas de entrenamiento");
      const row = (await screen.findByText("Pecho + tríceps")).closest("tr") as HTMLElement;
      expect(within(row).getByText("Gimnasio")).toBeInTheDocument();
      expect(within(row).getByText("2")).toBeInTheDocument();
      expect(within(row).getByText("60")).toBeInTheDocument();
      expect(apiFetchMock.mock.calls.some(([url]) => String(url).includes("scope=mine"))).toBe(false);
      expect(screen.getByText(/el panel nunca muestra entrenos, rutinas ni perfiles deportivos/)).toBeInTheDocument();
    });

    it("editar los ejercicios: añadir uno libre, reordenar y guardar reemplaza la lista entera", async () => {
      mockBackend(() => PECHO);
      await openCatalog("Plantillas de entrenamiento");
      await screen.findByText("Pecho + tríceps");
      await userEvent.click(screen.getByRole("button", { name: "Editar" }));
      const dialog = screen.getByRole("dialog", { name: "Editar plantilla" });
      expect(within(dialog).getByLabelText("Nombre (castellano)")).toHaveValue("Pecho + tríceps");
      await within(dialog).findAllByRole("option", { name: "Press de banca" });

      // Ejercicio 1 del catálogo con métrica de peso: repeticiones y peso, sin segundos.
      expect(within(dialog).getByLabelText("Repeticiones (1)")).toHaveValue(8);
      expect(within(dialog).getByLabelText("Peso, kg (1)")).toBeInTheDocument();
      expect(within(dialog).queryByLabelText("Segundos (1)")).not.toBeInTheDocument();
      // Ejercicio 2 (repeticiones): sin peso.
      expect(within(dialog).queryByLabelText("Peso, kg (2)")).not.toBeInTheDocument();
      // El ejercicio inactivo del catálogo no se ofrece.
      expect(within(dialog).queryByRole("option", { name: /Plancha/ })).not.toBeInTheDocument();

      await userEvent.type(within(dialog).getByLabelText("Peso, kg (1)"), "60");
      await userEvent.click(within(dialog).getByRole("button", { name: "Añadir ejercicio" }));
      await userEvent.type(within(dialog).getByLabelText("Nombre (3)"), "Plancha lateral");
      await userEvent.selectOptions(within(dialog).getByLabelText("Métrica (3)"), "time");
      await userEvent.type(within(dialog).getByLabelText("Segundos (3)"), "30");
      await userEvent.click(within(dialog).getByRole("button", { name: "Subir ejercicio 3" }));
      await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      const [path, init] = writes()[0];
      expect(path).toBe("/api/training/templates/1/");
      expect(init.method).toBe("PATCH");
      expect(init.body).not.toHaveProperty("system");
      expect(init.body).not.toHaveProperty("discipline_id");
      expect(init.body.items).toEqual([
        { exercise_id: 1, sets: 4, reps: 8, weight_kg: "60", seconds: null, distance_km: null },
        { exercise_id: null, name: "Plancha lateral", metric: "time", sets: 3, reps: null, weight_kg: null, seconds: 30, distance_km: null },
        { exercise_id: 5, sets: 3, reps: 10, weight_kg: null, seconds: null, distance_km: null },
      ]);
    });

    it("quitar un ejercicio y pasar otro a nombre libre", async () => {
      mockBackend(() => PECHO);
      await openCatalog("Plantillas de entrenamiento");
      await screen.findByText("Pecho + tríceps");
      await userEvent.click(screen.getByRole("button", { name: "Editar" }));
      const dialog = screen.getByRole("dialog", { name: "Editar plantilla" });
      await within(dialog).findAllByRole("option", { name: "Press de banca" });
      await userEvent.click(within(dialog).getByRole("button", { name: "Quitar ejercicio 1" }));
      await userEvent.selectOptions(within(dialog).getByLabelText("Ejercicio del catálogo (1)"), "");
      expect(within(dialog).getByLabelText("Nombre (1)")).toHaveValue("Fondos");
      await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(writes()[0][1].body.items).toEqual([
        { exercise_id: null, name: "Fondos", metric: "reps", sets: 3, reps: 10, weight_kg: null, seconds: null, distance_km: null },
      ]);
    });

    it("cambiar de disciplina pasa los ejercicios del catálogo a nombre libre y manda la nueva", async () => {
      mockBackend(() => PECHO);
      await openCatalog("Plantillas de entrenamiento");
      await screen.findByText("Pecho + tríceps");
      await userEvent.click(screen.getByRole("button", { name: "Editar" }));
      const dialog = screen.getByRole("dialog", { name: "Editar plantilla" });
      await within(dialog).findAllByRole("option", { name: "Press de banca" });
      // La disciplina inactiva (Moto) no se ofrece.
      expect(within(within(dialog).getByLabelText("Disciplina")).queryByRole("option", { name: "Moto" })).toBeNull();
      await userEvent.selectOptions(within(dialog).getByLabelText("Disciplina"), "2");
      expect(within(dialog).getByLabelText("Nombre (1)")).toHaveValue("Press de banca");
      await within(dialog).findAllByRole("option", { name: "Carrera continua" });
      await userEvent.selectOptions(within(dialog).getByLabelText("Ejercicio del catálogo (2)"), "25");
      expect(within(dialog).getByLabelText("Distancia, km (2)")).toBeInTheDocument();
      await userEvent.type(within(dialog).getByLabelText("Distancia, km (2)"), "5");
      await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      const body = writes()[0][1].body;
      expect(body.discipline_id).toBe(2);
      expect(body.items[0]).toMatchObject({ exercise_id: null, name: "Press de banca", metric: "weight_reps" });
      expect(body.items[1]).toMatchObject({ exercise_id: 25, distance_km: "5", reps: null });
    });

    it("alta: `system: true`; sin nombre ni disciplina no se puede guardar", async () => {
      mockBackend(() => ({ ...PECHO, id: 9 }));
      await openCatalog("Plantillas de entrenamiento");
      await screen.findByText("Pecho + tríceps");
      await userEvent.click(screen.getByRole("button", { name: "Nueva plantilla" }));
      const dialog = screen.getByRole("dialog", { name: "Nueva plantilla" });
      const save = within(dialog).getByRole("button", { name: "Guardar" });
      expect(save).toBeDisabled();
      expect(within(dialog).getByText("Falta el nombre en castellano.")).toBeInTheDocument();
      expect(within(dialog).getByText("Sin ejercicios todavía.")).toBeInTheDocument();
      await userEvent.type(within(dialog).getByLabelText("Nombre (castellano)"), "Rodaje 10 km");
      expect(within(dialog).getByText("Elige una disciplina.")).toBeInTheDocument();
      await userEvent.selectOptions(within(dialog).getByLabelText("Disciplina"), "2");
      await userEvent.type(within(dialog).getByLabelText("Distancia (km)"), "10");
      await userEvent.click(save);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(writes()[0]).toEqual([
        "/api/training/templates/",
        {
          method: "POST",
          body: {
            name: "Rodaje 10 km",
            name_eu: "",
            name_ca: "",
            description: "",
            duration_minutes: null,
            distance_km: "10",
            order: 0,
            is_active: true,
            items: [],
            discipline_id: 2,
            system: true,
          },
        },
      ]);
    });

    it("un 400 del backend se pinta literal dentro del diálogo", async () => {
      mockBackend(() => {
        throw new ApiError(400, { items: ["Cada ejercicio tiene que ser de la disciplina."] });
      });
      await openCatalog("Plantillas de entrenamiento");
      await screen.findByText("Pecho + tríceps");
      await userEvent.click(screen.getByRole("button", { name: "Editar" }));
      const dialog = screen.getByRole("dialog", { name: "Editar plantilla" });
      await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Cada ejercicio tiene que ser de la disciplina.",
      );
    });

    it("borrar una plantilla pide confirmación", async () => {
      mockBackend(() => undefined);
      await openCatalog("Plantillas de entrenamiento");
      await screen.findByText("Pecho + tríceps");
      await userEvent.click(screen.getByRole("button", { name: "Borrar" }));
      const confirm = screen.getByRole("alertdialog");
      expect(within(confirm).getByText(/la app deja de ofrecerla/)).toBeInTheDocument();
      await userEvent.click(within(confirm).getByRole("button", { name: "Borrar" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(writes()[0]).toEqual(["/api/training/templates/1/", { method: "DELETE" }]);
    });
  });
});
