import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border p-4 text-center">
      <p className="text-base font-semibold text-text-base">{title}</p>
      {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
      {action}
    </div>
  );
}
