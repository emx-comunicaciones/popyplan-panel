"use client";

/**
 * Diálogo genérico para formularios (tarea W3b): mismo lenguaje visual
 * que `ConfirmDialog.tsx` (overlay propio, sin librería), pero con
 * contenido libre en vez de dos botones fijos — lo usan
 * `components/people/{AddPersonDialog,ImportPeopleDialog}.tsx`. `role`
 * es `"dialog"` (no `"alertdialog"`: no es una confirmación de una
 * acción ya decidida, es un formulario). Carry-over de accesibilidad
 * (tarea W6): atrapa el foco con `useFocusTrap` (foco inicial dentro
 * del diálogo, `Tab`/`Shift+Tab` sin escapar, `Escape` cierra, el foco
 * vuelve a donde estaba al cerrarse).
 *
 * `pending` (mismo criterio que `ConfirmDialog.tsx`): con una mutación
 * en vuelo, ni `Escape` ni el botón × cierran el diálogo — cerrarlo
 * desmontaría el formulario con la petición a medias y se perdería el
 * error que va a pintar. El overlay nunca ha cerrado al pulsarlo, ni
 * aquí ni en `ConfirmDialog`, así que no hace falta guardarlo.
 */
import { useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { useFocusTrap } from "@/lib/a11y/useFocusTrap";

export interface DialogProps {
  open: boolean;
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
  /** Mutación en vuelo: el diálogo no se puede cerrar hasta que termine. */
  pending?: boolean;
  /**
   * `"side"` ancla el diálogo al borde derecho y lo estira a toda la
   * altura: es el «panel lateral» de la ficha de municipio (spec §4.1).
   * Sigue siendo el mismo diálogo modal, con su foco atrapado, su
   * `Escape` y su devolución del foco — solo cambia dónde se pinta, para
   * no duplicar esa mecánica en un componente nuevo de *drawer*.
   */
  placement?: "center" | "side";
}

export function Dialog({
  open,
  titleId,
  title,
  onClose,
  children,
  widthClassName = "max-w-lg",
  pending = false,
  placement = "center",
}: DialogProps) {
  const t = useTranslations("common");
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, open, () => {
    if (!pending) onClose();
  });

  if (!open) return null;

  const overlayPlacement =
    placement === "side" ? "justify-end" : "justify-center items-center";
  // El radio va en la rama, no en la clase base: `rounded-none` y
  // `rounded-lg` juntos dependerían del orden del CSS generado, no del
  // orden del atributo `class`.
  const panelPlacement =
    placement === "side" ? "h-full overflow-y-auto rounded-none" : "rounded-lg";

  return (
    <div className={`fixed inset-0 z-50 flex ${overlayPlacement} bg-black/40 p-4`}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-busy={pending}
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${widthClassName} ${panelPlacement} bg-white p-4 shadow-lg`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-text-base">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!pending) onClose();
            }}
            disabled={pending}
            aria-label={t("close")}
            className="text-lg leading-none text-text-secondary hover:text-text-base focus-visible:outline-primary-700"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
