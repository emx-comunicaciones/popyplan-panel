"use client";

/**
 * Confirmación antes de una acción irreversible o de coste alto (enviar
 * una comunicación a toda la entidad, borrar un recurso). Sin librería de
 * diálogo: overlay propio con `role="alertdialog"` (tarea W4b,
 * `docs/PANEL.md` §5/§7). Carry-over de accesibilidad (tarea W6): atrapa
 * el foco con `useFocusTrap` (foco inicial en «Cancelar» — la opción
 * segura — `Tab`/`Shift+Tab` sin escapar, `Escape` cancela, el foco
 * vuelve a donde estaba al cerrarse).
 */
import { useRef, type ReactNode } from "react";

import { useFocusTrap } from "@/lib/a11y/useFocusTrap";

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
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, open, onCancel);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        tabIndex={-1}
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
