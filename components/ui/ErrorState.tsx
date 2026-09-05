import type { ReactNode } from "react";

export interface ErrorStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-error/30 bg-error/5 p-8 text-center">
      <p className="text-base font-semibold text-error">{title}</p>
      {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
      {action}
    </div>
  );
}
