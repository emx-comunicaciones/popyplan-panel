import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

/*
 * Densidad (2026-09-20): 32px de alto (`min-h-8` + `py-1`, nunca menos —
 * es el objetivo interactivo mínimo del panel), 12px de relleno
 * horizontal y texto de 13px (`text-sm`, ver la escala de
 * `app/globals.css`). `min-h-` y no `h-`: un botón con texto largo que
 * pase a dos líneas crece en vez de recortar el texto.
 */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary-700 text-text-inverse hover:bg-secondary-600",
  secondary: "bg-white text-text-form border border-border hover:bg-border-light",
  danger: "bg-error text-text-inverse hover:opacity-90",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-8 items-center justify-center gap-2 rounded-md px-3 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}
