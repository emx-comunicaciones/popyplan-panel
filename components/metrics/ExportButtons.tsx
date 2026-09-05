"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useExport, type ExportFormat, type ExportParams } from "@/hooks/useExport";

export interface ExportButtonsProps {
  params: Omit<ExportParams, "format">;
}

const ERROR_MESSAGES: Record<string, string> = {
  pdf_unavailable: "El informe en PDF no está disponible ahora mismo. Prueba con CSV o inténtalo más tarde.",
  forbidden: "No tienes permiso para exportar informes.",
  desconocido: "No se pudo generar el informe.",
};

/** Botones «Exportar CSV»/«Exportar PDF»: llaman a `useExport().mutate` con el `format` pulsado. */
export function ExportButtons({ params }: ExportButtonsProps) {
  const { mutate, isPending, error } = useExport();
  const [lastFormat, setLastFormat] = useState<ExportFormat | null>(null);

  function handleExport(format: ExportFormat) {
    setLastFormat(format);
    mutate({ ...params, format });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => handleExport("csv")} disabled={isPending}>
          {isPending && lastFormat === "csv" ? "Exportando…" : "Exportar CSV"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleExport("pdf")}
          disabled={isPending}
        >
          {isPending && lastFormat === "pdf" ? "Exportando…" : "Exportar PDF"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {ERROR_MESSAGES[error.kind] ?? ERROR_MESSAGES.desconocido}
        </p>
      ) : null}
    </div>
  );
}
