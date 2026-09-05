import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  children: ReactNode;
}

export function Card({ title, children, className = "", ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`rounded-lg border border-border bg-white p-4 shadow-sm ${className}`}
    >
      {/*
        `<h2>`, no `<h3>` (fix de accesibilidad, tarea W6, hallazgo de
        `axe-core`, regla `heading-order`): toda página empieza en
        `<h1>` (el título de la sección del menú); un `Card` casi
        siempre cuelga directo de ese `<h1>` sin una `<h2>` de sección
        entre medias, así que un título de tarjeta en `<h3>` saltaba un
        nivel. `<h2>` nunca salta nivel (h1→h2 o h2→h2, ambos válidos)
        sea cual sea el contexto en el que se use esta tarjeta.
      */}
      {title ? (
        <h2 className="mb-2 text-sm font-semibold text-text-secondary">{title}</h2>
      ) : null}
      {children}
    </div>
  );
}
