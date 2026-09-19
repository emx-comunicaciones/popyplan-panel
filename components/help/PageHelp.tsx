"use client";

/**
 * Botón de ayuda de la cabecera (tarea 2 de «ayuda por pantalla»):
 * un signo de interrogación junto a «Cerrar sesión» en los tres
 * layouts de área. Resuelve la pantalla actual con `usePathname()`
 * contra el registro de `lib/help/pageHelp.ts`; sin entrada para la
 * ruta (login, elegir-entidad, accesibilidad, la raíz…, decisión 3 del
 * plan) no pinta nada — esas rutas no tienen esta cabecera de todos
 * modos, pero el componente es defensivo por si se monta en otro sitio.
 *
 * Reutiliza `components/ui/Dialog.tsx` (foco atrapado, `Escape` cierra,
 * el foco vuelve al botón al cerrarse): este componente solo decide
 * cuándo mostrarlo y con qué texto, nunca duplica esa mecánica.
 */
import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";

import { Dialog } from "@/components/ui/Dialog";
import { matchPageHelp } from "@/lib/help/pageHelp";

export function PageHelp() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const entry = matchPageHelp(pathname);

  // Cambiar de pantalla (incluida una navegación atrás/adelante del
  // navegador, que no pasa por el propio botón) cierra el diálogo: si
  // no, se queda abierto mostrando ya la ayuda de la pantalla nueva,
  // como si nunca se hubiera navegado.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!entry) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Ayuda: ${entry.title}`}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-primary-700 font-semibold hover:bg-primary-100 focus-visible:outline-primary-700"
      >
        <span aria-hidden="true">?</span>
      </button>
      <Dialog
        open={open}
        titleId={titleId}
        title={entry.title}
        onClose={() => setOpen(false)}
        widthClassName="max-w-xl"
      >
        <p>{entry.summary}</p>
        <h3 className="mt-4 text-sm font-semibold text-text-base">Qué puedes hacer aquí</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-base">
          {entry.actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-text-secondary">
          <strong>Quién la ve:</strong> {entry.audience}
        </p>
      </Dialog>
    </>
  );
}
