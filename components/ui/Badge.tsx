import type { HTMLAttributes } from "react";

export type BadgeTone = "neutral" | "success" | "error" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-card-light text-text-secondary",
  success: "bg-success/10 text-success",
  error: "bg-error/10 text-error",
  info: "bg-category-light text-text-form",
};

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
    />
  );
}
