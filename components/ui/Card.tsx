import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  children: ReactNode;
}

/*
 * Densidad (2026-09-20): relleno de 12px (`p-3`), borde de 1px y radio de
 * 8px (`rounded-lg`), **sin sombra** — la sombra sobre el fondo claro del
 * panel solo añadía peso visual; el borde ya separa la tarjeta del fondo.
 */
export function Card({ title, children, className = "", ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`rounded-lg border border-border bg-white p-3 ${className}`}
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
        <h2 className="mb-1 text-sm font-semibold text-text-secondary">{title}</h2>
      ) : null}
      {children}
    </div>
  );
}
