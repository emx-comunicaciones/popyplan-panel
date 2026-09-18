"use client";

/**
 * Retarda la publicación de un valor que cambia tecla a tecla (tarea 9
 * del plan de corrección, hallazgo B11): el `<input>` sigue siendo
 * controlado e inmediato (quien escribe ve su texto al momento), pero el
 * valor que llega a la query solo se actualiza cuando pasan `delayMs`
 * sin más cambios — así escribir «ana» dispara una petición y no tres.
 *
 * Los buscadores y filtros de texto/fecha del panel lo usan alrededor de
 * su propio estado (`components/entidad/PersonasTable.tsx`,
 * `components/plataforma/{EntidadesTable,AuditoriaPanel,RolesPanel}.tsx`);
 * los `<select>` no, porque cambian de golpe (un solo evento por
 * elección) y retrasarlos solo añadiría latencia.
 */
import { useEffect, useState } from "react";

const DEFAULT_DELAY_MS = 300;

export function useDebouncedValue<T>(value: T, delayMs: number = DEFAULT_DELAY_MS): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    // Cada cambio reinicia el reloj y, al desmontar, no queda ningún
    // `setDebounced` pendiente sobre un componente que ya no existe.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
