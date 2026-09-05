"use client";

/**
 * Confirmación antes de una acción irreversible o de coste alto (enviar
 * una comunicación a toda la entidad, borrar un recurso). Sin librería de
 * diálogo: overlay propio con `role="alertdialog"` (tarea W4b,
 * `docs/PANEL.md` §5/§7). No atrapa el foco (fuera del alcance de esta
 * tarea; Fase 6 audita accesibilidad formalmente de verdad), pero es
 * navegable con teclado igual que el resto del panel (botones nativos).
 */
import type { ReactNode } from "react";

import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg"
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-text-base">
          {title}
        </h2>
        {description ? <div className="mt-2 text-sm text-text-secondary">{description}</div> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
