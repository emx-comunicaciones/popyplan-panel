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
      {title ? (
        <h3 className="mb-2 text-sm font-semibold text-text-secondary">{title}</h3>
      ) : null}
      {children}
    </div>
  );
}
