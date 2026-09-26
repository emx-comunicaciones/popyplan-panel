import { describe, expect, it } from "vitest";

import type { TrainingTemplate } from "@/lib/api/types";

import {
  METRIC_FIELDS,
  detachExercises,
  emptyItem,
  formToWrite,
  moveItem,
  templateToForm,
  validateTemplateForm,
  type TemplateForm,
} from "./templateForm";

/** Forma real de `GET /api/training/templates/?scope=system` (una fila). */
const PECHO: TrainingTemplate = {
  id: 1,
  name: "Bularra + trizepsa",
  name_es: "Pecho + tríceps",
  name_eu: "Bularra + trizepsa",
  name_ca: "Pit + tríceps",
  description: "",
  discipline: { id: 1, code: "gym", name: "Gimnasio", kind: "strength" },
  is_system: true,
  duration_minutes: 60,
  distance_km: null,
  order: 0,
  is_active: true,
  items: [
    {
      id: 1,
      order: 0,
      exercise_id: 1,
      name: "Press de banca",
      metric: "weight_reps",
      sets: 4,
      reps: 8,
      weight_kg: "60.00",
      seconds: null,
      distance_km: null,
    },
    {
      id: 2,
      order: 1,
      exercise_id: null,
      name: "Plancha lateral",
      metric: "time",
      sets: 3,
      reps: null,
      weight_kg: null,
      seconds: 30,
      distance_km: null,
    },
  ],
  created_at: "2026-09-26T08:00:00Z",
  updated_at: "2026-09-26T08:00:00Z",
};

describe("templateToForm", () => {
  it("una plantilla nueva nace vacía, activa y en orden 0", () => {
    expect(templateToForm(null)).toEqual({
      name: "",
      name_eu: "",
      name_ca: "",
      description: "",
      disciplineId: "",
      duration_minutes: "",
      distance_km: "",
      order: "0",
      is_active: true,
      items: [],
    });
  });

  it("lee los nombres crudos (`name_es`), nunca el traducido", () => {
    const form = templateToForm(PECHO);
    expect(form.name).toBe("Pecho + tríceps");
    expect(form.name_eu).toBe("Bularra + trizepsa");
    expect(form.disciplineId).toBe("1");
    expect(form.duration_minutes).toBe("60");
    expect(form.distance_km).toBe("");
    expect(
      form.items.map((item) => {
        const rest: Partial<typeof item> = { ...item };
        delete rest.key;
        return rest;
      }),
    ).toEqual([
      {
        exerciseId: "1",
        name: "Press de banca",
        metric: "weight_reps",
        sets: "4",
        reps: "8",
        weight_kg: "60.00",
        seconds: "",
        distance_km: "",
      },
      {
        exerciseId: "",
        name: "Plancha lateral",
        metric: "time",
        sets: "3",
        reps: "",
        weight_kg: "",
        seconds: "30",
        distance_km: "",
      },
    ]);
  });

  it("cada ejercicio lleva una clave distinta", () => {
    const form = templateToForm(PECHO);
    expect(new Set(form.items.map((i) => i.key)).size).toBe(2);
    expect(emptyItem().key).not.toBe(emptyItem().key);
  });

  it("rellena la métrica que falte con `weight_reps`", () => {
    const sinMetrica = {
      ...PECHO,
      items: [{ ...PECHO.items[0], metric: undefined, name: undefined }],
    } as unknown as TrainingTemplate;
    const [item] = templateToForm(sinMetrica).items;
    expect(item.metric).toBe("weight_reps");
    expect(item.name).toBe("");
  });
});

describe("detachExercises", () => {
  it("pasa los del catálogo a nombre libre con su nombre y su métrica", () => {
    const form = templateToForm(PECHO);
    const catalog = new Map([["1", { name: "Press de banca plano", metric: "weight_reps" as const }]]);
    const [first, second] = detachExercises(form.items, catalog);
    expect(first).toMatchObject({ exerciseId: "", name: "Press de banca plano", metric: "weight_reps" });
    expect(second).toBe(form.items[1]);
  });

  it("sin el ejercicio en el catálogo, conserva lo que había", () => {
    const form = templateToForm(PECHO);
    const [first] = detachExercises(form.items, new Map());
    expect(first).toMatchObject({ exerciseId: "", name: "Press de banca", metric: "weight_reps" });
  });
});

describe("moveItem", () => {
  const items = [emptyItem(), emptyItem(), emptyItem()];

  it("sube y baja una posición", () => {
    expect(moveItem(items, 1, -1).map((i) => i.key)).toEqual([items[1].key, items[0].key, items[2].key]);
    expect(moveItem(items, 1, 1).map((i) => i.key)).toEqual([items[0].key, items[2].key, items[1].key]);
  });

  it("en los extremos no cambia nada", () => {
    expect(moveItem(items, 0, -1)).toBe(items);
    expect(moveItem(items, 2, 1)).toBe(items);
  });
});

function valid(): TemplateForm {
  return templateToForm(PECHO);
}

describe("validateTemplateForm", () => {
  it("un formulario completo es válido", () => {
    expect(validateTemplateForm(valid())).toBeNull();
  });

  it("exige el nombre en castellano y la disciplina", () => {
    expect(validateTemplateForm({ ...valid(), name: "  " })).toBe("nameRequired");
    expect(validateTemplateForm({ ...valid(), disciplineId: "" })).toBe("disciplineRequired");
  });

  it.each([
    [{ duration_minutes: "1.5" }],
    [{ duration_minutes: "-3" }],
    [{ order: "abc" }],
    [{ distance_km: "-1" }],
    [{ distance_km: "x" }],
  ])("rechaza números no válidos en la cabecera (%o)", (patch) => {
    expect(validateTemplateForm({ ...valid(), ...patch })).toBe("invalidNumber");
  });

  it("un ejercicio libre necesita nombre", () => {
    const form = valid();
    form.items[1] = { ...form.items[1], name: " " };
    expect(validateTemplateForm(form)).toBe("itemNameRequired");
  });

  it.each(["", "0", "51", "2.5"])("series fuera de 1..50 (%s)", (sets) => {
    const form = valid();
    form.items[0] = { ...form.items[0], sets };
    expect(validateTemplateForm(form)).toBe("itemSetsRange");
  });

  it.each([{ reps: "-1" }, { seconds: "1.2" }, { weight_kg: "-5" }, { distance_km: "abc" }])(
    "rechaza valores no válidos en un ejercicio (%o)",
    (patch) => {
      const form = valid();
      form.items[0] = { ...form.items[0], ...patch };
      expect(validateTemplateForm(form)).toBe("invalidNumber");
    },
  );

  it("acepta la coma decimal", () => {
    const form = valid();
    form.items[0] = { ...form.items[0], weight_kg: "62,5" };
    expect(validateTemplateForm({ ...form, distance_km: "5,25" })).toBeNull();
  });
});

describe("formToWrite", () => {
  const metricOf = (id: string) => (id === "1" ? ("weight_reps" as const) : undefined);

  it("alta: `system: true`, `discipline_id` y los ejercicios en orden", () => {
    const form: TemplateForm = { ...valid(), distance_km: "5,5" };
    const body = formToWrite(form, null, metricOf);
    expect(body).toEqual({
      name: "Pecho + tríceps",
      name_eu: "Bularra + trizepsa",
      name_ca: "Pit + tríceps",
      description: "",
      duration_minutes: 60,
      distance_km: "5.5",
      order: 0,
      is_active: true,
      discipline_id: 1,
      system: true,
      items: [
        { exercise_id: 1, sets: 4, reps: 8, weight_kg: "60.00", seconds: null, distance_km: null },
        {
          exercise_id: null,
          name: "Plancha lateral",
          metric: "time",
          sets: 3,
          reps: null,
          weight_kg: null,
          seconds: 30,
          distance_km: null,
        },
      ],
    });
  });

  it("edición sin cambiar de disciplina: ni `discipline_id` ni `system`", () => {
    const body = formToWrite(valid(), PECHO, metricOf);
    expect(body).not.toHaveProperty("discipline_id");
    expect(body).not.toHaveProperty("system");
  });

  it("edición cambiando de disciplina: manda la nueva", () => {
    const body = formToWrite({ ...valid(), disciplineId: "2", items: [] }, PECHO, metricOf);
    expect(body.discipline_id).toBe(2);
    expect(body).not.toHaveProperty("system");
  });

  it("solo manda los valores de la métrica, y la del catálogo manda", () => {
    const form = valid();
    // Un peso tecleado en un ejercicio de tiempo no se cuela.
    form.items[1] = { ...form.items[1], weight_kg: "20", reps: "5" };
    // Ejercicio del catálogo cuya métrica real es `weight_reps`: los segundos se ignoran.
    form.items[0] = { ...form.items[0], seconds: "40", metric: "time" };
    const body = formToWrite(form, PECHO, metricOf);
    expect(body.items[0]).toMatchObject({ reps: 8, weight_kg: "60.00", seconds: null });
    expect(body.items[1]).toMatchObject({ reps: null, weight_kg: null, seconds: 30 });
  });

  it("sin métrica conocida del catálogo usa la del formulario; distancia lleva distancia y segundos", () => {
    const form = valid();
    form.items = [{ ...emptyItem(), exerciseId: "99", metric: "distance", distance_km: "5", seconds: "1500", reps: "3" }];
    const [item] = formToWrite(form, PECHO, metricOf).items;
    expect(item).toEqual({ exercise_id: 99, sets: 3, reps: null, weight_kg: null, seconds: 1500, distance_km: "5" });
  });

  it("campos vacíos viajan como null y el orden vacío como 0", () => {
    const body = formToWrite({ ...valid(), duration_minutes: "", order: " " }, PECHO, metricOf);
    expect(body.duration_minutes).toBeNull();
    expect(body.order).toBe(0);
  });
});

describe("METRIC_FIELDS", () => {
  it("es la misma forma que una serie de un entreno", () => {
    expect(METRIC_FIELDS).toEqual({
      weight_reps: ["reps", "weight_kg"],
      reps: ["reps"],
      time: ["seconds"],
      distance: ["distance_km", "seconds"],
    });
  });
});
