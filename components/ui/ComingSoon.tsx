/**
 * Aviso «Próximamente» para las secciones del menú de entidad cuya
 * página real todavía no existe (tarea W4a: Comunicaciones, Encuestas,
 * Recursos y Familias, W4b). Solo lo ve `titular`/`moderador` — el resto
 * de roles las tiene ocultas del menú (`lib/auth/entidadMenu.ts`) y
 * recibe «Sin acceso» si navegan a la URL directamente.
 */
export interface ComingSoonProps {
  section: string;
}

export function ComingSoon({ section }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-base font-semibold text-text-base">Próximamente</p>
      <p className="text-sm text-text-secondary">
        {section} llega en una próxima tarea del panel. Todavía no hay nada que configurar aquí.
      </p>
    </div>
  );
}
