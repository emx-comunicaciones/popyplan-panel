"use client";

/**
 * Formulario de alta/edición de un programa (`docs/PANEL.md` §12): nombre,
 * financiador, descripción, inicio, fin y presupuesto en euros (input
 * `type="number" step="0.01"`, convertido a `budget_cents` con
 * `lib/programs/money.ts::eurosToCents` al enviar). Validación en cliente
 * de `fin >= inicio` (`lib/programs/validation.ts`) con el mismo mensaje
 * que el 400 del backend, para no lanzar una petición que ya sabemos que
 * va a fallar. Mismo patrón que `RecursosPanel.tsx::ResourceForm`:
 * `editing` es `"new"` (crear) o un `Program` (editar, `PATCH` parcial).
 */
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import {
  useCreateProgram,
  useUpdateProgram,
  type ProgramMutationErrorKind,
} from "@/hooks/useProgramMutations";
import type { Program } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { eurosToCents } from "@/lib/programs/money";
import { validateProgramDates } from "@/lib/programs/validation";

// `ProgramMutationError` es la misma clase para crear/editar/activar/
// cerrar (`useProgramMutations.ts`); solo el mensaje de «desconocido»
// varía según la acción (el backend nunca lo distingue por campo, es el
// texto de repuesto de cada `mutate` del hook) — dos mapas completos en
// vez de uno para no perder esa distinción real.
const CREATE_PROGRAM_ERROR_KEYS: Record<ProgramMutationErrorKind, string> = {
  invalido: "errors.programMutation.invalido",
  sin_permiso: "errors.programMutation.sinPermiso",
  no_encontrado: "errors.programMutation.noEncontrado",
  conflicto: "errors.programMutation.conflicto",
  desconocido: "errors.programMutation.desconocidoCrear",
};

const UPDATE_PROGRAM_ERROR_KEYS: Record<ProgramMutationErrorKind, string> = {
  ...CREATE_PROGRAM_ERROR_KEYS,
  desconocido: "errors.programMutation.desconocidoGuardar",
};

export interface ProgramaFormProps {
  orgId: number | string;
  editing: Program | "new";
  onDone: () => void;
  /**
   * Avisa hacia arriba de si el guardado está en vuelo. El formulario se
   * usa dentro de un `Dialog` que pertenece a quien lo monta
   * (`ProgramasPanel`/`ProgramaDetalle`), y ese diálogo necesita saberlo
   * para no dejarse cerrar con el `POST`/`PATCH` a medias (`pending`).
   */
  onPendingChange?: (pending: boolean) => void;
}

interface ProgramFormState {
  name: string;
  funder: string;
  description: string;
  startsOn: string;
  endsOn: string;
  budgetEuros: string;
}

function emptyForm(): ProgramFormState {
  return { name: "", funder: "", description: "", startsOn: "", endsOn: "", budgetEuros: "" };
}

function formFromProgram(program: Program): ProgramFormState {
  return {
    name: program.name,
    funder: program.funder,
    description: program.description,
    startsOn: program.starts_on,
    endsOn: program.ends_on,
    budgetEuros: (program.budget_cents / 100).toFixed(2),
  };
}

export function ProgramaForm({ orgId, editing, onDone, onPendingChange }: ProgramaFormProps) {
  const t = useTranslations();
  const createProgram = useCreateProgram(orgId);
  const updateProgram = useUpdateProgram(orgId);
  const [form, setForm] = useState<ProgramFormState>(
    editing === "new" ? emptyForm() : formFromProgram(editing),
  );

  const mutation = editing === "new" ? createProgram : updateProgram;
  const isPending = mutation.isPending;

  useEffect(() => {
    onPendingChange?.(isPending);
    // Al desmontar (el diálogo se cierra tras guardar) quien lo monta no
    // puede quedarse con `pending` a true para siempre: sin diálogo
    // abierto nadie volvería a bajarlo.
    return () => onPendingChange?.(false);
  }, [isPending, onPendingChange]);

  const dateErrorKey = validateProgramDates(form.startsOn, form.endsOn);
  const budgetCents = eurosToCents(form.budgetEuros);
  const canSubmit =
    form.name.trim().length > 0 &&
    form.startsOn.length > 0 &&
    form.endsOn.length > 0 &&
    form.budgetEuros.trim().length > 0 &&
    !Number.isNaN(budgetCents) &&
    budgetCents >= 0 &&
    !dateErrorKey;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const fields = {
      name: form.name,
      funder: form.funder,
      description: form.description,
      starts_on: form.startsOn,
      ends_on: form.endsOn,
      budget_cents: eurosToCents(form.budgetEuros),
    };

    if (editing === "new") {
      createProgram.mutate(fields, { onSuccess: onDone });
    } else {
      updateProgram.mutate({ programId: editing.id, ...fields }, { onSuccess: onDone });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="programa-name" className="mb-1 block text-sm font-medium text-text-form">
          {t("entidad.programaFicha.nameLabel")}
        </label>
        <input
          id="programa-name"
          type="text"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
        />
      </div>

      <div>
        <label htmlFor="programa-funder" className="mb-1 block text-sm font-medium text-text-form">
          {t("entidad.programaFicha.funderLabel")}
        </label>
        <input
          id="programa-funder"
          type="text"
          value={form.funder}
          onChange={(event) => setForm((prev) => ({ ...prev, funder: event.target.value }))}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
        />
      </div>

      <div>
        <label htmlFor="programa-description" className="mb-1 block text-sm font-medium text-text-form">
          {t("entidad.programaFicha.descriptionLabel")}
        </label>
        <textarea
          id="programa-description"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          rows={3}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="programa-starts-on" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.programaFicha.startsOnLabel")}
          </label>
          <input
            id="programa-starts-on"
            type="date"
            value={form.startsOn}
            onChange={(event) => setForm((prev) => ({ ...prev, startsOn: event.target.value }))}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="programa-ends-on" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.programaFicha.endsOnLabel")}
          </label>
          <input
            id="programa-ends-on"
            type="date"
            value={form.endsOn}
            onChange={(event) => setForm((prev) => ({ ...prev, endsOn: event.target.value }))}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="programa-budget" className="mb-1 block text-sm font-medium text-text-form">
            {t("entidad.programaFicha.budgetLabel")}
          </label>
          <input
            id="programa-budget"
            type="number"
            step="0.01"
            min="0"
            value={form.budgetEuros}
            onChange={(event) => setForm((prev) => ({ ...prev, budgetEuros: event.target.value }))}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
      </div>

      {dateErrorKey ? (
        <p role="alert" className="text-sm text-error">
          {t(dateErrorKey)}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit || isPending}>
          {t("common.save")}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={isPending}>
          {t("common.cancel")}
        </Button>
      </div>
      {mutation.isError ? (
        <p role="alert" className="text-sm text-error">
          {editing === "new"
            ? errorKindText(
                createProgram.error,
                CREATE_PROGRAM_ERROR_KEYS,
                t,
                "errors.programMutation.desconocidoCrear",
              )
            : errorKindText(
                updateProgram.error,
                UPDATE_PROGRAM_ERROR_KEYS,
                t,
                "errors.programMutation.desconocidoGuardar",
              )}
        </p>
      ) : null}
    </form>
  );
}
