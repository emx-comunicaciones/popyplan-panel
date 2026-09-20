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
import { useId, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";

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
  confirmLabel,
  cancelLabel,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Los textos por defecto de los dos botones salen del catálogo
  // (`common.confirm`/`common.cancel`, tarea i18n 2) — no se pueden
  // fijar como valor por defecto del parámetro porque `useTranslations`
  // es un hook y solo puede llamarse dentro del cuerpo del componente.
  const t = useTranslations("common");
  const resolvedConfirmLabel = confirmLabel ?? t("confirm");
  const resolvedCancelLabel = cancelLabel ?? t("cancel");
  const containerRef = useRef<HTMLDivElement>(null);
  // `useId()` y no un id fijo: hoy ninguna página monta dos de estos a la
  // vez (cada uno vive tras su propio estado de «confirmando»), pero nada
  // lo impide — y con el id fijo los dos `aria-labelledby` apuntaban al
  // primer `<h2>` del documento y se anunciaban con el mismo título.
  const titleId = useId();
  // Durante una mutación pendiente los botones ya están deshabilitados:
  // Escape no debe cancelar (cerraría el diálogo con la acción en vuelo y
  // ocultaría el posible error de la mutación).
  useFocusTrap(containerRef, open, () => {
    if (!pending) onCancel();
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg"
      >
        <h2 id={titleId} className="text-lg font-semibold text-text-base">
          {title}
        </h2>
        {description ? <div className="mt-2 text-sm text-text-secondary">{description}</div> : null}
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
            {resolvedCancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {resolvedConfirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
