"use client";

/**
 * Diálogo genérico para formularios (tarea W3b): mismo lenguaje visual
 * que `ConfirmDialog.tsx` (overlay propio, sin librería), pero con
 * contenido libre en vez de dos botones fijos — lo usan
 * `components/people/{AddPersonDialog,ImportPeopleDialog}.tsx`. `role`
 * es `"dialog"` (no `"alertdialog"`: no es una confirmación de una
 * acción ya decidida, es un formulario). No atrapa el foco (mismo
 * alcance que `ConfirmDialog`; Fase 6 audita accesibilidad formalmente).
 */
import type { ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}

export function Dialog({
  open,
  titleId,
  title,
  onClose,
  children,
  widthClassName = "max-w-lg",
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${widthClassName} rounded-lg bg-white p-6 shadow-lg`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-base font-semibold text-text-base">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-lg leading-none text-text-secondary hover:text-text-base focus-visible:outline-primary"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
