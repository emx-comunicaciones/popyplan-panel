"use client";

/**
 * Atrapa el foco dentro de un diálogo (tarea W6, accesibilidad):
 * al abrir, guarda qué tenía el foco y lo mueve al primer elemento
 * enfocable del contenedor (o al propio contenedor si no hay
 * ninguno); mientras está abierto, `Tab`/`Shift+Tab` da la vuelta
 * dentro del contenedor en vez de escapar a la página de detrás;
 * `Escape` llama a `onEscape` (cerrar); al cerrarse (o desmontar),
 * devuelve el foco a donde estaba antes de abrir. Lo usan
 * `components/ui/{Dialog,ConfirmDialog}.tsx`.
 */
import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const [first] = focusableElements(container);
    (first ?? container).focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const items = focusableElements(container);
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [active, containerRef]);
}
