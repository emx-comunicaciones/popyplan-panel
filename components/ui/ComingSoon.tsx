/**
 * Aviso «Próximamente» para las secciones del menú de entidad cuya
 * página real todavía no existe. Desde la tarea W4b solo queda Familias
 * (Comunicaciones, Encuestas y Recursos ya tienen página real). Solo lo
 * ve `titular`/`moderador` — el resto de roles la tiene oculta del menú
 * (`lib/auth/entidadMenu.ts::PENDING_SECTIONS`) y recibe «Sin acceso» si
 * navegan a la URL directamente.
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
