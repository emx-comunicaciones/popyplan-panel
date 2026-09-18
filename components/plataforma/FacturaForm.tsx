"use client";

/**
 * Alta de una factura sobre un contrato (`docs/PANEL.md` §13.1-§13.3):
 * número (único; un duplicado da 400, mensaje literal del backend),
 * importe en euros (convertido a `amount_cents` con
 * `lib/programs/money.ts::eurosToCents` — reutilizado tal cual, mismo
 * redondeo que Programas, sin duplicar la conversión), fecha de emisión
 * y de vencimiento, notas. Solo alta: la factura no se edita, solo se
 * marca pagada (`ContratosPanel.tsx`, acción aparte).
 */
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { useCreateInvoice } from "@/hooks/useBilling";
import { eurosToCents } from "@/lib/programs/money";

export interface FacturaFormProps {
  contractId: number | string;
  onDone: () => void;
}

export function FacturaForm({ contractId, onDone }: FacturaFormProps) {
  const createInvoice = useCreateInvoice();
  const [number, setNumber] = useState("");
  const [amountEuros, setAmountEuros] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [notes, setNotes] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  const canSubmit =
    number.trim().length > 0 &&
    amountEuros.trim().length > 0 &&
    !Number.isNaN(eurosToCents(amountEuros)) &&
    issuedOn.length > 0 &&
    dueOn.length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    // Las dos fechas llegan como `YYYY-MM-DD`, así que la comparación de
    // cadenas ya ordena bien. El backend lo valida otra vez.
    if (dueOn < issuedOn) {
      setDateError("La fecha de vencimiento no puede ser anterior a la de emisión.");
      return;
    }
    setDateError(null);

    createInvoice.mutate(
      {
        contractId,
        number,
        amount_cents: eurosToCents(amountEuros),
        issued_on: issuedOn,
        due_on: dueOn,
        notes,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="factura-number" className="mb-1 block text-sm font-medium text-text-form">
          Número
        </label>
        <input
          id="factura-number"
          type="text"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
        />
      </div>

      <div>
        <label htmlFor="factura-amount" className="mb-1 block text-sm font-medium text-text-form">
          Importe (€)
        </label>
        <input
          id="factura-amount"
          type="number"
          step="0.01"
          min="0"
          value={amountEuros}
          onChange={(event) => setAmountEuros(event.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="factura-issued-on" className="mb-1 block text-sm font-medium text-text-form">
            Emitida el
          </label>
          <input
            id="factura-issued-on"
            type="date"
            value={issuedOn}
            aria-describedby={dateError ? "factura-fechas-error" : undefined}
            onChange={(event) => {
              setDateError(null);
              setIssuedOn(event.target.value);
            }}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="factura-due-on" className="mb-1 block text-sm font-medium text-text-form">
            Vence el
          </label>
          <input
            id="factura-due-on"
            type="date"
            value={dueOn}
            aria-describedby={dateError ? "factura-fechas-error" : undefined}
            onChange={(event) => {
              setDateError(null);
              setDueOn(event.target.value);
            }}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
      </div>

      <div>
        <label htmlFor="factura-notes" className="mb-1 block text-sm font-medium text-text-form">
          Notas
        </label>
        <textarea
          id="factura-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
        />
      </div>

      {dateError ? (
        <p id="factura-fechas-error" role="alert" className="text-sm text-error">
          {dateError}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit || createInvoice.isPending}>
          Guardar
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </div>
      {createInvoice.isError ? (
        <p role="alert" className="text-sm text-error">
          {createInvoice.error.message}
        </p>
      ) : null}
    </form>
  );
}
