"use client";

/**
 * Atrapa el foco dentro de un diálogo (tarea W6, accesibilidad):
 * al abrir, guarda qué tenía el foco y lo mueve al primer elemento
 * enfocable del contenedor (o al propio contenedor si no hay
 * ninguno); mientras está abierto, `Tab`/`Shift+Tab` da la vuelta
 * dentro del contenedor en vez de escapar a la página de detrás;
 * `Escape` llama a `onEscape` (cerrar); al cerrarse (o desmontar),
 * devuelve el foco a donde estaba antes de abrir, o al
 * `<main id="main-content">` del layout si quien abrió el diálogo ya no
 * está en el documento. Lo usan
 * `components/ui/{Dialog,ConfirmDialog}.tsx`, los dos con
 * `tabIndex={-1}` en el contenedor para que pueda recibir el foco
 * cuando dentro no hay ningún control.
 */
import { useEffect, useRef, type RefObject } from "react";

/**
 * `input[type="hidden"]` nunca recibe el foco, y `tabindex="-1"` deja a
 * cualquier elemento fuera del orden de tabulación (el propio contenedor
 * del diálogo lo lleva). Sin excluirlos, `focusableElements` los contaba
 * como el primer/último elemento del ciclo: `focus()` sobre ellos no
 * hace nada, así que el foco se quedaba donde estuviera —en el `<body>`,
 * fuera del diálogo— y el Tab siguiente se iba a la página de detrás.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "[tabindex]",
]
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(", ");

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
      // Sin nada enfocable dentro, o con el foco perdido fuera del
      // diálogo (un clic en el overlay, el control que lo tenía
      // desmontado), el ciclo de abajo no puede aplicarse: se vuelve a
      // entrar en el diálogo en vez de dejar tabular por la página de
      // detrás, que sigue ahí aunque `aria-modal` diga lo contrario.
      if (items.length === 0 || !container.contains(document.activeElement)) {
        event.preventDefault();
        (items[0] ?? container).focus();
        return;
      }
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
      const opener = previouslyFocused.current;
      // Quien abrió el diálogo puede haber desaparecido con la propia
      // acción (la fila de la tabla que se borra, el botón de una
      // sección que deja de pintarse): `focus()` sobre un nodo ya
      // desmontado no hace nada y el foco se queda en el `<body>`, así
      // que quien navega con teclado vuelve al principio de la página.
      // El `<main id="main-content" tabIndex={-1}>` de los layouts de
      // área es el mismo destino al que lleva «Saltar al contenido».
      if (opener && document.contains(opener)) {
        opener.focus();
        return;
      }
      (document.getElementById("main-content") ?? document.body).focus();
    };
  }, [active, containerRef]);
}
